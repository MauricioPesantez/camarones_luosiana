import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizarNombre } from '@/lib/admin-validaciones';
import { ZONA_HORARIA, obtenerRangoEcuador } from '@/lib/fecha-ecuador';
import { RETIRO_SELECT, serializarRetiro } from '@/lib/retiros';

export async function GET(request: Request) {
  try {
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
          createdAt: {
            gte: rango.inicio,
            lt: rango.fin,
          },
        },
        include: {
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
      return {
        ...orden,
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
