import { beforeEach, describe, expect, it } from "vitest";

import { CajaEstado } from "@/domain/caja/CajaEstado";
import { CajaSession } from "@/domain/caja/CajaSession";
import { Libro } from "@/domain/caja/Libro";
import { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import { Money } from "@/domain/order/Money";
import { Order } from "@/domain/order/Order";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { isErr, isOk } from "@/domain/shared/Result";

import {
  FakeAuditRepository,
  FakeClock,
  FakeMenuRepository,
  FakeOrderRepository,
  FakeTransactionRunner,
} from "../orders/testFakes";
import { ACCION_CERRAR_CAJA, CerrarCaja } from "./CerrarCaja";
import { IngresoRetiroManual } from "./IngresoRetiroManual";
import { RegistrarPagoProveedor } from "./RegistrarPagoProveedor";
import {
  crearAdmin,
  crearIdGen,
  crearMesero,
  FakeCajaRepository,
} from "./testFakes";

const FECHA = new Date("2026-01-01T08:00:00Z");

/** Helper para asentar un movimiento directamente en el repositorio fake. */
function pushMov(
  caja: FakeCajaRepository,
  params: {
    id: string;
    tipo: TipoMovimiento;
    libro: Libro;
    monto: Money;
    esCarreraPassthrough?: boolean;
  },
): void {
  caja.movimientos.push(
    MovimientoCaja.crear({
      id: params.id,
      sesionId: "sesion-1",
      tipo: params.tipo,
      libro: params.libro,
      monto: params.monto,
      esCarreraPassthrough: params.esCarreraPassthrough,
      empleadoId: "admin-1",
      timestamp: FECHA,
    }),
  );
}

/** Helper para crear una orden en un estado dado (reconstitución). */
function crearOrden(id: string, estado: OrderStatus): Order {
  return Order.crear({
    id,
    numero: 1,
    canal: OrderChannel.SALON,
    creadoPorId: "mesero-1",
    estado,
  });
}

describe("CerrarCaja (R13, R16.1, R6.6)", () => {
  let caja: FakeCajaRepository;
  let audit: FakeAuditRepository;
  let orders: FakeOrderRepository;
  let cerrar: CerrarCaja;

  beforeEach(() => {
    caja = new FakeCajaRepository();
    audit = new FakeAuditRepository();
    orders = new FakeOrderRepository();
    const runner = new FakeTransactionRunner(
      orders,
      new FakeMenuRepository(),
      audit,
      caja,
    );
    cerrar = new CerrarCaja(runner, new FakeClock(), crearIdGen("cierre"));
    caja.sesiones.push(
      CajaSession.crear({
        id: "sesion-1",
        fecha: FECHA,
        fondoInicial: Money.de(100),
      }),
    );
  });

  it("cuadre completo con movimientos mezclados incluyendo passthrough (R13.1, R13.2, R13.3, R13.4)", async () => {
    // APERTURA +100 (EFECTIVO)
    pushMov(caja, {
      id: "m1",
      tipo: TipoMovimiento.APERTURA,
      libro: Libro.EFECTIVO,
      monto: Money.de(100),
    });
    // VENTA_EFECTIVO +50 (EFECTIVO)
    pushMov(caja, {
      id: "m2",
      tipo: TipoMovimiento.VENTA_EFECTIVO,
      libro: Libro.EFECTIVO,
      monto: Money.de(50),
    });
    // VENTA_TRANSFERENCIA +80 (TRANSFERENCIA) -> no cuenta para efectivo
    pushMov(caja, {
      id: "m3",
      tipo: TipoMovimiento.VENTA_TRANSFERENCIA,
      libro: Libro.TRANSFERENCIA,
      monto: Money.de(80),
    });
    // PAGO_CARRERA passthrough -3 (EFECTIVO) -> delivery+transferencia
    pushMov(caja, {
      id: "m4",
      tipo: TipoMovimiento.PAGO_CARRERA,
      libro: Libro.EFECTIVO,
      monto: Money.de(3).negativo(),
      esCarreraPassthrough: true,
    });
    // PAGO_PROVEEDOR -40 (EFECTIVO)
    pushMov(caja, {
      id: "m5",
      tipo: TipoMovimiento.PAGO_PROVEEDOR,
      libro: Libro.EFECTIVO,
      monto: Money.de(40).negativo(),
    });

    // esperado = 100 + 50 - 3 - 40 = 107
    const resultado = await cerrar.ejecutar({
      actor: crearAdmin(),
      efectivoContado: Money.de(105),
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.esperado.toDecimal()).toBe(107);
      // diferencia = 105 - 107 = -2 (faltante)
      expect(resultado.value.diferencia.toDecimal()).toBe(-2);
      // puente = -3 (la carrera passthrough)
      expect(resultado.value.puente.toDecimal()).toBe(-3);
      // Sesión marcada CERRADA y firmada (R13.4)
      expect(resultado.value.sesion.estado).toBe(CajaEstado.CERRADA);
      expect(resultado.value.sesion.efectivoContado?.toDecimal()).toBe(105);
      expect(resultado.value.sesion.diferencia?.toDecimal()).toBe(-2);
      expect(resultado.value.sesion.firmadoPorId).toBe("admin-1");
    }

    // Se asentó un movimiento CIERRE (R13.4)
    const cierreMov = caja.movimientos.find(
      (m) => m.tipo === TipoMovimiento.CIERRE,
    );
    expect(cierreMov).toBeDefined();
    expect(cierreMov?.monto.toDecimal()).toBe(0);

    // Auditoría de la acción sensible (R16.1)
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0].accion).toBe(ACCION_CERRAR_CAJA);
    expect(audit.entries[0].entidadTipo).toBe("CajaSession");
    expect(audit.entries[0].entidadId).toBe("sesion-1");
    expect(audit.entries[0].detalle?.esperado).toBe(107);
    expect(audit.entries[0].detalle?.puente).toBe(-3);
  });

  it("bloquea registrar nuevos movimientos tras el cierre (R13.5, Property 5)", async () => {
    pushMov(caja, {
      id: "m1",
      tipo: TipoMovimiento.APERTURA,
      libro: Libro.EFECTIVO,
      monto: Money.de(100),
    });

    const cierre = await cerrar.ejecutar({
      actor: crearAdmin(),
      efectivoContado: Money.de(100),
    });
    expect(isOk(cierre)).toBe(true);

    // Tras el cierre no hay sesión abierta: los movimientos quedan bloqueados.
    const pago = new RegistrarPagoProveedor(caja, new FakeClock(), crearIdGen());
    const intentoPago = await pago.ejecutar({
      actor: crearAdmin(),
      monto: Money.de(10),
    });
    expect(isErr(intentoPago)).toBe(true);
    if (isErr(intentoPago)) {
      expect(intentoPago.error.code).toBe("CAJA_NO_ABIERTA");
    }

    const manual = new IngresoRetiroManual(caja, new FakeClock(), crearIdGen());
    const intentoIngreso = await manual.ingreso({
      actor: crearAdmin(),
      monto: Money.de(5),
    });
    expect(isErr(intentoIngreso)).toBe(true);
    if (isErr(intentoIngreso)) {
      expect(intentoIngreso.error.code).toBe("CAJA_NO_ABIERTA");
    }
  });

  it("impide un segundo cierre de la misma jornada (R13.5)", async () => {
    pushMov(caja, {
      id: "m1",
      tipo: TipoMovimiento.APERTURA,
      libro: Libro.EFECTIVO,
      monto: Money.de(100),
    });
    const primero = await cerrar.ejecutar({
      actor: crearAdmin(),
      efectivoContado: Money.de(100),
    });
    expect(isOk(primero)).toBe(true);

    const segundo = await cerrar.ejecutar({
      actor: crearAdmin(),
      efectivoContado: Money.de(100),
    });
    expect(isErr(segundo)).toBe(true);
    if (isErr(segundo)) {
      // Ya no hay sesión abierta para cerrar.
      expect(segundo.error.code).toBe("CAJA_NO_ABIERTA");
    }
  });

  it("rechaza el cierre si lo solicita un no-admin (R13.6)", async () => {
    const resultado = await cerrar.ejecutar({
      actor: crearMesero(),
      efectivoContado: Money.de(100),
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("CAJA_CERRAR_NO_AUTORIZADO");
    }
    // La sesión sigue abierta y no se auditó.
    expect(caja.sesiones[0].estado).toBe(CajaEstado.ABIERTA);
    expect(audit.entries).toHaveLength(0);
  });

  it("cierra las órdenes COBRADA de la jornada dejándolas CERRADA (R6.6)", async () => {
    pushMov(caja, {
      id: "m1",
      tipo: TipoMovimiento.APERTURA,
      libro: Libro.EFECTIVO,
      monto: Money.de(100),
    });
    await orders.crear(crearOrden("o1", OrderStatus.COBRADA));
    await orders.crear(crearOrden("o2", OrderStatus.COBRADA));

    const resultado = await cerrar.ejecutar({
      actor: crearAdmin(),
      efectivoContado: Money.de(100),
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.ordenesCerradas).toBe(2);
    }
    // Ambas órdenes cobradas quedan CERRADAS tras el cierre del día.
    expect((await orders.obtener("o1"))?.estado).toBe(OrderStatus.CERRADA);
    expect((await orders.obtener("o2"))?.estado).toBe(OrderStatus.CERRADA);

    // La auditoría refleja cuántas órdenes se cerraron.
    expect(audit.entries[0].detalle?.ordenesCerradas).toBe(2);
  });

  it("no toca las órdenes que no están COBRADA al cerrar (R6.6)", async () => {
    pushMov(caja, {
      id: "m1",
      tipo: TipoMovimiento.APERTURA,
      libro: Libro.EFECTIVO,
      monto: Money.de(100),
    });
    await orders.crear(crearOrden("cobrada", OrderStatus.COBRADA));
    await orders.crear(crearOrden("abierta", OrderStatus.ABIERTA));
    await orders.crear(crearOrden("entregada", OrderStatus.ENTREGADA));
    await orders.crear(crearOrden("cancelada", OrderStatus.CANCELADA));

    const resultado = await cerrar.ejecutar({
      actor: crearAdmin(),
      efectivoContado: Money.de(100),
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      // Solo la orden COBRADA se cierra.
      expect(resultado.value.ordenesCerradas).toBe(1);
    }
    expect((await orders.obtener("cobrada"))?.estado).toBe(OrderStatus.CERRADA);
    // Las demás conservan su estado original (no se tocan).
    expect((await orders.obtener("abierta"))?.estado).toBe(OrderStatus.ABIERTA);
    expect((await orders.obtener("entregada"))?.estado).toBe(
      OrderStatus.ENTREGADA,
    );
    expect((await orders.obtener("cancelada"))?.estado).toBe(
      OrderStatus.CANCELADA,
    );
  });

  it("rechaza el cierre si no hay sesión abierta (R13)", async () => {
    const sinSesion = new FakeCajaRepository();
    const uc = new CerrarCaja(
      new FakeTransactionRunner(
        new FakeOrderRepository(),
        new FakeMenuRepository(),
        audit,
        sinSesion,
      ),
      new FakeClock(),
      crearIdGen(),
    );
    const resultado = await uc.ejecutar({
      actor: crearAdmin(),
      efectivoContado: Money.de(100),
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("CAJA_NO_ABIERTA");
    }
  });
});
