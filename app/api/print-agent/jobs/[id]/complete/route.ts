import { NextResponse } from 'next/server';

import {
  authenticatePrintAgent,
  normalizeWorkerId,
} from '@/lib/print-agent-auth';
import { completePrintJob } from '@/lib/print-agent-jobs';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticatePrintAgent(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [{ id }, body] = await Promise.all([
      params,
      request.json() as Promise<{ workerId?: unknown }>,
    ]);
    const workerId = normalizeWorkerId(body.workerId);
    const result = await completePrintJob(prisma, id, workerId);

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json(
        { error: 'El lease no pertenece al agente o ya vencio' },
        { status: 409 },
      );
    }

    return NextResponse.json({ job: result.job, idempotent: result.kind === 'idempotent' });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith('workerId')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error al completar trabajo de impresion:', error);
    return NextResponse.json(
      { error: 'No se pudo completar el trabajo de impresion' },
      { status: 500 },
    );
  }
}
