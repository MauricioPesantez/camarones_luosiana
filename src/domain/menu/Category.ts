import { DomainError } from "../shared/DomainError";

/**
 * Entidad `Category`: agrupa platos del menú (p. ej. "Camarones", "Bebidas").
 *
 * Es código de dominio puro (sin Prisma ni Next): identidad por `id` y un
 * `nombre` no vacío. Las conversiones a/desde la fila de Prisma ocurren en los
 * repositorios.
 */
export class Category {
  private constructor(
    /** Clave técnica (cuid en persistencia). */
    public readonly id: string,
    private _nombre: string,
  ) {}

  /**
   * Crea una `Category` validando sus invariantes: `id` y `nombre` no vacíos
   * (se recorta el espacio en blanco del nombre).
   */
  static crear(props: { id: string; nombre: string }): Category {
    const id = props.id?.trim();
    const nombre = props.nombre?.trim();
    if (!id) {
      throw new DomainError("Category requiere un id", "CATEGORIA_INVALIDA");
    }
    if (!nombre) {
      throw new DomainError("Category requiere un nombre", "CATEGORIA_INVALIDA");
    }
    return new Category(id, nombre);
  }

  get nombre(): string {
    return this._nombre;
  }

  /** Renombra la categoría exigiendo un nombre no vacío. */
  renombrar(nombre: string): void {
    const limpio = nombre?.trim();
    if (!limpio) {
      throw new DomainError("Category requiere un nombre", "CATEGORIA_INVALIDA");
    }
    this._nombre = limpio;
  }
}
