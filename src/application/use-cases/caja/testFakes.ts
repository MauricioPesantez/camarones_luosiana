import type { CajaRepository } from "@/application/ports/CajaRepository";
import { CajaSession } from "@/domain/caja/CajaSession";
import { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import { Role } from "@/domain/user/Role";
import { User } from "@/domain/user/User";

/**
 * Fakes en memoria para las pruebas de los casos de uso de caja. Implementan
 * los puertos con estructuras de datos simples (sin DB ni mocks de librerías)
 * para validar la lógica real de los casos de uso.
 */

/**
 * Repositorio de caja en memoria.
 *
 * `sesionAbierta` deriva su respuesta del estado vigente de la entidad: una vez
 * que `CerrarCaja` invoca `sesion.cerrar()`, la misma instancia pasa a
 * `CERRADA` y deja de considerarse abierta, lo que bloquea los movimientos
 * posteriores (Property 5).
 */
export class FakeCajaRepository implements CajaRepository {
  readonly sesiones: CajaSession[] = [];
  readonly movimientos: MovimientoCaja[] = [];

  async sesionAbierta(): Promise<CajaSession | null> {
    return this.sesiones.find((s) => s.estaAbierta()) ?? null;
  }

  async crearSesion(s: CajaSession): Promise<CajaSession> {
    this.sesiones.push(s);
    return s;
  }

  async agregarMovimiento(m: MovimientoCaja): Promise<void> {
    this.movimientos.push(m);
  }

  async movimientosDeSesion(sesionId: string): Promise<MovimientoCaja[]> {
    return this.movimientos.filter((m) => m.sesionId === sesionId);
  }

  async cerrarSesion(s: CajaSession): Promise<void> {
    // La entidad ya viene mutada a CERRADA por el caso de uso; basta con
    // asegurarse de que esté registrada.
    if (!this.sesiones.includes(s)) {
      this.sesiones.push(s);
    }
  }
}

/** Construye un usuario administrador para pruebas. */
export function crearAdmin(id = "admin-1"): User {
  return User.crear({
    id,
    usuario: "admin",
    claveHash: "hash",
    nombre: "Administrador",
    roles: [Role.ADMIN],
    puedeCobrar: true,
    activo: true,
  });
}

/** Construye un usuario no administrador (mesero) para pruebas. */
export function crearMesero(id = "mesero-1"): User {
  return User.crear({
    id,
    usuario: "mesero",
    claveHash: "hash",
    nombre: "Mesero",
    roles: [Role.MESERO],
    puedeCobrar: false,
    activo: true,
  });
}

/** Generador de ids determinista para pruebas (cuenta incremental). */
export function crearIdGen(prefijo = "id"): () => string {
  let contador = 0;
  return () => {
    contador += 1;
    return `${prefijo}-${contador}`;
  };
}
