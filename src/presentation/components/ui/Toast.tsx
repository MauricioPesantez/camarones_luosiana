"use client";

import type { Toast } from "./toastState";

export interface ToastRegionProps {
  readonly toasts: readonly Toast[];
}

/**
 * Región de toasts (R17.5): `aria-live="polite"` para que el lector de pantalla
 * anuncie cada mensaje sin interrumpir. El auto-cierre lo gestiona el
 * `UIProvider` con un temporizador; aquí solo se pinta la pila vigente.
 */
export function ToastRegion({ toasts }: ToastRegionProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
