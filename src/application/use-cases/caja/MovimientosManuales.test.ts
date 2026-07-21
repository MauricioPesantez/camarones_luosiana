import { beforeEach, describe, expect, it } from "vitest";

import { CajaSession } from "@/domain/caja/CajaSession";
import { Libro } from "@/domain/caja/Libro";
import { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import { Money } from "@/domain/order/Money";
import { isErr, isOk } from "@/domain/shared/Result";

import { FakeClock } from "../orders/testFakes";
import { IngresoRetiroManual } from "./IngresoRetiroManual";
import { RegistrarCompraMenor } from "./RegistrarCompraMenor";
import { RegistrarPagoProveedor } from "./RegistrarPagoProveedor";
import { crearAdmin, crearIdGen, FakeCajaRepository } from "./testFakes";

/**
 * Pruebas de los movimientos manuales de efectivo (R11.3–R11.6): cada caso de
 * uso asienta el `MovimientoCaja` con el tipo, libro y signo correctos, exige
 * una sesión abierta y registra empleado + marca de tiempo (R11.7).
 */
describe("Movimientos manuales de caja (R11.3–R11.6)", () => {
  let caja: FakeCajaRepository;

  beforeEach(() => {
    caja = new FakeCajaRepository();
    caja.sesiones.push(
      CajaSession.crear({
        id: "sesion-1",
        fecha: new Date("2026-01-01T08:00:00Z"),
        fondoInicial: Money.de(100),
      }),
    );
  });

  it("RegistrarPagoProveedor: PAGO_PROVEEDOR (−, EFECTIVO) con empleado y timestamp (R11.3, R11.7)", async () => {
    const uc = new RegistrarPagoProveedor(caja, new FakeClock(), crearIdGen());
    const resultado = await uc.ejecutar({
      actor: crearAdmin(),
      monto: Money.de(40),
      categoria: "Pescadería",
    });

    expect(isOk(resultado)).toBe(true);
    const mov = caja.movimientos.at(-1)!;
    expect(mov.tipo).toBe(TipoMovimiento.PAGO_PROVEEDOR);
    expect(mov.libro).toBe(Libro.EFECTIVO);
    expect(mov.monto.toDecimal()).toBe(-40);
    expect(mov.empleadoId).toBe("admin-1");
    expect(mov.timestamp).toEqual(new FakeClock().now());
  });

  it("RegistrarCompraMenor: COMPRA_MENOR (−, EFECTIVO) (R11.4)", async () => {
    const uc = new RegistrarCompraMenor(caja, new FakeClock(), crearIdGen());
    const resultado = await uc.ejecutar({
      actor: crearAdmin(),
      monto: Money.de(12.5),
    });

    expect(isOk(resultado)).toBe(true);
    const mov = caja.movimientos.at(-1)!;
    expect(mov.tipo).toBe(TipoMovimiento.COMPRA_MENOR);
    expect(mov.libro).toBe(Libro.EFECTIVO);
    expect(mov.monto.toDecimal()).toBe(-12.5);
  });

  it("IngresoRetiroManual.ingreso: INGRESO_MANUAL (+, EFECTIVO) (R11.5)", async () => {
    const uc = new IngresoRetiroManual(caja, new FakeClock(), crearIdGen());
    const resultado = await uc.ingreso({
      actor: crearAdmin(),
      monto: Money.de(30),
    });

    expect(isOk(resultado)).toBe(true);
    const mov = caja.movimientos.at(-1)!;
    expect(mov.tipo).toBe(TipoMovimiento.INGRESO_MANUAL);
    expect(mov.libro).toBe(Libro.EFECTIVO);
    expect(mov.monto.toDecimal()).toBe(30);
  });

  it("IngresoRetiroManual.retiro: RETIRO_MANUAL (−, EFECTIVO) (R11.6)", async () => {
    const uc = new IngresoRetiroManual(caja, new FakeClock(), crearIdGen());
    const resultado = await uc.retiro({
      actor: crearAdmin(),
      monto: Money.de(20),
    });

    expect(isOk(resultado)).toBe(true);
    const mov = caja.movimientos.at(-1)!;
    expect(mov.tipo).toBe(TipoMovimiento.RETIRO_MANUAL);
    expect(mov.libro).toBe(Libro.EFECTIVO);
    expect(mov.monto.toDecimal()).toBe(-20);
  });

  it("rechaza un monto cero o negativo", async () => {
    const uc = new IngresoRetiroManual(caja, new FakeClock(), crearIdGen());
    const resultado = await uc.ingreso({
      actor: crearAdmin(),
      monto: Money.cero(),
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("CAJA_MOVIMIENTO_MONTO_INVALIDO");
    }
  });

  it("rechaza registrar un movimiento si no hay sesión abierta (R11.7, Property 5)", async () => {
    const sinSesion = new FakeCajaRepository();
    const uc = new RegistrarPagoProveedor(
      sinSesion,
      new FakeClock(),
      crearIdGen(),
    );
    const resultado = await uc.ejecutar({
      actor: crearAdmin(),
      monto: Money.de(10),
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("CAJA_NO_ABIERTA");
    }
    expect(sinSesion.movimientos).toHaveLength(0);
  });
});
