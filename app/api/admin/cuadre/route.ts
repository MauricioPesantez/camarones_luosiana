import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizarNombre } from '@/lib/admin-validaciones';

const FECHA_LOCAL = /^\d{4}-\d{2}-\d{2}$/;

function obtenerRangoEcuador(fecha: string): { inicio: Date; fin: Date } | null {
  if (!FECHA_LOCAL.test(fecha)) return null;

  const [year, month, day] = fecha.split('-').map(Number);
  const inicio = new Date(Date.UTC(year, month - 1, day, 5));

  // Evita aceptar fechas que Date normalizaria silenciosamente (p. ej. 31/02).
  const fechaValidada = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(inicio);
  if (fechaValidada !== fecha) return null;

  return { inicio, fin: new Date(inicio.getTime() + 24 * 60 * 60 * 1000) };
}

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

    const [ordenes, usuarios] = await Promise.all([
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
      zonaHoraria: 'America/Guayaquil',
      ordenes: ordenesConCreador,
    });
  } catch (error) {
    console.error('Error en cuadre:', error);
    return NextResponse.json({ error: 'Error al obtener cuadre' }, { status: 500 });
  }
}
