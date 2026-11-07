import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PENDIENTE_DE_REVISION = { estado: 'REQUIERE_REVISION', revisadaAt: null };
const LIMITE = 50;
// El agente consulta como máximo cada 60 s; tres minutos sin noticias es caída.
const AGENTE_CAIDO_MS = 3 * 60 * 1000;

async function exigirAdmin() {
  const usuario = await getAuthenticatedUser();
  if (!usuario) return { error: NextResponse.json({ error: 'Sesion requerida' }, { status: 401 }) };
  if (usuario.rol !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo un administrador revisa WhatsApp' }, { status: 403 }) };
  }
  return { usuario };
}

/** Salud del agente y lo que el sistema no pudo resolver solo. */
export async function GET() {
  const { error } = await exigirAdmin();
  if (error) return error;

  try {
    const [agente, entradas, salidas] = await Promise.all([
      prisma.printAgent.findUnique({
        where: { id: 'whatsapp-agent' },
        select: { lastSeenAt: true, printerReachable: true },
      }),
      prisma.whatsappEntrada.findMany({
        where: PENDIENTE_DE_REVISION,
        orderBy: { recibidaAt: 'desc' },
        take: LIMITE,
        select: { id: true, recibidaAt: true, error: true, texto: true },
      }),
      prisma.whatsappSalida.findMany({
        where: PENDIENTE_DE_REVISION,
        orderBy: { createdAt: 'desc' },
        take: LIMITE,
        select: {
          id: true,
          tipo: true,
          createdAt: true,
          ultimoError: true,
          texto: true,
          orden: { select: { numeroDiario: true } },
        },
      }),
    ]);

    return NextResponse.json({
      habilitada: process.env.WHATSAPP_ENABLED === 'true',
      agente: agente?.lastSeenAt && {
        lastSeenAt: agente.lastSeenAt,
        activo: Date.now() - agente.lastSeenAt.getTime() < AGENTE_CAIDO_MS,
        sesionLista: agente.printerReachable === true,
      },
      entradas,
      salidas,
    });
  } catch (err) {
    console.error('Error al leer revisión de WhatsApp:', err instanceof Error ? err.name : 'desconocido');
    return NextResponse.json({ error: 'No se pudo leer la revisión' }, { status: 500 });
  }
}

/** Descartar no envía ni procesa nada: deja constancia de quién lo revisó. */
export async function POST(request: Request) {
  const { usuario, error } = await exigirAdmin();
  if (error) return error;

  try {
    const { tipo, id } = (await request.json()) as { tipo?: unknown; id?: unknown };
    if ((tipo !== 'entrada' && tipo !== 'salida') || typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'tipo e id son requeridos' }, { status: 400 });
    }

    const revision = { revisadaPor: usuario.nombre, revisadaAt: new Date() };
    const where = { id, ...PENDIENTE_DE_REVISION };
    const { count } = tipo === 'entrada'
      ? await prisma.whatsappEntrada.updateMany({ where, data: revision })
      : await prisma.whatsappSalida.updateMany({ where, data: revision });
    if (count !== 1) {
      return NextResponse.json({ error: 'Ya fue revisado o no existe' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    console.error('Error al descartar revisión de WhatsApp:', err instanceof Error ? err.name : 'desconocido');
    return NextResponse.json({ error: 'No se pudo descartar' }, { status: 500 });
  }
}
