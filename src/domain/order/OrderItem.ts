import { DomainError } from "../shared/DomainError";
import { Money } from "./Money";

/**
 * Propiedades para crear o reconstituir un `OrderItem` (p. ej. desde el
 * repositorio).
 */
export interface OrderItemProps {
  id: string;
  /** Referencia al `MenuItem` del que proviene este ítem. */
  menuItemId: string;
  /** Snapshot del nombre del plato al momento del pedido. */
  nombrePlato: string;
  /** Snapshot del precio unitario al momento del pedido. */
  precioUnit: Money;
  /** Cantidad pedida (entero positivo). */
  cantidad: number;
}

/**
 * Entidad `OrderItem`: una línea de la orden que referencia un `MenuItem`.
 *
 * Guarda un **snapshot** de `nombrePlato` y `precioUnit` al momento del pedido,
 * de modo que el total histórico de la orden no cambie si luego se edita el
 * precio o el nombre del plato en el menú (decisión de modelado del diseño).
 *
 * El cálculo de totales de la orden (subtotal = Σ precioUnit × cantidad) vive
 * en `Order.recalcular` (Tarea 4.2); aquí solo se exponen los datos de la línea.
 */
export class OrderItem {
  private constructor(
    readonly id: string,
    readonly menuItemId: string,
    private _nombrePlato: string,
    private _precioUnit: Money,
    private _cantidad: number,
  ) {}

  /**
   * Crea un `OrderItem` validando sus invariantes:
   * - `nombrePlato` no vacío (se recorta el espacio en blanco).
   * - `precioUnit` no negativo.
   * - `cantidad` entera y mayor que cero.
   */
  static crear(props: OrderItemProps): OrderItem {
    const nombrePlato = props.nombrePlato.trim();
    if (nombrePlato.length === 0) {
      throw new DomainError(
        "El ítem de orden requiere el nombre del plato",
        "ORDER_ITEM_NOMBRE_VACIO",
      );
    }
    if (props.precioUnit.esNegativo()) {
      throw new DomainError(
        "El precio unitario no puede ser negativo",
        "ORDER_ITEM_PRECIO_NEGATIVO",
      );
    }
    OrderItem.validarCantidad(props.cantidad);
    return new OrderItem(
      props.id,
      props.menuItemId,
      nombrePlato,
      props.precioUnit,
      props.cantidad,
    );
  }

  private static validarCantidad(cantidad: number): void {
    if (!Number.isInteger(cantidad)) {
      throw new DomainError(
        "La cantidad debe ser un entero",
        "ORDER_ITEM_CANTIDAD_NO_ENTERA",
      );
    }
    if (cantidad <= 0) {
      throw new DomainError(
        "La cantidad debe ser mayor que cero",
        "ORDER_ITEM_CANTIDAD_INVALIDA",
      );
    }
  }

  get nombrePlato(): string {
    return this._nombrePlato;
  }

  get precioUnit(): Money {
    return this._precioUnit;
  }

  get cantidad(): number {
    return this._cantidad;
  }

  /** Importe de la línea: `precioUnit × cantidad`. */
  importe(): Money {
    return this._precioUnit.multiplica(this._cantidad);
  }

  /** Ajusta la cantidad pedida validando que sea un entero positivo. */
  cambiarCantidad(cantidad: number): void {
    OrderItem.validarCantidad(cantidad);
    this._cantidad = cantidad;
  }
}
