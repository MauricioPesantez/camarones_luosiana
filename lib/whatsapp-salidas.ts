import type { Prisma } from '@prisma/client';
import {
  OrdenPublicable,
  textoConfirmacion,
  textoPublicacion,
  textoRechazo,
  textoRecordatorio,
} from '@/lib/whatsapp-mensajes';
import type { PedidoWhatsapp } from '@/lib/whatsapp-pedido';
import { ConfiguracionWhatsapp, leerConfiguracion } from '@/lib/whatsapp-webhook';

const ESPERA_DELIVERY_MIN = 10;
const LIMITE_RECORDATORIO_MS = 30 * 60 * 1000;

type OrdenConId = OrdenPublicable & { id: string };
type Destinos = Pick<ConfiguracionWhatsapp, 'grupoChatId' | 'localChatId'>;

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
      destino: destinos.localChatId,
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
