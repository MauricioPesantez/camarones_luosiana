import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { analyzeRegularization, executeRegularization } from '@/lib/employee-consumption-regularization';

export async function GET(request: Request) {
  const actor = await getAuthenticatedUser();
  if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  if (actor.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const corte = params.get('corte') ?? new Date().toISOString();
  const cursor = params.get('cursor');
  if (!Number.isFinite(Date.parse(corte)) || (cursor !== null && !cursor.trim())) return NextResponse.json({ error: 'Corte o cursor inválido' }, { status: 400 });
  try { return NextResponse.json(await analyzeRegularization(prisma, { corte: new Date(corte).toISOString(), cursor })); }
  catch (error) { console.error('Error analizando regularización:', error); return NextResponse.json({ error: 'No se pudo analizar la regularización' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedUser();
  if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  if (actor.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  let body: { clientRequestId?: unknown; motivo?: unknown; corte?: unknown; candidatos?: unknown }; 
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }); }
  if (!body || typeof body.clientRequestId !== 'string' || !body.clientRequestId.trim() || body.clientRequestId.length > 150 || typeof body.motivo !== 'string' || !body.motivo.trim() || body.motivo.length > 500 || typeof body.corte !== 'string' || !Number.isFinite(Date.parse(body.corte)) || !Array.isArray(body.candidatos) || !body.candidatos.length || body.candidatos.length > 50 || body.candidatos.some((c: { ordenId?: unknown; expectedRevision?: unknown; fingerprint?: unknown }) => !c || typeof c.ordenId !== 'string' || !c.ordenId.trim() || typeof c.expectedRevision !== 'number' || !Number.isInteger(c.expectedRevision) || c.expectedRevision < 0 || typeof c.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(c.fingerprint)) || new Set(body.candidatos.map((c: { ordenId: string }) => c.ordenId)).size !== body.candidatos.length) return NextResponse.json({ error: 'Solicitud de regularización inválida' }, { status: 400 });
  try { return NextResponse.json(await executeRegularization(prisma, { clientRequestId: body.clientRequestId.trim(), motivo: body.motivo.trim(), corte: new Date(body.corte).toISOString(), candidatos: body.candidatos as { ordenId: string; expectedRevision: number; fingerprint: string }[] }, actor)); }
  catch (error) { if (error instanceof Error && error.message === 'CLAVE_REUTILIZADA') return NextResponse.json({ error: 'La clave de solicitud ya fue utilizada con otro contenido' }, { status: 409 }); console.error('Error regularizando consumos:', error); return NextResponse.json({ error: 'No se pudo ejecutar la regularización' }, { status: 500 }); }
}
