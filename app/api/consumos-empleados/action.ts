import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { AccountError } from '@/lib/employee-account';
import { changeConsumption } from '@/lib/employee-consumption';

export async function consumptionAction(request: Request, id: string, action: 'entregar' | 'anular' | 'corregir') {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  if (action === 'entregar' ? !['admin', 'mesero'].includes(user.rol) : user.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { orden, replay } = await changeConsumption(id, action, await request.json(), user);
    return NextResponse.json({ orden, replay, impresion: null });
  }
  catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    console.error('Error en consumo', error); return NextResponse.json({ error: 'No se pudo actualizar el consumo' }, { status: 500 });
  }
}
