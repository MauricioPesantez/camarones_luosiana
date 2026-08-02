import { NextResponse } from 'next/server';

import {
  authenticatePrintAgent,
  getPrintLeaseSeconds,
  normalizeWorkerId,
} from '@/lib/print-agent-auth';
import { claimNextPrintJob } from '@/lib/print-agent-jobs';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = authenticatePrintAgent(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as { workerId?: unknown };
    const workerId = normalizeWorkerId(body.workerId);
    const job = await claimNextPrintJob(
      prisma,
      workerId,
      new Date(),
      getPrintLeaseSeconds(),
    );

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith('workerId')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error al reclamar trabajo de impresion:', error);
    return NextResponse.json(
      { error: 'No se pudo reclamar el trabajo de impresion' },
      { status: 500 },
    );
  }
}
