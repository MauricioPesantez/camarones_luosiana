import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/session';

export async function GET() {
  const usuario = await getAuthenticatedUser();
  if (!usuario) {
    return NextResponse.json({ error: 'Sesion no valida' }, { status: 401 });
  }
  return NextResponse.json({ usuario });
}
