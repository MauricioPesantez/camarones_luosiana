export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-EC');
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('es-EC');
}
