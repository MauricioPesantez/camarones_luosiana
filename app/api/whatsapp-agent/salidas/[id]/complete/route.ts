import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { autenticarAgenteWhatsapp, completarSalida } from '@/lib/whatsapp-agente';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = autenticarAgenteWhatsapp(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [{ id }, { token, mensajeId }] = await Promise.all([
      params,
      request.json() as Promise<{ token?: unknown; mensajeId?: unknown }>,
    ]);
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'token es requerido' }, { status: 400 });
    }

    const registrada = await completarSalida(prisma, id, token, typeof mensajeId === 'string' ? mensajeId : null);
    return registrada
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'La reserva ya no es vigente' }, { status: 409 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    console.error('Error al completar salida de WhatsApp:', error instanceof Error ? error.name : 'desconocido');
    return NextResponse.json({ error: 'No se pudo completar la salida' }, { status: 500 });
  }
}
