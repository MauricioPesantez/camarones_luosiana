import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  OrdenInvalidaError,
  StockInsuficienteError,
  notificarNuevaOrden,
  prepararOrden,
  registrarOrden,
} from '@/lib/order-creation';
import {
  enlaceDePin,
  textoActualizacionUbicacion,
  textoConfirmacion,
  textoConflicto,
  textoOrdenesSinUbicacion,
  textoPendienteAprobacion,
  textoRecordatorio,
  textoReenvio,
  textoUbicacionGuardada,
} from '@/lib/whatsapp-mensajes';
import {
  ItemResuelto,
  PedidoWhatsapp,
  hashPedido,
  interpretarPedido,
  resolverProductos,
} from '@/lib/whatsapp-pedido';
import { avisoDeDelivery, salidasDeOrdenAceptada } from '@/lib/whatsapp-salidas';
import { ConfiguracionWhatsapp, MensajeEntrante, leerCoordenadas } from '@/lib/whatsapp-webhook';
import type { AuthenticatedUser } from '@/lib/session';
import type { CrearOrdenRequest, MetodoPago } from '@/types/orden';

const VIGENCIA_ENTRADA_MS = 15 * 60 * 1000;
const VENTANA_REENVIO_MS = 30 * 60 * 1000;
const MAX_TEXTO_GUARDADO = 4000;
const MAX_ERROR_GUARDADO = 500;
// El gateway espera diez segundos antes de reintentar.
const TIMEOUT_TRANSACCION_MS = 8000;

type OrdenRegistrada = Awaited<ReturnType<typeof registrarOrden>>['orden'];

interface Evaluacion {
  estado: string;
  error?: string;
  datosNormalizados?: unknown;
  requestHash?: string;
  ordenId?: string;
  respuesta?: string;
  salidas?: Prisma.WhatsappSalidaUncheckedCreateInput[];
  ordenCreada?: OrdenRegistrada;
}

interface Contexto {
  tx: Prisma.TransactionClient;
  mensaje: MensajeEntrante;
  actor: AuthenticatedUser;
  config: ConfiguracionWhatsapp;
  requestUrl: string;
  ahora: Date;
  vigenteDesde: Date;
}

function rechazoDePedido(errores: string[]): Evaluacion {
  return {
    estado: 'INVALIDA',
    error: errores.join('; ').slice(0, MAX_ERROR_GUARDADO),
    respuesta: `Pedido no registrado. Corrige:\n${errores.map((error) => `- ${error}`).join('\n')}`,
  };
}

function buscarOrdenDelCliente(tx: Prisma.TransactionClient, pedido: PedidoWhatsapp, desde: Date) {
  const cliente: Prisma.OrdenWhereInput = pedido.telefono
    ? { telefonoCliente: { in: [pedido.telefono, `0${pedido.telefono.slice(4)}`] } }
    : { nombreCliente: { equals: pedido.cliente ?? '', mode: 'insensitive' } };
  return tx.orden.findFirst({
    where: {
      ...cliente,
      tipoOperacion: 'VENTA_CLIENTE',
      tipoOrden: pedido.tipoOrden,
      anulada: false,
      estado: { not: 'cancelada' },
      createdAt: { gte: desde },
    },
    orderBy: { createdAt: 'desc' },
    select: { numeroDiario: true, fechaNumeroDiario: true },
  });
}

function construirSolicitud(
  pedido: PedidoWhatsapp,
  items: ItemResuelto[],
  actor: AuthenticatedUser,
): CrearOrdenRequest {
  const domicilio = pedido.tipoOrden === 'domicilio';
  const pagada = pedido.pago === 'transferencia_confirmada';
  const metodoPagoPrevisto: MetodoPago | undefined = pagada
    ? 'transferencia'
    : domicilio ? 'efectivo' : undefined;
  return {
    tipoOrden: pedido.tipoOrden,
    nombreCliente: pedido.cliente ?? undefined,
    telefonoCliente: pedido.telefono ?? undefined,
    costoEnvio: pedido.envio ?? undefined,
    metodoPagoPrevisto,
    transferenciaConfirmada: pagada,
    ubicacionUrl: pedido.ubicacionUrl ?? undefined,
    observaciones: pedido.observaciones ?? undefined,
    solicitarAprobacion: pedido.solicitarAprobacion,
    mesero: actor.nombre,
    items: items.map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      // El servicio siempre usa el precio del catálogo.
      precioUnitario: 0,
      observaciones: item.observaciones ?? undefined,
      nivelPicante: item.nivelPicante ?? undefined,
    })),
  };
}

