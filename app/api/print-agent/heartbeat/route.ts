import { NextResponse } from 'next/server';

import {
  authenticatePrintAgent,
  normalizeWorkerId,
} from '@/lib/print-agent-auth';
import { sanitizePrintErrorMessage } from '@/lib/print-agent-jobs';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export async function POST(request: Request) {
  const auth = authenticatePrintAgent(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as {
      workerId?: unknown;
      name?: unknown;
      version?: unknown;
      printerReachable?: unknown;
      lastError?: unknown;
    };
    const workerId = normalizeWorkerId(body.workerId);
    if (
      body.printerReachable !== undefined &&
      typeof body.printerReachable !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'printerReachable debe ser booleano' },
        { status: 400 },
      );
    }

    const now = new Date();
    const name = optionalText(body.name, 100) ?? workerId;
    const version = optionalText(body.version, 50);
    const lastError = body.lastError
      ? sanitizePrintErrorMessage(body.lastError)
      : null;
    const printerReachable = body.printerReachable as boolean | undefined;

    const agent = await prisma.printAgent.upsert({
      where: { id: workerId },
      create: {
        id: workerId,
        name,
        version,
        lastSeenAt: now,
        lastPrinterCheckAt:
          printerReachable === undefined ? null : now,
        printerReachable: printerReachable ?? null,
        lastError,
      },
      update: {
        name,
        version,
        lastSeenAt: now,
        ...(printerReachable === undefined
          ? {}
          : { lastPrinterCheckAt: now, printerReachable }),
        lastError,
      },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith('workerId')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error al registrar heartbeat de impresion:', error);
    return NextResponse.json(
      { error: 'No se pudo registrar el heartbeat' },
      { status: 500 },
    );
  }
}
