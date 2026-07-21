import { describe, it, expect } from "vitest";
import { MovimientoCaja } from "./MovimientoCaja";
import { Libro, LIBROS, esLibro } from "./Libro";
import {
  TipoMovimiento,
  TIPOS_MOVIMIENTO,
  esTipoMovimiento,
} from "./TipoMovimiento";
import { Money } from "../order/Money";
import { DomainError } from "../shared/DomainError";

function crearMovimiento(
  overrides: Partial<Parameters<typeof MovimientoCaja.crear>[0]> = {},
) {
  return MovimientoCaja.crear({
    id: "mov-1",
    sesionId: "ses-1",
    tipo: TipoMovimiento.VENTA_EFECTIVO,
    libro: Libro.EFECTIVO,
    monto: Money.de(12.5),
    empleadoId: "emp-1",
    timestamp: new Date("2024-01-01T10:00:00Z"),
    ...overrides,
  });
}

describe("Libro", () => {
  it("expone los valores del enum Prisma", () => {
    expect(LIBROS).toEqual(["EFECTIVO", "TRANSFERENCIA"]);
  });

  it("type guard reconoce valores válidos e inválidos", () => {
    expect(esLibro("EFECTIVO")).toBe(true);
    expect(esLibro("TRANSFERENCIA")).toBe(true);
    expect(esLibro("OTRO")).toBe(false);
    expect(esLibro(undefined)).toBe(false);
  });
});

describe("TipoMovimiento", () => {
  it("incluye los nueve tipos del enum Prisma", () => {
    expect(TIPOS_MOVIMIENTO).toEqual([
      "APERTURA",
      "VENTA_EFECTIVO",
      "VENTA_TRANSFERENCIA",
      "PAGO_CARRERA",
      "PAGO_PROVEEDOR",
      "COMPRA_MENOR",
      "INGRESO_MANUAL",
      "RETIRO_MANUAL",
      "CIERRE",
    ]);
  });

  it("type guard reconoce valores válidos e inválidos", () => {
    expect(esTipoMovimiento("PAGO_CARRERA")).toBe(true);
    expect(esTipoMovimiento("NO_EXISTE")).toBe(false);
  });
});

describe("MovimientoCaja", () => {
  it("crea un movimiento válido con sus propiedades", () => {
    const mov = crearMovimiento();
    expect(mov.id).toBe("mov-1");
    expect(mov.sesionId).toBe("ses-1");
    expect(mov.tipo).toBe(TipoMovimiento.VENTA_EFECTIVO);
    expect(mov.libro).toBe(Libro.EFECTIVO);
    expect(mov.monto.toDecimal()).toBe(12.5);
    expect(mov.empleadoId).toBe("emp-1");
    expect(mov.orderId).toBeNull();
    expect(mov.categoria).toBeNull();
    expect(mov.esCarreraPassthrough).toBe(false);
    expect(mov.nota).toBeNull();
  });

  it("conserva montos negativos para egresos (con signo)", () => {
    const mov = crearMovimiento({
      tipo: TipoMovimiento.PAGO_PROVEEDOR,
      monto: Money.de(-5),
    });
    expect(mov.monto.toDecimal()).toBe(-5);
    expect(mov.monto.esNegativo()).toBe(true);
  });

  it("permite marcar el passthrough de carrera", () => {
    const mov = crearMovimiento({
      tipo: TipoMovimiento.PAGO_CARRERA,
      monto: Money.de(-2),
      esCarreraPassthrough: true,
    });
    expect(mov.esCarreraPassthrough).toBe(true);
  });

  it("rechaza id, sesión o empleado vacíos", () => {
    expect(() => crearMovimiento({ id: "  " })).toThrow(DomainError);
    expect(() => crearMovimiento({ sesionId: "" })).toThrow(DomainError);
    expect(() => crearMovimiento({ empleadoId: "   " })).toThrow(DomainError);
  });

  it("es inmutable: no expone setters ni métodos de mutación", () => {
    const mov = crearMovimiento();
    // La superficie pública son solo lecturas (sin métodos que muten estado).
    const metodos = Object.getOwnPropertyNames(
      Object.getPrototypeOf(mov),
    ).filter((n) => n !== "constructor");
    expect(metodos).toEqual([]);
  });
});
