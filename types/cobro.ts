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
 * Cuanto se reparte entre efectivo y transferencia en un cobro mixto.
 *
 * Es lo que el local REALMENTE recibe, no lo que pago el cliente. En un
 * domicilio el motorizado ya cobro el total al cliente y se quedo el envio,
 * asi que lo unico que trae al local es la venta propia; el mixto reparte esa
 * venta propia. Sumarle el envio seria pedirselo solo para devolverselo
 * enseguida: plata en circulo y un dato falso en el cuadre.
 *
 * `esPrimerPago` es lo que distingue una orden reabierta: ahi el envio ya se
 * liquido con el motorizado en el pago anterior, asi que el saldo nuevo se
 * reparte tal cual. Misma regla que usa `montoACobrarEnCaja` en las pantallas.
 */
export function montoARepartirEnMixto(input: {
  tipoOrden?: string | null;
  saldo: number | string;
  costoEnvio?: number | string | null;
  esPrimerPago: boolean;
}): number {
  return aDolares(
    aCentavos(input.saldo) - envioNoRepartidoEnCentavos(input),
  );
}

/**
 * Traduce el reparto de un mixto del espacio en que trabaja el cobrador -lo que
 * tiene fisicamente delante- al espacio que exige el servidor: `PartePago[]`
 * que suman EXACTAMENTE el saldo de la orden, envio incluido.
 *
 * `efectivoEnCaja` es el billete que entra al cajon. La parte de efectivo le
 * repone el envio que el motorizado ya se habia quedado, de modo que
 * `calcularLiquidacionDomicilio` en el cuadre vuelva a descontarlo y devuelva
 * justo el efectivo que de verdad esta en la caja.
 */
export function partesDeCobroMixto(input: {
  tipoOrden?: string | null;
  saldo: number | string;
  costoEnvio?: number | string | null;
  esPrimerPago: boolean;
  efectivoEnCaja: number | string;
}): PartePago[] {
  const saldoCentavos = aCentavos(input.saldo);
  const envioCentavos = envioNoRepartidoEnCentavos(input);
  const efectivoCentavos = aCentavos(input.efectivoEnCaja) + envioCentavos;

  return [
    { metodoPago: 'efectivo', monto: aDolares(efectivoCentavos) },
    {
      metodoPago: 'transferencia',
      monto: aDolares(saldoCentavos - efectivoCentavos),
    },
  ];
}

/**
 * El envio que el mixto NO reparte y que hay que reponer al armar las partes.
 * Cero fuera de domicilio y en cualquier pago que no sea el primero. Acotado al
 * saldo para que el reparto nunca quede negativo.
 */
function envioNoRepartidoEnCentavos(input: {
  tipoOrden?: string | null;
  saldo: number | string;
  costoEnvio?: number | string | null;
  esPrimerPago: boolean;
}): number {
  if (input.tipoOrden !== 'domicilio' || !input.esPrimerPago) return 0;
  return Math.min(aCentavos(input.saldo), aCentavos(input.costoEnvio));
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
