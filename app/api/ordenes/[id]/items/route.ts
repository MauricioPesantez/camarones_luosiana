import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { notificarClientes } from '@/lib/sse';
import { Prisma } from '@prisma/client';

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

    // Validar que la orden esté en un estado editable (cualquiera antes de cobrada/cancelada)
    const estadosEditables = ['pendiente', 'en_preparacion', 'lista'];
    if (!estadosEditables.includes(ordenActual.estado)) {
      return NextResponse.json(
        { error: 'Solo se pueden modificar órdenes activas' },
        { status: 400 }
      );
    }

    const estabaLista = ordenActual.estado === 'lista';

    // Validar acciones inválidas para órdenes lista
    if (estabaLista) {
      const accionesInvalidas = items.filter(
        (i: { accion: string; itemId?: string; cantidad?: number }) => {
          if (i.accion === 'eliminar') return true; // nunca permitir eliminar
          if (i.accion === 'modificar') {
            // Solo rechazar si reduce la cantidad por debajo de la original
            const itemOriginal = ordenActual.items.find((orig) => orig.id === i.itemId);
            if (!itemOriginal) return false;
            return (i.cantidad ?? 0) < itemOriginal.cantidad;
          }
          return false;
        }
      );
      if (accionesInvalidas.length > 0) {
        return NextResponse.json(
          { error: 'No se pueden eliminar items ni reducir cantidades de una orden ya lista.' },
          { status: 400 }
        );
      }
    }

    const totalAnterior = Number(ordenActual.total);

    interface HistorialRegistro {
      tipoAccion: string;
      descripcion: string;
      itemAfectado?: Prisma.InputJsonValue;
      datosAntes?: Prisma.InputJsonValue;
      datosDespues?: Prisma.InputJsonValue;
      usuarioNombre: string;
      usuarioRol: string;
      razon: string;
      diferenciaTotal: number;
    }

    const historialRegistros: HistorialRegistro[] = [];

    // Procesar cada cambio de item dentro de una transacción para manejar stock
    await prisma.$transaction(async (tx) => {
      for (const itemCambio of items) {
        const { accion, productoId, cantidad, itemId } = itemCambio;

        if (accion === 'eliminar') {
          // Encontrar el item a eliminar
          const itemAEliminar = ordenActual.items.find((i) => i.id === itemId);
          if (itemAEliminar) {
            // Devolver stock al producto
            await tx.producto.update({
              where: { id: itemAEliminar.productoId },
              data: {
                stock: {
                  increment: itemAEliminar.cantidad,
                },
              },
            });

            // Eliminar el item
            await tx.item.delete({
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
          const producto = await tx.producto.findUnique({
            where: { id: productoId },
          });

          if (!producto) continue;

          const precioUnitario = Number(producto.precio);
          const subtotal = cantidad * precioUnitario;

          // Descontar stock del producto
          await tx.producto.update({
            where: { id: productoId },
            data: {
              stock: {
                decrement: cantidad,
              },
            },
          });

          // Crear el nuevo item
          const nuevoItem = await tx.item.create({
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

            // Ajustar stock: devolver la cantidad anterior y descontar la nueva
            const diferenciaCantidad = cantidad - itemAModificar.cantidad;

            await tx.producto.update({
              where: { id: itemAModificar.productoId },
              data: {
                stock: {
                  decrement: diferenciaCantidad,
                },
              },
            });

            await tx.item.update({
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
    });

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

    // Actualizar la orden — si estaba lista y se agregaron items, regresa a cocina
    const tieneItemsNuevos = historialRegistros.some(r => r.tipoAccion === 'item_agregado');
    const nuevoEstado = estabaLista && tieneItemsNuevos ? 'en_preparacion' : undefined;

    await prisma.orden.update({
      where: { id },
      data: {
        total: nuevoTotal,
        tiempoEstimado: nuevoTiempoEstimado,
        modificada: true,
        ...(nuevoEstado ? { estado: nuevoEstado } : {}),
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

    // Si la orden regresó a cocina, notificar en tiempo real via SSE
    if (nuevoEstado && ordenActualizada) {
      const titulo =
        !ordenActualizada.tipoOrden || ordenActualizada.tipoOrden === 'local'
          ? `Mesa ${ordenActualizada.numeroMesa}`
          : (ordenActualizada.nombreCliente ?? 'Cliente');
      const itemsNuevos = historialRegistros.filter(r => r.tipoAccion === 'item_agregado').length;
      notificarClientes('regresa-a-cocina', { ordenId: id, tituloOrden: titulo, itemsNuevos });
    }

    return NextResponse.json({
      orden: ordenActualizada,
      cambios: historialRegistros.length,
      totalAnterior,
      totalNuevo: nuevoTotal,
      diferencia: nuevoTotal - totalAnterior,
      regresaACocina: !!nuevoEstado,
    });
  } catch (error) {
    console.error('Error al modificar orden:', error);
    return NextResponse.json(
      { error: 'Error al modificar orden' },
      { status: 500 }
    );
  }
}
