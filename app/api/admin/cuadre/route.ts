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
              cobro: {
                is: {
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
          cobro: {
            select: { createdAt: true, estado: true },
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
        cobro: _privatePayment,
        ...safeOrder
      } = orden;
      void _privateTokenHash;
      void _privatePayment;
      return {
        ...safeOrder,
        // El cuadre es por fecha del movimiento, no por el estado actual. Asi una
        // orden creada ayer y cobrada hoy no aparece cobrada en ambos cierres.
        cobrada: cobradaEnFecha,
        metodoPago: cobradaEnFecha ? orden.metodoPago : null,
        fechaCobro: cobradaEnFecha ? orden.fechaCobro : null,
        estadoCobro: orden.cobro?.estado ?? null,
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
