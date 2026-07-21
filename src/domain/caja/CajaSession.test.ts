import { describe, it, expect } from "vitest";
import { CajaSession } from "./CajaSession";
import { CajaEstado, CAJA_ESTADOS, esCajaEstado } from "./CajaEstado";
import { Money } from "../order/Money";
import { DomainError } from "../shared/DomainError";

function crearSesion(
  overrides: Partial<Parameters<typeof CajaSession.crear>[0]> = {},
) {
  return CajaSession.crear({
    id: "ses-1",
    fecha: new Date("2024-01-01T08:00:00Z"),
    fondoInicial: Money.de(100),
    ...overrides,
  });
}

describe("CajaEstado", () => {
  it("expone los valores del enum Prisma", () => {
    expect(CAJA_ESTADOS).toEqual(["ABIERTA", "CERRADA"]);
  });

  it("type guard reconoce valores válidos e inválidos", () => {
    expect(esCajaEstado("ABIERTA")).toBe(true);
    expect(esCajaEstado("CERRADA")).toBe(true);
    expect(esCajaEstado("PAUSADA")).toBe(false);
  });
});

describe("CajaSession", () => {
  it("nace ABIERTA por defecto con su fondo inicial", () => {
    const sesion = crearSesion();
    expect(sesion.id).toBe("ses-1");
    expect(sesion.fondoInicial.toDecimal()).toBe(100);
    expect(sesion.estado).toBe(CajaEstado.ABIERTA);
    expect(sesion.estaAbierta()).toBe(true);
    expect(sesion.estaCerrada()).toBe(false);
    expect(sesion.efectivoContado).toBeNull();
    expect(sesion.diferencia).toBeNull();
    expect(sesion.firmadoPorId).toBeNull();
    expect(sesion.closedAt).toBeNull();
  });

  it("reconstituye una sesión cerrada con sus campos de cierre", () => {
    const sesion = crearSesion({
      estado: CajaEstado.CERRADA,
      efectivoContado: Money.de(250),
      diferencia: Money.de(-1.5),
      firmadoPorId: "admin-1",
      closedAt: new Date("2024-01-01T22:00:00Z"),
    });
    expect(sesion.estaCerrada()).toBe(true);
    expect(sesion.efectivoContado?.toDecimal()).toBe(250);
    expect(sesion.diferencia?.toDecimal()).toBe(-1.5);
    expect(sesion.firmadoPorId).toBe("admin-1");
  });

  it("rechaza id vacío", () => {
    expect(() => crearSesion({ id: "  " })).toThrow(DomainError);
  });

  it("rechaza fondo inicial negativo", () => {
    expect(() => crearSesion({ fondoInicial: Money.de(-1) })).toThrow(
      DomainError,
    );
  });

  it("acepta fondo inicial cero", () => {
    expect(crearSesion({ fondoInicial: Money.cero() }).fondoInicial.esCero()).toBe(
      true,
    );
  });
});
