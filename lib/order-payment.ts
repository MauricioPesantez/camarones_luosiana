import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { parseComprobanteKey } from '@/lib/comprobantes';
import { objectExists } from '@/lib/storage';
import { canCollectPayments, type AuthenticatedUser } from '@/lib/session';
import { calcularMovimientosCobro } from '@/types/cobro';
import { esMetodoPago, type MetodoPago } from '@/types/orden';

export class PaymentConflictError extends Error {}
export class PaymentValidationError extends Error {}
export class PaymentNotFoundError extends Error {}
export class PaymentForbiddenError extends Error {}

const ORDER_WITH_ITEMS = {
  items: { include: { producto: true } },
} satisfies Prisma.OrdenInclude;

// El cobro no depende de quién creó la orden: cualquier rol habilitado para cobrar
// puede cerrar el pago de cualquier orden (turnos, relevos, caja compartida).
export function canUserCollectOrder(user: AuthenticatedUser): boolean {
  return canCollectPayments(user);
}

// Modificar los items de una orden sí sigue reservado a su creador (o al admin):
// editar productos de una orden ajena es una acción distinta a cobrarla.
export function canUserModifyOrder(
  user: AuthenticatedUser,
  order: { creadorId?: string | null; mesero: string },
): boolean {
  return (
    user.rol === 'admin' ||
    order.creadorId === user.id ||
    (!order.creadorId && order.mesero === user.nombre)
  );
}

function validateOrderCanBePaid(order: {
  cobrada: boolean;
  anulada: boolean;
  estado: string;
  tipoOrden: string;
  printRevision: number;
}, expectedRevision: number, origen: 'qr' | 'lista'): void {
  if (order.cobrada) throw new PaymentConflictError('Esta orden ya fue cobrada');
  // Una orden anulada salio del cuadre: cobrarla volveria a meterla.
  if (order.anulada) {
    throw new PaymentValidationError('No se puede cobrar una orden anulada');
  }
  if (order.estado === 'cancelada') {
    throw new PaymentValidationError('No se puede cobrar una orden cancelada');
  }
  if (order.estado === 'pendiente_aprobacion_stock') {
    throw new PaymentValidationError(
      'La orden debe ser aprobada por stock antes de poder cobrarla',
    );
  }
  if (order.printRevision !== expectedRevision) {
    throw new PaymentConflictError(
      'La orden cambió. Recárgala y confirma el total actualizado.',
    );
  }
  // El cobro por enlace (QR) puede cerrar el pago en cualquier estado operativo:
  // basta con que la orden exista, no esté cobrada, cancelada ni pendiente de stock.
  // El cobro desde la lista interna mantiene la regla de mesa lista/entregada.
  if (origen === 'lista') {
    const esLocal = !order.tipoOrden || order.tipoOrden === 'local';
    if (esLocal && !['lista', 'entregada', 'cobrada'].includes(order.estado)) {
      throw new PaymentValidationError(
        'Las órdenes de mesa solo se pueden cobrar cuando estén listas o entregadas',
      );
    }
  }
}

