import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { accountBalance } from '@/lib/employee-account';
import { CATEGORIA_ADELANTO } from '@/types/retiro';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedUser();
  if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  const { id } = await params;
  if (actor.rol !== 'admin' && actor.id !== id) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  const empleado = await prisma.usuario.findUnique({ where: { id }, select: { id: true, nombre: true, activo: true, cuentaActivadaAt: true, cuentaRevision: true, aperturaCuenta: true } });
  if (!empleado) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  const url = new URL(request.url);
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1));
  const [balance, movimientos, liquidaciones, adelantos, pendientes] = await Promise.all([
    accountBalance(prisma, id),
    prisma.movimientoCuentaEmpleado.findMany({ where: { empleadoId: id }, orderBy: { secuencia: 'desc' }, skip: (page - 1) * 50, take: 50, include: { orden: { select: { id: true, numeroDiario: true, items: { select: { id: true, nombreProducto: true, cantidad: true, precioUnitario: true, subtotal: true } } } }, retiro: { select: { id: true, motivo: true, monto: true, createdAt: true } } } }),
    prisma.liquidacionEmpleado.findMany({ where: { empleadoId: id }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50 }),
    actor.rol === 'admin' && !empleado.cuentaActivadaAt ? prisma.retiroCaja.findMany({ where: { beneficiarioId: id, categoria: CATEGORIA_ADELANTO }, orderBy: { createdAt: 'asc' }, select: { id: true, monto: true, estado: true, motivo: true, createdAt: true, updatedAt: true, beneficiarioNombre: true } }) : Promise.resolve([]),
    prisma.orden.findMany({ where: { empleadoId: id, tipoOperacion: 'CONSUMO_EMPLEADO', estado: { in: ['pendiente', 'en_preparacion', 'lista'] }, anulada: false }, select: { id: true, total: true, estado: true, createdAt: true } }),
  ]);
  return NextResponse.json({ empleado, revision: empleado.cuentaRevision, saldo: balance.saldo, pendiente: balance.pendiente, saldoAFavor: balance.saldoAFavor, movimientos, liquidaciones, adelantos, pendientes, apertura: empleado.aperturaCuenta, page });
}
