import { beforeEach, describe, expect, it } from "vitest";

import type { SessionUser } from "@/application/ports/AuthService";
import { CajaSession } from "@/domain/caja/CajaSession";
import { Libro } from "@/domain/caja/Libro";
import { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import { MetodoPago } from "@/domain/order/MetodoPago";
import { Money } from "@/domain/order/Money";
import { Order } from "@/domain/order/Order";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderItem } from "@/domain/order/OrderItem";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { isErr, isOk } from "@/domain/shared/Result";
import { Role } from "@/domain/user/Role";

import { FakeCajaRepository } from "../caja/testFakes";
import { CobrarOrden } from "./CobrarOrden";
import {
  FakeClock,
  FakeIdGenerator,
  FakeMenuRepository,
  FakeOrderRepository,
  FakeStorageService,
  FakeTransactionRunner,
} from "./testFakes";

/** Usuario con permiso de cobro (R2.3). */
const COBRADOR: SessionUser = {
  id: "cobrador-1",
  usuario: "cajero",
  nombre: "Cajero",
  roles: [Role.OPERADOR],
  puedeCobrar: true,
};

/** Usuario sin permiso de cobro (R2.4). */
const SIN_PERMISO: SessionUser = {
  id: "mesero-1",
  usuario: "mesero",
  nombre: "Mesero",
  roles: [Role.MESERO],
  puedeCobrar: false,
};

const COMPROBANTE = { archivo: Buffer.from("img"), mime: "image/jpeg" };

/**
 * Crea una orden llevada hasta `ENTREGADA` con un ítem Ceviche ($5 × 2 = $10 de
 * subtotal). En DELIVERY registra el envío indicado y aplica el recargo de
 * envases ($0.50).
 */
function crearOrdenEntregada(
  canal: OrderChannel,
  opciones: { envio?: number } = {},
): Order {
  const order = Order.crear({
    id: "order-1",
    numero: 1,
    canal,
    creadoPorId: "mesero-1",
    mesa: canal === OrderChannel.SALON ? 1 : null,
  });
  order.agregarItem(
    OrderItem.crear({
      id: "item-1",
      menuItemId: "menu-1",
      nombrePlato: "Ceviche",
      precioUnit: Money.de(5),
      cantidad: 2,
    }),
  );
  if (canal === OrderChannel.DELIVERY && opciones.envio !== undefined) {
    order.establecerEnvio(Money.de(opciones.envio));
  }
  order.recalcular();

  order.transicionarA(OrderStatus.ENVIADA_A_COCINA);
  order.transicionarA(OrderStatus.EN_PREPARACION);
  order.transicionarA(OrderStatus.LISTA);
  order.transicionarA(OrderStatus.ENTREGADA);
  return order;
}

