"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { Modal } from "./Modal";
import { ToastRegion } from "./Toast";
import { TOAST_TTL_MS, toastReducer } from "./toastState";

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly danger?: boolean;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

export interface UIContextValue {
  /** Muestra un toast que se auto-cierra (~2.6s). */
  toast: (text: string) => void;
  /** Abre un modal de confirmación; resuelve `true` al confirmar, `false` si no. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const UIContext = createContext<UIContextValue | null>(null);

interface PendingConfirm extends ConfirmOptions {
  readonly resolve: (value: boolean) => void;
}

let toastSeq = 0;

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const toast = useCallback((text: string) => {
    const id = `t${++toastSeq}`;
    dispatch({ type: "push", id, text });
    const timer = setTimeout(() => {
      dispatch({ type: "dismiss", id });
      timers.current.delete(id);
    }, TOAST_TTL_MS);
    timers.current.set(id, timer);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback(
    (value: boolean) => {
      setPending((current) => {
        current?.resolve(value);
        return null;
      });
    },
    [],
  );

  const value = useMemo<UIContextValue>(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UIContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} />
      {pending && (
        <Modal
          title={pending.title}
          message={pending.message}
          danger={pending.danger}
          confirmLabel={pending.confirmLabel}
          cancelLabel={pending.cancelLabel}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </UIContext.Provider>
  );
}

/** Accede al `UIProvider`. Lanza si se usa fuera del árbol del provider. */
export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error("useUI debe usarse dentro de <UIProvider>");
  }
  return ctx;
}
