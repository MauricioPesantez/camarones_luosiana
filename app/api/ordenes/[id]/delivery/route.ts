import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { cancelarRecordatorios, leerAvisoMoto, programarAvisoMoto } from '@/lib/whatsapp-salidas';

const ESTADOS_SIN_PREPARACION = new Set(['cancelada', 'pendiente_aprobacion_stock']);
// La hora elegida puede quedar segundos atrás mientras se envía el formulario.
const TOLERANCIA_PASADO_MS = 60 * 1000;
const MAX_PROGRAMACION_MS = 12 * 60 * 60 * 1000;

type Usuario = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;

/** Orden de domicilio que este usuario puede gestionar, o la respuesta de error. */
async function cargarOrden(id: string, usuario: Usuario) {
  const orden = await prisma.orden.findUnique({
    where: { id },
    select: {
      tipoOrden: true,
      tipoOperacion: true,
      anulada: true,
      estado: true,
      creadorId: true,
      deliverySolicitadoAt: true,
      numeroDiario: true,
      fechaNumeroDiario: true,
      nombreCliente: true,
      telefonoCliente: true,
      ubicacionUrl: true,
      referenciaEntrega: true,
      total: true,
      costoEnvio: true,
      montoPagado: true,
    },
  });
  if (!orden) {
    return { error: NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 }) };
  }
  const autorizado =
    usuario.rol === 'admin' ||
    (usuario.rol === 'digital' && orden.creadorId === usuario.id);
  if (!autorizado) {
    return { error: NextResponse.json({ error: 'No puedes solicitar delivery para esta orden' }, { status: 403 }) };
  }
  if (orden.tipoOperacion !== 'VENTA_CLIENTE' || orden.tipoOrden !== 'domicilio') {
    return { error: NextResponse.json({ error: 'Solo los domicilios usan delivery' }, { status: 409 }) };
  }
  return { orden };
}

/** Estado fresco antes de pedir o reprogramar: la página no se actualiza sola. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    const { id } = await params;
    const cargada = await cargarOrden(id, usuario);
    if (cargada.error) return cargada.error;
    return NextResponse.json({
      deliverySolicitadoAt: cargada.orden.deliverySolicitadoAt,
      aviso: await leerAvisoMoto(prisma, id),
    });
  } catch (error) {
    console.error('Error al consultar delivery:', error);
    return NextResponse.json({ error: 'Error al consultar delivery' }, { status: 500 });
  }
}

/**
 * `solicitar`: registra que alguien pidió motorizado fuera del sistema.
 * `pedir`: el POS manda ya el aviso al grupo Motos; la orden queda marcada cuando sale.
 * `programar` + `hora` (ISO): cambia a qué hora sale ese aviso, mientras no haya salido.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }

    const body = await request.json();
    const accion = body?.accion;
    if (accion !== 'solicitar' && accion !== 'pedir' && accion !== 'programar') {
      return NextResponse.json({ error: 'Acción de delivery no válida' }, { status: 400 });
    }

    const ahora = new Date();
    let disponibleAt = ahora;
    if (accion === 'programar') {
      disponibleAt = new Date(typeof body.hora === 'string' ? body.hora : NaN);
      if (Number.isNaN(disponibleAt.getTime())) {
        return NextResponse.json({ error: 'Hora no válida' }, { status: 400 });
      }
      if (disponibleAt.getTime() < ahora.getTime() - TOLERANCIA_PASADO_MS) {
        return NextResponse.json({ error: 'La hora ya pasó: usa Pedir moto' }, { status: 400 });
      }
      if (disponibleAt.getTime() > ahora.getTime() + MAX_PROGRAMACION_MS) {
        return NextResponse.json({ error: 'Solo se puede programar hasta 12 horas adelante' }, { status: 400 });
      }
      if (disponibleAt < ahora) disponibleAt = ahora;
    }

    const { id } = await params;
    const cargada = await cargarOrden(id, usuario);
    if (cargada.error) return cargada.error;
    const { orden } = cargada;
    if (orden.anulada || ESTADOS_SIN_PREPARACION.has(orden.estado)) {
      return NextResponse.json({ error: 'Esta orden no admite solicitud de delivery' }, { status: 409 });
    }
    if (orden.deliverySolicitadoAt) {
      return NextResponse.json({ deliverySolicitadoAt: orden.deliverySolicitadoAt });
    }

    if (accion !== 'solicitar') {
      const resultado = await prisma.$transaction(async (tx) => {
        // Serializa dos clics simultáneos sobre el mismo aviso.
        await tx.$queryRaw`SELECT id FROM "Orden" WHERE id = ${id} FOR UPDATE`;
        const r = await programarAvisoMoto(tx, { ...orden, id }, disponibleAt);
        if (r === 'encolada') {
          const hora = disponibleAt.toLocaleTimeString('es-EC', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil',
          });
          await tx.historialOrden.create({
            data: {
              ordenId: id,
              tipoAccion: accion === 'pedir' ? 'moto_pedida_grupo' : 'moto_programada',
              descripcion: accion === 'pedir'
                ? 'Moto pedida al grupo Motos desde el sistema'
                : `Pedido de moto programado para las ${hora}`,
              datosDespues: { disponibleAt: disponibleAt.toISOString() },
              usuarioNombre: usuario.nombre,
              usuarioRol: usuario.rol,
              diferenciaTotal: 0,
            },
          });
        }
        return { resultado: r, aviso: await leerAvisoMoto(tx, id) };
      });
      if (resultado.resultado === 'sin_configuracion') {
        return NextResponse.json({ error: 'WhatsApp no está configurado para avisar a Motos' }, { status: 409 });
      }
      if (accion === 'programar' && resultado.resultado !== 'encolada') {
        return NextResponse.json(
          { error: 'La moto ya fue pedida al grupo; no se puede cambiar la hora', aviso: resultado.aviso },
          { status: 409 },
        );
      }
      return NextResponse.json({ pedidoMoto: resultado.resultado, aviso: resultado.aviso });
    }

    const deliverySolicitadoAt = new Date();
    const registrada = await prisma.$transaction(async (tx) => {
      const { count } = await tx.orden.updateMany({
        where: { id, anulada: false, deliverySolicitadoAt: null },
        data: { deliverySolicitadoAt },
      });
      if (count !== 1) return false;
      await tx.historialOrden.create({
        data: {
          ordenId: id,
          tipoAccion: 'delivery_solicitado',
          descripcion: 'Delivery solicitado',
          datosDespues: { deliverySolicitadoAt: deliverySolicitadoAt.toISOString() },
          usuarioNombre: usuario.nombre,
          usuarioRol: usuario.rol,
          diferenciaTotal: 0,
        },
      });
      await cancelarRecordatorios(tx, id, 'DELIVERY_SOLICITADO');
      return true;
    });
    if (registrada) {
      return NextResponse.json({ deliverySolicitadoAt });
    }

    // Otra solicitud ganó la carrera, o la anularon mientras tanto.
    const actual = await prisma.orden.findUnique({
      where: { id },
      select: { deliverySolicitadoAt: true },
    });
    if (!actual?.deliverySolicitadoAt) {
      return NextResponse.json({ error: 'Esta orden no admite solicitud de delivery' }, { status: 409 });
    }
    return NextResponse.json({ deliverySolicitadoAt: actual.deliverySolicitadoAt });
  } catch (error) {
    console.error('Error al registrar delivery:', error);
    return NextResponse.json({ error: 'Error al registrar delivery' }, { status: 500 });
  }
}
