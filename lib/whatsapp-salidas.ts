import type { Prisma } from '@prisma/client';
import {
  Encabezado,
  OrdenPublicable,
  PedidoMoto,
  textoActualizacionUbicacion,
  textoAnulacion,
  textoConfirmacion,
  textoPublicacion,
  textoRechazo,
  textoRecordatorio,
} from '@/lib/whatsapp-mensajes';
import type { PedidoWhatsapp } from '@/lib/whatsapp-pedido';
import { ConfiguracionWhatsapp, leerConfiguracion } from '@/lib/whatsapp-webhook';

const ESPERA_DELIVERY_MIN = 10;
const SIN_SALIR = ['PENDIENTE', 'REINTENTO'];
const MENSAJES_DE_ORDEN = ['PUBLICACION_GRUPO', 'ACTUALIZACION_GRUPO', 'RECORDATORIO_DELIVERY'];
const LIMITE_RECORDATORIO_MS = 30 * 60 * 1000;

type OrdenConId = OrdenPublicable & { id: string };
type Destinos = Pick<ConfiguracionWhatsapp, 'grupoChatId' | 'motosChatId'>;

/** Cuenta desde que el POS acepta la orden para preparación; el pedido puede fijar otra espera. */
export function avisoDeDelivery(
  orden: Pick<OrdenPublicable, 'tipoOrden'>,
  ahora: Date,
  esperaMin?: number | null,
): Date | null {
  if (orden.tipoOrden !== 'domicilio') return null;
  return new Date(ahora.getTime() + (esperaMin ?? ESPERA_DELIVERY_MIN) * 60 * 1000);
}

/** Publicación y recordatorio de una orden aceptada; se guardan con la transacción que la acepta. */
export function salidasDeOrdenAceptada(
  orden: OrdenConId,
  sessionId: string,
  destinos: Destinos,
  ahora: Date,
  esperaMin?: number | null,
): Prisma.WhatsappSalidaUncheckedCreateInput[] {
  const salidas: Prisma.WhatsappSalidaUncheckedCreateInput[] = [{
    sessionId,
    ordenId: orden.id,
    tipo: 'PUBLICACION_GRUPO',
    destino: destinos.grupoChatId,
    texto: textoPublicacion(orden),
    clave: `publicacion:${orden.id}`,
  }];

  const aviso = avisoDeDelivery(orden, ahora, esperaMin);
  if (aviso) {
    salidas.push({
      sessionId,
      ordenId: orden.id,
      tipo: 'RECORDATORIO_DELIVERY',
      destino: destinos.motosChatId,
      texto: textoRecordatorio(orden),
      clave: `recordatorio:${orden.id}`,
      disponibleAt: aviso,
      venceAt: new Date(aviso.getTime() + LIMITE_RECORDATORIO_MS),
    });
  }
  return salidas;
}

async function entradaDeOrden(tx: Prisma.TransactionClient, ordenId: string) {
  const entrada = await tx.whatsappEntrada.findFirst({
    where: { ordenId, estado: 'CREADA' },
    select: { id: true, sessionId: true, remitente: true, datosNormalizados: true },
  });
  if (!entrada) return null;

  const config = leerConfiguracion(process.env);
  if (!config) {
    console.error('Orden de WhatsApp sin configuración para avisar:', ordenId);
    return null;
  }
  return { entrada, config };
}

/** Solo órdenes nacidas por WhatsApp: una orden manual no genera salidas. */
export async function registrarAprobacionWhatsapp(
  tx: Prisma.TransactionClient,
  orden: OrdenConId,
  impresionEnCola: boolean,
  ahora: Date,
): Promise<void> {
  const origen = await entradaDeOrden(tx, orden.id);
  if (!origen) return;

  const { entrada, config } = origen;
  // La línea moto del pedido sigue vigente aunque la aprobación llegue después.
  const datos = entrada.datosNormalizados as { pedido?: Pick<PedidoWhatsapp, 'esperaMotoMin'> } | null;
  const esperaMin = datos?.pedido?.esperaMotoMin;
  const salidas = salidasDeOrdenAceptada(orden, entrada.sessionId, config, ahora, esperaMin);
  salidas.push({
    sessionId: entrada.sessionId,
    ordenId: orden.id,
    entradaId: entrada.id,
    tipo: 'RESPUESTA_EMPLEADO',
    destino: entrada.remitente,
    texto: textoConfirmacion(orden, { impresionEnCola, avisoDelivery: avisoDeDelivery(orden, ahora, esperaMin) }),
    clave: `aprobacion:${orden.id}`,
  });
  await tx.whatsappSalida.createMany({ data: salidas });
}

export async function registrarRechazoWhatsapp(
  tx: Prisma.TransactionClient,
  orden: Pick<OrdenConId, 'id' | 'numeroDiario' | 'fechaNumeroDiario'>,
  razon: string | null | undefined,
): Promise<void> {
  const origen = await entradaDeOrden(tx, orden.id);
  if (!origen) return;

  await tx.whatsappSalida.create({
    data: {
      sessionId: origen.entrada.sessionId,
      ordenId: orden.id,
      entradaId: origen.entrada.id,
      tipo: 'RESPUESTA_EMPLEADO',
      destino: origen.entrada.remitente,
      texto: textoRechazo(orden, razon),
      clave: `rechazo:${orden.id}`,
    },
  });
}

/**
 * Un cambio sale como mensaje nuevo al grupo y, si la moto ya se pidió, también a Motos
 * (con `textoMotos` si lo que le importa es otro). Una orden nunca publicada no genera nada.
 */