async function evaluarPedido(contexto: Contexto): Promise<Evaluacion> {
  const { tx, mensaje, actor, config, requestUrl, ahora, vigenteDesde } = contexto;

  const interpretado = interpretarPedido(mensaje.texto ?? '');
  if (!interpretado.ok) return rechazoDePedido(interpretado.errores);
  const { pedido } = interpretado;
  const requestHash = hashPedido(pedido);
  const ventana = new Date(ahora.getTime() - VENTANA_REENVIO_MS);

  // Antes que antigüedad o stock: un pedido ya conocido se reconoce aunque hayan cambiado.
  const previa = await tx.whatsappEntrada.findFirst({
    where: { requestHash, ordenId: { not: null }, recibidaAt: { gte: ventana } },
    orderBy: { recibidaAt: 'desc' },
    select: { orden: true },
  });
  if (previa?.orden) {
    return {
      estado: 'IGNORADA',
      error: 'REENVIO',
      requestHash,
      ordenId: previa.orden.id,
      respuesta: textoReenvio(previa.orden),
    };
  }

  if (mensaje.enviadoAt < vigenteDesde) {
    return {
      estado: 'REQUIERE_REVISION',
      error: 'ENTRADA_ANTIGUA',
      respuesta: 'Este pedido llegó tarde y quedó en revisión. No se creó ninguna orden: verifica en el POS antes de reenviarlo.',
    };
  }

  if (!pedido.nuevoPedido) {
    const otra = await buscarOrdenDelCliente(tx, pedido, ventana);
    if (otra) {
      return { estado: 'INVALIDA', error: 'CONFLICTO_CLIENTE', respuesta: textoConflicto(otra) };
    }
  }

  const catalogo = await tx.producto.findMany({
    select: { id: true, nombre: true, categoria: true, disponible: true },
  });
  const productos = resolverProductos(pedido.items, catalogo);
  if (!productos.ok) return rechazoDePedido(productos.errores);

  const solicitud = construirSolicitud(pedido, productos.items, actor);
  let preparada: Awaited<ReturnType<typeof prepararOrden>>;
  try {
    preparada = await prepararOrden(actor, solicitud, requestUrl, tx);
  } catch (error) {
    if (error instanceof OrdenInvalidaError || error instanceof StockInsuficienteError) {
      return rechazoDePedido([error.message]);
    }
    throw error;
  }

  // Un StockConflictError revierte todo y el gateway reintenta contra el stock real.
  const { orden, printJobQueued } = await registrarOrden(tx, preparada);

  const aceptada = orden.estado === 'pendiente';
  const avisoDelivery = avisoDeDelivery(orden, ahora, pedido.esperaMotoMin);
  return {
    estado: 'CREADA',
    requestHash,
    ordenId: orden.id,
    datosNormalizados: { pedido, items: productos.items },
    respuesta: aceptada
      ? textoConfirmacion(orden, { impresionEnCola: printJobQueued, avisoDelivery })
      : textoPendienteAprobacion(orden),
    salidas: aceptada ? salidasDeOrdenAceptada(orden, mensaje.sessionId, config, ahora, pedido.esperaMotoMin) : [],
    ordenCreada: orden,
  };
}

/** El pin llega después del pedido: va a la única orden reciente sin ubicación del operador. */
async function evaluarPin(contexto: Contexto): Promise<Evaluacion> {
  const { tx, mensaje, actor, config, vigenteDesde } = contexto;
  if (mensaje.enviadoAt < vigenteDesde) {
    return {
      estado: 'IGNORADA',
      error: 'ENTRADA_ANTIGUA',
      respuesta: 'Esta ubicación llegó tarde. Complétala desde el POS.',
    };
  }

  const coordenadas = leerCoordenadas(mensaje.location);
  if (!coordenadas) {
    return {
      estado: 'INVALIDA',
      error: 'COORDENADAS_INVALIDAS',
      respuesta: 'Ubicación no válida. Reenvía el pin del cliente.',
    };
  }

  const entradas = await tx.whatsappEntrada.findMany({
    where: {
      remitente: mensaje.remitente,
      tipo: 'PEDIDO',
      estado: 'CREADA',
      recibidaAt: { gte: vigenteDesde },
      orden: {
        tipoOrden: 'domicilio',
        ubicacionUrl: null,
        anulada: false,
        estado: { not: 'cancelada' },
      },
    },
    select: { orden: true },
  });
  const ordenes = entradas.flatMap((entrada) => (entrada.orden ? [entrada.orden] : []));
  if (ordenes.length > 1) {
    return { estado: 'INVALIDA', error: 'ORDEN_AMBIGUA', respuesta: textoOrdenesSinUbicacion(ordenes) };
  }
  const orden = ordenes[0];
  if (!orden) {
    return {
      estado: 'IGNORADA',
      error: 'SIN_ORDEN_PENDIENTE',
      respuesta: 'Ubicación no guardada: envíala después del pedido o complétala desde el POS.',
    };
  }

  const ubicacionUrl = enlaceDePin(coordenadas);
  const { count } = await tx.orden.updateMany({
    where: { id: orden.id, ubicacionUrl: null },
    data: { ubicacionUrl },
  });
  if (count !== 1) {
    return {
      estado: 'IGNORADA',
      error: 'SIN_ORDEN_PENDIENTE',
      respuesta: 'Ubicación no guardada: la orden ya tiene una. Revísala desde el POS.',
    };
  }

  await tx.historialOrden.create({
    data: {
      ordenId: orden.id,
      tipoAccion: 'ubicacion_actualizada',
      descripcion: 'Ubicación de entrega recibida por WhatsApp',
      datosAntes: { ubicacionUrl: null },
      datosDespues: { ubicacionUrl },
      usuarioNombre: actor.nombre,
      usuarioRol: actor.rol,
      diferenciaTotal: 0,
    },
  });

  const actualizada = { ...orden, ubicacionUrl };
  // Un recordatorio sin intentar aún puede cambiar de texto; uno intentado no.
  await tx.whatsappSalida.updateMany({
    where: { ordenId: orden.id, tipo: 'RECORDATORIO_DELIVERY', estado: 'PENDIENTE', intentos: 0 },
    data: { texto: textoRecordatorio(actualizada) },
  });

  const publicada = orden.estado !== 'pendiente_aprobacion_stock';
  return {
    estado: 'UBICACION_USADA',
    ordenId: orden.id,
    datosNormalizados: coordenadas,
    respuesta: textoUbicacionGuardada(actualizada),
    salidas: publicada ? [{
      sessionId: mensaje.sessionId,
      ordenId: orden.id,
      tipo: 'ACTUALIZACION_GRUPO',
      destino: config.grupoChatId,
      texto: textoActualizacionUbicacion(actualizada),
      clave: `ubicacion:${mensaje.messageId}`,
    }] : [],
  };
}

