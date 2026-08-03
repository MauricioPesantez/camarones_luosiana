export function isConfirmedPaymentInRange(
  payment: {
    cobrada: boolean;
    fechaCobro?: Date | null;
    cobro?: { createdAt: Date; estado: string } | null;
  },
  range: { inicio: Date; fin: Date },
): boolean {
  const movementDate = payment.cobro?.createdAt ?? payment.fechaCobro;
  return Boolean(
    payment.cobrada &&
      movementDate &&
      movementDate >= range.inicio &&
      movementDate < range.fin &&
      (!payment.cobro ||
        ['CONFIRMADO', 'REEMBOLSO_PENDIENTE'].includes(payment.cobro.estado)),
  );
}
