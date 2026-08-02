import type { AgentConfig, ClaimedPrintJob } from './types.js';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class PrintAgentApiClient {
  constructor(private readonly config: AgentConfig) {}

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
    retries = 0,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.config.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!response.ok) {
          throw new ApiError(
            data.error ?? `La API respondio ${response.status}`,
            response.status,
          );
        }
        return data as T;
      } catch (error) {
        lastError = error;
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          throw error;
        }
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async claim(): Promise<ClaimedPrintJob | null> {
    const response = await this.request<{ job: ClaimedPrintJob | null }>(
      '/api/print-agent/claim',
      { workerId: this.config.workerId },
    );
    return response.job;
  }

  async complete(jobId: string): Promise<void> {
    await this.request(
      `/api/print-agent/jobs/${encodeURIComponent(jobId)}/complete`,
      { workerId: this.config.workerId },
      3,
    );
  }

  async fail(jobId: string, errorCode: string, errorMessage: string): Promise<void> {
    await this.request(
      `/api/print-agent/jobs/${encodeURIComponent(jobId)}/fail`,
      {
        workerId: this.config.workerId,
        errorCode,
        errorMessage,
      },
      3,
    );
  }

  async heartbeat(
    printerReachable: boolean,
    lastError: string | null,
  ): Promise<void> {
    await this.request('/api/print-agent/heartbeat', {
      workerId: this.config.workerId,
      name: this.config.workerId,
      version: '1.0.0',
      printerReachable,
      lastError,
    });
  }
}
