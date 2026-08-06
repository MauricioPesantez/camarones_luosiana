export function isConfirmedPaymentInRange(
  payment: {
    cobrada: boolean;
    fechaCobro?: Date | null;
    pagos?: readonly { createdAt: Date; estado: string }[] | null;
  },
  range: { inicio: Date; fin: Date },
): boolean {
  if (!payment.cobrada) return false;

  const pagos = payment.pagos ?? [];
  // Con multipago la orden cuenta como cobrada en la fecha del pago que la
  // cerro, es decir el ultimo. Un pago reembolsado no cierra nada.
  const vigentes = pagos.filter((pago) =>
    ['CONFIRMADO', 'REEMBOLSO_PENDIENTE'].includes(pago.estado),
  );
  if (pagos.length > 0 && vigentes.length === 0) return false;

  const movementDate = vigentes.length
    ? vigentes.reduce((ultimo, pago) =>
        pago.createdAt > ultimo.createdAt ? pago : ultimo,
      ).createdAt
    : payment.fechaCobro;

  return Boolean(
    movementDate && movementDate >= range.inicio && movementDate < range.fin,
  );
}
