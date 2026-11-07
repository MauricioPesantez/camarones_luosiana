import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { AccountError } from '@/lib/employee-account';
import { printEmployeeReceipt } from '@/lib/employee-receipts-server';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedUser();
  if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  try {
    const { id } = await params;
    return NextResponse.json(await printEmployeeReceipt(actor, { ordenId: id }));
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error al imprimir consumo:', error);
    return NextResponse.json({ error: 'No se pudo imprimir el comprobante' }, { status: 500 });
  }
}
