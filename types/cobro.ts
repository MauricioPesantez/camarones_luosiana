import { esMetodoPago, type MetodoPago } from './orden';

export interface MovimientosCobro {
  efectivoRecibido: number;
  efectivoEntregado: number;
  transferenciaRecibida: number;
}

/**
 * Lo que entra a la caja del local al cerrar el cobro, en el metodo elegido.
 *
 * Es el mismo numero que se asienta en `Cobro`, derivado de los movimientos para
 * que la pantalla de cobro no pueda mostrar una cifra distinta a la contabilizada.
 * En domicilio con efectivo el envio nunca entra: lo conserva el motorizado.
 */
export function montoACobrarEnCaja(input: {
  tipoOrden?: string | null;
  total: number | string;
  costoEnvio?: number | string | null;
  metodoPago: MetodoPago | string;
}): number {
  const movimientos = calcularMovimientosCobro(input);
  return movimientos.efectivoRecibido + movimientos.transferenciaRecibida;
}

/**
 * Movimientos reales del local. En domicilio el envio pertenece al motorizado:
 * efectivo entra sin el envio; transferencia entra completa y el envio sale de caja.
 */
export function calcularMovimientosCobro(input: {
  tipoOrden?: string | null;
  total: number | string;
  costoEnvio?: number | string | null;
  metodoPago: MetodoPago | string;
}): MovimientosCobro {
  if (!esMetodoPago(input.metodoPago)) {
    return {
      efectivoRecibido: 0,
      efectivoEntregado: 0,
      transferenciaRecibida: 0,
    };
  }

  const totalCentavos = Math.round(Number(input.total) * 100);
  const envioCentavos = Math.max(0, Math.round(Number(input.costoEnvio ?? 0) * 100));
  const dinero = (centavos: number) => centavos / 100;

  if (input.tipoOrden === 'domicilio') {
    return input.metodoPago === 'efectivo'
      ? {
          efectivoRecibido: dinero(Math.max(0, totalCentavos - envioCentavos)),
          efectivoEntregado: 0,
          transferenciaRecibida: 0,
        }
      : {
          efectivoRecibido: 0,
          efectivoEntregado: dinero(envioCentavos),
          transferenciaRecibida: dinero(totalCentavos),
        };
  }

  return input.metodoPago === 'efectivo'
    ? {
        efectivoRecibido: dinero(totalCentavos),
        efectivoEntregado: 0,
        transferenciaRecibida: 0,
      }
    : {
        efectivoRecibido: 0,
        efectivoEntregado: 0,
        transferenciaRecibida: dinero(totalCentavos),
      };
}
