import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

interface ItemAfectadoJson {
  nombre?: string;
  [key: string]: unknown;
}

interface EstadisticaMesero {
  nombre: string;
  total: number;
  agregados: number;
  eliminados: number;
  modificados: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');

    const whereCondition: Prisma.HistorialOrdenWhereInput = {};

    if (fechaInicio && fechaFin) {
      whereCondition.createdAt = {
        gte: new Date(fechaInicio),
        lte: new Date(fechaFin + 'T23:59:59'),
      };
    }

    const historial = await prisma.historialOrden.findMany({
      where: whereCondition,
      include: {
        orden: {
          select: {
            numeroMesa: true,
            mesero: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filtrar solo modificaciones (excluir orden_creada y orden_completada)
    const modificaciones = historial.filter(
      (h) => !['orden_creada', 'orden_completada'].includes(h.tipoAccion)
    );

    const totalModificaciones = modificaciones.length;
    const ordenesModificadas = new Set(modificaciones.map((m) => m.ordenId)).size;

    // Items más eliminados
    const itemsEliminados = modificaciones
      .filter((m) => m.tipoAccion === 'item_eliminado')
      .map((m) => {
        const item = m.itemAfectado as ItemAfectadoJson | null;
        return item?.nombre ?? 'Desconocido';
      });

    const itemsEliminadosCount = itemsEliminados.reduce(
      (acc: Record<string, number>, item) => {
        acc[item] = (acc[item] ?? 0) + 1;
        return acc;
      },
      {}
    );

    const topItemsEliminados = Object.entries(itemsEliminadosCount)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    // Items más agregados
    const itemsAgregados = modificaciones
      .filter((m) => m.tipoAccion === 'item_agregado')
      .map((m) => {
        const item = m.itemAfectado as ItemAfectadoJson | null;
        return item?.nombre ?? 'Desconocido';
      });

    const itemsAgregadosCount = itemsAgregados.reduce<Record<string, number>>((acc, item) => {
      acc[item] = (acc[item] ?? 0) + 1;
      return acc;
    }, {});

    const topItemsAgregados = Object.entries(itemsAgregadosCount)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    // Meseros con más modificaciones
    const modificacionesPorMesero = modificaciones.reduce<Record<string, EstadisticaMesero>>(
      (acc, mod) => {
        const mesero = mod.usuarioNombre;
        if (!acc[mesero]) {
          acc[mesero] = { nombre: mesero, total: 0, agregados: 0, eliminados: 0, modificados: 0 };
        }
        acc[mesero].total++;
        if (mod.tipoAccion === 'item_agregado') acc[mesero].agregados++;
        if (mod.tipoAccion === 'item_eliminado') acc[mesero].eliminados++;
        if (mod.tipoAccion === 'item_modificado') acc[mesero].modificados++;
        return acc;
      },
      {}
    );

    const topMeseros = Object.values(modificacionesPorMesero)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Impacto financiero
    const impactoFinanciero = modificaciones.reduce(
      (acc, mod) => {
        const diferencia = Number(mod.diferenciaTotal ?? 0);
        if (diferencia > 0) {
          acc.aumentos += diferencia;
        } else if (diferencia < 0) {
          acc.reducciones += Math.abs(diferencia);
        }
        return acc;
      },
      { aumentos: 0, reducciones: 0 }
    );

    // Modificaciones por día
    const modificacionesPorDia = modificaciones.reduce<Record<string, number>>((acc, mod) => {
      const fecha = new Date(mod.createdAt).toISOString().split('T')[0];
      acc[fecha] = (acc[fecha] ?? 0) + 1;
      return acc;
    }, {});

    const graficoDias = Object.entries(modificacionesPorDia)
      .map(([fecha, cantidad]) => ({ fecha, cantidad }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Razones más comunes
    const razonesCount = modificaciones
      .filter((m) => m.razon)
      .reduce<Record<string, number>>((acc, mod) => {
        const razon = mod.razon ?? 'Sin razón';
        acc[razon] = (acc[razon] ?? 0) + 1;
        return acc;
      }, {});

    const topRazones = Object.entries(razonesCount)
      .map(([razon, cantidad]) => ({ razon, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    return NextResponse.json({
      resumen: { totalModificaciones, ordenesModificadas, impactoFinanciero },
      topItemsEliminados,
      topItemsAgregados,
      topMeseros,
      graficoDias,
      topRazones,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas de modificaciones' },
      { status: 500 }
    );
  }
}
