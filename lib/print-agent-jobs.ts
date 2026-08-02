import type { PrismaClient } from '@prisma/client';

import { PRINT_JOB_STATUSES } from './print-jobs';

const RETRY_DELAYS_SECONDS = [5, 15, 30, 60, 120, 300] as const;

export type JobMutationResult =
  | { kind: 'updated' | 'idempotent'; job: Awaited<ReturnType<PrismaClient['printJob']['findUnique']>> }
  | { kind: 'not_found' | 'conflict'; job: null };

export function getRetryDelaySeconds(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error('attempt debe ser un entero mayor a cero');
  }

  return RETRY_DELAYS_SECONDS[
    Math.min(attempt - 1, RETRY_DELAYS_SECONDS.length - 1)
  ];
}

export function sanitizePrintErrorCode(value: unknown): string {
  if (typeof value !== 'string') return 'UNKNOWN';
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_.-]/g, '_');
  return normalized.slice(0, 64) || 'UNKNOWN';
}

export function sanitizePrintErrorMessage(value: unknown): string {
  if (typeof value !== 'string') return 'Error de impresion no especificado';
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return normalized.slice(0, 500) || 'Error de impresion no especificado';
}

export async function claimNextPrintJob(
  prisma: PrismaClient,
  workerId: string,
  now = new Date(),
  leaseSeconds = 30,
) {
  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1_000);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "PrintJob"
      SET
        status = CASE
          WHEN attempts >= "maxAttempts" THEN 'FAILED'::"PrintJobStatus"
          WHEN "autoPrintUntil" < ${now} THEN 'NEEDS_REVIEW'::"PrintJobStatus"
          ELSE 'RETRY'::"PrintJobStatus"
        END,
        "availableAt" = ${now},
        "leasedAt" = NULL,
        "leaseExpiresAt" = NULL,
        "updatedAt" = ${now}
      WHERE status = 'PROCESSING'::"PrintJobStatus"
        AND "leaseExpiresAt" <= ${now}
    `;

    await tx.printJob.updateMany({
      where: {
        status: { in: [PRINT_JOB_STATUSES.PENDING, PRINT_JOB_STATUSES.RETRY] },
        autoPrintUntil: { lt: now },
      },
      data: { status: PRINT_JOB_STATUSES.NEEDS_REVIEW },
    });

    await tx.$executeRaw`
      UPDATE "PrintJob"
      SET status = 'FAILED'::"PrintJobStatus", "updatedAt" = ${now}
      WHERE status IN ('PENDING'::"PrintJobStatus", 'RETRY'::"PrintJobStatus")
        AND attempts >= "maxAttempts"
    `;

    const candidates = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "PrintJob"
      WHERE status IN ('PENDING'::"PrintJobStatus", 'RETRY'::"PrintJobStatus")
        AND "availableAt" <= ${now}
        AND "autoPrintUntil" >= ${now}
        AND attempts < "maxAttempts"
      ORDER BY "availableAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    const candidate = candidates[0];
    if (!candidate) return null;

    return tx.printJob.update({
      where: { id: candidate.id },
      data: {
        status: PRINT_JOB_STATUSES.PROCESSING,
        attempts: { increment: 1 },
        workerId,
        leasedAt: now,
        leaseExpiresAt,
        lastErrorCode: null,
        lastError: null,
      },
    });
  });
}

export async function completePrintJob(
  prisma: PrismaClient,
  jobId: string,
  workerId: string,
  now = new Date(),
): Promise<JobMutationResult> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.printJob.updateMany({
      where: {
        id: jobId,
        status: PRINT_JOB_STATUSES.PROCESSING,
        workerId,
        leaseExpiresAt: { gte: now },
      },
      data: {
        status: PRINT_JOB_STATUSES.SUCCEEDED,
        printedAt: now,
        leasedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        lastError: null,
      },
    });

    if (updated.count === 1) {
      const job = await tx.printJob.findUnique({ where: { id: jobId } });
      if (job?.type === 'ORDER') {
        await tx.orden.update({
          where: { id: job.ordenId },
          data: { impresa: true },
        });
      }
      return { kind: 'updated' as const, job };
    }

    const existing = await tx.printJob.findUnique({ where: { id: jobId } });
    if (!existing) return { kind: 'not_found' as const, job: null };
    if (
      existing.status === PRINT_JOB_STATUSES.SUCCEEDED &&
      existing.workerId === workerId
    ) {
      return { kind: 'idempotent' as const, job: existing };
    }
    return { kind: 'conflict' as const, job: null };
  });
}

export async function failPrintJob(
  prisma: PrismaClient,
  jobId: string,
  workerId: string,
  errorCode: string,
  errorMessage: string,
  now = new Date(),
): Promise<JobMutationResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.printJob.findUnique({ where: { id: jobId } });
    if (!current) return { kind: 'not_found' as const, job: null };

    if (
      current.workerId === workerId &&
      [
        PRINT_JOB_STATUSES.RETRY,
        PRINT_JOB_STATUSES.FAILED,
        PRINT_JOB_STATUSES.NEEDS_REVIEW,
      ].includes(current.status as never)
    ) {
      return { kind: 'idempotent' as const, job: current };
    }

    if (
      current.status !== PRINT_JOB_STATUSES.PROCESSING ||
      current.workerId !== workerId ||
      !current.leaseExpiresAt ||
      current.leaseExpiresAt < now
    ) {
      return { kind: 'conflict' as const, job: null };
    }

    const exhausted = current.attempts >= current.maxAttempts;
    const expired = current.autoPrintUntil < now;
    const nextStatus = exhausted
      ? PRINT_JOB_STATUSES.FAILED
      : expired
        ? PRINT_JOB_STATUSES.NEEDS_REVIEW
        : PRINT_JOB_STATUSES.RETRY;
    const availableAt =
      nextStatus === PRINT_JOB_STATUSES.RETRY
        ? new Date(now.getTime() + getRetryDelaySeconds(current.attempts) * 1_000)
        : now;

    const updated = await tx.printJob.updateMany({
      where: {
        id: jobId,
        status: PRINT_JOB_STATUSES.PROCESSING,
        workerId,
        leaseExpiresAt: { gte: now },
      },
      data: {
        status: nextStatus,
        availableAt,
        leasedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: errorCode,
        lastError: errorMessage,
      },
    });

    if (updated.count !== 1) return { kind: 'conflict' as const, job: null };
    const job = await tx.printJob.findUnique({ where: { id: jobId } });
    return { kind: 'updated' as const, job };
  });
}
