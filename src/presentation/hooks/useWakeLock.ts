"use client";

import { useEffect } from "react";

/**
 * Mantiene la pantalla encendida mientras el KDS está activo (R14.5) vía la
 * Screen Wake Lock API. El lock se libera solo si la pestaña pasa a segundo
 * plano; se re-adquiere al volver a ser visible. Degrada silenciosamente en
 * navegadores sin soporte.
 */
export function useWakeLock(activo: boolean = true): void {
  useEffect(() => {
    if (!activo || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let cancelado = false;

    const adquirir = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Falla si no hay permiso o la pestaña no está visible: se reintenta
        // en el próximo evento de visibilidad.
      }
    };

    const onVisibilidad = () => {
      if (document.visibilityState === "visible" && !cancelado) {
        adquirir();
      }
    };

    adquirir();
    document.addEventListener("visibilitychange", onVisibilidad);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", onVisibilidad);
      sentinel?.release().catch(() => undefined);
    };
  }, [activo]);
}
