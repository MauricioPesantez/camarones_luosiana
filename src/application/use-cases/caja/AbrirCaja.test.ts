import { beforeEach, describe, expect, it } from "vitest";

import { CajaEstado } from "@/domain/caja/CajaEstado";
import { CajaSession } from "@/domain/caja/CajaSession";
import { Libro } from "@/domain/caja/Libro";
import { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import { Money } from "@/domain/order/Money";
import { isErr, isOk } from "@/domain/shared/Result";

import { FakeClock } from "../orders/testFakes";
import { AbrirCaja } from "./AbrirCaja";
import { crearAdmin, crearIdGen, crearMesero, FakeCajaRepository } from "./testFakes";

describe("AbrirCaja (R10)", () => {
  let caja: FakeCajaRepository;
  let abrir: AbrirCaja;

  beforeEach(() => {
    caja = new FakeCajaRepository();
    abrir = new AbrirCaja(caja, new FakeClock(), crearIdGen("caja"));
  });

  it("crea una sesión ABIERTA y un movimiento APERTURA (+, EFECTIVO) (R10.1, R10.2)", async () => {
    const resultado = await abrir.ejecutar({
      actor: crearAdmin(),
      fondoInicial: Money.de(100),
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.estado).toBe(CajaEstado.ABIERTA);
      expect(resultado.value.fondoInicial.toDecimal()).toBe(100);
    }

    expect(caja.movimientos).toHaveLength(1);
    const apertura = caja.movimientos[0];
    expect(apertura.tipo).toBe(TipoMovimiento.APERTURA);
    expect(apertura.libro).toBe(Libro.EFECTIVO);
    expect(apertura.monto.toDecimal()).toBe(100);
    expect(apertura.empleadoId).toBe("admin-1");
  });

  it("rechaza la apertura si un no-admin la solicita (R10.3)", async () => {
    const resultado = await abrir.ejecutar({
      actor: crearMesero(),
      fondoInicial: Money.de(100),
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("CAJA_ABRIR_NO_AUTORIZADO");
    }
    expect(caja.sesiones).toHaveLength(0);
    expect(caja.movimientos).toHaveLength(0);
  });

  it("rechaza la apertura si ya existe una sesión ABIERTA (R10.4)", async () => {
    caja.sesiones.push(
      CajaSession.crear({
        id: "sesion-previa",
        fecha: new Date("2026-01-01T08:00:00Z"),
        fondoInicial: Money.de(50),
      }),
    );

    const resultado = await abrir.ejecutar({
      actor: crearAdmin(),
      fondoInicial: Money.de(100),
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("CAJA_YA_ABIERTA");
    }
    // No se creó una segunda sesión ni un movimiento.
    expect(caja.sesiones).toHaveLength(1);
    expect(caja.movimientos).toHaveLength(0);
  });
});