export async function registrarCambioWhatsapp(
  tx: Prisma.TransactionClient,
  ordenId: string,
  clave: string,
  texto: string,
  textoMotos = texto,
): Promise<void> {
  const previas = await tx.whatsappSalida.findMany({
    where: {
      ordenId,
      estado: { not: 'CANCELADA' },
      OR: [{ tipo: 'PUBLICACION_GRUPO' }, { tipo: 'RECORDATORIO_DELIVERY', intentos: { gt: 0 } }],
    },
    select: { tipo: true, sessionId: true, destino: true },
  });
  if (previas.length === 0) return;
  await tx.whatsappSalida.createMany({
    data: previas.map(({ tipo, sessionId, destino }) => ({
      sessionId,
      destino,
      ordenId,
      tipo: 'ACTUALIZACION_GRUPO',
      ...(tipo === 'PUBLICACION_GRUPO' ? { texto, clave } : { texto: textoMotos, clave: `${clave}:motos` }),
    })),
  });
}

/** Con delivery pedido o la orden anulada, el aviso de moto que no salió ya no aplica. */
export function cancelarRecordatorios(tx: Prisma.TransactionClient, ordenId: string, motivo: string) {
  return tx.whatsappSalida.updateMany({
    where: { ordenId, tipo: 'RECORDATORIO_DELIVERY', estado: { in: SIN_SALIR } },
    data: { estado: 'CANCELADA', ultimoError: motivo },
  });
}

/** Un aviso de moto aún sin intentar toma los datos actuales; uno intentado conserva su texto. */
export function refrescarRecordatorio(tx: Prisma.TransactionClient, orden: PedidoMoto & { id: string }) {
  return tx.whatsappSalida.updateMany({
    where: { ordenId: orden.id, tipo: 'RECORDATORIO_DELIVERY', estado: 'PENDIENTE', intentos: 0 },
    data: { texto: textoRecordatorio(orden) },
  });
}

/** Lo que nadie intentó enviar se cancela; quien pudo ver la orden (grupo o Motos) recibe la anulación. */
export async function registrarAnulacionWhatsapp(
  tx: Prisma.TransactionClient,
  orden: Encabezado & { id: string },
): Promise<void> {
  await tx.whatsappSalida.updateMany({
    where: { ordenId: orden.id, tipo: { in: MENSAJES_DE_ORDEN }, estado: 'PENDIENTE', intentos: 0 },
    data: { estado: 'CANCELADA', ultimoError: 'ORDEN_ANULADA' },
  });
  // Antes de cancelar un aviso en reintento: pudo haber llegado a Motos.
  await registrarCambioWhatsapp(tx, orden.id, `anulacion:${orden.id}`, textoAnulacion(orden));
  await cancelarRecordatorios(tx, orden.id, 'ORDEN_ANULADA');
}

export async function registrarUbicacionWhatsapp(
  tx: Prisma.TransactionClient,
  orden: PedidoMoto & { id: string },
  historialId: string,
): Promise<void> {
  await refrescarRecordatorio(tx, orden);
  await registrarCambioWhatsapp(tx, orden.id, `ubicacion:${historialId}`, textoActualizacionUbicacion(orden));
}

export type ResultadoProgramarMoto = 'encolada' | 'en_curso' | 'ya_enviada' | 'sin_configuracion';

export type AvisoMoto = { estado: string; disponibleAt: Date } | null;

/** Estado del aviso a Motos de una orden; null si nunca se programó. */
export function leerAvisoMoto(db: Pick<Prisma.TransactionClient, 'whatsappSalida'>, ordenId: string): Promise<AvisoMoto> {
  return db.whatsappSalida.findUnique({
    where: { clave: `recordatorio:${ordenId}` },
    select: { estado: true, disponibleAt: true },
  });
}

/**
 * Pide la moto a una hora (ahora o más tarde): mueve o crea el aviso a Motos.
 * Uno ya enviado o en envío no se toca; al enviarse, el agente marca la orden.
 */
export async function programarAvisoMoto(
  tx: Prisma.TransactionClient,
  orden: PedidoMoto & { id: string },
  disponibleAt: Date,
): Promise<ResultadoProgramarMoto> {
  const config = leerConfiguracion(process.env);
  if (!config) return 'sin_configuracion';

  const clave = `recordatorio:${orden.id}`;
  const fresca = {
    sessionId: config.sessionId,
    destino: config.motosChatId,
    texto: textoRecordatorio(orden),
    disponibleAt,
    venceAt: new Date(disponibleAt.getTime() + LIMITE_RECORDATORIO_MS),
  };
  const actual = await tx.whatsappSalida.findUnique({ where: { clave }, select: { estado: true, intentos: true } });
  if (!actual) {
    await tx.whatsappSalida.create({ data: { ...fresca, ordenId: orden.id, tipo: 'RECORDATORIO_DELIVERY', clave } });
    return 'encolada';
  }
  if (actual.estado === 'ENVIADA') return 'ya_enviada';
  if (actual.estado === 'PROCESANDO') return 'en_curso';
  if (SIN_SALIR.includes(actual.estado)) {
    // Uno ya intentado conserva su texto (pudo llegar); solo cambia la hora.
    await tx.whatsappSalida.update({
      where: { clave },
      data: actual.intentos === 0 ? fresca : { disponibleAt, venceAt: fresca.venceAt },
    });
    return 'encolada';
  }
  // CANCELADA o REQUIERE_REVISION: alguien la pide de nuevo a propósito.
  await tx.whatsappSalida.update({
    where: { clave },
    data: {
      ...fresca, estado: 'PENDIENTE', intentos: 0, ultimoError: null, mensajeId: null,
      reservaToken: null, reservaExpiraAt: null, revisadaPor: null, revisadaAt: null,
    },
  });
  return 'encolada';
}
