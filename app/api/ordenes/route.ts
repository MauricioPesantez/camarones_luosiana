import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CrearOrdenRequest } from '@/types/orden';
import { ORDENES_VIGENTES } from '@/lib/ordenes-anulacion';
import {
  ORDEN_INCLUDE,
  OrdenInvalidaError,
  StockConflictError,
  StockInsuficienteError,
  crearOrden,
} from '@/lib/order-creation';
import { canCollectPayments, getAuthenticatedUser } from '@/lib/session';
import { obtenerFechaEcuador, obtenerRangoEcuador } from '@/lib/fecha-ecuador';
import { CajaNoDisponibleError } from '@/lib/caja';
import { AccountError } from '@/lib/employee-account';

function withoutPaymentSecrets<T extends { cobroTokenHash?: string | null }>(order: T) {
  const { cobroTokenHash: _privateTokenHash, ...safeOrder } = order;
  void _privateTokenHash;
  return safeOrder;
}

export async function GET(request: Request) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');

    // Soporta un solo estado o múltiples separados por coma: ?estado=pendiente,en_preparacion
    const estadoFiltro = estado
      ? estado.includes(',')
        ? { estado: { in: estado.split(',').map((s) => s.trim()) } }
        : { estado }
      : undefined;

    const ownerFilter = ['admin', 'cocina'].includes(usuario.rol)
      ? {}
      : {
          OR: [
            { creadorId: usuario.id },
            { creadorId: null, mesero: usuario.nombre },
          ],
        };

    // Cocina y mesero solo ven órdenes del día actual (hora Ecuador).
    // Admin tiene su propia vista con filtro de fecha independiente.
    const hoyEcuador = obtenerFechaEcuador();
    const rangoHoy = obtenerRangoEcuador(hoyEcuador)!;
    const fechaFiltro = usuario.rol === 'admin' ? {} : { createdAt: { gte: rangoHoy.inicio, lt: rangoHoy.fin } };

    // Una orden anulada desaparece de la operacion: cocina no la prepara y el
    // mesero no la cobra. Solo el cuadre la sigue mostrando, tachada.
    const ordenes = await prisma.orden.findMany({
      where: {
        ...ORDENES_VIGENTES,
        tipoOperacion: 'VENTA_CLIENTE',
        ...ownerFilter,
        ...(estadoFiltro ?? {}),
        ...fechaFiltro,
      },
      include: ORDEN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(ordenes.map(withoutPaymentSecrets));
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (!canCollectPayments(usuario)) {
      return NextResponse.json({ error: 'Rol no autorizado para crear ordenes' }, { status: 403 });
    }
    const body: CrearOrdenRequest = await request.json();
    const { orden, ...resultado } = await crearOrden(usuario, body, request.url);
    return NextResponse.json({ ...resultado, orden: withoutPaymentSecrets(orden) });
  } catch (error) {
    if (error instanceof OrdenInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CajaNoDisponibleError) {
      return NextResponse.json(
        { error: error.message, code: 'CAJA_NO_DISPONIBLE' },
        { status: 409 },
      );
    }
    if (error instanceof StockInsuficienteError) {
      return NextResponse.json(
        { error: error.message, code: 'STOCK_INSUFICIENTE', itemsSinStock: error.itemsSinStock },
        { status: 409 },
      );
    }
    if (error instanceof StockConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error al crear orden:', error);
    return NextResponse.json({ error: 'Error al crear orden' }, { status: 500 });
  }
}
