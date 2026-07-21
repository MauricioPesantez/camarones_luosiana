"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Desbloqueo de audio por gesto del usuario (R14.4).
 *
 * Los navegadores no dejan reproducir sonido sin una interacción previa. Este
 * hook expone `activar` (a enganchar en un botón inicial) que crea/reanuda el
 * `AudioContext`, y `reproducir` que emite un beep corto para avisar de órdenes
 * nuevas. Mientras no se active, `reproducir` es no-op silencioso.
 */
export function useAudioUnlock() {
  const [habilitado, setHabilitado] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const activar = useCallback(async () => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    await ctxRef.current.resume();
    setHabilitado(true);
  }, []);

  const reproducir = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !habilitado) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }, [habilitado]);

  return { habilitado, activar, reproducir };
}
