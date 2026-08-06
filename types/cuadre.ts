import { esMetodoPago, obtenerCostoEnvio } from "./orden";
import { ESTADO_RETIRO_ANULADO } from "./retiro";

export interface OrdenParaCuadre {
  cobrada: boolean;
  tipoOrden?: string | null;
  total: number | string;
  costoEnvio?: number | string | null;
  metodoPago?: string | null;
  estadoCobro?: string | null;
  /** Anulada logicamente: se sigue viendo, pero no cuenta como venta. */
  anulada?: boolean | null;
}

export interface RetiroParaCuadre {
  monto: number | string;
  estado: string;
}

export interface ResumenCuadre {
  /** Ordenes que cuentan: las anuladas quedan fuera de este total. */
  totalOrdenes: number;
  ordenesCobradas: number;
  ordenesSinCobrar: number;
  /** Ordenes anuladas por un admin. Se informan, no se suman. */
  ordenesAnuladas: number;
  /** Venta que se perdio al anular, sin el envio. Solo informativa. */
  ventasAnuladas: number;
  /** Venta del local: totales sin el envio, cobradas y no cobradas. */
  ventasTotales: number;
  ventasSinCobrar: number;
  ventasCobradas: number;
  efectivoVentasDirectas: number;
  efectivoCobradoMotorizados: number;
  efectivoEntregadoMotorizados: number;
  efectivoEnCaja: number;
  /** Venta propia cobrada por transferencia, sin el envio. */
  transferenciasVentas: number;
  /** Lo que realmente llego al banco: incluye el envio que se devuelve. */
  depositosRecibidos: number;
  /** Dinero del motorizado que paso por las ordenes cobradas. No es ingreso. */
  enviosMotorizados: number;
  /** Efectivo que los empleados sacaron de la caja. Los anulados no cuentan. */
  retirosEfectivo: number;
  cantidadRetiros: number;
  /**
   * Deuda con el cliente, no una venta: es lo que el cliente pago y todavia hay
   * que devolverle, asi que va en bruto e incluye el envio.
   */
  montoReembolsoPendiente: number;
}

function aCentavos(valor: number | string | null | undefined): number {
  return Math.round(Number(valor ?? 0) * 100);
}

function aDolares(centavos: number): number {
  return centavos / 100;
}

/**
 * Resume el dinero del dia.
 *
 * Regla que manda sobre todo lo demas: el costo de envio no es del local, asi
 * que no entra en ninguna cifra de venta. Se descuenta de toda orden a
 * domicilio, sin importar el metodo de pago ni si la orden es anterior a que
 * se registrara la modalidad.
 *
 * De ahi se desprende la liquidacion con el motorizado:
 * - efectivo: el motorizado cobra el total al cliente y entrega al local la
 *   venta propia; el envio nunca toca la caja;
 * - transferencia: el cliente deposita el total, asi que el banco recibe el
 *   envio y el local se lo devuelve al motorizado en efectivo.
 *
 * Los retiros son la otra mitad de la caja: gastos que los empleados pagan con
 * el efectivo del dia. Solo tocan `efectivoEnCaja`; no son una venta ni una
 * venta negativa, asi que ninguna cifra de venta los mira.
 *
 * Una orden anulada se trata igual que un retiro anulado: se recibe, se informa
 * aparte y no entra en ninguna cifra. Que el dato llegue y se descarte aqui (en
 * vez de filtrarse en la consulta) es lo que permite mostrarla tachada en la
 * pantalla sin arriesgar que alguna cifra la sume por descuido.
 */
export function calcularResumenCuadre(
  ordenes: readonly OrdenParaCuadre[],
  retiros: readonly RetiroParaCuadre[] = [],
): ResumenCuadre {
  const ordenesAnuladas = ordenes.filter((orden) => orden.anulada === true);
  const ordenesVigentes = ordenes.filter((orden) => orden.anulada !== true);
  const ventasAnuladas = ordenesAnuladas.reduce(
    (total, orden) =>
      total + aCentavos(orden.total) - aCentavos(obtenerCostoEnvio(orden)),
    0,
  );

  const resumen = ordenesVigentes.reduce(
    (acumulado, orden) => {
      const total = aCentavos(orden.total);
      const costoEnvio = aCentavos(obtenerCostoEnvio(orden));
      const ventaPropia = total - costoEnvio;

      acumulado.ventasTotales += ventaPropia;

      if (!orden.cobrada) {
        acumulado.ordenesSinCobrar += 1;
        acumulado.ventasSinCobrar += ventaPropia;
        return acumulado;
      }

      acumulado.ordenesCobradas += 1;
      acumulado.ventasCobradas += ventaPropia;
      acumulado.enviosMotorizados += costoEnvio;

      // El reembolso es lo que hay que devolverle al cliente: va en bruto,
      // porque el cliente pago el envio junto con el pedido.
      if (orden.estadoCobro === "REEMBOLSO_PENDIENTE") {
        acumulado.montoReembolsoPendiente += total;
      }

      // Ordenes viejas cobradas sin metodo registrado: cuentan como venta,
      // pero no se puede decir donde quedo la plata.
      if (!esMetodoPago(orden.metodoPago)) {
        return acumulado;
      }

      if (orden.tipoOrden === "domicilio") {
        if (orden.metodoPago === "efectivo") {
          acumulado.efectivoCobradoMotorizados += ventaPropia;
        } else {
          acumulado.transferenciasVentas += ventaPropia;
          acumulado.depositosRecibidos += total;
          acumulado.efectivoEntregadoMotorizados += costoEnvio;
        }
        return acumulado;
      }

      if (orden.metodoPago === "efectivo") {
        acumulado.efectivoVentasDirectas += ventaPropia;
      } else {
        acumulado.transferenciasVentas += ventaPropia;
        acumulado.depositosRecibidos += ventaPropia;
      }

      return acumulado;
    },
    {
      ordenesCobradas: 0,
      ordenesSinCobrar: 0,
      ventasTotales: 0,
      ventasSinCobrar: 0,
      ventasCobradas: 0,
      efectivoVentasDirectas: 0,
      efectivoCobradoMotorizados: 0,
      efectivoEntregadoMotorizados: 0,
      transferenciasVentas: 0,
      depositosRecibidos: 0,
      enviosMotorizados: 0,
      montoReembolsoPendiente: 0,
    },
  );

  const retirosRegistrados = retiros.filter(
    (retiro) => retiro.estado !== ESTADO_RETIRO_ANULADO,
  );
  const retirosEfectivo = retirosRegistrados.reduce(
    (total, retiro) => total + aCentavos(retiro.monto),
    0,
  );

  return {
    totalOrdenes: ordenesVigentes.length,
    ordenesCobradas: resumen.ordenesCobradas,
    ordenesSinCobrar: resumen.ordenesSinCobrar,
    ordenesAnuladas: ordenesAnuladas.length,
    ventasAnuladas: aDolares(ventasAnuladas),
    ventasTotales: aDolares(resumen.ventasTotales),
    ventasSinCobrar: aDolares(resumen.ventasSinCobrar),
    ventasCobradas: aDolares(resumen.ventasCobradas),
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
        resumen.efectivoEntregadoMotorizados -
        retirosEfectivo,
    ),
    transferenciasVentas: aDolares(resumen.transferenciasVentas),
    depositosRecibidos: aDolares(resumen.depositosRecibidos),
    enviosMotorizados: aDolares(resumen.enviosMotorizados),
    retirosEfectivo: aDolares(retirosEfectivo),
    cantidadRetiros: retirosRegistrados.length,
    montoReembolsoPendiente: aDolares(resumen.montoReembolsoPendiente),
  };
}
