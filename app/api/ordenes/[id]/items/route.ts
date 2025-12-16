import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { items, razon, usuario } = body;

    // Validar que la razón sea obligatoria
    if (!razon || razon.trim() === '') {
      return NextResponse.json(
        { error: 'La razón del cambio es obligatoria' },
        { status: 400 }
      );
    }

    // Obtener la orden actual con sus items
    const ordenActual = await prisma.orden.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            producto: true,
          },
        },
      },
    });

    if (!ordenActual) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    // Validar que la orden esté pendiente
    if (ordenActual.estado !== 'pendiente') {
      return NextResponse.json(
        { error: 'Solo se pueden modificar órdenes pendientes' },
        { status: 400 }
      );
    }

    const totalAnterior = Number(ordenActual.total);
    const historialRegistros: any[] = [];

    // Procesar cada cambio de item
    for (const itemCambio of items) {
      const { accion, productoId, cantidad, itemId } = itemCambio;

      if (accion === 'eliminar') {
        // Encontrar el item a eliminar
        const itemAEliminar = ordenActual.items.find((i) => i.id === itemId);
        if (itemAEliminar) {
          // Eliminar el item
          await prisma.item.delete({
            where: { id: itemId },
          });

          // Registrar en historial
          historialRegistros.push({
            tipoAccion: 'item_eliminado',
            descripcion: `Eliminado: ${itemAEliminar.cantidad}x ${itemAEliminar.producto.nombre}`,
            itemAfectado: {
              id: itemAEliminar.id,
              nombre: itemAEliminar.producto.nombre,
              cantidad: itemAEliminar.cantidad,
              precio: Number(itemAEliminar.precioUnitario),
            },
            datosAntes: {
              cantidad: itemAEliminar.cantidad,
              subtotal: Number(itemAEliminar.subtotal),
            },
            usuarioNombre: usuario.nombre,
            usuarioRol: usuario.rol,
            razon,
            diferenciaTotal: -Number(itemAEliminar.subtotal),
          });
        }
      } else if (accion === 'agregar') {
        // Obtener información del producto
        const producto = await prisma.producto.findUnique({
          where: { id: productoId },
        });

        if (!producto) continue;

        const precioUnitario = Number(producto.precio);
        const subtotal = cantidad * precioUnitario;

        // Crear el nuevo item
        const nuevoItem = await prisma.item.create({
          data: {
            ordenId: id,
            productoId,
            cantidad,
            precioUnitario,
            subtotal,
          },
        });

        // Registrar en historial
        historialRegistros.push({
          tipoAccion: 'item_agregado',
          descripcion: `Agregado: ${cantidad}x ${producto.nombre}`,
          itemAfectado: {
            id: nuevoItem.id,
            nombre: producto.nombre,
            cantidad,
            precio: precioUnitario,
          },
          datosDespues: {
            cantidad,
            subtotal,
          },
          usuarioNombre: usuario.nombre,
          usuarioRol: usuario.rol,
          razon,
          diferenciaTotal: subtotal,
        });
      } else if (accion === 'modificar') {
        // Modificar cantidad de un item existente
        const itemAModificar = ordenActual.items.find((i) => i.id === itemId);
        if (itemAModificar) {
          const precioUnitario = Number(itemAModificar.precioUnitario);
          const nuevoSubtotal = cantidad * precioUnitario;
          const subtotalAnterior = Number(itemAModificar.subtotal);

          await prisma.item.update({
            where: { id: itemId },
            data: {
              cantidad,
              subtotal: nuevoSubtotal,
            },
          });

          // Registrar en historial
          historialRegistros.push({
            tipoAccion: 'item_modificado',
            descripcion: `Modificado: ${itemAModificar.producto.nombre} (${itemAModificar.cantidad} → ${cantidad})`,
            itemAfectado: {
              id: itemAModificar.id,
              nombre: itemAModificar.producto.nombre,
              cantidad: itemAModificar.cantidad,
              precio: precioUnitario,
            },
            datosAntes: {
              cantidad: itemAModificar.cantidad,
              subtotal: subtotalAnterior,
            },
            datosDespues: {
              cantidad,
              subtotal: nuevoSubtotal,
            },
            usuarioNombre: usuario.nombre,
            usuarioRol: usuario.rol,
            razon,
            diferenciaTotal: nuevoSubtotal - subtotalAnterior,
          });
        }
      }
    }

    // Recalcular el total de la orden
    const itemsActualizados = await prisma.item.findMany({
      where: { ordenId: id },
    });

    const nuevoTotal = itemsActualizados.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0
    );

    // Recalcular tiempo estimado
    const productosIds = itemsActualizados.map((i) => i.productoId);
    const productos = await prisma.producto.findMany({
      where: { id: { in: productosIds } },
    });

    let tiempoBase = 0;
    let tiempoAdicional = 0;

    itemsActualizados.forEach((item) => {
      const producto = productos.find((p) => p.id === item.productoId);
      const tiempoPreparacion = producto?.tiempoPreparacion || 0;

      if (producto?.categoria === 'Platos Fuertes') {
        tiempoBase = Math.max(tiempoBase, tiempoPreparacion);
      } else if (
        producto?.categoria === 'Acompañamientos' ||
        producto?.categoria === 'Entradas'
      ) {
        tiempoAdicional += tiempoPreparacion * 0.1;
      }
    });

    const nuevoTiempoEstimado = Math.ceil(tiempoBase + tiempoAdicional);

    // Actualizar la orden
    await prisma.orden.update({
      where: { id },
      data: {
        total: nuevoTotal,
        tiempoEstimado: nuevoTiempoEstimado,
        modificada: true,
      },
    });

    // Crear registros en el historial
    await prisma.historialOrden.createMany({
      data: historialRegistros.map((registro) => ({
        ...registro,
        ordenId: id,
      })),
    });

    // Obtener la orden actualizada
    const ordenActualizada = await prisma.orden.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            producto: true,
          },
        },
      },
    });

    return NextResponse.json({
      orden: ordenActualizada,
      cambios: historialRegistros.length,
      totalAnterior,
      totalNuevo: nuevoTotal,
      diferencia: nuevoTotal - totalAnterior,
    });
  } catch (error) {
    console.error('Error al modificar orden:', error);
    return NextResponse.json(
      { error: 'Error al modificar orden' },
      { status: 500 }
    );
  }
}
