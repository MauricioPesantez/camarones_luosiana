import { beforeEach, describe, expect, it } from "vitest";

import { MenuItem } from "@/domain/menu/MenuItem";
import { Money } from "@/domain/order/Money";
import { Order } from "@/domain/order/Order";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { isErr, isOk } from "@/domain/shared/Result";

import { AgregarItemAOrden } from "./AgregarItemAOrden";
import { QuitarItem } from "./QuitarItem";
import {
  FakeIdGenerator,
  FakeMenuRepository,
  FakeOrderRepository,
  FakeTransactionRunner,
} from "./testFakes";

function crearOrden(estado: OrderStatus = OrderStatus.ABIERTA): Order {
  return Order.crear({
    id: "order-1",
    numero: 1,
    canal: OrderChannel.SALON,
    creadoPorId: "user-1",
    mesa: 1,
    estado,
  });
}

function crearPlato(stock: number): MenuItem {
  return MenuItem.crear({
    id: "menu-1",
    nombre: "Ceviche",
    categoriaId: "cat-1",
    precio: Money.de(5),
    stockDelDia: stock,
    disponible: true,
  });
}

describe("AgregarItemAOrden / QuitarItem", () => {
  let orders: FakeOrderRepository;
  let menu: FakeMenuRepository;
  let tx: FakeTransactionRunner;
  let agregar: AgregarItemAOrden;
  let quitar: QuitarItem;

  beforeEach(() => {
    orders = new FakeOrderRepository();
    menu = new FakeMenuRepository();
    tx = new FakeTransactionRunner(orders, menu);
    agregar = new AgregarItemAOrden(tx, new FakeIdGenerator());
    quitar = new QuitarItem(tx);
  });

  it("decrementa el stock al agregar y recalcula el subtotal (R3.3, R8.1)", async () => {
    orders.agregar(crearOrden());
    menu.agregar(crearPlato(10));

    const resultado = await agregar.ejecutar({
      orderId: "order-1",
      menuItemId: "menu-1",
      cantidad: 3,
    });

    expect(isOk(resultado)).toBe(true);
    expect((await menu.obtener("menu-1"))?.stockDelDia).toBe(7);
    if (isOk(resultado)) {
      expect(resultado.value.subtotal.toDecimal()).toBe(15);
      expect(resultado.value.items).toHaveLength(1);
    }
  });

  it("conserva el stock: agregar y luego quitar lo restaura (R5.2)", async () => {
    orders.agregar(crearOrden());
    menu.agregar(crearPlato(10));

    await agregar.ejecutar({
      orderId: "order-1",
      menuItemId: "menu-1",
      cantidad: 4,
    });
    expect((await menu.obtener("menu-1"))?.stockDelDia).toBe(6);

    const orden = await orders.obtener("order-1");
    const itemId = orden!.items[0].id;

    const resultado = await quitar.ejecutar({
      orderId: "order-1",
      orderItemId: itemId,
    });

    expect(isOk(resultado)).toBe(true);
    // Stock conservado: vuelve al valor inicial.
    expect((await menu.obtener("menu-1"))?.stockDelDia).toBe(10);
    if (isOk(resultado)) {
      expect(resultado.value.items).toHaveLength(0);
      expect(resultado.value.subtotal.toDecimal()).toBe(0);
    }
  });

  it("aplica auto-86 cuando el stock llega a 0 (R3.4)", async () => {
    orders.agregar(crearOrden());
    menu.agregar(crearPlato(2));

    await agregar.ejecutar({
      orderId: "order-1",
      menuItemId: "menu-1",
      cantidad: 2,
    });

    const plato = await menu.obtener("menu-1");
    expect(plato?.stockDelDia).toBe(0);
    expect(plato?.disponible).toBe(false);
  });

  it("rechaza agregar un plato no disponible (R3.5)", async () => {
    orders.agregar(crearOrden());
    const plato = crearPlato(5);
    plato.establecerDisponibilidad(false);
    menu.agregar(plato);

    const resultado = await agregar.ejecutar({
      orderId: "order-1",
      menuItemId: "menu-1",
      cantidad: 1,
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("MENU_ITEM_NO_DISPONIBLE");
    }
    // El stock no se tocó.
    expect((await menu.obtener("menu-1"))?.stockDelDia).toBe(5);
  });

  it("permite agregar ítems a una orden ENTREGADA (running tab, R5.5)", async () => {
    orders.agregar(crearOrden(OrderStatus.ENTREGADA));
    menu.agregar(crearPlato(10));

    const resultado = await agregar.ejecutar({
      orderId: "order-1",
      menuItemId: "menu-1",
      cantidad: 1,
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.estado).toBe(OrderStatus.ENTREGADA);
      expect(resultado.value.items).toHaveLength(1);
    }
  });

  it("no permite quitar ítems de una orden ENTREGADA (R5.1)", async () => {
    const orden = crearOrden(OrderStatus.ENTREGADA);
    orders.agregar(orden);
    menu.agregar(crearPlato(10));

    const resultado = await quitar.ejecutar({
      orderId: "order-1",
      orderItemId: "cualquiera",
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_ESTADO_NO_PERMITE_QUITAR");
    }
  });
});
