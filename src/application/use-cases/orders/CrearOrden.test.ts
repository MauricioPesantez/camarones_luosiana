import { beforeEach, describe, expect, it } from "vitest";

import { Money } from "@/domain/order/Money";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { isErr, isOk } from "@/domain/shared/Result";

import { CrearOrden } from "./CrearOrden";
import { FakeIdGenerator, FakeOrderRepository } from "./testFakes";

describe("CrearOrden", () => {
  let orders: FakeOrderRepository;
  let crearOrden: CrearOrden;

  beforeEach(() => {
    orders = new FakeOrderRepository();
    crearOrden = new CrearOrden(orders, new FakeIdGenerator());
  });

  it("crea una orden de SALON con mesa en estado ABIERTA", async () => {
    const resultado = await crearOrden.ejecutar({
      canal: OrderChannel.SALON,
      creadoPorId: "user-1",
      mesa: 4,
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.canal).toBe(OrderChannel.SALON);
      expect(resultado.value.mesa).toBe(4);
      expect(resultado.value.estado).toBe(OrderStatus.ABIERTA);
    }
    expect(orders.store.size).toBe(1);
  });

  it("rechaza una orden de SALON sin mesa (R4.4)", async () => {
    const resultado = await crearOrden.ejecutar({
      canal: OrderChannel.SALON,
      creadoPorId: "user-1",
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_SALON_SIN_MESA");
    }
    expect(orders.store.size).toBe(0);
  });

  it("crea una orden de DELIVERY con dirección y registra el envío en el total (R4.2, R8.4)", async () => {
    const resultado = await crearOrden.ejecutar({
      canal: OrderChannel.DELIVERY,
      creadoPorId: "user-1",
      clienteNombre: "Ana",
      clienteDireccion: "Av. Siempre Viva 742",
      envio: Money.de(1.5),
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.canal).toBe(OrderChannel.DELIVERY);
      // envases 0.50 + envio 1.50 = 2.00 (sin ítems aún).
      expect(resultado.value.total.toDecimal()).toBe(2);
    }
  });

  it("rechaza una orden de DELIVERY sin dirección (R4.5)", async () => {
    const resultado = await crearOrden.ejecutar({
      canal: OrderChannel.DELIVERY,
      creadoPorId: "user-1",
      clienteNombre: "Ana",
      clienteDireccion: "   ",
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_DELIVERY_SIN_DIRECCION");
    }
    expect(orders.store.size).toBe(0);
  });

  it("crea una orden de RETIRAR sin mesa ni dirección (R4.3)", async () => {
    const resultado = await crearOrden.ejecutar({
      canal: OrderChannel.RETIRAR,
      creadoPorId: "user-1",
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.estado).toBe(OrderStatus.ABIERTA);
    }
  });
});
