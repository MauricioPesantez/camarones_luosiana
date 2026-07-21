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

/** Entrada del caso de uso `RegistrarCompraMenor`. */
export interface RegistrarCompraMenorInput {
  actor: User;
  /** Magnitud de la compra (positiva). */
  monto: Money;
  categoria?: string | null;
  nota?: string | null;
}

/**
 * Caso de uso `RegistrarCompraMenor` (R11.4).
 *
 * Asienta un `MovimientoCaja` de tipo `COMPRA_MENOR` con signo **negativo**
 * en el libro `EFECTIVO`. Requiere una sesión de caja abierta y registra el
 * empleado y la marca de tiempo (R11.7).
 */
export class RegistrarCompraMenor {
  constructor(
    private readonly cajaRepo: CajaRepository,
    private readonly clock: Clock,
    private readonly idGen: () => string = defaultIdGen,
  ) {}

  ejecutar(input: RegistrarCompraMenorInput): Promise<Result<MovimientoCaja>> {
    return registrarMovimientoEfectivo(this.cajaRepo, this.clock, this.idGen, {
      actor: input.actor,
      monto: input.monto,
      tipo: TipoMovimiento.COMPRA_MENOR,
      signo: -1,
      categoria: input.categoria,
      nota: input.nota,
    });
  }
}