/** Entrada, orden, efectos comerciales y salidas se confirman juntos. Repetir un mensaje no tiene efectos. */
export async function procesarMensaje(
  mensaje: MensajeEntrante,
  config: ConfiguracionWhatsapp,
  requestUrl: string,
  ahora = new Date(),
): Promise<'procesado' | 'duplicado'> {
  const vigenteDesde = new Date(ahora.getTime() - VIGENCIA_ENTRADA_MS);

  let ordenCreada: OrdenRegistrada | undefined;
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // Dos mensajes del operador no se evalúan a la vez: ven el pin y la orden del anterior.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${mensaje.remitente}))`;

      const repetida = await tx.whatsappEntrada.findUnique({
        where: { sessionId_messageId: { sessionId: mensaje.sessionId, messageId: mensaje.messageId } },
        select: { id: true },
      });
      if (repetida) return 'duplicado' as const;

      const usuario = await tx.usuario.findUnique({
        where: { id: config.usuarioOperadorId },
        select: { id: true, nombre: true, rol: true, activo: true },
      });
      const actor = usuario?.activo === true && usuario.rol === 'digital' ? usuario : null;

      let evaluacion: Evaluacion;
      if (!actor) {
        evaluacion = { estado: 'IGNORADA', error: 'OPERADOR_NO_AUTORIZADO' };
      } else if (!config.habilitado) {
        evaluacion = { estado: 'REQUIERE_REVISION', error: 'SUSPENDIDO' };
      } else {
        const contexto = { tx, mensaje, actor, config, requestUrl, ahora, vigenteDesde };
        evaluacion = await (mensaje.tipo === 'PEDIDO' ? evaluarPedido : evaluarPin)(contexto);
      }

      const entrada = await tx.whatsappEntrada.create({
        data: {
          tipo: mensaje.tipo,
          sessionId: mensaje.sessionId,
          messageId: mensaje.messageId,
          claveEntrega: mensaje.claveEntrega,
          remitente: mensaje.remitente,
          usuarioId: actor?.id ?? null,
          enviadoAt: mensaje.enviadoAt,
          texto: mensaje.texto?.slice(0, MAX_TEXTO_GUARDADO) ?? null,
          datosNormalizados: evaluacion.datosNormalizados as Prisma.InputJsonValue | undefined,
          requestHash: evaluacion.requestHash,
          estado: evaluacion.estado,
          ordenId: evaluacion.ordenId,
          error: evaluacion.error,
        },
        select: { id: true },
      });

      const salidas = (evaluacion.salidas ?? []).map((salida) => ({ ...salida, entradaId: entrada.id }));
      if (evaluacion.respuesta) {
        salidas.push({
          sessionId: mensaje.sessionId,
          ordenId: evaluacion.ordenId,
          entradaId: entrada.id,
          tipo: 'RESPUESTA_EMPLEADO',
          destino: mensaje.chatId,
          texto: evaluacion.respuesta,
          clave: `respuesta:${entrada.id}`,
        });
      }
      if (salidas.length > 0) await tx.whatsappSalida.createMany({ data: salidas });

      ordenCreada = evaluacion.ordenCreada;
      return 'procesado' as const;
    }, { timeout: TIMEOUT_TRANSACCION_MS });

    if (ordenCreada?.estado === 'pendiente') {
      try {
        notificarNuevaOrden(ordenCreada);
      } catch (error) {
        // La cocina también consulta por polling; la orden ya existe.
        console.error('Error al notificar orden de WhatsApp:', error instanceof Error ? error.name : 'desconocido');
      }
    }
    return resultado;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return 'duplicado';
    }
    throw error;
  }
}
