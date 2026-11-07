import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { autenticarAgenteWhatsapp, fallarSalida } from '@/lib/whatsapp-agente';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = autenticarAgenteWhatsapp(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [{ id }, { token, codigo, reintentable, esperaSeg }] = await Promise.all([
      params,
      request.json() as Promise<{ token?: unknown; codigo?: unknown; reintentable?: unknown; esperaSeg?: unknown }>,
    ]);
    if (typeof token !== 'string' || !token || typeof reintentable !== 'boolean') {
      return NextResponse.json({ error: 'token y reintentable son requeridos' }, { status: 400 });
    }

    const registrada = await fallarSalida(prisma, id, token, { codigo, reintentable, esperaSeg });
    return registrada
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'La reserva ya no es vigente' }, { status: 409 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    console.error('Error al registrar fallo de WhatsApp:', error instanceof Error ? error.name : 'desconocido');
    return NextResponse.json({ error: 'No se pudo registrar el fallo' }, { status: 500 });
  }
}
