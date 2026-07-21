import { MenuRepository } from "@/application/ports/MenuRepository";
import { MenuItem } from "@/domain/menu/MenuItem";
import { DomainError } from "@/domain/shared/DomainError";

import { PrismaClientLike } from "../client";
import { moneyToDecimal, toMenuItemDomain } from "../mappers";
import { prisma } from "../prisma";

/**
 * Implementación Prisma del puerto `MenuRepository`.
 *
 * Acepta un cliente Prisma (singleton o transaccional) para poder participar
 * en una unidad de trabajo (`runInTransaction`) sin duplicar código.
 */
export class PrismaMenuRepository implements MenuRepository {
  constructor(private readonly db: PrismaClientLike = prisma) {}

  async listar(): Promise<MenuItem[]> {
    const rows = await this.db.menuItem.findMany({ orderBy: { nombre: "asc" } });
    return rows.map(toMenuItemDomain);
  }

  async obtener(id: string): Promise<MenuItem | null> {
    const row = await this.db.menuItem.findUnique({ where: { id } });
    return row ? toMenuItemDomain(row) : null;
  }

  async guardar(item: MenuItem): Promise<void> {
    const data = {
      nombre: item.nombre,
      categoriaId: item.categoriaId,
      precio: moneyToDecimal(item.precio),
      fotoUrl: item.fotoUrl,
      stockDelDia: item.stockDelDia,
      disponible: item.disponible,
    };
    await this.db.menuItem.upsert({
      where: { id: item.id },
      create: { id: item.id, ...data },
      update: data,
    });
  }

  /**
   * Elimina un ítem del menú por su id (R3.1).
   *
   * Usa `deleteMany` para ser idempotente: si el ítem ya no existe, no lanza.
   */
  async eliminar(id: string): Promise<void> {
    await this.db.menuItem.deleteMany({ where: { id } });
  }

  /**
   * Ajusta el stock de forma atómica (R3.3, R5.2).
   *
   * El decremento usa una actualización guardada (`updateMany` con condición
   * `stockDelDia >= |delta|`) más un `increment` a nivel de base de datos, de
   * modo que dos peticiones concurrentes no puedan dejar el stock negativo
   * (Property 1). Si la actualización no afecta filas, se distingue entre ítem
   * inexistente y stock insuficiente.
   *
   * Tras el ajuste aplica auto-86: si el stock queda en 0, marca el ítem como
   * no disponible (R3.4).
   */
  async ajustarStock(id: string, delta: number): Promise<MenuItem> {
    if (!Number.isInteger(delta)) {
      throw new DomainError(
        "El ajuste de stock debe ser un entero",
        "MENU_ITEM_DELTA_NO_ENTERO",
      );
    }

    const resultado = await this.db.menuItem.updateMany({
      // Para decrementos exigimos stock suficiente; para incrementos no hay guarda.
      where: delta < 0 ? { id, stockDelDia: { gte: -delta } } : { id },
      data: { stockDelDia: { increment: delta } },
    });

    if (resultado.count === 0) {
      const existe = await this.db.menuItem.findUnique({ where: { id } });
      if (!existe) {
        throw new DomainError(
          `No existe el plato ${id}`,
          "MENU_ITEM_NO_ENCONTRADO",
        );
      }
      throw new DomainError(
        "Stock insuficiente para el plato",
        "MENU_ITEM_STOCK_INSUFICIENTE",
      );
    }

    const row = await this.db.menuItem.findUniqueOrThrow({ where: { id } });

    // Auto-86: si el stock llegó a 0, el plato deja de estar disponible.
    if (row.stockDelDia === 0 && row.disponible) {
      const actualizado = await this.db.menuItem.update({
        where: { id },
        data: { disponible: false },
      });
      return toMenuItemDomain(actualizado);
    }

    return toMenuItemDomain(row);
  }
}
