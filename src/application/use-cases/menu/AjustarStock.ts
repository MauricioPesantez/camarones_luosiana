import type { MenuRepository } from "@/application/ports/MenuRepository";
import { MenuItem } from "@/domain/menu/MenuItem";
import { DomainError } from "@/domain/shared/DomainError";
import { err, ok, type Result } from "@/domain/shared/Result";

/**
 * Entrada de la carga diaria de stock (R3.7): el stock del Plato y, de forma
 * opcional, su disponibilidad. Si `disponible` se omite, se deriva del stock
 * (un Plato con stock > 0 queda disponible al iniciar el día).
 */
export interface ResetStockEntrada {
  menuItemId: string;
  stock: number;
  disponible?: boolean;
}

/**
 * Caso de uso `AjustarStock`: operaciones del administrador sobre el stock y la
 * disponibilidad de los Platos (R3.6, R3.7).
 *
 * - `establecerStock`: fija manualmente el `stockDelDia` (R3.6). Aplica auto-86
 *   si el valor es 0 (la entidad `MenuItem` impone esa invariante).
 * - `forzarDisponibilidad`: fuerza `disponible` on/off (R3.6), por ejemplo para
 *   reactivar un Plato que el auto-86 había deshabilitado.
 * - `resetDiario`: reinicia el `stockDelDia` de varios Platos según la carga del
 *   administrador al iniciar la jornada (R3.7 / asunción 2).
 *
 * No usa `MenuRepository.ajustarStock` (pensado para ajustes atómicos por
 * `delta` durante el flujo de órdenes); aquí se trabaja con valores absolutos,
 * por lo que se lee la entidad, se muta y se persiste.
 */
export class AjustarStock {
  constructor(private readonly menuRepo: MenuRepository) {}

  /** Fija manualmente el stock del Plato (R3.6); aplica auto-86 si llega a 0. */
  async establecerStock(
    menuItemId: string,
    stock: number,
  ): Promise<Result<MenuItem>> {
    const item = await this.menuRepo.obtener(menuItemId);
    if (!item) {
      return this.noEncontrado(menuItemId);
    }
    try {
      item.ajustarStock(stock);
      await this.menuRepo.guardar(item);
      return ok(item);
    } catch (e) {
      return this.mapError(e);
    }
  }

  /** Fuerza la disponibilidad del Plato on/off (R3.6). */
  async forzarDisponibilidad(
    menuItemId: string,
    disponible: boolean,
  ): Promise<Result<MenuItem>> {
    const item = await this.menuRepo.obtener(menuItemId);
    if (!item) {
      return this.noEncontrado(menuItemId);
    }
    item.establecerDisponibilidad(disponible);
    await this.menuRepo.guardar(item);
    return ok(item);
  }

  /**
   * Reinicia el stock diario de los Platos indicados (R3.7). Valida primero que
   * todos existan para evitar aplicar la carga de forma parcial; luego fija el
   * stock y la disponibilidad de cada uno.
   *
   * La disponibilidad resultante es la indicada explícitamente o, si se omite,
   * `stock > 0`: un Plato con stock disponible vuelve a venderse al iniciar el
   * día, mientras que uno con stock 0 permanece deshabilitado por el auto-86.
   */
  async resetDiario(
    entradas: ResetStockEntrada[],
  ): Promise<Result<MenuItem[]>> {
    // Primera pasada: resolver y validar que todos los Platos existan.
    const resueltos: { item: MenuItem; entrada: ResetStockEntrada }[] = [];
    for (const entrada of entradas) {
      const item = await this.menuRepo.obtener(entrada.menuItemId);
      if (!item) {
        return this.noEncontrado(entrada.menuItemId);
      }
      resueltos.push({ item, entrada });
    }

    // Segunda pasada: aplicar el ajuste y persistir.
    const actualizados: MenuItem[] = [];
    try {
      for (const { item, entrada } of resueltos) {
        item.ajustarStock(entrada.stock);
        const disponibleFinal = entrada.disponible ?? entrada.stock > 0;
        item.establecerDisponibilidad(disponibleFinal);
        await this.menuRepo.guardar(item);
        actualizados.push(item);
      }
      return ok(actualizados);
    } catch (e) {
      return this.mapError(e);
    }
  }

  private noEncontrado<T>(id: string): Result<T> {
    return err(
      new DomainError(`No existe el plato ${id}`, "MENU_ITEM_NO_ENCONTRADO"),
    );
  }

  private mapError<T>(e: unknown): Result<T> {
    if (e instanceof DomainError) {
      return err(e);
    }
    throw e;
  }
}
