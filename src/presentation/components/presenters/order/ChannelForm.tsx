"use client";

import { ORDER_CHANNELS, OrderChannel } from "@/domain/order/OrderChannel";

import type { OrderDraft } from "./orderTaking";

const ETIQUETA_CANAL: Record<OrderChannel, string> = {
  SALON: "Salón",
  DELIVERY: "Delivery",
  RETIRAR: "Retirar",
};

export interface ChannelFieldsProps {
  readonly draft: OrderDraft;
  /** Aplica un cambio parcial sobre el borrador (canal o datos de cliente). */
  readonly onChange: (patch: Partial<OrderDraft>) => void;
}

/**
 * Datos de canal de la orden (R4.1–R4.3), componente **controlado**: el estado
 * vive en el borrador del container, de modo que el canal y los datos del
 * cliente persisten mientras se arma el carrito. Pide número de mesa en `SALON`
 * y dirección (y envío/contacto) en `DELIVERY`. La creación la dispara el
 * container tras armar todo el pedido.
 */
export function ChannelFields({ draft, onChange }: ChannelFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">Canal</legend>
        <div className="flex gap-2">
          {ORDER_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={draft.canal === c}
              onClick={() => onChange({ canal: c })}
              className={
                draft.canal === c
                  ? "min-h-[44px] flex-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                  : "min-h-[44px] flex-1 rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted"
              }
            >
              {ETIQUETA_CANAL[c]}
            </button>
          ))}
        </div>
      </fieldset>

      {draft.canal === OrderChannel.SALON && (
        <Field label="Número de mesa">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.mesa}
            onChange={(e) => onChange({ mesa: e.target.value })}
            className="min-h-[44px] w-full rounded-md border border-input px-3"
          />
        </Field>
      )}

      {draft.canal === OrderChannel.DELIVERY && (
        <>
          <Field label="Dirección del cliente">
            <input
              type="text"
              value={draft.clienteDireccion}
              onChange={(e) => onChange({ clienteDireccion: e.target.value })}
              className="min-h-[44px] w-full rounded-md border border-input px-3"
            />
          </Field>
          <Field label="Nombre (opcional)">
            <input
              type="text"
              value={draft.clienteNombre}
              onChange={(e) => onChange({ clienteNombre: e.target.value })}
              className="min-h-[44px] w-full rounded-md border border-input px-3"
            />
          </Field>
          <Field label="Teléfono (opcional)">
            <input
              type="tel"
              value={draft.clienteTelefono}
              onChange={(e) => onChange({ clienteTelefono: e.target.value })}
              className="min-h-[44px] w-full rounded-md border border-input px-3"
            />
          </Field>
          <Field label="Envío (opcional)">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={draft.envio}
              onChange={(e) => onChange({ envio: e.target.value })}
              className="min-h-[44px] w-full rounded-md border border-input px-3"
            />
          </Field>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
      {label}
      {children}
    </label>
  );
}
