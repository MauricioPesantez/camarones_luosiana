"use client";

import { useEffect, useRef } from "react";

import { cn } from "./utils";

export interface ModalProps {
  readonly title: string;
  readonly message: string;
  /** Estilo destructivo para acciones irreversibles (R17.2). */
  readonly danger?: boolean;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Modal de confirmación accesible (R17.1, R17.4, R17.6).
 *
 * - `role="dialog"` + `aria-modal` y etiquetado por título/mensaje.
 * - Foco inicial en el botón primario; `Escape` cancela.
 * - Trampa de foco simple con Tab/Shift+Tab entre los controles.
 * - Botones de al menos 44px de alto (objetivo táctil WCAG 2.1 AA).
 */
export function Modal({
  title,
  message,
  danger = false,
  confirmLabel = "Continuar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: ModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === "Tab") {
      // Solo dos focusables: mantenemos el foco dentro del diálogo.
      const first = cancelRef.current;
      const last = confirmRef.current;
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        // Clic en el backdrop cancela; clic dentro no burbujea hasta aquí.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-message"
        onKeyDown={onKeyDown}
        className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg"
      >
        <h2 id="modal-title" className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        <p id="modal-message" className="mt-2 text-sm text-muted-foreground">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={cn(
              "min-h-[44px] rounded-md px-4 text-sm font-medium",
              danger
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
