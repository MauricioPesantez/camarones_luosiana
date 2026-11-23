import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { obtenerFechaEcuador } from '@/lib/fecha-ecuador';
import { getAuthenticatedUser } from '@/lib/session';
import { ESTADO_CAJA_ABIERTA } from '@/types/caja';
import { calcularMovimientosPago } from '@/types/cobro';
import { esMetodoPago } from '@/types/orden';

const RAZON_MAXIMA = 200;

class CorreccionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Admin corrige un cobro ya registrado con el método equivocado. El dinero no
 * cambia de monto ni de hora: solo pasa de la caja al banco o al revés.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAuthenticatedUser();
    if (!admin) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (admin.rol !== 'admin') {
      return NextResponse.json(
        { error: 'Solo un administrador puede corregir un cobro' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as
      | { metodoPago?: unknown; razon?: unknown }
      | null;
    const nuevo = body?.metodoPago;
    if (!esMetodoPago(nuevo)) {
      return NextResponse.json(
        { error: 'Método de pago no válido: efectivo o transferencia' },
        { status: 400 },
      );
    }
    const razon = typeof body?.razon === 'string' ? body.razon.trim() : '';
    if (!razon || razon.length > RAZON_MAXIMA) {
      return NextResponse.json(
        { error: `Escribe el motivo de la corrección (máximo ${RAZON_MAXIMA} caracteres)` },
        { status: 400 },
      );
    }

    const cobroId = await prisma.$transaction(async (tx) => {
      const orden = await tx.orden.findUnique({
        where: { id },
        select: {
          tipoOperacion: true,
          empleadoId: true,
          anulada: true,
          estado: true,
          pagos: { select: { createdAt: true } },
        },
      });
      if (!orden) throw new CorreccionError('Orden no encontrada', 404);
      if (
        orden.tipoOperacion !== 'VENTA_CLIENTE' ||
        orden.empleadoId ||
        orden.anulada ||
        orden.estado === 'cancelada'
      ) {
        throw new CorreccionError('Esta orden no tiene un cobro que corregir', 409);
      }
      if (orden.pagos.length !== 1) {
        throw new CorreccionError(
          'Solo se corrige una orden con un único pago. Si fue mixta, anúlala y créala de nuevo.',
          409,
        );
      }

      // Mismo candado que cobros y cierre: un cobro nuevo o el cierre esperan.
      const [caja] = await tx.$queryRaw<Array<{ estado: string }>>`
        SELECT "estado"
        FROM "SesionCaja"
        WHERE "fecha" = ${obtenerFechaEcuador(orden.pagos[0].createdAt)}
        FOR UPDATE
      `;
      if (caja?.estado !== ESTADO_CAJA_ABIERTA) {
        throw new CorreccionError('La caja de ese cobro ya fue cerrada', 409);
      }

      // Con el candado tomado se relee: pudo entrar otro pago mientras se esperaba.
      const actual = await tx.orden.findUnique({
        where: { id },
        select: {
          pagos: { select: { id: true, metodoPago: true, monto: true, estado: true } },
        },
      });
      const pago = actual?.pagos[0];
      if (!pago || actual.pagos.length !== 1 || pago.estado !== 'CONFIRMADO') {
        throw new CorreccionError('El cobro cambió. Recarga la orden e intenta otra vez.', 409);
      }
      if (pago.metodoPago === nuevo) {
        throw new CorreccionError(`El cobro ya está en ${nuevo}`, 409);
      }

      const monto = Number(pago.monto);
      const corregido = await tx.cobro.updateMany({
        where: { id: pago.id, metodoPago: pago.metodoPago, estado: 'CONFIRMADO' },
        data: { metodoPago: nuevo, ...calcularMovimientosPago({ metodoPago: nuevo, monto }) },
      });
      if (corregido.count !== 1) {
        throw new CorreccionError('El cobro cambió. Recarga la orden e intenta otra vez.', 409);
      }
      await tx.orden.update({ where: { id }, data: { metodoPago: nuevo } });
      await tx.historialOrden.create({
        data: {
          ordenId: id,
          tipoAccion: 'cobro_corregido',
          descripcion: `Cobro de $${monto.toFixed(2)} corregido de ${pago.metodoPago} a ${nuevo}`,
          datosAntes: { metodoPago: pago.metodoPago },
          datosDespues: { metodoPago: nuevo },
          usuarioNombre: admin.nombre,
          usuarioRol: admin.rol,
          razon,
          diferenciaTotal: 0,
        },
      });
      return pago.id;
    });

    return NextResponse.json({ orden: { id, metodoPago: nuevo }, cobroId });
  } catch (error) {
    if (error instanceof CorreccionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error al corregir el cobro:', error);
    return NextResponse.json({ error: 'Error al corregir el cobro' }, { status: 500 });
  }
}
