import { beforeEach, describe, expect, it } from "vitest";

import { MenuItem } from "@/domain/menu/MenuItem";
import { Money } from "@/domain/order/Money";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { isErr, isOk } from "@/domain/shared/Result";

import { CrearOrdenConItems } from "./CrearOrdenConItems";
import {
  FakeIdGenerator,
  FakeMenuRepository,
  FakeOrderRepository,
  FakeTransactionRunner,
} from "./testFakes";

function crearPlato(id: string, stock: number, precio = 5): MenuItem {
  return MenuItem.crear({
    id,
    nombre: `Plato ${id}`,
    categoriaId: "cat-1",
    precio: Money.de(precio),
    stockDelDia: stock,
    disponible: true,
  });
}

describe("CrearOrdenConItems", () => {
  let orders: FakeOrderRepository;
  let menu: FakeMenuRepository;
  let tx: FakeTransactionRunner;
  let crear: CrearOrdenConItems;

  beforeEach(() => {
    orders = new FakeOrderRepository();
    menu = new FakeMenuRepository();
    tx = new FakeTransactionRunner(orders, menu);
    crear = new CrearOrdenConItems(tx, new FakeIdGenerator());
  });

  it("crea la orden ABIERTA con sus ítems y descuenta el stock (R4, R5.1, R8.1)", async () => {
    menu.agregar(crearPlato("menu-1", 10, 5));
    menu.agregar(crearPlato("menu-2", 10, 3));

    const resultado = await crear.ejecutar({
      canal: OrderChannel.SALON,
      creadoPorId: "user-1",
      mesa: 4,
      items: [
        { menuItemId: "menu-1", cantidad: 2 },
        { menuItemId: "menu-2", cantidad: 1 },
      ],
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.estado).toBe(OrderStatus.ABIERTA);
      expect(resultado.value.items).toHaveLength(2);
      // 2×5 + 1×3 = 13
      expect(resultado.value.subtotal.toDecimal()).toBe(13);
    }
    expect((await menu.obtener("menu-1"))?.stockDelDia).toBe(8);
    expect((await menu.obtener("menu-2"))?.stockDelDia).toBe(9);
  });

  it("revierte todo si un ítem no tiene stock suficiente (Property 7)", async () => {
    menu.agregar(crearPlato("menu-1", 10, 5));
    menu.agregar(crearPlato("menu-2", 1, 3));

    const resultado = await crear.ejecutar({
      canal: OrderChannel.SALON,
      creadoPorId: "user-1",
      mesa: 4,
      items: [
        { menuItemId: "menu-1", cantidad: 2 },
        { menuItemId: "menu-2", cantidad: 5 },
      ],
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("MENU_ITEM_STOCK_INSUFICIENTE");
    }
    // No se persistió ninguna orden.
    expect(orders.store.size).toBe(0);
  });

  it("rechaza una orden de salón sin mesa (R4.4)", async () => {
    const resultado = await crear.ejecutar({
      canal: OrderChannel.SALON,
      creadoPorId: "user-1",
      items: [],
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_SALON_SIN_MESA");
    }
  });

  it("rechaza una orden de delivery sin dirección (R4.5)", async () => {
    const resultado = await crear.ejecutar({
      canal: OrderChannel.DELIVERY,
      creadoPorId: "user-1",
      items: [],
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_DELIVERY_SIN_DIRECCION");
    }
  });

  it("aplica el envío y los envases en delivery (R8.2, R8.4)", async () => {
    menu.agregar(crearPlato("menu-1", 10, 5));

    const resultado = await crear.ejecutar({
      canal: OrderChannel.DELIVERY,
      creadoPorId: "user-1",
      clienteDireccion: "Av. Siempre Viva 123",
      envio: Money.de(2),
      items: [{ menuItemId: "menu-1", cantidad: 2 }],
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      // subtotal 10 + envases 0.5 + envío 2 = 12.5
      expect(resultado.value.subtotal.toDecimal()).toBe(10);
      expect(resultado.value.envases.toDecimal()).toBe(0.5);
      expect(resultado.value.envio.toDecimal()).toBe(2);
      expect(resultado.value.total.toDecimal()).toBe(12.5);
    }
  });
});
