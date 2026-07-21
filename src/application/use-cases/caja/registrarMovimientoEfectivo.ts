import { randomUUID } from "node:crypto";

import type { CajaRepository } from "@/application/ports/CajaRepository";
import type { Clock } from "@/application/ports/Clock";
import { Libro } from "@/domain/caja/Libro";
import { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import type { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import { Money } from "@/domain/order/Money";
import { DomainError } from "@/domain/shared/DomainError";
import { err, ok, type Result } from "@/domain/shared/Result";
import type { User } from "@/domain/user/User";

/**
 * Helper interno compartido por los casos de uso de movimientos manuales de
 * efectivo (R11.3–R11.6): pago a proveedor, compra menor, ingreso y retiro
 * manual. Centraliza las reglas comunes para que las tres operaciones se
 * comporten de forma idéntica:
 *
 * - Exige una `CajaSession` ABIERTA; si no hay, falla (los movimientos solo
 *   existen dentro de una jornada y, tras el cierre, no hay sesión abierta, lo
 *   que bloquea toda edición — Property 5).
 * - Valida que la magnitud recibida sea estrictamente positiva (el caso de uso
 *   pasa siempre el monto como magnitud; aquí se le aplica el signo correcto).
 * - Registra empleado y marca de tiempo del reloj inyectado (R11.7).
 *
 * El `signo` lo fija cada caso de uso: `+1` para ingresos (INGRESO_MANUAL),
 * `-1` para egresos (PAGO_PROVEEDOR, COMPRA_MENOR, RETIRO_MANUAL).
 */
export interface RegistrarMovimientoEfectivoParams {
  /** Empleado que registra el movimiento (R11.7). */
  actor: User;
  /** Magnitud del movimiento (siempre positiva; el signo lo aplica el helper). */
  monto: Money;
  /** Tipo de movimiento a asentar. */
  tipo: TipoMovimiento;
  /** Signo a aplicar a la magnitud: `+1` ingreso, `-1` egreso. */
  signo: 1 | -1;
  categoria?: string | null;
  nota?: string | null;
}

export async function registrarMovimientoEfectivo(
  cajaRepo: CajaRepository,
  clock: Clock,
  idGen: () => string,
  params: RegistrarMovimientoEfectivoParams,
): Promise<Result<MovimientoCaja>> {
  const { actor, monto, tipo, signo, categoria, nota } = params;

  if (monto.esNegativo() || monto.esCero()) {
    return err(
      new DomainError(
        "El monto del movimiento debe ser mayor que cero",
        "CAJA_MOVIMIENTO_MONTO_INVALIDO",
      ),
    );
  }

  const sesion = await cajaRepo.sesionAbierta();
  if (!sesion) {
    return err(
      new DomainError(
        "No hay una sesión de caja abierta",
        "CAJA_NO_ABIERTA",
      ),
    );
  }

  const montoConSigno = signo === -1 ? monto.negativo() : monto;

  const movimiento = MovimientoCaja.crear({
    id: idGen(),
    sesionId: sesion.id,
    tipo,
    libro: Libro.EFECTIVO,
    monto: montoConSigno,
    categoria: categoria ?? null,
    empleadoId: actor.id,
    nota: nota ?? null,
    timestamp: clock.now(),
  });

  await cajaRepo.agregarMovimiento(movimiento);
  return ok(movimiento);
}

/** Generador de id por defecto reutilizado por los casos de uso de caja. */
export const defaultIdGen: () => string = randomUUID;
