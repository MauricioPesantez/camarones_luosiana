import { calcularSaldo } from "../types/orden";

export interface PaymentOrder {
  anulada: boolean;
  tipoOperacion?: string;
  estado: string;
  tipoOrden: string;
  total: { toString(): string } | number | string;
  montoPagado: { toString(): string } | number | string;
}

export function payableStates(
  order: { tipoOrden: string },
  origen: "qr" | "lista",
) {
  return origen === "lista" && (!order.tipoOrden || order.tipoOrden === "local")
    ? ["lista", "entregada", "cobrada"]
    : ["pendiente", "en_preparacion", "lista", "entregada", "cobrada"];
}

export function paymentBlockReason(
  order: PaymentOrder,
  origen: "qr" | "lista",
): string | null {
  if (order.tipoOperacion === "CONSUMO_EMPLEADO")
    return "Un consumo de empleado se descuenta de su cuenta";
  if (
    calcularSaldo({
      total: order.total.toString(),
      montoPagado: order.montoPagado.toString(),
    }) <= 0
  )
    return "Esta orden ya fue cobrada";
  if (order.anulada) return "No se puede cobrar una orden anulada";
  if (order.estado === "cancelada")
    return "No se puede cobrar una orden cancelada";
  if (order.estado === "pendiente_aprobacion_stock")
    return "La orden debe ser aprobada por stock antes de poder cobrarla";
  if (!payableStates(order, origen).includes(order.estado))
    return "Las órdenes de mesa solo se pueden cobrar cuando estén listas o entregadas";
  return null;
}
