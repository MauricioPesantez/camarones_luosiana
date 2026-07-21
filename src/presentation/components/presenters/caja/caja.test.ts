import { describe, expect, it } from "vitest";

import type { EstadoCajaDTO } from "@/presentation/http/dto";

import {
  diferenciaEnVivo,
  etiquetaDiferencia,
  hayCajaAbierta,
  mensajeConfirmarApertura,
  mensajeConfirmarCierre,
  mensajeMovimientoRegistrado,
  puedeAbrir,
  puedeCerrar,
  puedeRegistrarMovimiento,
} from "./caja";

function estado(sesion: EstadoCajaDTO["sesion"]): EstadoCajaDTO {
  return { sesion, movimientos: [], esperado: 0, puente: 0 };
}

const sesionAbierta: EstadoCajaDTO["sesion"] = {
  id: "s1",
  fecha: "2026-07-12T00:00:00.000Z",
  fondoInicial: 100,
  estado: "ABIERTA",
  efectivoContado: null,
  diferencia: null,
  firmadoPorId: null,
  closedAt: null,
};

describe("hayCajaAbierta", () => {
  it("es true cuando hay sesión", () => {
    expect(hayCajaAbierta(estado(sesionAbierta))).toBe(true);
  });

  it("es false cuando no hay sesión", () => {
    expect(hayCajaAbierta(estado(null))).toBe(false);
  });
});

describe("etiquetaDiferencia", () => {
  it("sobrante cuando es positiva", () => {
    expect(etiquetaDiferencia(5)).toBe("Sobrante");
  });

  it("faltante cuando es negativa", () => {
    expect(etiquetaDiferencia(-5)).toBe("Faltante");
  });

  it("cuadre exacto dentro de la tolerancia de punto flotante", () => {
    expect(etiquetaDiferencia(0)).toBe("Cuadre exacto");
    expect(etiquetaDiferencia(0.001)).toBe("Cuadre exacto");
  });
});

describe("diferenciaEnVivo", () => {
  it("es contado − esperado", () => {
    expect(diferenciaEnVivo(120, 100)).toBe(20);
    expect(diferenciaEnVivo(90, 100)).toBe(-10);
  });
});

describe("predicados de habilitación", () => {
  it("puedeAbrir acepta 0 y positivos, rechaza negativos y no finitos", () => {
    expect(puedeAbrir(0)).toBe(true);
    expect(puedeAbrir(100)).toBe(true);
    expect(puedeAbrir(-1)).toBe(false);
    expect(puedeAbrir(null)).toBe(false);
    expect(puedeAbrir(Number.NaN)).toBe(false);
  });

  it("puedeRegistrarMovimiento exige monto estrictamente positivo", () => {
    expect(puedeRegistrarMovimiento(10)).toBe(true);
    expect(puedeRegistrarMovimiento(0)).toBe(false);
    expect(puedeRegistrarMovimiento(-5)).toBe(false);
    expect(puedeRegistrarMovimiento(null)).toBe(false);
  });

  it("puedeCerrar acepta 0 y positivos, rechaza negativos y null", () => {
    expect(puedeCerrar(0)).toBe(true);
    expect(puedeCerrar(250)).toBe(true);
    expect(puedeCerrar(-1)).toBe(false);
    expect(puedeCerrar(null)).toBe(false);
  });
});

describe("mensajes", () => {
  it("apertura incluye el fondo formateado", () => {
    expect(mensajeConfirmarApertura(100)).toContain("$100.00");
  });

  it("movimiento registrado usa la etiqueta legible", () => {
    expect(mensajeMovimientoRegistrado("PAGO_PROVEEDOR")).toBe(
      "Pago a proveedor registrado",
    );
  });

  it("cierre incluye contado, etiqueta de diferencia y magnitud", () => {
    const msg = mensajeConfirmarCierre(90, -10);
    expect(msg).toContain("$90.00");
    expect(msg).toContain("Faltante");
    expect(msg).toContain("$10.00");
    expect(msg).toContain("¿Continuar?");
  });
});
