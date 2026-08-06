import { esMetodoPago, type MetodoPago } from './orden';

export interface MovimientosPago {
  /** Lo que el cliente entrego en efectivo en este pago, en bruto. */
  efectivoRecibido: number;
  /** Lo que el cliente transfirio en este pago, en bruto. */
  transferenciaRecibida: number;
}

export interface PartePago {
  metodoPago: MetodoPago;
  monto: number;
  comprobanteTransferenciaKey?: string | null;
}

export function aCentavos(valor: number | string | null | undefined): number {
  return Math.round(Number(valor ?? 0) * 100);
}

export function aDolares(centavos: number): number {
  return centavos / 100;
}

/**
 * Movimientos de un pago suelto. Deliberadamente NO sabe de envios ni de
 * ordenes: guarda lo que el cliente entrego, en bruto. La liquidacion del
 * envio con el motorizado vive en `calcularLiquidacionDomicilio`, porque
 * depende de la orden completa y no de un pago en particular.
 */
export function calcularMovimientosPago(input: {
  metodoPago: MetodoPago | string;
  monto: number | string;
}): MovimientosPago {
  if (!esMetodoPago(input.metodoPago)) {
    return { efectivoRecibido: 0, transferenciaRecibida: 0 };
  }

  const monto = aDolares(aCentavos(input.monto));
  return input.metodoPago === 'efectivo'
    ? { efectivoRecibido: monto, transferenciaRecibida: 0 }
    : { efectivoRecibido: 0, transferenciaRecibida: monto };
}

/**
 * Dato de presentacion que se materializa en `Orden.metodoPago`. El cuadre no
 * lo usa: el dinero se cuenta sumando las filas de `Cobro`.
 */
export function resumirMetodoPago(
  pagos: readonly { metodoPago: string }[],
): MetodoPago | 'mixto' | null {
  const metodos = new Set(
    pagos
      .map((pago) => pago.metodoPago)
      .filter((metodo): metodo is MetodoPago => esMetodoPago(metodo)),
  );

  if (metodos.size === 0) return null;
  if (metodos.size > 1) return 'mixto';
  return [...metodos][0];
}
