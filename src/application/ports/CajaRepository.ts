import { CajaSession } from "@/domain/caja/CajaSession";
import { MovimientoCaja } from "@/domain/caja/MovimientoCaja";

/**
 * Puerto para la persistencia de caja.
 *
 * Abstrae el acceso a `CajaSession` y `MovimientoCaja`.
 */
export interface CajaRepository {
  /** Retorna la sesión de caja actualmente abierta, o `null` si no hay ninguna. */
  sesionAbierta(): Promise<CajaSession | null>;

  /** Persiste una nueva sesión de caja. */
  crearSesion(s: CajaSession): Promise<CajaSession>;

  /** Agrega un movimiento a la sesión de caja activa. */
  agregarMovimiento(m: MovimientoCaja): Promise<void>;

  /** Lista todos los movimientos de una sesión de caja. */
  movimientosDeSesion(sesionId: string): Promise<MovimientoCaja[]>;

  /** Marca la sesión como cerrada y persiste los datos de cierre. */
  cerrarSesion(s: CajaSession): Promise<void>;
}
