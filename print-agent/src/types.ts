export type PrintJobType = 'ORDER' | 'AMENDMENT' | 'REPRINT';

export interface PrintOrderSnapshot {
  id: string;
  shortCode: string;
  type: 'local' | 'para_llevar' | 'domicilio';
  tableNumber: number | null;
  customerName: string | null;
  customerPhone: string | null;
  waiterName: string;
  observations: string | null;
  surcharge: number;
  deliveryCost: number;
  total: number;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
    observations: string | null;
    complimentary: boolean;
  }>;
}

export interface PrintJobPayload {
  payloadVersion: number;
  jobType: PrintJobType;
  revision: number;
  ticketLabel: 'ORDEN' | 'MODIFICACION' | 'REIMPRESION';
  generatedAt: string;
  order: PrintOrderSnapshot;
  changes?: Array<{
    action: 'ADD' | 'UPDATE' | 'REMOVE';
    productName: string;
    previousQuantity: number | null;
    quantity: number | null;
    observations: string | null;
  }>;
  reason?: string;
  requestedBy?: string;
}

export interface ClaimedPrintJob {
  id: string;
  ordenId: string;
  type: PrintJobType;
  attempts: number;
  maxAttempts: number;
  leaseExpiresAt: string;
  payload: PrintJobPayload;
}

export interface AgentConfig {
  apiBaseUrl: string;
  token: string;
  workerId: string;
  printerIp: string;
  printerPort: number;
  dryRun: boolean;
  pollIntervalMs: number;
  pollActiveStartHour: number;
  pollActiveEndHour: number;
  pollTimeZone: string;
  heartbeatIntervalMs: number;
  requestTimeoutMs: number;
  printerTimeoutMs: number;
}