export async function collectOrderPayment(input: {
  orderId: string;
  metodoPago: MetodoPago;
  expectedRevision: number;
  idempotencyKey: string;
  origen: 'qr' | 'lista';
  user: AuthenticatedUser;
  comprobanteTransferenciaKey?: string | null;
}) {
  if (!esMetodoPago(input.metodoPago)) {
    throw new PaymentValidationError('Método de pago inválido');
  }
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new PaymentValidationError('La revisión esperada es requerida');
  }
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey)) {
    throw new PaymentValidationError('La clave de idempotencia no es válida');
  }

  const retried = await prisma.cobro.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { ordenId: true },
  });
  if (retried) {
    if (retried.ordenId !== input.orderId) {
      throw new PaymentConflictError('La clave de cobro ya fue utilizada');
    }
    return prisma.orden.findUniqueOrThrow({
      where: { id: input.orderId },
      include: ORDER_WITH_ITEMS,
    });
  }

  const existing = await prisma.orden.findUnique({ where: { id: input.orderId } });
  if (!existing) throw new PaymentNotFoundError('Orden no encontrada');
  if (!canUserCollectOrder(input.user)) {
    throw new PaymentForbiddenError('Tu rol no puede cobrar órdenes');
  }
  validateOrderCanBePaid(existing, input.expectedRevision, input.origen);

  // La key nunca se acepta como viene: solo cuenta si es un string de verdad (no
  // un array ni un objeto que coincidiera con el regex al coercionar), recortado.
  // Vacío o de otro tipo se trata como ausente para no persistir "" en vez de null.
  // Este es el valor resuelto que se usa en el resto de la función, nunca el input.
  let comprobanteKey: string | null =
    typeof input.comprobanteTransferenciaKey === 'string'
      ? input.comprobanteTransferenciaKey.trim() || null
      : null;

  // Tiene que tener la forma exacta que arma el servidor, apuntar a ESTA orden,
  // y el objeto tiene que existir de verdad.
  if (comprobanteKey) {
    const parsed = parseComprobanteKey(comprobanteKey);
    if (!parsed || parsed.ordenId !== input.orderId) {
      throw new PaymentValidationError('El comprobante no corresponde a esta orden');
    }
    try {
      if (!(await objectExists(comprobanteKey))) {
        throw new PaymentValidationError('El comprobante no se guardó, reintenta');
      }
    } catch (error) {
      if (error instanceof PaymentValidationError) throw error;
      // El storage puede fallar por una causa que no es "el objeto no existe"
      // (credenciales vencidas, endpoint caído, permiso de solo escritura). El pago
      // nunca puede depender de esa disponibilidad: se deja constancia del error
      // para poder diagnosticar la caída y se sigue como si no hubiera llegado
      // ninguna key, igual que si el cliente nunca hubiera subido nada.
      console.error(
        'No se pudo verificar el comprobante en el storage, se cobra sin él:',
        error,
      );
      comprobanteKey = null;
    }
  }

  // Al cobrar por enlace (QR) la orden se cierra como `cobrada` sin importar el
  // tipo ni el estado operativo previo. Desde la lista interna se conserva el
  // comportamiento previo (solo pasa a `cobrada` si ya estaba lista/entregada).
  const nuevoEstado =
    input.origen === 'qr' ||
    ['lista', 'entregada', 'cobrada'].includes(existing.estado)
      ? 'cobrada'
      : existing.estado;
  const estadosCobrables =
    input.origen === 'qr'
      ? ['pendiente', 'en_preparacion', 'lista', 'entregada']
      : !existing.tipoOrden || existing.tipoOrden === 'local'
        ? ['lista', 'entregada']
        : ['pendiente', 'en_preparacion', 'lista', 'entregada'];
  const movimientos = calcularMovimientosCobro({
    tipoOrden: existing.tipoOrden,
    total: existing.total.toString(),
    costoEnvio: existing.costoEnvio?.toString(),
    metodoPago: input.metodoPago,
  });
  const huboOverride =
    esMetodoPago(existing.metodoPagoPrevisto) &&
    existing.metodoPagoPrevisto !== input.metodoPago;
  // Se permite cobrar una transferencia sin comprobante, pero queda asentado:
  // el cuadre lo muestra al cerrar el dia. Usa el valor ya resuelto arriba, asi
  // que una caida del storage tambien cae en este camino.
  const sinComprobante =
    input.metodoPago === 'transferencia' && !comprobanteKey;

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.orden.updateMany({
        where: {
          id: input.orderId,
          cobrada: false,
          anulada: false,
          printRevision: input.expectedRevision,
          estado: { in: estadosCobrables },
        },
        data: {
          metodoPago: input.metodoPago,
          cobrada: true,
          fechaCobro: new Date(),
          cobradaPor: input.user.nombre,
          cobradaPorId: input.user.id,
          origenCobro: input.origen,
          comprobanteTransferenciaKey: comprobanteKey,
          estado: nuevoEstado,
        },
      });
      if (updated.count !== 1) {
        throw new PaymentConflictError(
          'La orden fue cobrada, anulada o modificada al mismo tiempo.',
        );
      }

      await tx.cobro.create({
        data: {
          ordenId: input.orderId,
          metodoPago: input.metodoPago,
          montoTotal: existing.total,
          costoEnvio: existing.costoEnvio ?? 0,
          ...movimientos,
          cobradoPorId: input.user.id,
          cobradoPorNombre: input.user.nombre,
          cobradoPorRol: input.user.rol,
          origen: input.origen,
          idempotencyKey: input.idempotencyKey,
          comprobanteTransferenciaKey: comprobanteKey,
        },
      });

      await tx.historialOrden.create({
        data: {
          ordenId: input.orderId,
          tipoAccion: huboOverride ? 'metodo_pago_override' : 'orden_cobrada',
          descripcion: `${
            huboOverride
              ? `Cobro en ${input.metodoPago} sobre una orden acordada en ${existing.metodoPagoPrevisto}`
              : `Orden cobrada en ${input.metodoPago} por ${input.user.nombre}`
          }${sinComprobante ? ' · sin comprobante de transferencia' : ''}`,
          datosAntes: {
            cobrada: false,
            metodoPagoPrevisto: existing.metodoPagoPrevisto,
          },
          datosDespues: {
            cobrada: true,
            metodoPago: input.metodoPago,
            comprobanteTransferenciaKey: comprobanteKey,
            total: Number(existing.total),
            costoEnvio: Number(existing.costoEnvio ?? 0),
            ...movimientos,
          },
          usuarioNombre: input.user.nombre,
          usuarioRol: input.user.rol,
          razon: huboOverride
            ? 'El cliente pagó con un método distinto al acordado'
            : null,
          diferenciaTotal: 0,
        },
      });

      return tx.orden.findUniqueOrThrow({
        where: { id: input.orderId },
        include: ORDER_WITH_ITEMS,
      });
    });
  } catch (error) {
    if (error instanceof PaymentConflictError) {
      const retry = await prisma.cobro.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (retry?.ordenId === input.orderId) {
        return prisma.orden.findUniqueOrThrow({
          where: { id: input.orderId },
          include: ORDER_WITH_ITEMS,
        });
      }
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const retry = await prisma.cobro.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (retry?.ordenId === input.orderId) {
        return prisma.orden.findUniqueOrThrow({
          where: { id: input.orderId },
          include: ORDER_WITH_ITEMS,
        });
      }
      throw new PaymentConflictError('La orden ya fue cobrada');
    }
    throw error;
  }
}
