import { PrintAgentApiClient } from './api-client.js';
import { checkPrinterReachable } from './health.js';
import { log } from './logger.js';
import { PrinterError, sendToPrinter } from './printer.js';
import { isPollingActive } from './schedule.js';
import type { AgentConfig } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoff(failures: number): number {
  const base = Math.min(30_000, 1_000 * 2 ** Math.min(failures, 5));
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

function errorDetails(error: unknown): { code: string; message: string } {
  if (error instanceof PrinterError) return { code: error.code, message: error.message };
  if (error instanceof Error) {
    const code = error.name === 'TimeoutError' ? 'API_TIMEOUT' : 'AGENT_ERROR';
    return { code, message: error.message };
  }
  return { code: 'AGENT_ERROR', message: String(error) };
}

export class PrintWorker {
  private readonly api: PrintAgentApiClient;
  private stopping = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: AgentConfig) {
    this.api = new PrintAgentApiClient(config);
  }

  stop(): void {
    this.stopping = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  private async heartbeat(): Promise<void> {
    const health = await checkPrinterReachable(
      this.config.printerIp,
      this.config.printerPort,
      this.config.printerTimeoutMs,
    );
    await this.api.heartbeat(health.reachable, health.error);
    log('info', 'heartbeat', { printerReachable: health.reachable });
  }

  async run(): Promise<void> {
    log('info', 'agent_started', {
      workerId: this.config.workerId,
      dryRun: this.config.dryRun,
    });

    await this.heartbeat().catch((error) => {
      log('warn', 'initial_heartbeat_failed', errorDetails(error));
    });
    this.heartbeatTimer = setInterval(() => {
      void this.heartbeat().catch((error) => {
        log('warn', 'heartbeat_failed', errorDetails(error));
      });
    }, this.config.heartbeatIntervalMs);

    if (this.config.dryRun) {
      log('warn', 'dry_run_enabled', {
        message: 'El agente reporta salud pero no reclama ni imprime trabajos',
      });
      while (!this.stopping) await sleep(1_000);
      return;
    }

    let apiFailures = 0;
    let wasPollingActive: boolean | null = null;
    while (!this.stopping) {
      const pollingActive = isPollingActive(new Date(), {
        startHour: this.config.pollActiveStartHour,
        endHour: this.config.pollActiveEndHour,
        timeZone: this.config.pollTimeZone,
      });
      if (!pollingActive) {
        if (wasPollingActive !== false) {
          log('info', 'polling_paused_by_schedule', {
            startHour: this.config.pollActiveStartHour,
            endHour: this.config.pollActiveEndHour,
            timeZone: this.config.pollTimeZone,
          });
        }
        wasPollingActive = false;
        await sleep(30_000);
        continue;
      }
      if (wasPollingActive === false) log('info', 'polling_resumed_by_schedule');
      wasPollingActive = true;

      try {
        const job = await this.api.claim();
        apiFailures = 0;
        if (!job) {
          await sleep(this.config.pollIntervalMs);
          continue;
        }

        log('info', 'job_claimed', {
          jobId: job.id,
          orderId: job.ordenId,
          type: job.type,
          attempt: job.attempts,
        });

        try {
          await sendToPrinter(this.config, job.payload);
        } catch (error) {
          const details = errorDetails(error);
          log('error', 'job_failed', { jobId: job.id, ...details });
          await this.api.fail(job.id, details.code, details.message);
          continue;
        }

        try {
          await this.api.complete(job.id);
          log('info', 'job_completed', { jobId: job.id });
        } catch (error) {
          // La impresion pudo haber salido fisicamente. Complete es idempotente y
          // ya reintento; no reportamos fail porque eso forzaria un duplicado.
          log('error', 'job_confirmation_failed', {
            jobId: job.id,
            ...errorDetails(error),
          });
          throw error;
        }
      } catch (error) {
        apiFailures += 1;
        const delayMs = jitteredBackoff(apiFailures);
        log('warn', 'api_unavailable', { ...errorDetails(error), delayMs });
        await sleep(delayMs);
      }
    }
  }
}
