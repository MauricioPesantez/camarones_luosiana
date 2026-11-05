import { NextResponse } from 'next/server';
import { procesarMensaje } from '@/lib/whatsapp-ingreso';
import {
  MAX_CUERPO_WEBHOOK,
  clasificarMensaje,
  firmaValida,
  leerConfiguracion,
  leerCuerpoLimitado,
} from '@/lib/whatsapp-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const config = leerConfiguracion(process.env);
  if (!config) {
    return NextResponse.json({ error: 'Integración no configurada' }, { status: 503 });
  }

  try {
    const cuerpo = await leerCuerpoLimitado(request, MAX_CUERPO_WEBHOOK);
    if (!cuerpo) {
      return NextResponse.json({ error: 'Cuerpo excesivo' }, { status: 413 });
    }
    if (!firmaValida(cuerpo, request.headers.get('x-openwa-signature'), config.secreto)) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }

    let evento: unknown;
    try {
      evento = JSON.parse(cuerpo.toString('utf8'));
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const clasificacion = clasificarMensaje(evento, config);
    if (!clasificacion.relevante) {
      return clasificacion.malformado
        ? NextResponse.json({ error: 'Evento inválido' }, { status: 400 })
        : NextResponse.json({ ok: true });
    }

    await procesarMensaje(clasificacion.mensaje, config);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Solo el tipo: el error de base puede citar el texto del cliente.
    console.error('Error en webhook de WhatsApp:', error instanceof Error ? error.name : 'desconocido');
    return NextResponse.json({ error: 'Error temporal' }, { status: 500 });
  }
}
