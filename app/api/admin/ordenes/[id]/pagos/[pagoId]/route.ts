import { NextResponse } from 'next/server';

import { bloquearCajaAbierta, CajaNoDisponibleError } from '@/lib/caja';
import { prisma } from '@/lib/db';
import { obtenerFechaEcuador, obtenerRangoEcuador } from '@/lib/fecha-ecuador';
import { getAuthenticatedUser } from '@/lib/session';
import { calcularMovimientosPago, resumirMetodoPago } from '@/types/cobro';
import { esMetodoPago } from '@/types/orden';

class CambioMetodoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Admin corrige el método de un pago ya registrado (efectivo <-> transferencia).
 * El monto no cambia; solo a qué columna del cuadre va. Solo pagos de la caja
 * abierta de hoy: una caja cerrada ya fijó su efectivo esperado.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; pagoId: string }> },
) {
  try {
    const admin = await getAuthenticatedUser();
    if (!admin) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (admin.rol !== 'admin') {
      return NextResponse.json(
        { error: 'Solo un administrador puede cambiar el método de pago' },
        { status: 403 },
      );
    }

    const { id, pagoId } = await params;
    const body = (await request.json().catch(() => null)) as
      | { metodoPago?: unknown; razon?: unknown }
      | null;
    const nuevoMetodo = body?.metodoPago;
    if (!esMetodoPago(nuevoMetodo)) {
      return NextResponse.json(
        { error: 'Método de pago no válido: efectivo o transferencia' },
        { status: 400 },
      );
    }
    const razon = typeof body?.razon === 'string' && body.razon.trim() ? body.razon.trim() : null;

    const resultado = await prisma.$transaction(async (tx) => {
      await bloquearCajaAbierta(tx);

      const pago = await tx.cobro.findUnique({
        where: { id: pagoId },
        include: { orden: { select: { anulada: true, metodoPago: true } } },
      });
      if (!pago || pago.ordenId !== id) throw new CambioMetodoError('Pago no encontrado', 404);
      if (pago.orden.anulada) {
        throw new CambioMetodoError('La orden está anulada', 409);
      }
      if (pago.estado !== 'CONFIRMADO') {
        throw new CambioMetodoError('Solo se puede corregir un pago confirmado', 409);
      }
      if (pago.metodoPago === nuevoMetodo) {
        throw new CambioMetodoError(`El pago ya está en ${nuevoMetodo}`, 400);
      }
      const hoy = obtenerRangoEcuador(obtenerFechaEcuador())!;
      if (pago.createdAt < hoy.inicio || pago.createdAt >= hoy.fin) {
        throw new CambioMetodoError(
          'Solo se pueden corregir pagos de la caja de hoy; esa caja ya se cerró',
          409,
        );
      }

      await tx.cobro.update({
        where: { id: pagoId },
        data: {
          metodoPago: nuevoMetodo,
          ...calcularMovimientosPago({ metodoPago: nuevoMetodo, monto: pago.monto.toString() }),
          // Un pago en efectivo no tiene comprobante; el key anterior queda en el historial.
          ...(nuevoMetodo === 'efectivo' ? { comprobanteTransferenciaKey: null } : {}),
        },
      });

      const pagos = await tx.cobro.findMany({
        where: { ordenId: id },
        select: { metodoPago: true },
      });
      const metodoResumido = resumirMetodoPago(pagos);
      await tx.orden.update({ where: { id }, data: { metodoPago: metodoResumido } });

      await tx.historialOrden.create({
        data: {
          ordenId: id,
          tipoAccion: 'metodo_pago_cambiado',
          descripcion: `Pago de $${Number(pago.monto).toFixed(2)} cambiado de ${pago.metodoPago} a ${nuevoMetodo}`,
          datosAntes: {
            pagoId,
            metodoPago: pago.metodoPago,
            metodoOrden: pago.orden.metodoPago,
            comprobanteTransferenciaKey: pago.comprobanteTransferenciaKey,
          },
          datosDespues: { pagoId, metodoPago: nuevoMetodo, metodoOrden: metodoResumido },
          usuarioNombre: admin.nombre,
          usuarioRol: admin.rol,
          razon,
          diferenciaTotal: 0,
        },
      });

      return { metodoPago: metodoResumido };
    });

    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof CambioMetodoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CajaNoDisponibleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error al cambiar método de pago:', error);
    return NextResponse.json({ error: 'Error al cambiar método de pago' }, { status: 500 });
  }
}
