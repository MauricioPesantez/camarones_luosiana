import { randomUUID } from "crypto";

import type { MenuRepository } from "@/application/ports/MenuRepository";
import { MenuItem } from "@/domain/menu/MenuItem";
import { Money } from "@/domain/order/Money";
import { DomainError } from "@/domain/shared/DomainError";
import { err, ok, type Result } from "@/domain/shared/Result";

/**
 * Datos para crear un Plato (R3.1).
 */
export interface CrearPlatoInput {
  nombre: string;
  categoriaId: string;
  precio: Money;
  fotoUrl?: string | null;
  stockDelDia: number;
  disponible: boolean;
}

/**
 * Cambios para editar un Plato. Cada campo es opcional: solo se aplican los
 * presentes; el resto conserva su valor actual. `fotoUrl` admite `null` de
 * forma explícita para borrar la foto, por lo que se distingue de "ausente".
 */
export interface EditarPlatoInput {
  nombre?: string;
  categoriaId?: string;
  precio?: Money;
  fotoUrl?: string | null;
  stockDelDia?: number;
  disponible?: boolean;
}

/** Generador de ids inyectable (facilita pruebas deterministas). */
export type GenerarId = () => string;

/**
 * Caso de uso `GestionarMenu` (R3.1): permite al administrador crear, editar y
 * eliminar Platos con nombre, categoría, precio, foto, `stockDelDia` y
 * `disponible`. Persiste los cambios a través del `MenuRepository`.
 *
 * La validación de invariantes (nombre no vacío, precio no negativo, stock
 * entero no negativo) recae en la entidad `MenuItem`; aquí solo se orquesta y
 * se traducen los `DomainError` a un `Result` tipado.
 */
export class GestionarMenu {
  constructor(
    private readonly menuRepo: MenuRepository,
    private readonly generarId: GenerarId = () => randomUUID(),
  ) {}

  /** Crea un Plato nuevo y lo persiste. */
  async crear(input: CrearPlatoInput): Promise<Result<MenuItem>> {
    try {
      const item = MenuItem.crear({
        id: this.generarId(),
        nombre: input.nombre,
        categoriaId: input.categoriaId,
        precio: input.precio,
        fotoUrl: input.fotoUrl ?? null,
        stockDelDia: input.stockDelDia,
        disponible: input.disponible,
      });
      await this.menuRepo.guardar(item);
      return ok(item);
    } catch (e) {
      return this.mapError(e);
    }
  }

  /** Edita un Plato existente aplicando solo los campos provistos. */
  async editar(id: string, cambios: EditarPlatoInput): Promise<Result<MenuItem>> {
    const existente = await this.menuRepo.obtener(id);
    if (!existente) {
      return err(
        new DomainError(`No existe el plato ${id}`, "MENU_ITEM_NO_ENCONTRADO"),
      );
    }
    try {
      const actualizado = MenuItem.crear({
        id,
        nombre: cambios.nombre ?? existente.nombre,
        categoriaId: cambios.categoriaId ?? existente.categoriaId,
        precio: cambios.precio ?? existente.precio,
        fotoUrl:
          cambios.fotoUrl !== undefined ? cambios.fotoUrl : existente.fotoUrl,
        stockDelDia: cambios.stockDelDia ?? existente.stockDelDia,
        disponible: cambios.disponible ?? existente.disponible,
      });
      await this.menuRepo.guardar(actualizado);
      return ok(actualizado);
    } catch (e) {
      return this.mapError(e);
    }
  }

  /** Elimina un Plato existente. */
  async eliminar(id: string): Promise<Result<void>> {
    const existente = await this.menuRepo.obtener(id);
    if (!existente) {
      return err(
        new DomainError(`No existe el plato ${id}`, "MENU_ITEM_NO_ENCONTRADO"),
      );
    }
    await this.menuRepo.eliminar(id);
    return ok(undefined);
  }

  /** Traduce un `DomainError` a `Result.err`; re-lanza errores inesperados. */
  private mapError<T>(e: unknown): Result<T> {
    if (e instanceof DomainError) {
      return err(e);
    }
    throw e;
  }
}
