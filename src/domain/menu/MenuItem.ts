import { DomainError } from "../shared/DomainError";
import { Money } from "../order/Money";

/**
 * Propiedades para reconstituir un `MenuItem` (p. ej. desde el repositorio).
 */
export interface MenuItemProps {
  id: string;
  nombre: string;
  categoriaId: string;
  precio: Money;
  fotoUrl?: string | null;
  stockDelDia: number;
  disponible: boolean;
}

/**
 * Entidad `MenuItem`: un plato del menú con precio, foto, stock diario y
 * disponibilidad (R3).
 *
 * Concentra las reglas de stock como código puro (R3.3, R3.4, R5.2):
 * - `decrementar` / `incrementar` ajustan el `stockDelDia` por la cantidad
 *   pedida o devuelta.
 * - Auto-86: cuando el stock llega a 0, `disponible` pasa a `false`.
 * - El stock nunca puede quedar negativo (se rechaza con `DomainError`).
 */
export class MenuItem {
  private constructor(
    readonly id: string,
    private _nombre: string,
    readonly categoriaId: string,
    private _precio: Money,
    private _fotoUrl: string | null,
    private _stockDelDia: number,
    private _disponible: boolean,
  ) {}

  static crear(props: MenuItemProps): MenuItem {
    const nombre = props.nombre.trim();
    if (nombre.length === 0) {
      throw new DomainError(
        "El plato requiere un nombre",
        "MENU_ITEM_NOMBRE_VACIO",
      );
    }
    if (props.precio.esNegativo()) {
      throw new DomainError(
        "El precio del plato no puede ser negativo",
        "MENU_ITEM_PRECIO_NEGATIVO",
      );
    }
    MenuItem.validarStock(props.stockDelDia);
    return new MenuItem(
      props.id,
      nombre,
      props.categoriaId,
      props.precio,
      props.fotoUrl ?? null,
      props.stockDelDia,
      props.disponible,
    );
  }

  private static validarStock(stock: number): void {
    if (!Number.isInteger(stock)) {
      throw new DomainError(
        "El stock del día debe ser un entero",
        "MENU_ITEM_STOCK_NO_ENTERO",
      );
    }
    if (stock < 0) {
      throw new DomainError(
        "El stock del día no puede ser negativo",
        "MENU_ITEM_STOCK_NEGATIVO",
      );
    }
  }

  private static validarCantidad(cantidad: number): void {
    if (!Number.isInteger(cantidad)) {
      throw new DomainError(
        "La cantidad debe ser un entero",
        "MENU_ITEM_CANTIDAD_NO_ENTERA",
      );
    }
    if (cantidad <= 0) {
      throw new DomainError(
        "La cantidad debe ser mayor que cero",
        "MENU_ITEM_CANTIDAD_INVALIDA",
      );
    }
  }

  get nombre(): string {
    return this._nombre;
  }

  get precio(): Money {
    return this._precio;
  }

  get fotoUrl(): string | null {
    return this._fotoUrl;
  }

  get stockDelDia(): number {
    return this._stockDelDia;
  }

  get disponible(): boolean {
    return this._disponible;
  }

  /**
   * Decrementa el stock por la cantidad pedida al confirmar un ítem de orden
   * (R3.3). Si el stock llega a 0, aplica auto-86 (`disponible = false`, R3.4).
   * Rechaza si no hay stock suficiente (evita stock negativo).
   */
  decrementar(cantidad: number): void {
    MenuItem.validarCantidad(cantidad);
    if (cantidad > this._stockDelDia) {
      throw new DomainError(
        "Stock insuficiente para el plato",
        "MENU_ITEM_STOCK_INSUFICIENTE",
      );
    }
    this._stockDelDia -= cantidad;
    if (this._stockDelDia === 0) {
      this._disponible = false;
    }
  }

  /**
   * Incrementa el stock por la cantidad devuelta al quitar un ítem de orden
   * (R5.2). No reactiva `disponible` automáticamente: la reposición de
   * disponibilidad es una decisión explícita del administrador (R3.6).
   */
  incrementar(cantidad: number): void {
    MenuItem.validarCantidad(cantidad);
    this._stockDelDia += cantidad;
  }

  /**
   * Ajuste manual del stock por parte del administrador (R3.6). Aplica auto-86
   * si el nuevo valor es 0.
   */
  ajustarStock(nuevoStock: number): void {
    MenuItem.validarStock(nuevoStock);
    this._stockDelDia = nuevoStock;
    if (this._stockDelDia === 0) {
      this._disponible = false;
    }
  }

  /** El administrador fuerza la disponibilidad del plato (R3.6). */
  establecerDisponibilidad(disponible: boolean): void {
    this._disponible = disponible;
  }

  cambiarNombre(nombre: string): void {
    const limpio = nombre.trim();
    if (limpio.length === 0) {
      throw new DomainError(
        "El plato requiere un nombre",
        "MENU_ITEM_NOMBRE_VACIO",
      );
    }
    this._nombre = limpio;
  }

  cambiarPrecio(precio: Money): void {
    if (precio.esNegativo()) {
      throw new DomainError(
        "El precio del plato no puede ser negativo",
        "MENU_ITEM_PRECIO_NEGATIVO",
      );
    }
    this._precio = precio;
  }

  cambiarFoto(fotoUrl: string | null): void {
    this._fotoUrl = fotoUrl;
  }
}
