import { esMetodoPago } from "./orden";

export interface OrdenParaCuadre {
  cobrada: boolean;
  tipoOrden?: string | null;
  total: number | string;
  costoEnvio?: number | string | null;
  metodoPago?: string | null;
}

export interface ResumenCuadre {
  totalOrdenes: number;
  ordenesCobradas: number;
  ordenesSinCobrar: number;
  montoTotalOrdenes: number;
  montoSinCobrar: number;
  totalCobrado: number;
  efectivoVentasDirectas: number;
  efectivoCobradoMotorizados: number;
  efectivoEntregadoMotorizados: number;
  efectivoEnCaja: number;
  transferencias: number;
}

function aCentavos(valor: number | string | null | undefined): number {
  return Math.round(Number(valor ?? 0) * 100);
}

function aDolares(centavos: number): number {
  return centavos / 100;
}

/**
 * Resume solo dinero efectivamente cobrado.
 *
 * En domicilio, el costo de envio pertenece al motorizado:
 * - pago en efectivo: el motorizado entrega al local total menos envio;
 * - pago por transferencia: el local recibe el total y entrega el envio en efectivo.
 */
export function calcularResumenCuadre(
  ordenes: readonly OrdenParaCuadre[],
): ResumenCuadre {
  const resumen = ordenes.reduce(
    (acumulado, orden) => {
      const total = aCentavos(orden.total);
      acumulado.montoTotalOrdenes += total;

      if (!orden.cobrada) {
        acumulado.ordenesSinCobrar += 1;
        acumulado.montoSinCobrar += total;
        return acumulado;
      }

      acumulado.ordenesCobradas += 1;
      acumulado.totalCobrado += total;

      if (!esMetodoPago(orden.metodoPago)) {
        return acumulado;
      }

      const costoEnvio = Math.max(0, aCentavos(orden.costoEnvio));

      if (orden.tipoOrden === "domicilio") {
        if (orden.metodoPago === "efectivo") {
          acumulado.efectivoCobradoMotorizados += Math.max(
            0,
            total - costoEnvio,
          );
        } else {
          acumulado.transferencias += total;
          acumulado.efectivoEntregadoMotorizados += costoEnvio;
        }
        return acumulado;
      }

      if (orden.metodoPago === "efectivo") {
        acumulado.efectivoVentasDirectas += total;
      } else {
        acumulado.transferencias += total;
      }

      return acumulado;
    },
    {
      ordenesCobradas: 0,
      ordenesSinCobrar: 0,
      montoTotalOrdenes: 0,
      montoSinCobrar: 0,
      totalCobrado: 0,
      efectivoVentasDirectas: 0,
      efectivoCobradoMotorizados: 0,
      efectivoEntregadoMotorizados: 0,
      transferencias: 0,
    },
  );

  return {
    totalOrdenes: ordenes.length,
    ordenesCobradas: resumen.ordenesCobradas,
    ordenesSinCobrar: resumen.ordenesSinCobrar,
    montoTotalOrdenes: aDolares(resumen.montoTotalOrdenes),
    montoSinCobrar: aDolares(resumen.montoSinCobrar),
    totalCobrado: aDolares(resumen.totalCobrado),
    efectivoVentasDirectas: aDolares(resumen.efectivoVentasDirectas),
    efectivoCobradoMotorizados: aDolares(
      resumen.efectivoCobradoMotorizados,
    ),
    efectivoEntregadoMotorizados: aDolares(
      resumen.efectivoEntregadoMotorizados,
    ),
    efectivoEnCaja: aDolares(
      resumen.efectivoVentasDirectas +
        resumen.efectivoCobradoMotorizados -
        resumen.efectivoEntregadoMotorizados,
    ),
    transferencias: aDolares(resumen.transferencias),
  };
}
