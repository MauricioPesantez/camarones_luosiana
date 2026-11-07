import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; liquidacionId: string }> }) {
  const actor = await getAuthenticatedUser();
  if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  const { id, liquidacionId } = await params;
  if (actor.rol !== 'admin' && actor.id !== id) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  const liquidacion = await prisma.liquidacionEmpleado.findFirst({ where: { id: liquidacionId, empleadoId: id }, include: { movimientos: true } });
  if (!liquidacion) return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
  return NextResponse.json(liquidacion);
}
