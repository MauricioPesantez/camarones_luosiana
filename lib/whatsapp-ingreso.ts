import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPedido, interpretarPlantilla, resolverProductos } from '@/lib/whatsapp-pedido';
import { ConfiguracionWhatsapp, MensajeEntrante, leerCoordenadas } from '@/lib/whatsapp-webhook';

const VIGENCIA_ENTRADA_MS = 15 * 60 * 1000;
const MAX_TEXTO_GUARDADO = 4000;
const MAX_ERROR_GUARDADO = 500;

interface Evaluacion {
  estado: string;
  error?: string;
  datosNormalizados?: unknown;
  requestHash?: string;
  respuesta?: string;
}

function rechazoDePedido(errores: string[]): Evaluacion {
  return {
    estado: 'INVALIDA',
    error: errores.join('; ').slice(0, MAX_ERROR_GUARDADO),
    respuesta: `PEDIDO no registrado. Corrige:\n${errores.map((error) => `- ${error}`).join('\n')}`,
  };
}

async function evaluarPedido(
  tx: Prisma.TransactionClient,
  mensaje: MensajeEntrante,
  vigenteDesde: Date,
): Promise<Evaluacion> {
  if (mensaje.enviadoAt < vigenteDesde) {
    return {
      estado: 'REQUIERE_REVISION',
      error: 'ENTRADA_ANTIGUA',
      respuesta: 'Este PEDIDO llegó tarde y quedó en revisión. No se creó ninguna orden: verifica en el POS antes de reenviarlo.',
    };
  }

  const plantilla = interpretarPlantilla(mensaje.texto ?? '');
  if (!plantilla.ok) return rechazoDePedido(plantilla.errores);

  const catalogo = await tx.producto.findMany({
    select: { id: true, nombre: true, categoria: true, disponible: true },
  });
  const productos = resolverProductos(plantilla.pedido.items, catalogo);
  if (!productos.ok) return rechazoDePedido(productos.errores);

  if (plantilla.pedido.ubicacion?.tipo === 'pin') {
    const pin = await tx.whatsappEntrada.findFirst({
      where: {
        remitente: mensaje.remitente,
        tipo: 'UBICACION',
        estado: 'UBICACION_DISPONIBLE',
        enviadoAt: { gte: vigenteDesde },
      },
      orderBy: { enviadoAt: 'desc' },
      select: { id: true },
    });
    if (!pin) {
      return {
        estado: 'INVALIDA',
        error: 'SIN_PIN_VIGENTE',
        respuesta: 'PEDIDO no registrado: no hay un pin vigente. Reenvía la ubicación y luego el PEDIDO.',
      };
    }
  }

  // shortcut: esta fase no crea órdenes; la Fase 4 reemplaza este resultado por la creación.
  return {
    estado: 'REQUIERE_REVISION',
    error: 'CREACION_PENDIENTE',
    requestHash: hashPedido(plantilla.pedido),
    datosNormalizados: { pedido: plantilla.pedido, items: productos.items },
    respuesta: 'PEDIDO válido, pero aún no se crean órdenes por WhatsApp. Regístralo en el POS.',
  };
}

async function evaluarPin(
  tx: Prisma.TransactionClient,
  mensaje: MensajeEntrante,
  vigenteDesde: Date,
): Promise<Evaluacion> {
  if (mensaje.enviadoAt < vigenteDesde) {
    return {
      estado: 'IGNORADA',
      error: 'ENTRADA_ANTIGUA',
      respuesta: 'Esta ubicación llegó tarde. Reenvíala antes del PEDIDO.',
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

  await tx.whatsappEntrada.updateMany({
    where: { remitente: mensaje.remitente, tipo: 'UBICACION', estado: 'UBICACION_DISPONIBLE' },
    data: { estado: 'IGNORADA' },
  });
  return {
    estado: 'UBICACION_DISPONIBLE',
    datosNormalizados: coordenadas,
    respuesta: 'Ubicación recibida. Se usará en el próximo PEDIDO.',
  };
}

/** Guarda el mensaje y su respuesta en una transacción. Repetir un mensaje no tiene efectos. */
export async function procesarMensaje(
  mensaje: MensajeEntrante,
  config: ConfiguracionWhatsapp,
  ahora = new Date(),
): Promise<'procesado' | 'duplicado'> {
  const vigenteDesde = new Date(ahora.getTime() - VIGENCIA_ENTRADA_MS);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${mensaje.remitente}))`;

      const usuario = await tx.usuario.findUnique({
        where: { id: config.usuarioOperadorId },
        select: { id: true, rol: true, activo: true },
      });
      const autorizado = usuario?.activo === true && usuario.rol === 'digital';

      let evaluacion: Evaluacion;
      if (!autorizado) {
        evaluacion = { estado: 'IGNORADA', error: 'OPERADOR_NO_AUTORIZADO' };
      } else if (!config.habilitado) {
        evaluacion = { estado: 'REQUIERE_REVISION', error: 'SUSPENDIDO' };
      } else if (mensaje.tipo === 'PEDIDO') {
        evaluacion = await evaluarPedido(tx, mensaje, vigenteDesde);
      } else {
        evaluacion = await evaluarPin(tx, mensaje, vigenteDesde);
      }

      const entrada = await tx.whatsappEntrada.create({
        data: {
          tipo: mensaje.tipo,
          sessionId: mensaje.sessionId,
          messageId: mensaje.messageId,
          claveEntrega: mensaje.claveEntrega,
          remitente: mensaje.remitente,
          usuarioId: autorizado ? usuario.id : null,
          enviadoAt: mensaje.enviadoAt,
          texto: mensaje.texto?.slice(0, MAX_TEXTO_GUARDADO) ?? null,
          datosNormalizados: evaluacion.datosNormalizados as Prisma.InputJsonValue | undefined,
          requestHash: evaluacion.requestHash,
          estado: evaluacion.estado,
          error: evaluacion.error,
        },
        select: { id: true },
      });

      if (evaluacion.respuesta) {
        await tx.whatsappSalida.create({
          data: {
            sessionId: mensaje.sessionId,
            entradaId: entrada.id,
            tipo: 'RESPUESTA_EMPLEADO',
            destino: mensaje.chatId,
            texto: evaluacion.respuesta,
            clave: `respuesta:${entrada.id}`,
          },
        });
      }
    });
    return 'procesado';
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return 'duplicado';
    }
    throw error;
  }
}
