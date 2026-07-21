"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { OrderDTO } from "@/presentation/http/dto";
import { ordenesActivas } from "@/presentation/api/orders";
import { INTERVALO_POLLING_MS } from "@/presentation/components/presenters/kds/kds";

export interface PollingOrdersState {
  readonly orders: OrderDTO[];
  readonly error: boolean;
  readonly cargando: boolean;
  readonly refetch: () => void;
}

/**
 * Consulta las órdenes activas en intervalo fijo (R14.1: 3–5s) y reintenta
 * automáticamente ante un fallo (R14.6): el temporizador sigue vivo, así que el
 * siguiente tick reintenta; el estado previo se conserva para no vaciar la cola
 * ante un error transitorio. Cancela la petición en curso al desmontar.
 */
export function usePollingOrders(
  intervaloMs: number = INTERVALO_POLLING_MS,
): PollingOrdersState {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const cargar = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await ordenesActivas(controller.signal);
      setOrders(data);
      setError(false);
    } catch (e) {
      if (controller.signal.aborted) return;
      // Conserva la cola previa; el próximo tick reintenta (R14.6).
      setError(true);
    } finally {
      if (!controller.signal.aborted) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, intervaloMs);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [cargar, intervaloMs]);

  return { orders, error, cargando, refetch: cargar };
}
