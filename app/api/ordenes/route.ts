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

    // Obtener productos con sus tiempos de preparación
    const productosIds = body.items.map((item: any) => item.productoId);
    const productos = await prisma.producto.findMany({
      where: { id: { in: productosIds } },
    });

    // Calcular total y tiempo estimado
    let total = 0;
    let tiempoBase = 0;
    let tiempoAdicional = 0;

    const itemsData = body.items.map((item: any) => {
      const subtotal = item.cantidad * item.precioUnitario;
      total += subtotal;

      // Buscar el producto para obtener su tiempo de preparación
      const producto = productos.find((p) => p.id === item.productoId);
      const tiempoPreparacion = producto?.tiempoPreparacion || 0;

      // Calcular tiempo según categoría
      if (producto?.categoria === 'Platos Fuertes') {
        // Para platos fuertes, tomamos el tiempo máximo
        tiempoBase = Math.max(tiempoBase, tiempoPreparacion);
      } else if (
        producto?.categoria === 'Acompañamientos' ||
        producto?.categoria === 'Entradas'
      ) {
        // Para acompañamientos y entradas, sumamos el 10%
        tiempoAdicional += tiempoPreparacion * 0.1;
      }

      return {
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal,
        observaciones: item.observaciones,
      };
    });

    // Calcular tiempo estimado total (redondeado al entero más cercano)
    const tiempoEstimado = Math.ceil(tiempoBase + tiempoAdicional);

    // Crear orden
    const orden = await prisma.orden.create({
      data: {
        numeroMesa: body.numeroMesa,
        mesero: body.mesero,
        observaciones: body.observaciones,
        total,
        tiempoEstimado,
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
