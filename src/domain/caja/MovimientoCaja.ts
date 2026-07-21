import { DomainError } from "../shared/DomainError";
import { Money } from "../order/Money";
import { Libro } from "./Libro";
import { TipoMovimiento } from "./TipoMovimiento";

/**
 * Propiedades para crear/reconstituir un `MovimientoCaja`.
 *
 * `monto` se expresa con signo: positivo para ingresos (ventas, aperturas,
 * ingresos manuales) y negativo para egresos (pago a proveedor, compra menor,
 * retiro manual, pago de carrera passthrough). El llamador es responsable de
 * fijar el signo según el `tipo`; la entidad solo almacena el valor.
 */
export interface MovimientoCajaProps {
  id: string;
  sesionId: string;
  tipo: TipoMovimiento;
  libro: Libro;
  /** Monto con signo (puede ser negativo para egresos). */
  monto: Money;
  orderId?: string | null;
  categoria?: string | null;
  /** `true` solo para `PAGO_CARRERA` originado por delivery + transferencia. */
  esCarreraPassthrough?: boolean;
  /** Empleado que registró el movimiento (R11.7). */
  empleadoId: string;
  nota?: string | null;
  /** Marca de tiempo del evento de dinero (R11.7). */
  timestamp: Date;
}

/**
 * Entidad `MovimientoCaja`: un evento de dinero del libro mayor de caja (R11).
 *
 * Es **inmutable** (Property 5): una vez creado no se edita ni elimina. Las
 * correcciones se hacen con movimientos compensatorios (`INGRESO_MANUAL` /
 * `RETIRO_MANUAL`), nunca mutando un movimiento existente. Por eso todos los
 * campos son `readonly` y la entidad no expone setters.
 *
 * El cierre de caja (sub-tarea 5.2) consume estos movimientos como datos
 * planos: suma los del libro `EFECTIVO` para el esperado y los `PAGO_CARRERA`
 * passthrough para el puente.
 */
export class MovimientoCaja {
  private constructor(
    readonly id: string,
    readonly sesionId: string,
    readonly tipo: TipoMovimiento,
    readonly libro: Libro,
    readonly monto: Money,
    readonly orderId: string | null,
    readonly categoria: string | null,
    readonly esCarreraPassthrough: boolean,
    readonly empleadoId: string,
    readonly nota: string | null,
    readonly timestamp: Date,
  ) {}

  /**
   * Crea un `MovimientoCaja` validando sus invariantes: `id`, `sesionId` y
   * `empleadoId` no vacíos. El `monto` se conserva tal cual (con su signo).
   */
  static crear(props: MovimientoCajaProps): MovimientoCaja {
    const id = props.id?.trim();
    if (!id) {
      throw new DomainError(
        "MovimientoCaja requiere un id",
        "MOVIMIENTO_CAJA_ID_VACIO",
      );
    }
    const sesionId = props.sesionId?.trim();
    if (!sesionId) {
      throw new DomainError(
        "MovimientoCaja requiere una sesión",
        "MOVIMIENTO_CAJA_SESION_VACIA",
      );
    }
    const empleadoId = props.empleadoId?.trim();
    if (!empleadoId) {
      throw new DomainError(
        "MovimientoCaja requiere el empleado que lo registró",
        "MOVIMIENTO_CAJA_EMPLEADO_VACIO",
      );
    }
    return new MovimientoCaja(
      id,
      sesionId,
      props.tipo,
      props.libro,
      props.monto,
      props.orderId ?? null,
      props.categoria ?? null,
      props.esCarreraPassthrough ?? false,
      empleadoId,
      props.nota ?? null,
      props.timestamp,
    );
  }
}