describe("CobrarOrden", () => {
  let orders: FakeOrderRepository;
  let caja: FakeCajaRepository;
  let storage: FakeStorageService;
  let cobrar: CobrarOrden;

  beforeEach(() => {
    orders = new FakeOrderRepository();
    caja = new FakeCajaRepository();
    storage = new FakeStorageService();
    // Sesión de caja abierta requerida para asentar movimientos.
    caja.sesiones.push(
      CajaSession.crear({
        id: "sesion-1",
        fecha: new Date("2026-01-01T08:00:00Z"),
        fondoInicial: Money.de(100),
      }),
    );
    const tx = new FakeTransactionRunner(
      orders,
      new FakeMenuRepository(),
      undefined,
      caja,
    );
    cobrar = new CobrarOrden(
      tx,
      storage,
      new FakeIdGenerator("mov"),
      new FakeClock(),
    );
  });

  it("EFECTIVO salón: VENTA_EFECTIVO +total en EFECTIVO y pasa a COBRADA (R11.1, R9.2)", async () => {
    orders.agregar(crearOrdenEntregada(OrderChannel.SALON));

    const resultado = await cobrar.ejecutar({
      orderId: "order-1",
      actor: COBRADOR,
      metodoPago: MetodoPago.EFECTIVO,
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.estado).toBe(OrderStatus.COBRADA);
      expect(resultado.value.metodoPago).toBe(MetodoPago.EFECTIVO);
    }

    expect(caja.movimientos).toHaveLength(1);
    const mov = caja.movimientos[0];
    expect(mov.tipo).toBe(TipoMovimiento.VENTA_EFECTIVO);
    expect(mov.libro).toBe(Libro.EFECTIVO);
    expect(mov.monto.toDecimal()).toBe(10);
    expect(mov.orderId).toBe("order-1");
    expect(mov.empleadoId).toBe("cobrador-1");
    // Sin transferencia no se sube comprobante.
    expect(storage.subidas).toHaveLength(0);
  });

  it("TRANSFERENCIA salón: VENTA_TRANSFERENCIA +total en TRANSFERENCIA y sube comprobante (R11.2, R9.3)", async () => {
    orders.agregar(crearOrdenEntregada(OrderChannel.SALON));

    const resultado = await cobrar.ejecutar({
      orderId: "order-1",
      actor: COBRADOR,
      metodoPago: MetodoPago.TRANSFERENCIA,
      comprobante: COMPROBANTE,
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.estado).toBe(OrderStatus.COBRADA);
      expect(resultado.value.comprobanteUrl).toBe(
        "https://storage.test/comprobantes/order-1",
      );
    }

    expect(caja.movimientos).toHaveLength(1);
    const mov = caja.movimientos[0];
    expect(mov.tipo).toBe(TipoMovimiento.VENTA_TRANSFERENCIA);
    expect(mov.libro).toBe(Libro.TRANSFERENCIA);
    expect(mov.monto.toDecimal()).toBe(10);
    // R9.3: se subió y asoció el comprobante.
    expect(storage.subidas).toEqual([
      { orderId: "order-1", mime: "image/jpeg" },
    ]);
  });

  it("DELIVERY + TRANSFERENCIA (passthrough): VENTA_TRANSFERENCIA +total y PAGO_CARRERA −envío (R12.1, R12.2)", async () => {
    orders.agregar(crearOrdenEntregada(OrderChannel.DELIVERY, { envio: 2 }));

    const resultado = await cobrar.ejecutar({
      orderId: "order-1",
      actor: COBRADOR,
      metodoPago: MetodoPago.TRANSFERENCIA,
      comprobante: COMPROBANTE,
    });

    expect(isOk(resultado)).toBe(true);
    expect(caja.movimientos).toHaveLength(2);

    // total = subtotal 10 + envases 0.50 + envío 2 = 12.50
    const venta = caja.movimientos.find(
      (m) => m.tipo === TipoMovimiento.VENTA_TRANSFERENCIA,
    );
    expect(venta).toBeDefined();
    expect(venta?.libro).toBe(Libro.TRANSFERENCIA);
    expect(venta?.monto.toDecimal()).toBe(12.5);

    const carrera = caja.movimientos.find(
      (m) => m.tipo === TipoMovimiento.PAGO_CARRERA,
    );
    expect(carrera).toBeDefined();
    expect(carrera?.libro).toBe(Libro.EFECTIVO);
    expect(carrera?.monto.toDecimal()).toBe(-2);
    expect(carrera?.esCarreraPassthrough).toBe(true);
  });

  it("DELIVERY + EFECTIVO: VENTA_EFECTIVO +(subtotal+envases); la carrera no toca la caja (R12.3)", async () => {
    orders.agregar(crearOrdenEntregada(OrderChannel.DELIVERY, { envio: 2 }));

    const resultado = await cobrar.ejecutar({
      orderId: "order-1",
      actor: COBRADOR,
      metodoPago: MetodoPago.EFECTIVO,
    });

    expect(isOk(resultado)).toBe(true);
    expect(caja.movimientos).toHaveLength(1);
    const mov = caja.movimientos[0];
    expect(mov.tipo).toBe(TipoMovimiento.VENTA_EFECTIVO);
    expect(mov.libro).toBe(Libro.EFECTIVO);
    // subtotal 10 + envases 0.50 = 10.50 (excluye el envío 2, cobrado por el repartidor)
    expect(mov.monto.toDecimal()).toBe(10.5);
    // No hay PAGO_CARRERA en efectivo.
    expect(
      caja.movimientos.some((m) => m.tipo === TipoMovimiento.PAGO_CARRERA),
    ).toBe(false);
  });

  it("es idempotente: cobrar dos veces no duplica movimientos ni recobra (Property 7)", async () => {
    orders.agregar(crearOrdenEntregada(OrderChannel.SALON));

    const primero = await cobrar.ejecutar({
      orderId: "order-1",
      actor: COBRADOR,
      metodoPago: MetodoPago.EFECTIVO,
    });
    expect(isOk(primero)).toBe(true);

    const segundo = await cobrar.ejecutar({
      orderId: "order-1",
      actor: COBRADOR,
      metodoPago: MetodoPago.EFECTIVO,
    });

    expect(isErr(segundo)).toBe(true);
    if (isErr(segundo)) {
      expect(segundo.error.code).toBe("ORDER_YA_COBRADA");
    }
    // Solo el primer cobro asentó un movimiento.
    expect(caja.movimientos).toHaveLength(1);
  });

  it("deniega el cobro a un usuario sin permiso `puedeCobrar` (R2.3, R2.4)", async () => {
    orders.agregar(crearOrdenEntregada(OrderChannel.SALON));

    const resultado = await cobrar.ejecutar({
      orderId: "order-1",
      actor: SIN_PERMISO,
      metodoPago: MetodoPago.EFECTIVO,
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("COBRO_NO_AUTORIZADO");
    }
    // No se asentaron movimientos ni cambió el estado de la orden.
    expect(caja.movimientos).toHaveLength(0);
    expect((await orders.obtener("order-1"))?.estado).toBe(
      OrderStatus.ENTREGADA,
    );
  });

  it("exige comprobante en TRANSFERENCIA (R9.3)", async () => {
    orders.agregar(crearOrdenEntregada(OrderChannel.SALON));

    const resultado = await cobrar.ejecutar({
      orderId: "order-1",
      actor: COBRADOR,
      metodoPago: MetodoPago.TRANSFERENCIA,
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("COMPROBANTE_REQUERIDO");
    }
    expect(caja.movimientos).toHaveLength(0);
  });

  it("rechaza el cobro si no hay una sesión de caja abierta (CAJA_NO_ABIERTA)", async () => {
    orders.agregar(crearOrdenEntregada(OrderChannel.SALON));
    // Cierra la sesión abierta simulando que no hay jornada.
    caja.sesiones.length = 0;

    const resultado = await cobrar.ejecutar({
      orderId: "order-1",
      actor: COBRADOR,
      metodoPago: MetodoPago.EFECTIVO,
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("CAJA_NO_ABIERTA");
    }
  });
});
