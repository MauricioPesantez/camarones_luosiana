import { MenuItem } from "@/domain/menu/MenuItem";

/**
 * Puerto para la persistencia del menú.
 *
 * Abstrae el acceso a `MenuItem`. La operación `ajustarStock` debe ser
 * atómica (incremento/decremento sin race conditions).
 */
export interface MenuRepository {
  /** Lista todos los ítems del menú. */
  listar(): Promise<MenuItem[]>;

  /** Obtiene un ítem por su id, o `null` si no existe. */
  obtener(id: string): Promise<MenuItem | null>;

  /** Persiste los cambios de un ítem existente o crea uno nuevo. */
  guardar(item: MenuItem): Promise<void>;

  /** Elimina un ítem por su id (R3.1). */
  eliminar(id: string): Promise<void>;

  /**
   * Ajusta el stock de un ítem de forma atómica.
   * `delta` puede ser negativo (decremento) o positivo (incremento).
   * Retorna el `MenuItem` actualizado.
   */
  ajustarStock(id: string, delta: number): Promise<MenuItem>;
}
