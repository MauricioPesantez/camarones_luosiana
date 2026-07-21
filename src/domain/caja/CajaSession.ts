import { DomainError } from "../shared/DomainError";
import { Money } from "../order/Money";
import { CajaEstado } from "./CajaEstado";

/**
 * Propiedades para crear/reconstituir una `CajaSession`.
 *
 * Al abrir la jornada solo se conocen `id`, `fecha` y `fondoInicial`; el resto
 * de campos (estado, efectivo contado, diferencia, firma, cierre) se completan
 * al cerrar la caja. El repositorio los provee al reconstituir una sesión ya
 * cerrada.
 */
export interface CajaSessionProps {
  id: string;
  fecha: Date;
  fondoInicial: Money;
  /** Por defecto `ABIERTA` al iniciar la jornada (R10.1). */
  estado?: CajaEstado;
  efectivoContado?: Money | null;
  diferencia?: Money | null;
  firmadoPorId?: string | null;
  closedAt?: Date | null;
}

/**
 * Entidad `CajaSession`: la jornada de caja con un fondo físico (R10, R13).
 *
 * Nace `ABIERTA` con un `fondoInicial`. El cuadre y la firma del día (fijar
 * `estado=CERRADA`, `efectivoContado`, `diferencia`, `firmadoPorId`,
 * `closedAt`) corresponden a la sub-tarea 5.2, que también calcula el efectivo
 * esperado, la diferencia y el puente como funciones puras.
 *
 * Para dejar esa costura limpia, los campos que se completan al cerrar se
 * mantienen como propiedades privadas mutables expuestas solo por getters; la
 * mutación de cierre la añadirá 5.2 sin duplicar sus cálculos aquí.
 */
export class CajaSession {
  private constructor(
    readonly id: string,
    readonly fecha: Date,
    readonly fondoInicial: Money,
    private _estado: CajaEstado,
    private _efectivoContado: Money | null,
    private _diferencia: Money | null,
    private _firmadoPorId: string | null,
    private _closedAt: Date | null,
  ) {}

  /**
   * Crea una `CajaSession` validando sus invariantes: `id` no vacío y
   * `fondoInicial` no negativo. Por defecto la sesión queda `ABIERTA`.
   */
  static crear(props: CajaSessionProps): CajaSession {
    const id = props.id?.trim();
    if (!id) {
      throw new DomainError(
        "CajaSession requiere un id",
        "CAJA_SESSION_ID_VACIO",
      );
    }
    if (props.fondoInicial.esNegativo()) {
      throw new DomainError(
        "El fondo inicial no puede ser negativo",
        "CAJA_SESSION_FONDO_NEGATIVO",
      );
    }
    return new CajaSession(
      id,
      props.fecha,
      props.fondoInicial,
      props.estado ?? CajaEstado.ABIERTA,
      props.efectivoContado ?? null,
      props.diferencia ?? null,
      props.firmadoPorId ?? null,
      props.closedAt ?? null,
    );
  }

  get estado(): CajaEstado {
    return this._estado;
  }

  get efectivoContado(): Money | null {
    return this._efectivoContado;
  }

  get diferencia(): Money | null {
    return this._diferencia;
  }

  get firmadoPorId(): string | null {
    return this._firmadoPorId;
  }

  get closedAt(): Date | null {
    return this._closedAt;
  }

  /** ¿La sesión sigue abierta y admite nuevos movimientos? */
  estaAbierta(): boolean {
    return this._estado === CajaEstado.ABIERTA;
  }

  /** ¿La sesión está cerrada (bloquea edición de movimientos, Property 5)? */
  estaCerrada(): boolean {
    return this._estado === CajaEstado.CERRADA;
  }

  /**
   * Cierra y firma la jornada (R13.4): fija `estado=CERRADA` junto con el
   * efectivo contado, la diferencia del cuadre, el firmante y la marca de
   * cierre. Es idempotencia-segura: si la sesión ya está cerrada lanza
   * `DomainError`, de modo que no se puede recerrar ni reabrir una sesión
   * (Property 5; bloquea toda edición posterior de sus movimientos).
   *
   * Los valores de cuadre (`efectivoContado`, `diferencia`) los calcula el
   * caso de uso `CerrarCaja` reutilizando las funciones puras de `cierre.ts`;
   * esta mutación solo asienta el resultado en la entidad.
   */
  cerrar(props: {
    efectivoContado: Money;
    diferencia: Money;
    firmadoPorId: string;
    closedAt: Date;
  }): void {
    if (this._estado === CajaEstado.CERRADA) {
      throw new DomainError(
        "La caja ya está cerrada",
        "CAJA_SESSION_YA_CERRADA",
      );
    }
    const firmadoPorId = props.firmadoPorId?.trim();
    if (!firmadoPorId) {
      throw new DomainError(
        "El cierre requiere el id de quien firma",
        "CAJA_SESSION_FIRMA_VACIA",
      );
    }
    this._estado = CajaEstado.CERRADA;
    this._efectivoContado = props.efectivoContado;
    this._diferencia = props.diferencia;
    this._firmadoPorId = firmadoPorId;
    this._closedAt = props.closedAt;
  }
}
