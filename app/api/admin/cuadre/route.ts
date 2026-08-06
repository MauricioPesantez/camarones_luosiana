import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizarNombre } from '@/lib/admin-validaciones';
import { ZONA_HORARIA, obtenerRangoEcuador } from '@/lib/fecha-ecuador';
import { RETIRO_SELECT, serializarRetiro } from '@/lib/retiros';
import { getAuthenticatedUser } from '@/lib/session';
import { isConfirmedPaymentInRange } from '@/lib/cuadre-date';

export async function GET(request: Request) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (usuario.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');

    if (!fecha) {
      return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 });
    }

    const rango = obtenerRangoEcuador(fecha);
    if (!rango) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
    }

    // Los retiros viajan con las ordenes y con el mismo rango: una sola vuelta
    // y una sola definicion de "el dia" para las dos mitades de la caja.
    const [ordenes, usuarios, retiros] = await Promise.all([
      prisma.orden.findMany({
        where: {
          OR: [
            {
              createdAt: {
                gte: rango.inicio,
                lt: rango.fin,
              },
            },
            {
              fechaCobro: {
                gte: rango.inicio,
                lt: rango.fin,
              },
            },
            {
              pagos: {
                some: {
                  createdAt: {
                    gte: rango.inicio,
                    lt: rango.fin,
                  },
                },
              },
            },
          ],
        },
        include: {
          pagos: {
            select: {
              id: true,
              createdAt: true,
              estado: true,
              metodoPago: true,
              monto: true,
              comprobanteTransferenciaKey: true,
              origen: true,
            },
          },
          creador: {
            select: { id: true, nombre: true, rol: true },
          },
          items: {
            include: {
              producto: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.usuario.findMany({
        select: { id: true, nombre: true, rol: true },
      }),
      prisma.retiroCaja.findMany({
        where: {
          createdAt: {
            gte: rango.inicio,
            lt: rango.fin,
          },
        },
        select: RETIRO_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Las órdenes anteriores a `creadorId` se recuperan por el nombre legado.
    const usuariosPorNombre = new Map(
      usuarios.map((usuario) => [normalizarNombre(usuario.nombre), usuario]),
    );
    const ordenesConCreador = ordenes.map((orden) => {
      const creadorInferido = usuariosPorNombre.get(
        normalizarNombre(orden.mesero),
      );
      const cobradaEnFecha = isConfirmedPaymentInRange(orden, rango);
      const {
        cobroTokenHash: _privateTokenHash,
        pagos: _privatePayments,
        ...safeOrder
      } = orden;
      void _privateTokenHash;
      return {
        ...safeOrder,
        // El cuadre es por fecha del movimiento, no por el estado actual. Asi una
        // orden creada ayer y cobrada hoy no aparece cobrada en ambos cierres.
        cobrada: cobradaEnFecha,
        metodoPago: cobradaEnFecha ? orden.metodoPago : null,
        fechaCobro: cobradaEnFecha ? orden.fechaCobro : null,
        estadoCobro:
          _privatePayments.find((pago) => pago.estado !== 'CONFIRMADO')?.estado ??
          _privatePayments[0]?.estado ??
          null,
        // Cada pago dice si cae en el rango. El resumen suma solo los que si.
        // `id` y `comprobanteTransferenciaKey` no los usa el calculo, viajan
        // para que el admin pueda pedir el comprobante de un pago puntual.
        pagos: _privatePayments
          .filter((pago) => pago.estado !== 'REEMBOLSADO')
          .map((pago) => ({
            id: pago.id,
            metodoPago: pago.metodoPago,
            monto: Number(pago.monto),
            comprobanteTransferenciaKey: pago.comprobanteTransferenciaKey,
            origen: pago.origen,
            estado: pago.estado,
            enRango:
              pago.createdAt >= rango.inicio && pago.createdAt < rango.fin,
          })),
        creadorNombre:
          orden.creador?.nombre ?? creadorInferido?.nombre ?? orden.mesero,
        creadorRol:
          orden.creadorRol ??
          orden.creador?.rol ??
          creadorInferido?.rol ??
          'desconocido',
      };
    });

    return NextResponse.json({
      fecha,
      zonaHoraria: ZONA_HORARIA,
      ordenes: ordenesConCreador,
      retiros: retiros.map(serializarRetiro),
    });
  } catch (error) {
    console.error('Error en cuadre:', error);
    return NextResponse.json({ error: 'Error al obtener cuadre' }, { status: 500 });
  }
}
