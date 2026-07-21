/**
 * Estado puro de la pila de toasts del `UIProvider` (R17.5).
 *
 * Se aísla del componente React para poder probar la lógica de encolado y
 * descarte en entorno Node, sin DOM. El provider solo despacha estas acciones y
 * pinta el resultado.
 */

/** Duración de un toast antes del auto-cierre, ~2.6s según R17.5. */
export const TOAST_TTL_MS = 2600;

export interface Toast {
  readonly id: string;
  readonly text: string;
}

export type ToastAction =
  | { type: "push"; id: string; text: string }
  | { type: "dismiss"; id: string };

export function toastReducer(state: readonly Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case "push":
      // Ignora ids duplicados para no repetir el mismo toast si el temporizador
      // de descarte se solapa con un re-render.
      if (state.some((t) => t.id === action.id)) {
        return state as Toast[];
      }
      return [...state, { id: action.id, text: action.text }];
    case "dismiss":
      return state.filter((t) => t.id !== action.id);
    default:
      return state as Toast[];
  }
}
