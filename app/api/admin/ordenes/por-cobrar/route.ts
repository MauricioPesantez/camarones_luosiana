import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { obtenerFechaEcuador, obtenerRangoEcuador } from '@/lib/fecha-ecuador';
import { ORDENES_VIGENTES } from '@/lib/ordenes-anulacion';
import { getAuthenticatedUser } from '@/lib/session';
import { textoOrdenesPorCobrar } from '@/lib/whatsapp-mensajes';
import { leerConfiguracion } from '@/lib/whatsapp-webhook';

export const dynamic = 'force-dynamic';

const MAX_MINUTOS = 24 * 60;

async function exigirAdmin() {
  const usuario = await getAuthenticatedUser();
  if (!usuario) return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
  if (usuario.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo un administrador pide cerrar órdenes' }, { status: 403 });
  }
  return null;
}

function leerMinutos(valor: unknown): number | null {
  const minutos = Number(valor);
  return Number.isInteger(minutos) && minutos >= 0 && minutos <= MAX_MINUTOS ? minutos : null;
}

/** Del día (Ecuador), sin cobrar y abiertas hace más de `minutos`; la más antigua primero. */
function buscarPorCobrar(minutos: number, ahora: Date) {
  const hoy = obtenerRangoEcuador(obtenerFechaEcuador())!;
  const limite = new Date(ahora.getTime() - minutos * 60 * 1000);
  return prisma.orden.findMany({
    where: {
      ...ORDENES_VIGENTES,
      tipoOperacion: 'VENTA_CLIENTE',
      cobrada: false,
      estado: { notIn: ['cancelada', 'pendiente_aprobacion_stock'] },
      createdAt: { gte: hoy.inicio, lte: limite },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, numeroDiario: true, fechaNumeroDiario: true, tipoOrden: true, numeroMesa: true,
      nombreCliente: true, telefonoCliente: true, mesero: true, total: true, montoPagado: true, estado: true, createdAt: true,
    },
  });
}

/** Vista previa: el admin revisa la lista antes de mandarla al grupo. */
export async function GET(request: Request) {
  const error = await exigirAdmin();
  if (error) return error;

  const minutos = leerMinutos(new URL(request.url).searchParams.get('minutos'));
  if (minutos === null) {
    return NextResponse.json({ error: `Minutos debe ser un entero entre 0 y ${MAX_MINUTOS}` }, { status: 400 });
  }
  try {
    return NextResponse.json(await buscarPorCobrar(minutos, new Date()));
  } catch (err) {
    console.error('Error al buscar órdenes por cobrar:', err instanceof Error ? err.name : 'desconocido');
    return NextResponse.json({ error: 'No se pudieron buscar las órdenes' }, { status: 500 });
  }
}

/** Vuelve a buscar (la lista pudo cambiar) y deja el aviso en la cola del agente de WhatsApp. */
export async function POST(request: Request) {
  const error = await exigirAdmin();
  if (error) return error;

  const body = (await request.json().catch(() => null)) as { minutos?: unknown } | null;
  const minutos = leerMinutos(body?.minutos);
  if (minutos === null) {
    return NextResponse.json({ error: `Minutos debe ser un entero entre 0 y ${MAX_MINUTOS}` }, { status: 400 });
  }
  const config = leerConfiguracion(process.env);
  if (!config) return NextResponse.json({ error: 'WhatsApp no está configurado' }, { status: 409 });

  try {
    const ahora = new Date();
    const ordenes = await buscarPorCobrar(minutos, ahora);
    if (ordenes.length === 0) {
      return NextResponse.json({ enviadas: 0, ordenes });
    }
    await prisma.whatsappSalida.create({
      data: {
        sessionId: config.sessionId,
        tipo: 'RECORDATORIO_COBRO',
        destino: config.grupoChatId,
        texto: textoOrdenesPorCobrar(ordenes),
        clave: `por-cobrar:${ahora.getTime()}`,
      },
    });
    return NextResponse.json({ enviadas: ordenes.length, ordenes });
  } catch (err) {
    console.error('Error al pedir cierre de órdenes:', err instanceof Error ? err.name : 'desconocido');
    return NextResponse.json({ error: 'No se pudo enviar el aviso' }, { status: 500 });
  }
}
