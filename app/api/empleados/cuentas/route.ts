import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { accountTotals } from '@/lib/employee-account-validation';

export async function GET() {
  const actor = await getAuthenticatedUser();
  if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  if (actor.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  const [empleados, saldos, consumosPendientes, adelantosSinBeneficiario] = await Promise.all([
    prisma.usuario.findMany({ select: { id: true, nombre: true, activo: true, cuentaActivadaAt: true, cuentaRevision: true, liquidacionesCuenta: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, createdAt: true } } }, orderBy: { nombre: 'asc' } }),
    prisma.movimientoCuentaEmpleado.groupBy({ by: ['empleadoId'], _sum: { monto: true } }),
    prisma.orden.groupBy({ by: ['empleadoId'], where: { tipoOperacion: 'CONSUMO_EMPLEADO', empleadoId: { not: null }, estado: { in: ['pendiente', 'en_preparacion', 'lista'] }, anulada: false }, _sum: { total: true }, _count: { _all: true } }),
    prisma.retiroCaja.findMany({ where: { categoria: 'adelanto', beneficiarioId: null }, select: { id: true, monto: true, estado: true, motivo: true, beneficiarioNombre: true, createdAt: true } }),
  ]);
  const porEmpleado = new Map(saldos.map((s) => [s.empleadoId, s._sum.monto?.mul(100).toNumber() ?? 0]));
  return NextResponse.json({ adelantosSinBeneficiario, empleados: empleados.map((e) => ({ ...e, empleadoId: e.id, revision: e.cuentaRevision, ...accountTotals(porEmpleado.get(e.id) ?? 0), ultimaLiquidacion: e.liquidacionesCuenta[0] ?? null, consumosPendientes: consumosPendientes.find((p) => p.empleadoId === e.id)?._count._all ?? 0, montoConsumosPendientes: consumosPendientes.find((p) => p.empleadoId === e.id)?._sum.total?.toNumber() ?? 0 })) });
}
