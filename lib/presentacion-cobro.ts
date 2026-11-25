import "server-only";
import {
  aCentavos,
  aDolares,
  montoACobrarEnCaja,
  montoARepartirEnMixto,
  partesDeCobroMixto,
} from "../types/cobro";
import { calcularSaldo } from "../types/orden";
import {
  validarActoDeCobro,
  ActoDeCobroInvalido,
} from "./order-payment-validaciones";
import type {
  PresentacionCobro,
  PrevisualizacionMixto,
} from "../types/por-cobrar";

type Importe = number | string | { toString(): string };
export interface OrdenImportes {
  tipoOrden: string;
  total: Importe;
  montoPagado: Importe;
  costoEnvio: Importe | null;
  items?: readonly { subtotal: Importe }[];
}

export function presentarCobro(order: OrdenImportes): PresentacionCobro {
  const saldo = calcularSaldo({
    total: order.total.toString(),
    montoPagado: order.montoPagado.toString(),
  });
  const esPrimerPago = aCentavos(order.montoPagado.toString()) <= 0;
  const costoEnvio = Number(order.costoEnvio ?? 0);
  const base = { tipoOrden: order.tipoOrden, saldo, costoEnvio, esPrimerPago };
  const efectivo = esPrimerPago
    ? montoACobrarEnCaja({ ...base, total: saldo, metodoPago: "efectivo" })
    : saldo;
  const mixto = montoARepartirEnMixto(base);
  const envioPendiente = aDolares(aCentavos(saldo) - aCentavos(mixto));
  const conEnvio =
    order.tipoOrden === "domicilio" && esPrimerPago && costoEnvio > 0;
  return {
    saldo,
    subtotalProductos: aDolares(
      (order.items ?? []).reduce(
        (sum, item) => sum + aCentavos(item.subtotal.toString()),
        0,
      ),
    ),
    efectivo,
    transferencia: saldo,
    mixto,
    envioPendiente,
    explicacionEfectivo: conEnvio
      ? `El cliente paga $${saldo.toFixed(2)}; el motorizado entrega $${efectivo.toFixed(2)} al local y conserva $${costoEnvio.toFixed(2)} del envío.`
      : null,
    explicacionTransferencia: conEnvio
      ? `El local recibe $${saldo.toFixed(2)} por transferencia y entrega $${costoEnvio.toFixed(2)} del envío al motorizado.`
      : null,
    partesEfectivo: [{ metodoPago: "efectivo", monto: saldo }],
    partesTransferencia: [{ metodoPago: "transferencia", monto: saldo }],
  };
}

export function previsualizarMixto(
  order: OrdenImportes,
  valor: unknown,
): PrevisualizacionMixto {
  if (typeof valor !== "string" || !/^\d{1,8}(?:\.\d{1,2})?$/.test(valor)) {
    throw new ActoDeCobroInvalido(
      "Escribe un importe en efectivo válido, con hasta dos decimales",
    );
  }
  const vista = presentarCobro(order);
  const partes = partesDeCobroMixto({
    tipoOrden: order.tipoOrden,
    saldo: vista.saldo,
    costoEnvio: Number(order.costoEnvio ?? 0),
    esPrimerPago: aCentavos(order.montoPagado.toString()) <= 0,
    efectivoEnCaja: valor,
  });
  validarActoDeCobro({ saldo: vista.saldo, partes });
  return {
    partes,
    efectivo: aDolares(aCentavos(valor)),
    transferencia: partes[1].monto,
  };
}
