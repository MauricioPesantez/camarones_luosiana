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

export function validarCorteTurno(
  body: unknown,
): ResultadoValidacion<{ numero: number; montoContado: number }> {
  return ejecutar(() => {
    const datos = objeto(body);
    // El cliente dice que corte cree hacer: si otro mesero corto antes, se rechaza.
    if (!Number.isInteger(datos.numero) || (datos.numero as number) < 1) {
      throw new ErrorValidacion("Recarga la caja e intenta nuevamente");
    }
    return {
      numero: datos.numero as number,
      montoContado: montoNoNegativo(datos.montoContado, "El efectivo contado"),
    };
  });
}

export interface CorteAnterior {
  montoContado: number;
  esperadoDia: number;
}

/**
 * Esperado de un turno sobre la caja compartida. El turno recibe lo contado en
 * el corte anterior (o el fondo inicial) y suma lo que el esperado del dia se
 * movio desde entonces. Asi la suma de diferencias de los turnos es la
 * diferencia del dia, sin depender de la hora exacta de cada pago.
 */
export function calcularCorteTurno({
  montoInicial,
  esperadoDia,
  anterior,
  montoContado,
}: {
  montoInicial: number;
  esperadoDia: number;
  anterior: CorteAnterior | null;
  montoContado: number;
}) {
  const c = (valor: number) => Math.round(valor * 100);
  const fondo = c(anterior?.montoContado ?? montoInicial);
  const base = c(anterior?.esperadoDia ?? montoInicial);
  const esperado = fondo + c(esperadoDia) - base;
  return {
    fondoInicial: fondo / 100,
    montoEsperado: esperado / 100,
    diferencia: (c(montoContado) - esperado) / 100,
  };
}
