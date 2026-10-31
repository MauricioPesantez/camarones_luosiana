import type { ResultadoValidacion } from "./admin-validaciones";
import { MONTO_MAXIMO_CAJA } from "../types/caja";

class ErrorValidacion extends Error {}

function objeto(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ErrorValidacion("El cuerpo de la peticion es invalido");
  }
  return body as Record<string, unknown>;
}

function montoNoNegativo(valor: unknown, nombre: string): number {
  if (
    (typeof valor !== "number" && typeof valor !== "string") ||
    (typeof valor === "string" && valor.trim() === "")
  ) {
    throw new ErrorValidacion(`${nombre} debe ser un numero mayor o igual a 0`);
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new ErrorValidacion(`${nombre} debe ser un numero mayor o igual a 0`);
  }
  const centavos = numero * 100;
  if (Math.abs(centavos - Math.round(centavos)) > 1e-9) {
    throw new ErrorValidacion(`${nombre} no puede tener mas de 2 decimales`);
  }
  if (numero > MONTO_MAXIMO_CAJA) {
    throw new ErrorValidacion(
      `${nombre} no puede superar $${MONTO_MAXIMO_CAJA.toFixed(2)}`,
    );
  }
  return Math.round(centavos) / 100;
}

function ejecutar<T>(construir: () => T): ResultadoValidacion<T> {
  try {
    return { ok: true, data: construir() };
  } catch (error) {
    if (error instanceof ErrorValidacion) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export function validarAperturaCaja(
  body: unknown,
): ResultadoValidacion<{ montoInicial: number }> {
  return ejecutar(() => {
    const datos = objeto(body);
    return {
      montoInicial: montoNoNegativo(datos.montoInicial, "El fondo inicial"),
    };
  });
}

export function validarCierreCaja(
  body: unknown,
): ResultadoValidacion<{ fecha: string; montoCierre: number }> {
  return ejecutar(() => {
    const datos = objeto(body);
    if (typeof datos.fecha !== "string" || datos.fecha.trim() === "") {
      throw new ErrorValidacion("La fecha es obligatoria");
    }
    return {
      fecha: datos.fecha.trim(),
      montoCierre: montoNoNegativo(datos.montoCierre, "El efectivo contado"),
    };
  });
}
