import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

interface DatosDespuesJson {
  productoNombre?: string;
  cantidad?: number;
  razon?: string | null;
  [key: string]: unknown;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');

    const whereCondition: Prisma.HistorialOrdenWhereInput = {
      tipoAccion: 'cortesia_aplicada',
    };

    if (fechaInicio && fechaFin) {
      whereCondition.createdAt = {
        gte: new Date(fechaInicio),
        lte: new Date(fechaFin + 'T23:59:59'),
      };
    }

    const registros = await prisma.historialOrden.findMany({
      where: whereCondition,
      include: {
        orden: {
          select: {
            id: true,
            numeroMesa: true,
            nombreCliente: true,
            tipoOrden: true,
            mesero: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Construir lista detallada de cortesías
    const cortesias = registros.map((r) => {
      const datos = r.datosDespues as DatosDespuesJson | null;
      return {
        id: r.id,
        ordenId: r.ordenId,
        ordenTitulo:
          !r.orden.tipoOrden || r.orden.tipoOrden === 'local'
            ? `Mesa ${r.orden.numeroMesa}`
            : (r.orden.nombreCliente ?? 'Cliente'),
        mesero: r.orden.mesero,
        productoNombre: datos?.productoNombre ?? r.descripcion,
        cantidad: datos?.cantidad ?? 1,
        adminAutorizo: r.usuarioNombre,
        razon: datos?.razon ?? r.razon ?? null,
        fecha: r.createdAt,
      };
    });

    // Resumen
    const totalCortesias = cortesias.length;
    const ordenesConCortesia = new Set(cortesias.map((c) => c.ordenId)).size;

    // Top productos dados en cortesía
    const productoCount = cortesias.reduce<Record<string, number>>((acc, c) => {
      acc[c.productoNombre] = (acc[c.productoNombre] ?? 0) + c.cantidad;
      return acc;
    }, {});
    const topProductos = Object.entries(productoCount)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    // Top admins que autorizaron cortesías
    const adminCount = cortesias.reduce<Record<string, number>>((acc, c) => {
      acc[c.adminAutorizo] = (acc[c.adminAutorizo] ?? 0) + 1;
      return acc;
    }, {});
    const topAdmins = Object.entries(adminCount)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    return NextResponse.json({
      resumen: { totalCortesias, ordenesConCortesia },
      cortesias,
      topProductos,
      topAdmins,
    });
  } catch (error) {
    console.error('Error al obtener cortesías:', error);
    return NextResponse.json(
      { error: 'Error al obtener reporte de cortesías' },
      { status: 500 }
    );
  }
}
