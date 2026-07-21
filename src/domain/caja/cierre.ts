import { Money } from "../order/Money";
import { Libro } from "./Libro";
import { TipoMovimiento } from "./TipoMovimiento";
import type { MovimientoCaja } from "./MovimientoCaja";

/**
 * Cálculos puros del cierre de caja (R13).
 *
 * Estas funciones son **puras**: no mutan sus argumentos ni ningún estado
 * externo, no dependen del reloj ni de I/O, y devuelven siempre `Money` nuevo
 * usando aritmética en centavos (sin coma flotante). Consumen los
 * `MovimientoCaja` como datos planos de solo lectura, de modo que el cierre se
 * puede calcular y probar de forma aislada del caso de uso `CerrarCaja`
 * (Tarea 15.3) y de la persistencia.
 *
 * Convención de signo (importante): el `monto` de cada `MovimientoCaja` ya
 * lleva su signo embebido — positivo para ingresos (apertura, ventas, ingresos
 * manuales) y negativo para egresos (pago a proveedor, compra menor, retiro,
 * pago de carrera passthrough). Estas funciones **respetan ese signo** y
 * devuelven sumas con signo; nunca toman magnitudes absolutas.
 */

/**
 * Calcula el efectivo esperado de la sesión (R13.1): la suma de los `monto`
 * **con signo** de todos los movimientos cuyo `libro === Libro.EFECTIVO`.
 *
 * Los movimientos del libro `TRANSFERENCIA` se excluyen por completo: no
 * representan dinero físico en la caja. Como cada `monto` ya trae su signo, los
 * egresos (negativos) restan de forma natural al acumular desde `Money.cero()`.
 *
 * @param movimientos Lista de movimientos de la sesión (no se muta).
 * @returns Efectivo esperado con signo (normalmente positivo, pero puede ser
 *   negativo si los egresos superan a los ingresos del libro EFECTIVO).
 */
export function efectivoEsperado(
  movimientos: readonly MovimientoCaja[],
): Money {
  return movimientos
    .filter((m) => m.libro === Libro.EFECTIVO)
    .reduce((acc, m) => acc.suma(m.monto), Money.cero());
}

/**
 * Calcula la diferencia del cuadre (R13.2): `efectivoContado − esperado`.
 *
 * Un resultado positivo indica sobrante (hay más efectivo físico del esperado);
 * negativo indica faltante; cero indica cuadre exacto.
 *
 * @param efectivoContado Efectivo físico contado por el administrador.
 * @param esperado Efectivo esperado (típicamente el de `efectivoEsperado`).
 * @returns Diferencia con signo (`contado − esperado`).
 */
export function diferencia(efectivoContado: Money, esperado: Money): Money {
  return efectivoContado.resta(esperado);
}

/**
 * Calcula el monto puente (R13.3): la suma de los `monto` **con signo** de los
 * movimientos de tipo `PAGO_CARRERA` que además son passthrough
 * (`esCarreraPassthrough === true`).
 *
 * Estos movimientos se registran como egreso del libro `EFECTIVO` por el valor
 * del envío (monto negativo, R12.2). El puente devuelve la **suma con signo**
 * de esos movimientos —es decir, un valor negativo o cero— de forma coherente
 * con cómo quedaron asentados. Así, "el puente del cierre iguala la suma de
 * esos PAGO_CARRERA" se cumple literalmente y sin reinterpretar signos.
 *
 * @param movimientos Lista de movimientos de la sesión (no se muta).
 * @returns Suma con signo de los PAGO_CARRERA passthrough (≤ 0).
 */
export function puente(movimientos: readonly MovimientoCaja[]): Money {
  return movimientos
    .filter(
      (m) =>
        m.tipo === TipoMovimiento.PAGO_CARRERA &&
        m.esCarreraPassthrough === true,
    )
    .reduce((acc, m) => acc.suma(m.monto), Money.cero());
}

/** Resultado agregado del cierre de caja. */
export interface ResultadoCierre {
  /** Efectivo esperado (R13.1). */
  esperado: Money;
  /** Diferencia `contado − esperado` (R13.2). */
  diferencia: Money;
  /** Monto puente: suma con signo de PAGO_CARRERA passthrough (R13.3). */
  puente: Money;
}

/**
 * Conveniencia pura que calcula los tres valores del cierre de una vez (R13.1,
 * R13.2, R13.3) reutilizando las funciones individuales. No introduce lógica
 * nueva; existe para que el caso de uso de cierre lea de forma cohesiva.
 *
 * @param movimientos Lista de movimientos de la sesión (no se muta).
 * @param efectivoContado Efectivo físico contado por el administrador.
 */
export function calcularCierre(
  movimientos: readonly MovimientoCaja[],
  efectivoContado: Money,
): ResultadoCierre {
  const esperado = efectivoEsperado(movimientos);
  return {
    esperado,
    diferencia: diferencia(efectivoContado, esperado),
    puente: puente(movimientos),
  };
}
