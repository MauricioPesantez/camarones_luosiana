import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { PUBLIC_PRODUCT_SELECT } from '@/lib/product-select';
import { getAuthenticatedUser } from '@/lib/session';
import { textoActualizacionItems, textoActualizacionMoto } from '@/lib/whatsapp-mensajes';
import { refrescarRecordatorio, registrarCambioWhatsapp } from '@/lib/whatsapp-salidas';
import {
  calcularDescuento,
  calcularSaldo,
  esDescuentoSolicitado,
  etiquetaDescuento,
} from '@/types/orden';

class DescuentoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Admin aplica, cambia o quita (`descuento: null`) el descuento de una orden.
 *
 * Misma regla que la edición de items: con un pago registrado el total no puede
 * bajar, porque el reembolso no existe. Quitar un descuento sí se permite: el
 * total sube y la orden vuelve a tener saldo.
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
        { error: 'Solo un administrador puede aplicar descuentos a una orden existente' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as
      | { descuento?: unknown; razon?: unknown }
      | null;
    const solicitado = body?.descuento ?? null;
    if (solicitado !== null && !esDescuentoSolicitado(solicitado)) {
      return NextResponse.json(
        { error: 'Descuento no válido: usa un monto en dólares o un porcentaje hasta 100%' },
        { status: 400 },
      );
    }
    const razon = typeof body?.razon === 'string' && body.razon.trim() ? body.razon.trim() : null;

    const orden = await prisma.$transaction(
      async (tx) => {
        const actual = await tx.orden.findUnique({ where: { id }, include: { items: true } });
        if (!actual) throw new DescuentoError('Orden no encontrada', 404);
        if (actual.tipoOperacion === 'CONSUMO_EMPLEADO') {
          throw new DescuentoError('Utiliza la gestion de consumos de empleados', 409);
        }
        if (actual.anulada || actual.estado === 'cancelada') {
          throw new DescuentoError('No se puede aplicar descuento a una orden anulada o rechazada', 409);
        }

        const subtotal = actual.items.reduce((suma, item) => suma + Number(item.subtotal), 0);
        if (
          solicitado?.tipo === 'monto' &&
          Math.round(solicitado.valor * 100) > Math.round(subtotal * 100)
        ) {
          throw new DescuentoError('El descuento supera el subtotal de productos', 400);
        }

        const anterior = Number(actual.descuento);
        const nuevo = calcularDescuento(solicitado, subtotal);
        const totalAnterior = Number(actual.total);
        const total = subtotal - nuevo + Number(actual.recargo ?? 0) + Number(actual.costoEnvio ?? 0);
        if (Number(actual.montoPagado) > 0 && Math.round(total * 100) < Math.round(totalAnterior * 100)) {
          throw new DescuentoError(
            'No se puede bajar el total de una orden que ya tiene un pago registrado.',
            400,
          );
        }

        await tx.orden.update({
          where: { id },
          data: {
            descuentoTipo: solicitado?.tipo ?? null,
            descuentoValor: solicitado?.valor ?? null,
            descuento: nuevo,
            descuentoPor: solicitado ? admin.nombre : null,
            total,
            cobrada: calcularSaldo({ total, montoPagado: actual.montoPagado.toString() }) <= 0,
          },
        });
        const historial = await tx.historialOrden.create({
          data: {
            ordenId: id,
            tipoAccion: solicitado ? 'descuento_aplicado' : 'descuento_quitado',
            descripcion: solicitado
              ? `Descuento ${etiquetaDescuento(solicitado)} aplicado: -$${nuevo.toFixed(2)}`
              : `Descuento quitado: +$${anterior.toFixed(2)}`,
            datosAntes: { descuento: anterior, total: totalAnterior },
            datosDespues: { descuento: nuevo, total, descuentoSolicitado: solicitado ? { ...solicitado } : null },
            usuarioNombre: admin.nombre,
            usuarioRol: admin.rol,
            razon,
            diferenciaTotal: total - totalAnterior,
          },
        });

        const actualizada = await tx.orden.findUniqueOrThrow({
          where: { id },
          include: { items: { include: { producto: { select: PUBLIC_PRODUCT_SELECT } } } },
        });
        // El total a cobrar cambió: grupo y motorizado deben ver el nuevo monto.
        await refrescarRecordatorio(tx, actualizada);
        await registrarCambioWhatsapp(
          tx,
          id,
          `descuento:${historial.id}`,
          textoActualizacionItems(actualizada),
          textoActualizacionMoto(actualizada),
        );
        return actualizada;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ orden });
  } catch (error) {
    if (error instanceof DescuentoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json(
        { error: 'La orden cambió al mismo tiempo. Intenta nuevamente.' },
        { status: 409 },
      );
    }
    console.error('Error al aplicar descuento:', error);
    return NextResponse.json({ error: 'Error al aplicar descuento' }, { status: 500 });
  }
}
