import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { notificarClientes } from '@/lib/sse';

const ESTADOS_EDITABLES = ['pendiente', 'en_preparacion', 'lista', 'entregada'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { productoId, cantidad, adminId, razon } = body;

    if (!productoId || !productoId.trim()) {
      return NextResponse.json({ error: 'El producto es requerido' }, { status: 400 });
    }
    if (!cantidad || cantidad < 1 || !Number.isInteger(cantidad)) {
      return NextResponse.json({ error: 'La cantidad debe ser un número entero mayor a 0' }, { status: 400 });
    }
    if (!adminId || !adminId.trim()) {
      return NextResponse.json({ error: 'El ID del administrador es requerido' }, { status: 400 });
    }

    // Verificar que el admin existe y tiene rol 'admin'
    const admin = await prisma.usuario.findUnique({ where: { id: adminId } });
    if (!admin) {
      return NextResponse.json({ error: 'Administrador no encontrado' }, { status: 404 });
    }
    if (admin.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo los administradores pueden aplicar cortesías' }, { status: 403 });
    }

    const orden = await prisma.orden.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (!ESTADOS_EDITABLES.includes(orden.estado)) {
      return NextResponse.json(
        { error: `No se puede agregar cortesía a una orden en estado "${orden.estado}"` },
        { status: 400 }
      );
    }

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    });

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    if (!producto.disponible) {
      return NextResponse.json({ error: 'El producto no está disponible' }, { status: 400 });
    }
    if (producto.stock < cantidad) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${producto.stock}` },
        { status: 409 }
      );
    }

    // Crear item de cortesía y descontar stock en una transacción
    await prisma.$transaction(async (tx) => {
      const nuevoItem = await tx.item.create({
        data: {
          ordenId: id,
          productoId,
          cantidad,
          precioUnitario: 0,
          subtotal: 0,
          esCortesia: true,
          adminCortesia: admin.nombre,
        },
      });

      await tx.producto.update({
        where: { id: productoId },
        data: { stock: { decrement: cantidad } },
      });

      await tx.historialOrden.create({
        data: {
          ordenId: id,
          tipoAccion: 'cortesia_aplicada',
          descripcion: `Cortesía aplicada: ${cantidad}x ${producto.nombre}`,
          itemAfectado: {
            id: nuevoItem.id,
            nombre: producto.nombre,
            cantidad,
            precio: 0,
          },
          datosDespues: {
            productoId,
            productoNombre: producto.nombre,
            cantidad,
            esCortesia: true,
            razon: razon ?? null,
          },
          usuarioNombre: admin.nombre,
          usuarioRol: 'admin',
          razon: razon ?? 'Cortesía aplicada por admin',
          diferenciaTotal: 0,
        },
      });
    });

    // Devolver la orden actualizada con todos sus items
    const ordenActualizada = await prisma.orden.findUnique({
      where: { id },
      include: {
        items: {
          include: { producto: true },
        },
      },
    });

    // Notificar a cocina en tiempo real
    const tituloOrden = !ordenActualizada?.tipoOrden || ordenActualizada.tipoOrden === 'local'
      ? `Mesa ${ordenActualizada?.numeroMesa}`
      : (ordenActualizada?.nombreCliente ?? 'Cliente');

    notificarClientes('cortesia-aplicada', {
      ordenId: id,
      tituloOrden,
      productoNombre: producto.nombre,
      cantidad,
      adminNombre: admin.nombre,
    });

    return NextResponse.json({ orden: ordenActualizada });
  } catch (error) {
    console.error('Error al aplicar cortesía:', error);
    return NextResponse.json({ error: 'Error al aplicar cortesía' }, { status: 500 });
  }
}
