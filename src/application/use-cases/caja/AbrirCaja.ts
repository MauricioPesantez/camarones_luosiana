import { randomUUID } from "node:crypto";

import type { CajaRepository } from "@/application/ports/CajaRepository";
import type { Clock } from "@/application/ports/Clock";
import { CajaSession } from "@/domain/caja/CajaSession";
import { Libro } from "@/domain/caja/Libro";
import { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import { Money } from "@/domain/order/Money";
import { DomainError } from "@/domain/shared/DomainError";
import { err, ok, type Result } from "@/domain/shared/Result";
import type { User } from "@/domain/user/User";

/** Entrada del caso de uso `AbrirCaja`. */
export interface AbrirCajaInput {
  /** Usuario que solicita la apertura (debe ser admin, R10.3). */
  actor: User;
  /** Fondo físico con el que arranca la jornada (R10.1). */
  fondoInicial: Money;
}

/**
 * Caso de uso `AbrirCaja` (R10).
 *
 * Abre la jornada de caja: valida que el actor sea administrador (R10.3),
 * rechaza la apertura si ya existe una sesión `ABIERTA` (R10.4), crea la
 * `CajaSession` con el `fondoInicial` (R10.1) y asienta un `MovimientoCaja`
 * de tipo `APERTURA` con signo positivo en el libro `EFECTIVO` por ese fondo
 * (R10.2).
 *
 * Devuelve un `Result` con la sesión creada o un `DomainError` tipado; no lanza
 * para errores de negocio.
 */
export class AbrirCaja {
  constructor(
    private readonly cajaRepo: CajaRepository,
    private readonly clock: Clock,
    private readonly idGen: () => string = randomUUID,
  ) {}

  async ejecutar(input: AbrirCajaInput): Promise<Result<CajaSession>> {
    const { actor, fondoInicial } = input;

    // R10.3: solo el administrador puede abrir la caja.
    if (!actor.esAdmin()) {
      return err(
        new DomainError(
          "Solo un administrador puede abrir la caja",
          "CAJA_ABRIR_NO_AUTORIZADO",
        ),
      );
    }

    // R10.4: no se puede abrir si ya hay una sesión abierta.
    const abierta = await this.cajaRepo.sesionAbierta();
    if (abierta) {
      return err(
        new DomainError(
          "Ya existe una sesión de caja abierta",
          "CAJA_YA_ABIERTA",
        ),
      );
    }

    const ahora = this.clock.now();

    // R10.1: crear la sesión (valida fondo no negativo en el dominio).
    let sesion: CajaSession;
    try {
      sesion = CajaSession.crear({
        id: this.idGen(),
        fecha: ahora,
        fondoInicial,
      });
    } catch (e) {
      if (e instanceof DomainError) {
        return err(e);
      }
      throw e;
    }

    const creada = await this.cajaRepo.crearSesion(sesion);

    // R10.2: movimiento de APERTURA, signo positivo, libro EFECTIVO.
    const apertura = MovimientoCaja.crear({
      id: this.idGen(),
      sesionId: creada.id,
      tipo: TipoMovimiento.APERTURA,
      libro: Libro.EFECTIVO,
      monto: fondoInicial,
      empleadoId: actor.id,
      timestamp: ahora,
      nota: "Apertura de caja",
    });
    await this.cajaRepo.agregarMovimiento(apertura);

    return ok(creada);
  }
}
