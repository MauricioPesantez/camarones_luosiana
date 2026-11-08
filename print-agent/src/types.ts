export type PrintJobType = 'ORDER' | 'AMENDMENT' | 'REPRINT' | 'CASH_WITHDRAWAL' | 'EMPLOYEE_RECEIPT';

export interface PrintOrderSnapshot {
  employeeConsumption?: boolean;
  employeeName?: string | null;
  id: string;
  shortCode: string;
  dailyNumber: number | null;
  dailyDate?: string | null;
  type: 'local' | 'para_llevar' | 'domicilio';
  spiceLevel?: 'natural' | 'leve' | 'picante_1' | 'picante_2' | 'picante_3';
  tableNumber: number | null;
  customerName: string | null;
  customerPhone: string | null;
  waiterName: string;
  observations: string | null;
  surcharge: number;
  deliveryCost: number;
  /** Dólares descontados de los productos, ya restados en `total`. Ausente en payloads previos. */
  discount?: number;
  /**
   * Modalidad acordada al crear la orden. Solo llega en domicilio. Los payloads
   * generados antes de esta funcionalidad no traen el campo.
   */
  paymentMethod?: 'efectivo' | 'transferencia' | null;
  /** Opcional para compatibilidad con trabajos creados antes del cobro QR. */
  paymentUrl?: string | null;
  total: number;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
    observations: string | null;
    spiceLevel?: 'natural' | 'leve' | 'picante_1' | 'picante_2' | 'picante_3' | null;
    complimentary: boolean;
  }>;
}

export interface PrintJobPayload {
  payloadVersion: number;
  jobType: Exclude<PrintJobType, 'CASH_WITHDRAWAL' | 'EMPLOYEE_RECEIPT'>;
  revision: number;
  ticketLabel: 'ORDEN' | 'MODIFICACION' | 'REIMPRESION';
  generatedAt: string;
  order: PrintOrderSnapshot;
  changes?: Array<{
    action: 'ADD' | 'UPDATE' | 'REMOVE';
    productName: string;
    previousQuantity: number | null;
    quantity: number | null;
    quantityDelta?: number;
    unitPrice?: number;
    amountDelta?: number;
    surchargeDelta?: number;
    observations: string | null;
    spiceLevel?: 'natural' | 'leve' | 'picante_1' | 'picante_2' | 'picante_3' | null;
    complimentary?: boolean;
  }>;
  reason?: string;
  requestedBy?: string;
}

export interface WithdrawalPrintPayload {
  payloadVersion: 1;
  jobType: 'CASH_WITHDRAWAL';
  withdrawalId: string;
  lines: string[];
}

export interface EmployeeReceiptPayload {
  payloadVersion: 1;
  jobType: 'EMPLOYEE_RECEIPT';
  documentId: string;
  lines: string[];
}

export type AnyPrintJobPayload = PrintJobPayload | WithdrawalPrintPayload | EmployeeReceiptPayload;

export interface ClaimedPrintJob {
  id: string;
  ordenId: string | null;
  retiroId: string | null;
  type: PrintJobType;
  attempts: number;
  maxAttempts: number;
  leaseExpiresAt: string;
  payload: AnyPrintJobPayload;
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
