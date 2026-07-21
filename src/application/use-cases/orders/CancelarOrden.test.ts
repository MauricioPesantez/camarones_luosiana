import { beforeEach, describe, expect, it } from "vitest";

import type { SessionUser } from "@/application/ports/AuthService";
import { MenuItem } from "@/domain/menu/MenuItem";
import { Money } from "@/domain/order/Money";
import { Order } from "@/domain/order/Order";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderItem } from "@/domain/order/OrderItem";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { isErr, isOk } from "@/domain/shared/Result";
import { Role } from "@/domain/user/Role";

import { ACCION_CANCELAR_ORDEN, CancelarOrden } from "./CancelarOrden";
import {
  FakeAuditRepository,
  FakeClock,
  FakeIdGenerator,
  FakeMenuRepository,
  FakeOrderRepository,
  FakeTransactionRunner,
} from "./testFakes";

const ADMIN: SessionUser = {
  id: "admin-1",
  usuario: "admin",
  nombre: "Admin",
  roles: [Role.ADMIN],
  puedeCobrar: true,
};

const MESERO: SessionUser = {
  id: "mesero-1",
  usuario: "mesero",
  nombre: "Mesero",
  roles: [Role.MESERO],
  puedeCobrar: false,
};

function crearOrdenConItem(estado: OrderStatus, cantidad = 2): Order {
  const order = Order.crear({
    id: "order-1",
    numero: 1,
    canal: OrderChannel.SALON,
    creadoPorId: "mesero-1",
    mesa: 1,
  });
  order.agregarItem(
    OrderItem.crear({
      id: "item-1",
      menuItemId: "menu-1",
      nombrePlato: "Ceviche",
      precioUnit: Money.de(5),
      cantidad,
    }),
  );
  order.recalcular();
  // Lleva la orden hasta el estado deseado respetando la máquina de estados.
  if (estado !== OrderStatus.ABIERTA) {
    order.transicionarA(OrderStatus.ENVIADA_A_COCINA);
  }
  if (
    estado === OrderStatus.EN_PREPARACION ||
    estado === OrderStatus.COBRADA
  ) {
    order.transicionarA(OrderStatus.EN_PREPARACION);
  }
  if (estado === OrderStatus.COBRADA) {
    order.transicionarA(OrderStatus.LISTA);
    order.transicionarA(OrderStatus.ENTREGADA);
    order.transicionarA(OrderStatus.COBRADA);
  }
  return order;
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

describe("CancelarOrden", () => {
  let orders: FakeOrderRepository;
  let menu: FakeMenuRepository;
  let audit: FakeAuditRepository;
  let cancelar: CancelarOrden;

  beforeEach(() => {
    orders = new FakeOrderRepository();
    menu = new FakeMenuRepository();
    audit = new FakeAuditRepository();
    const tx = new FakeTransactionRunner(orders, menu, audit);
    cancelar = new CancelarOrden(tx, new FakeIdGenerator("audit"), new FakeClock());
  });

  it("deniega a un no-admin cancelar una orden ENVIADA_A_COCINA (R7.2)", async () => {
    orders.agregar(crearOrdenConItem(OrderStatus.ENVIADA_A_COCINA));
    menu.agregar(crearPlato(8));

    const resultado = await cancelar.ejecutar({
      orderId: "order-1",
      actor: MESERO,
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_CANCELACION_REQUIERE_ADMIN");
    }
    // No se restauró stock ni se auditó.
    expect((await menu.obtener("menu-1"))?.stockDelDia).toBe(8);
    expect(audit.entries).toHaveLength(0);
    expect((await orders.obtener("order-1"))?.estado).toBe(
      OrderStatus.ENVIADA_A_COCINA,
    );
  });

  it("deniega a un no-admin cancelar una orden COBRADA (R7.2)", async () => {
    orders.agregar(crearOrdenConItem(OrderStatus.COBRADA));
    menu.agregar(crearPlato(8));

    const resultado = await cancelar.ejecutar({
      orderId: "order-1",
      actor: MESERO,
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("ORDER_CANCELACION_REQUIERE_ADMIN");
    }
    expect(audit.entries).toHaveLength(0);
  });

  it("admin cancela una orden enviada: restaura stock y crea AuditEntry (R7.1, R7.3, R16.1)", async () => {
    orders.agregar(crearOrdenConItem(OrderStatus.ENVIADA_A_COCINA, 2));
    menu.agregar(crearPlato(8));

    const resultado = await cancelar.ejecutar({
      orderId: "order-1",
      actor: ADMIN,
      motivo: "Cliente se retiró",
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.estado).toBe(OrderStatus.CANCELADA);
    }
    // Stock restaurado por la cantidad del ítem.
    expect((await menu.obtener("menu-1"))?.stockDelDia).toBe(10);
    // Auditoría registrada con los datos de la acción.
    expect(audit.entries).toHaveLength(1);
    const entrada = audit.entries[0];
    expect(entrada.accion).toBe(ACCION_CANCELAR_ORDEN);
    expect(entrada.usuarioId).toBe(ADMIN.id);
    expect(entrada.entidadTipo).toBe("Order");
    expect(entrada.entidadId).toBe("order-1");
    expect(entrada.detalle?.estadoPrevio).toBe(OrderStatus.ENVIADA_A_COCINA);
  });

  it("permite a un no-admin cancelar una orden ABIERTA (R6.8)", async () => {
    orders.agregar(crearOrdenConItem(OrderStatus.ABIERTA, 3));
    menu.agregar(crearPlato(5));

    const resultado = await cancelar.ejecutar({
      orderId: "order-1",
      actor: MESERO,
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.estado).toBe(OrderStatus.CANCELADA);
    }
    expect((await menu.obtener("menu-1"))?.stockDelDia).toBe(8);
    expect(audit.entries).toHaveLength(1);
  });
});
