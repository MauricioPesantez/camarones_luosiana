import { beforeEach, describe, expect, it } from "vitest";

import { Order } from "@/domain/order/Order";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { isErr, isOk } from "@/domain/shared/Result";

import { MarcarOrdenLista } from "./MarcarOrdenLista";
import { FakeOrderRepository, FakeRealtimeNotifier } from "./testFakes";

/** Crea una orden de SALON en el estado indicado para las pruebas. */
function ordenEnEstado(id: string, estado: OrderStatus): Order {
  return Order.crear({
    id,
    numero: 1,
    canal: OrderChannel.SALON,
    creadoPorId: "user-1",
    mesa: 3,
    estado,
  });
}

describe("MarcarOrdenLista", () => {
  let orders: FakeOrderRepository;
  let notifier: FakeRealtimeNotifier;
  let marcarLista: MarcarOrdenLista;

  beforeEach(() => {
    orders = new FakeOrderRepository();
    notifier = new FakeRealtimeNotifier();
    marcarLista = new MarcarOrdenLista(orders, notifier);
  });

  it("transiciona una orden EN_PREPARACION a LISTA y notifica al KDS (R6.3, R15.1)", async () => {
    orders.agregar(ordenEnEstado("ord-1", OrderStatus.EN_PREPARACION));

    const resultado = await marcarLista.ejecutar("ord-1");

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.estado).toBe(OrderStatus.LISTA);
    }
    expect(await orders.obtener("ord-1")).not.toBeNull();
    expect(notifier.notificados).toEqual(["orders"]);
  });

  it("rechaza si la orden no existe", async () => {
    const resultado = await marcarLista.ejecutar("inexistente");

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_NO_ENCONTRADA");
    }
    expect(notifier.notificados).toEqual([]);
  });

  it("rechaza marcar lista una orden que no está EN_PREPARACION y conserva su estado (R6.7)", async () => {
    orders.agregar(ordenEnEstado("ord-2", OrderStatus.ENVIADA_A_COCINA));

    const resultado = await marcarLista.ejecutar("ord-2");

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_TRANSICION_INVALIDA");
    }
    const orden = await orders.obtener("ord-2");
    expect(orden?.estado).toBe(OrderStatus.ENVIADA_A_COCINA);
    expect(notifier.notificados).toEqual([]);
  });

  it("rechaza marcar lista una orden ya LISTA (idempotencia, sin doble notificación)", async () => {
    orders.agregar(ordenEnEstado("ord-3", OrderStatus.LISTA));

    const resultado = await marcarLista.ejecutar("ord-3");

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_TRANSICION_INVALIDA");
    }
    expect(notifier.notificados).toEqual([]);
  });
});
