import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { autenticarAgenteWhatsapp, registrarSalud, reservarSalida } from '@/lib/whatsapp-agente';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = autenticarAgenteWhatsapp(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { sessionId, sesionLista } = (await request.json()) as { sessionId?: unknown; sesionLista?: unknown };
    if (typeof sessionId !== 'string' || !sessionId || typeof sesionLista !== 'boolean') {
      return NextResponse.json({ error: 'sessionId y sesionLista son requeridos' }, { status: 400 });
    }

    const ahora = new Date();
    await registrarSalud(prisma, sesionLista, ahora);
    const salida = sesionLista ? await reservarSalida(prisma, sessionId, ahora) : null;
    return NextResponse.json({ salida });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    console.error('Error al reservar salida de WhatsApp:', error instanceof Error ? error.name : 'desconocido');
    return NextResponse.json({ error: 'No se pudo reservar la salida' }, { status: 500 });
  }
}
