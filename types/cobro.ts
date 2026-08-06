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
 * Cuanto efectivo recibe la caja ahora mismo, por UN pago completo de la
 * orden en este metodo. Es un helper de presentacion (UI), deliberadamente
 * independiente de `calcularMovimientosPago`/`PartePago`: en domicilio pagado
 * en efectivo, el motorizado cobra el total al cliente y entrega al local
 * todo menos el envio (que es su ganancia), asi que la caja nunca recibe el
 * envio en ese caso. En cualquier otra combinacion (cualquier metodo en
 * local/para_llevar, o transferencia en domicilio) entra el total completo.
 */
export function montoACobrarEnCaja(input: {
  tipoOrden?: string | null;
  total: number | string;
  costoEnvio?: number | string | null;
  metodoPago: MetodoPago | string;
}): number {
  if (!esMetodoPago(input.metodoPago)) return 0;

  const totalCentavos = aCentavos(input.total);

  if (input.tipoOrden === 'domicilio' && input.metodoPago === 'efectivo') {
    const envioCentavos = aCentavos(input.costoEnvio);
    return aDolares(Math.max(0, totalCentavos - envioCentavos));
  }

  return aDolares(totalCentavos);
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
