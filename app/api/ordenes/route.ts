import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PrinterService } from '@/lib/printer';
import { ItemSinStock } from '@/types/stock';

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

    // Obtener productos con sus tiempos de preparación y stock
    const productosIds = body.items.map((item: { productoId: string }) => item.productoId);
    const productos = await prisma.producto.findMany({
      where: { id: { in: productosIds } },
      select: {
        id: true,
        nombre: true,
        categoria: true,
        precio: true,
        disponible: true,
        descripcion: true,
        tiempoPreparacion: true,
        stock: true,
        stockMinimo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Validar stock para cada producto
    const itemsSinStock: ItemSinStock[] = [];

    for (const item of body.items) {
      const producto = productos.find((p) => p.id === item.productoId);

      if (!producto) {
        itemsSinStock.push({
          productoId: item.productoId,
          productoNombre: 'Producto no encontrado',
          cantidadSolicitada: item.cantidad,
          stockDisponible: 0,
        });
        continue;
      }

      if (producto.stock < item.cantidad) {
        itemsSinStock.push({
          productoId: producto.id,
          productoNombre: producto.nombre,
          cantidadSolicitada: item.cantidad,
          stockDisponible: producto.stock,
        });
      }
    }

    // Si hay items sin stock y no se especifica forzar creación,
    // crear orden con estado pendiente_aprobacion_stock
    const solicitarAprobacion = body.solicitarAprobacion === true;
    const hayStockInsuficiente = itemsSinStock.length > 0;

    // Calcular total y tiempo estimado
    let total = 0;
    let tiempoBase = 0;
    let tiempoAdicional = 0;

    const itemsData = body.items.map((item: {
      productoId: string;
      cantidad: number;
      precioUnitario: number;
      observaciones?: string;
    }) => {
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

    // Determinar el estado inicial de la orden
    const estadoInicial = hayStockInsuficiente && solicitarAprobacion
      ? 'pendiente_aprobacion_stock'
      : 'pendiente';

    // Crear orden
    const orden = await prisma.$transaction(async (tx) => {
      const nuevaOrden = await tx.orden.create({
        data: {
          numeroMesa: body.numeroMesa,
          mesero: body.mesero,
          observaciones: body.observaciones,
          total,
          tiempoEstimado,
          estado: estadoInicial,
          itemsSinStock: hayStockInsuficiente && solicitarAprobacion ? itemsSinStock : null,
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

      // Solo descontar stock si la orden fue creada con estado pendiente (con stock suficiente)
      if (estadoInicial === 'pendiente') {
        for (const item of body.items) {
          const producto = productos.find((p) => p.id === item.productoId);
          if (producto) {
            await tx.producto.update({
              where: { id: producto.id },
              data: { stock: producto.stock - item.cantidad },
            });
          }
        }
      }

      return nuevaOrden;
    });

    // Registrar creación en el historial
    const itemsDescripcion = orden.items
      .map((item) => `${item.cantidad}x ${item.producto.nombre}`)
      .join(', ');

    const tipoAccion = estadoInicial === 'pendiente_aprobacion_stock'
      ? 'orden_creada_pendiente_stock'
      : 'orden_creada';

    const descripcion = estadoInicial === 'pendiente_aprobacion_stock'
      ? `Orden creada pendiente de aprobación (sin stock) con ${orden.items.length} items: ${itemsDescripcion}`
      : `Orden creada con ${orden.items.length} items: ${itemsDescripcion}`;

    await prisma.historialOrden.create({
      data: {
        ordenId: orden.id,
        tipoAccion,
        descripcion,
        datosDespues: {
          items: orden.items.map((item) => ({
            nombre: item.producto.nombre,
            cantidad: item.cantidad,
            precio: Number(item.precioUnitario),
            subtotal: Number(item.subtotal),
          })),
          total: Number(total),
          tiempoEstimado,
          itemsSinStock: hayStockInsuficiente && solicitarAprobacion ? JSON.parse(JSON.stringify(itemsSinStock)) : null,
        },
        usuarioNombre: body.mesero,
        usuarioRol: 'mesero',
        diferenciaTotal: Number(total),
      },
    });

    // Solo imprimir comanda si la orden no está pendiente de aprobación
    let resultadoImpresion: { success: boolean; data?: unknown; error?: unknown } = {
      success: false,
      error: 'Orden pendiente de aprobación'
    };

    if (estadoInicial === 'pendiente') {
      const printer = new PrinterService();
      resultadoImpresion = await printer.imprimirComanda(orden);

      if (resultadoImpresion.success) {
        await prisma.orden.update({
          where: { id: orden.id },
          data: { impresa: true },
        });
      }
    }

    // Si hay items sin stock, incluir esa información en la respuesta
    const respuesta = {
      orden,
      impresion: resultadoImpresion,
      ...(hayStockInsuficiente && {
        stockInsuficiente: true,
        itemsSinStock,
        pendienteAprobacion: solicitarAprobacion,
      }),
    };

    return NextResponse.json(respuesta);
  } catch (error) {
    console.error('Error al crear orden:', error);
    return NextResponse.json({ error: 'Error al crear orden' }, { status: 500 });
  }
}
