"use client";

const money = (n: number) => `$${n.toFixed(2)}`;

/** Línea mostrada en el carrito (orden persistida o borrador). */
export interface CartLine {
  /** Identificador de la línea: `id` del OrderItem o `menuItemId` en borrador. */
  id: string;
  nombrePlato: string;
  precioUnit: number;
  cantidad: number;
}

/**
 * Vista mínima que el carrito necesita para pintarse. Tanto un `OrderDTO`
 * (orden ya creada) como el borrador en memoria satisfacen esta forma, de modo
 * que el mismo presenter sirve para componer y para editar.
 */
export interface CartView {
  items: readonly CartLine[];
  subtotal: number;
  envases: number;
  envio: number;
  total: number;
}

export interface CartProps {
  readonly view: CartView;
  readonly onQuitar: (id: string) => void;
  /** Si false, oculta los botones de quitar (orden no editable). */
  readonly editable?: boolean;
}

/**
 * Carrito de la orden: ítems, cantidades y totales (subtotal, envases, envío,
 * total). Presentacional puro; emite `onQuitar` por ítem. Los montos ya vienen
 * calculados (por el dominio en el DTO o por `resumenBorrador` en el borrador).
 */
export function Cart({ view, onQuitar, editable = true }: CartProps) {
  if (view.items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin ítems. Agrega platos del menú.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border">
        {view.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <span className="w-8 text-sm font-medium text-muted-foreground">
              {item.cantidad}×
            </span>
            <span className="flex-1 text-foreground">{item.nombrePlato}</span>
            <span className="text-sm text-muted-foreground">
              {money(item.precioUnit * item.cantidad)}
            </span>
            {editable && (
              <button
                type="button"
                onClick={() => onQuitar(item.id)}
                aria-label={`Quitar ${item.nombrePlato}`}
                className="min-h-[44px] min-w-[44px] rounded-md text-destructive hover:bg-muted"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
        <Row label="Subtotal" value={money(view.subtotal)} />
        {view.envases > 0 && <Row label="Envases" value={money(view.envases)} />}
        {view.envio > 0 && <Row label="Envío" value={money(view.envio)} />}
        <Row label="Total" value={money(view.total)} emphasis />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? "flex justify-between pt-1 text-base font-semibold text-foreground"
          : "flex justify-between text-muted-foreground"
      }
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
