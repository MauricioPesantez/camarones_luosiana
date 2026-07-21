"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import type { OrderDTO } from "@/presentation/http/dto";
import { ApiError } from "@/presentation/api/client";
import { iniciarPreparacion, marcarLista } from "@/presentation/api/orders";
import { useUI } from "@/presentation/components/ui";
import {
  colaCocina,
  mensajeConfirmarLista,
  mensajeOrdenLista,
  sinAtender,
} from "@/presentation/components/presenters/kds/kds";
import { KdsBoard } from "@/presentation/components/presenters/kds/KdsBoard";
import { useAudioUnlock } from "@/presentation/hooks/useAudioUnlock";
import { usePollingOrders } from "@/presentation/hooks/usePollingOrders";
import { useWakeLock } from "@/presentation/hooks/useWakeLock";

/**
 * Container del KDS (cocina). Compone el polling de órdenes activas (R14.1/6),
 * el wake lock (R14.5) y el desbloqueo de audio (R14.4) con la cola visual y las
 * acciones de iniciar/marcar lista (modal R15.2 + toast R15.3).
 */
export function KdsContainer() {
  const { toast, confirm } = useUI();
  const { orders, error, refetch } = usePollingOrders();
  const { habilitado, activar, reproducir } = useAudioUnlock();
  useWakeLock(true);

  const cola = useMemo(() => colaCocina(orders), [orders]);

  // Beep cuando aparece una orden nueva sin atender (R14.4).
  const sinAtenderPrev = useRef(0);
  useEffect(() => {
    const actuales = cola.filter(sinAtender).length;
    if (actuales > sinAtenderPrev.current) {
      reproducir();
    }
    sinAtenderPrev.current = actuales;
  }, [cola, reproducir]);

  const iniciar = useCallback(
    async (order: OrderDTO) => {
      try {
        await iniciarPreparacion(order.id);
        refetch();
      } catch (e) {
        toast(mensajeError(e));
      }
    },
    [refetch, toast],
  );

  const marcar = useCallback(
    async (order: OrderDTO) => {
      const ok = await confirm({
        title: "Marcar lista",
        message: mensajeConfirmarLista(order.numero),
      });
      if (!ok) return;
      try {
        await marcarLista(order.id);
        toast(mensajeOrdenLista(order.numero));
        refetch();
      } catch (e) {
        toast(mensajeError(e));
      }
    },
    [confirm, refetch, toast],
  );

  return (
    <section className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Cocina</h1>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-sm text-destructive" role="status">
              Reconectando…
            </span>
          )}
          {!habilitado && (
            <button
              type="button"
              onClick={activar}
              className="min-h-[44px] rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Activar sonido
            </button>
          )}
        </div>
      </header>

      <KdsBoard orders={cola} onIniciar={iniciar} onMarcarLista={marcar} />
    </section>
  );
}

function mensajeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Ocurrió un error. Intenta de nuevo.";
}
