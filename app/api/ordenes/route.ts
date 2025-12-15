import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PrinterService } from '@/lib/printer';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');

    const ordenes = await prisma.orden.findMany({
      where: estado ? { estado } : undefined,
      include: {
        items: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(ordenes);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Calcular total
    let total = 0;
    const itemsData = body.items.map((item: any) => {
      const subtotal = item.cantidad * item.precioUnitario;
      total += subtotal;
      return {
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal,
        observaciones: item.observaciones,
      };
    });

    // Crear orden
    const orden = await prisma.orden.create({
      data: {
        numeroMesa: body.numeroMesa,
        mesero: body.mesero,
        observaciones: body.observaciones,
        total,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: {
          include: {
            producto: true,
          },
        },
      },
    });

    // Imprimir comanda
    const printer = new PrinterService();
    const resultadoImpresion = await printer.imprimirComanda(orden);

    if (resultadoImpresion.success) {
      await prisma.orden.update({
        where: { id: orden.id },
        data: { impresa: true },
      });
    }

    return NextResponse.json({
      orden,
      impresion: resultadoImpresion,
    });
  } catch (error) {
    console.error('Error al crear orden:', error);
    return NextResponse.json({ error: 'Error al crear orden' }, { status: 500 });
  }
}
