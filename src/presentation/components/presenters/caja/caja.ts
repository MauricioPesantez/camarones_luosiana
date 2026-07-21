import type { EstadoCajaDTO } from "@/presentation/http/dto";
import type { TipoMovimientoManual } from "@/presentation/api/caja";

/**
 * Vista-modelo pura de la pantalla de caja/cierre (R10, R11, R13).
 *
 * Sin dependencias de React ni del DOM: etiquetas, formato, predicados de
 * habilitación y textos de confirmación/toast. Se prueba de forma aislada en
 * Node (`caja.test.ts`); los presenters y el container solo consumen estas
 * funciones para mantener una única fuente de verdad de la lógica de la vista.
 */

/** Etiqueta legible de cada tipo de movimiento manual (R11.3–R11.6). */
export const ETIQUETA_MOVIMIENTO: Record<TipoMovimientoManual, string> = {
  PAGO_PROVEEDOR: "Pago a proveedor",
  COMPRA_MENOR: "Compra menor",
  INGRESO_MANUAL: "Ingreso manual",
  RETIRO_MANUAL: "Retiro manual",
};

/** Orden de presentación de los tipos de movimiento manual. */
export const TIPOS_MOVIMIENTO_MANUAL: readonly TipoMovimientoManual[] = [
  "PAGO_PROVEEDOR",
  "COMPRA_MENOR",
  "INGRESO_MANUAL",
  "RETIRO_MANUAL",
];

/** ¿Hay una sesión de caja abierta? (R10). */
export function hayCajaAbierta(estado: EstadoCajaDTO): boolean {
  return estado.sesion !== null;
}

/** Formatea un monto decimal a moneda (mismo formato que el resto de la app). */
export function formatMoney(monto: number): string {
  return `$${monto.toFixed(2)}`;
}

/**
 * Etiqueta legible de la diferencia del cuadre (R13.2): sobrante si es
 * positiva, faltante si es negativa, cuadre exacto si es cero. Se compara con
 * una tolerancia mínima (medio centavo) para evitar ruido de punto flotante.
 */
export function etiquetaDiferencia(diferencia: number): string {
  if (diferencia > 0.005) return "Sobrante";
  if (diferencia < -0.005) return "Faltante";
  return "Cuadre exacto";
}

/**
 * Diferencia en vivo del cuadre antes de cerrar: `contado − esperado` (R13.2).
 * Espeja la fórmula pura del dominio (`diferencia`) para la vista previa.
 */
export function diferenciaEnVivo(
  efectivoContado: number,
  esperado: number,
): number {
  return efectivoContado - esperado;
}

/** Un fondo de apertura debe ser un número finito no negativo (R10). */
export function puedeAbrir(fondoInicial: number | null): boolean {
  return (
    fondoInicial !== null &&
    Number.isFinite(fondoInicial) &&
    fondoInicial >= 0
  );
}

/** Un movimiento manual exige un monto finito y estrictamente positivo. */
export function puedeRegistrarMovimiento(monto: number | null): boolean {
  return monto !== null && Number.isFinite(monto) && monto > 0;
}

/** El efectivo contado del cierre debe ser un número finito no negativo. */
export function puedeCerrar(efectivoContado: number | null): boolean {
  return (
    efectivoContado !== null &&
    Number.isFinite(efectivoContado) &&
    efectivoContado >= 0
  );
}

/** Texto de confirmación de apertura de caja (R10). */
export function mensajeConfirmarApertura(fondoInicial: number): string {
  return `¿Abrir la caja con un fondo de ${formatMoney(fondoInicial)}?`;
}

/** Toast tras abrir la caja (R10). */
export const MENSAJE_CAJA_ABIERTA = "Caja abierta";

/** Toast tras asentar un movimiento manual (R11). */
export function mensajeMovimientoRegistrado(tipo: TipoMovimientoManual): string {
  return `${ETIQUETA_MOVIMIENTO[tipo]} registrado`;
}

/**
 * Texto de confirmación del cierre (R13). Se muestra en el modal antes de
 * firmar la jornada, con el efectivo contado y la diferencia resultante para
 * que el cierre sea legible y deliberado.
 */
export function mensajeConfirmarCierre(
  efectivoContado: number,
  diferencia: number,
): string {
  return `Se cerrará la caja con ${formatMoney(
    efectivoContado,
  )} contados (${etiquetaDiferencia(diferencia)}: ${formatMoney(
    Math.abs(diferencia),
  )}). Esta acción firma y cierra la jornada. ¿Continuar?`;
}

/** Toast tras cerrar la caja (R13). */
export const MENSAJE_CAJA_CERRADA = "Caja cerrada";
