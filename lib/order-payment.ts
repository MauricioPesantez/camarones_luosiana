import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type { AuthenticatedUser } from '@/lib/session';
import { calcularMovimientosCobro } from '@/types/cobro';
import { esMetodoPago, type MetodoPago } from '@/types/orden';

export class PaymentConflictError extends Error {}
export class PaymentValidationError extends Error {}
export class PaymentNotFoundError extends Error {}
export class PaymentForbiddenError extends Error {}

const ORDER_WITH_ITEMS = {
  items: { include: { producto: true } },
} satisfies Prisma.OrdenInclude;

export function canUserCollectOrder(
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
  estado: string;
  tipoOrden: string;
  printRevision: number;
}, expectedRevision: number): void {
  if (order.cobrada) throw new PaymentConflictError('Esta orden ya fue cobrada');
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
  const esLocal = !order.tipoOrden || order.tipoOrden === 'local';
  if (esLocal && !['lista', 'entregada', 'cobrada'].includes(order.estado)) {
    throw new PaymentValidationError(
      'Las órdenes de mesa solo se pueden cobrar cuando estén listas o entregadas',
    );
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
  if (!canUserCollectOrder(input.user, existing)) {
    throw new PaymentForbiddenError('No puedes cobrar una orden de otro usuario');
  }
  validateOrderCanBePaid(existing, input.expectedRevision);

  const nuevoEstado = ['lista', 'entregada', 'cobrada'].includes(existing.estado)
    ? 'cobrada'
    : existing.estado;
  const estadosCobrables =
    !existing.tipoOrden || existing.tipoOrden === 'local'
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

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.orden.updateMany({
        where: {
          id: input.orderId,
          cobrada: false,
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
          comprobanteTransferenciaKey:
            input.comprobanteTransferenciaKey ?? null,
          estado: nuevoEstado,
        },
      });
      if (updated.count !== 1) {
        throw new PaymentConflictError(
          'La orden fue cobrada o modificada al mismo tiempo.',
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
          comprobanteTransferenciaKey:
            input.comprobanteTransferenciaKey ?? null,
        },
      });

      await tx.historialOrden.create({
        data: {
          ordenId: input.orderId,
          tipoAccion: huboOverride ? 'metodo_pago_override' : 'orden_cobrada',
          descripcion: huboOverride
            ? `Cobro en ${input.metodoPago} sobre una orden acordada en ${existing.metodoPagoPrevisto}`
            : `Orden cobrada en ${input.metodoPago} por ${input.user.nombre}`,
          datosAntes: {
            cobrada: false,
            metodoPagoPrevisto: existing.metodoPagoPrevisto,
          },
          datosDespues: {
            cobrada: true,
            metodoPago: input.metodoPago,
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
