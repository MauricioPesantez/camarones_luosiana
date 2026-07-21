import type { CajaRepository } from "@/application/ports/CajaRepository";
import type { Clock } from "@/application/ports/Clock";
import type { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import type { Money } from "@/domain/order/Money";
import type { Result } from "@/domain/shared/Result";
import type { User } from "@/domain/user/User";

import {
  defaultIdGen,
  registrarMovimientoEfectivo,
} from "./registrarMovimientoEfectivo";

/** Entrada de los movimientos manuales de efectivo (ingreso / retiro). */
export interface IngresoRetiroManualInput {
  actor: User;
  /** Magnitud del movimiento (siempre positiva; el signo lo aplica el caso de uso). */
  monto: Money;
  categoria?: string | null;
  nota?: string | null;
}

/**
 * Caso de uso `IngresoRetiroManual` (R11.5, R11.6).
 *
 * Asienta movimientos manuales de efectivo que corrigen o ajustan la caja sin
 * pasar por una venta:
 *
 * - `ingreso(...)` → `INGRESO_MANUAL` con signo **positivo** en el libro
 *   `EFECTIVO` (R11.5).
 * - `retiro(...)` → `RETIRO_MANUAL` con signo **negativo** en el libro
 *   `EFECTIVO` (R11.6).
 *
 * Ambas operaciones exigen una `CajaSession` ABIERTA y registran el empleado y
 * la marca de tiempo (R11.7). Como tras el cierre no hay sesión abierta, estos
 * movimientos quedan bloqueados (Property 5).
 */
export class IngresoRetiroManual {
  constructor(
    private readonly cajaRepo: CajaRepository,
    private readonly clock: Clock,
    private readonly idGen: () => string = defaultIdGen,
  ) {}

  /** Registra un ingreso manual de efectivo (R11.5). */
  ingreso(input: IngresoRetiroManualInput): Promise<Result<MovimientoCaja>> {
    return registrarMovimientoEfectivo(this.cajaRepo, this.clock, this.idGen, {
      actor: input.actor,
      monto: input.monto,
      tipo: TipoMovimiento.INGRESO_MANUAL,
      signo: 1,
      categoria: input.categoria,
      nota: input.nota,
    });
  }

  /** Registra un retiro manual de efectivo (R11.6). */
  retiro(input: IngresoRetiroManualInput): Promise<Result<MovimientoCaja>> {
    return registrarMovimientoEfectivo(this.cajaRepo, this.clock, this.idGen, {
      actor: input.actor,
      monto: input.monto,
      tipo: TipoMovimiento.RETIRO_MANUAL,
      signo: -1,
      categoria: input.categoria,
      nota: input.nota,
    });
  }
}
