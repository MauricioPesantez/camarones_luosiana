// Import relativo: este modulo se ejecuta con ts-node en los tests, donde el
// alias @/ no aplica. Mismo criterio que lib/print-jobs.ts.
import { aCentavos, type PartePago } from '../types/cobro';
import { esMetodoPago, type MetodoPago } from '../types/orden';

export class ActoDeCobroInvalido extends Error {}

/**
 * Un acto de cobro deja el saldo exactamente en cero. No existen abonos
 * parciales: si las partes no suman el saldo, el cobro no se registra.
 */
export function validarActoDeCobro(input: {
  saldo: number | string;
  partes: readonly PartePago[];
}): void {
  const saldo = aCentavos(input.saldo);
  if (saldo <= 0) {
    throw new ActoDeCobroInvalido('Esta orden no tiene saldo pendiente');
  }
  if (input.partes.length === 0) {
    throw new ActoDeCobroInvalido('Se requiere al menos una forma de pago');
  }

  const metodosVistos = new Set<MetodoPago>();
  let suma = 0;

  for (const parte of input.partes) {
    if (!esMetodoPago(parte.metodoPago)) {
      throw new ActoDeCobroInvalido('Método de pago inválido');
    }
    if (metodosVistos.has(parte.metodoPago)) {
      throw new ActoDeCobroInvalido(
        'No se puede registrar dos veces el mismo método de pago',
      );
    }
    metodosVistos.add(parte.metodoPago);

    const monto = aCentavos(parte.monto);
    if (monto <= 0) {
      throw new ActoDeCobroInvalido(
        'Cada forma de pago debe tener un monto mayor a cero',
      );
    }
    suma += monto;
  }

  if (suma !== saldo) {
    throw new ActoDeCobroInvalido(
      `El pago debe sumar exactamente $${(saldo / 100).toFixed(2)}`,
    );
  }
}

/**
 * Cada parte de un acto de cobro necesita su propia clave unica, porque cada
 * una es una fila de `Cobro`. Se derivan de una sola clave que manda el
 * cliente, para que reintentar el acto completo no duplique nada.
 */
export function derivarClaveIdempotencia(
  base: string,
  metodoPago: MetodoPago,
): string {
  return `${base}:${metodoPago}`;
}
