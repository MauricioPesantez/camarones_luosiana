import { Prisma } from '@prisma/client';

import { parseComprobanteKey } from '@/lib/comprobantes';
import { prisma } from '@/lib/db';
import {
  ActoDeCobroInvalido,
  derivarClaveIdempotencia,
  validarActoDeCobro,
} from '@/lib/order-payment-validaciones';
import { objectExists } from '@/lib/storage';
import { canCollectPayments, type AuthenticatedUser } from '@/lib/session';
import {
  aCentavos,
  aDolares,
  calcularMovimientosPago,
  resumirMetodoPago,
  type PartePago,
} from '@/types/cobro';
import { calcularSaldo } from '@/types/orden';

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

function validateOrderCanBePaid(
  order: {
    anulada: boolean;
    estado: string;
    tipoOrden: string;
    printRevision: number;
    total: Prisma.Decimal;
    montoPagado: Prisma.Decimal;
  },
  expectedRevision: number,
  origen: 'qr' | 'lista',
): void {
  if (calcularSaldo({ total: order.total.toString(), montoPagado: order.montoPagado.toString() }) <= 0) {
    throw new PaymentConflictError('Esta orden ya fue cobrada');
  }
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
  // basta con que la orden exista, tenga saldo y no este cancelada ni pendiente
  // de stock. El cobro desde la lista interna mantiene la regla de mesa
  // lista/entregada, ahora con `cobrada` incluida: una orden pagada a la que se
  // le agregaron productos conserva ese estado y vuelve a tener saldo.
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
  partes: readonly PartePago[];
  expectedRevision: number;
  idempotencyKey: string;
  origen: 'qr' | 'lista';
  user: AuthenticatedUser;
}) {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new PaymentValidationError('La revisión esperada es requerida');
  }
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey)) {
    throw new PaymentValidationError('La clave de idempotencia no es válida');
  }

  const claves = input.partes
    .filter((parte) => parte.metodoPago === 'efectivo' || parte.metodoPago === 'transferencia')
    .map((parte) => derivarClaveIdempotencia(input.idempotencyKey, parte.metodoPago));

  // Reintento del mismo acto: las claves derivadas ya existen y apuntan a esta
  // orden. Se devuelve el estado guardado sin volver a cobrar.
  const yaRegistradas = claves.length
    ? await prisma.cobro.findMany({
        where: { idempotencyKey: { in: claves } },
        select: { ordenId: true },
      })
    : [];
  if (yaRegistradas.length > 0) {
    if (yaRegistradas.some((cobro) => cobro.ordenId !== input.orderId)) {
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

  const saldo = calcularSaldo({
    total: existing.total.toString(),
    montoPagado: existing.montoPagado.toString(),
  });
  try {
    validarActoDeCobro({ saldo, partes: input.partes });
  } catch (error) {
    if (error instanceof ActoDeCobroInvalido) {
      throw new PaymentValidationError(error.message);
    }
    throw error;
  }

  const nuevoMontoPagado = aDolares(
    aCentavos(existing.montoPagado.toString()) + aCentavos(saldo),
  );
  const nuevoEstado =
    input.origen === 'qr' ||
    ['lista', 'entregada', 'cobrada'].includes(existing.estado)
      ? 'cobrada'
      : existing.estado;
  const estadosCobrables =
    input.origen === 'qr'
      ? ['pendiente', 'en_preparacion', 'lista', 'entregada', 'cobrada']
      : !existing.tipoOrden || existing.tipoOrden === 'local'
        ? ['lista', 'entregada', 'cobrada']
        : ['pendiente', 'en_preparacion', 'lista', 'entregada', 'cobrada'];

  // `validarActoDeCobro` garantiza a lo sumo una parte por método en un mismo
  // acto, asi que nunca hay mas de una parte en transferencia que verificar aca.
  const parteTransferencia = input.partes.find(
    (parte) => parte.metodoPago === 'transferencia',
  );

  // La key nunca se acepta como viene: solo cuenta si es un string de verdad (no
  // un array ni un objeto que coincidiera con el regex al coercionar), recortado.
  // Vacío o de otro tipo se trata como ausente para no persistir "" en vez de null.
  // Este es el valor resuelto que se usa en el resto de la función, nunca el input.
  let comprobanteKey: string | null =
    typeof parteTransferencia?.comprobanteTransferenciaKey === 'string'
      ? parteTransferencia.comprobanteTransferenciaKey.trim() || null
      : null;

  // Tiene que tener la forma exacta que arma el servidor, apuntar a ESTA orden,
  // y el objeto tiene que existir de verdad. Se resuelve antes de entrar al
  // `$transaction`: es una llamada de I/O externa (S3), no debe mantener la
  // transacción de la base de datos abierta.
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

  // Se permite cobrar una transferencia sin comprobante, pero queda asentado en
  // el historial: usa el valor ya resuelto arriba, asi que una caida del storage
  // tambien cae en este camino.
  const sinComprobante = Boolean(parteTransferencia) && !comprobanteKey;

  try {
    return await prisma.$transaction(async (tx) => {
      // El filtro por `montoPagado` es el candado optimista del dinero: si otro
      // cobrador cerro el saldo entre la lectura y esta escritura, no coincide.
      const updated = await tx.orden.updateMany({
        where: {
          id: input.orderId,
          anulada: false,
          printRevision: input.expectedRevision,
          montoPagado: existing.montoPagado,
          estado: { in: estadosCobrables },
        },
        data: {
          montoPagado: nuevoMontoPagado,
          cobrada: true,
          fechaCobro: new Date(),
          cobradaPor: input.user.nombre,
          cobradaPorId: input.user.id,
          origenCobro: input.origen,
          estado: nuevoEstado,
        },
      });
      if (updated.count !== 1) {
        throw new PaymentConflictError(
          'La orden fue cobrada, anulada o modificada al mismo tiempo.',
        );
      }

      for (const parte of input.partes) {
        await tx.cobro.create({
          data: {
            ordenId: input.orderId,
            metodoPago: parte.metodoPago,
            monto: parte.monto,
            montoTotal: existing.total,
            costoEnvio: existing.costoEnvio ?? 0,
            ...calcularMovimientosPago(parte),
            cobradoPorId: input.user.id,
            cobradoPorNombre: input.user.nombre,
            cobradoPorRol: input.user.rol,
            origen: input.origen,
            idempotencyKey: derivarClaveIdempotencia(
              input.idempotencyKey,
              parte.metodoPago,
            ),
            comprobanteTransferenciaKey:
              parte.metodoPago === 'transferencia' ? comprobanteKey : null,
          },
        });
      }

      // `Orden.metodoPago` es dato de presentacion: resume TODOS los pagos de la
      // orden, no solo los de este acto.
      const pagos = await tx.cobro.findMany({
        where: { ordenId: input.orderId },
        select: { metodoPago: true },
      });
      const metodoResumido = resumirMetodoPago(pagos);
      await tx.orden.update({
        where: { id: input.orderId },
        data: { metodoPago: metodoResumido },
      });

      const detallePartes = input.partes
        .map((parte) => `${parte.metodoPago} $${Number(parte.monto).toFixed(2)}`)
        .join(' + ');
      await tx.historialOrden.create({
        data: {
          ordenId: input.orderId,
          tipoAccion: 'orden_cobrada',
          descripcion: `Cobro de $${saldo.toFixed(2)} por ${input.user.nombre}: ${detallePartes}${sinComprobante ? ' · sin comprobante de transferencia' : ''}`,
          datosAntes: {
            montoPagado: Number(existing.montoPagado),
            metodoPago: existing.metodoPago,
          },
          datosDespues: {
            montoPagado: nuevoMontoPagado,
            metodoPago: metodoResumido,
            total: Number(existing.total),
            costoEnvio: Number(existing.costoEnvio ?? 0),
            partes: input.partes.map((parte) => ({
              metodoPago: parte.metodoPago,
              monto: Number(parte.monto),
            })),
          },
          usuarioNombre: input.user.nombre,
          usuarioRol: input.user.rol,
          diferenciaTotal: 0,
        },
      });

      return tx.orden.findUniqueOrThrow({
        where: { id: input.orderId },
        include: ORDER_WITH_ITEMS,
      });
    });
  } catch (error) {
    if (
      error instanceof PaymentConflictError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002')
    ) {
      // Carrera resuelta por el otro lado: si las claves derivadas ya existen y
      // son de esta orden, el acto si se registro.
      const retry = await prisma.cobro.findMany({
        where: { idempotencyKey: { in: claves } },
        select: { ordenId: true },
      });
      if (retry.length > 0 && retry.every((cobro) => cobro.ordenId === input.orderId)) {
        return prisma.orden.findUniqueOrThrow({
          where: { id: input.orderId },
          include: ORDER_WITH_ITEMS,
        });
      }
      if (error instanceof PaymentConflictError) throw error;
      throw new PaymentConflictError('La orden ya fue cobrada');
    }
    throw error;
  }
}
