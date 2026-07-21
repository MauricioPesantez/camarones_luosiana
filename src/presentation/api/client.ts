import type { OrderDTO, MenuItemDTO } from "@/presentation/http/dto";

/**
 * Error de una llamada a la API. Conserva el `code` del `DomainError` y el
 * status HTTP para que el container decida el mensaje/toast a mostrar.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: unknown;
  code?: unknown;
}

/**
 * Envoltura mínima de `fetch` para el contrato JSON de la app. Ante un status
 * de error, parsea `{ error, code }` y lanza `ApiError`; ante éxito devuelve el
 * cuerpo tipado. Las mutaciones envían JSON salvo que se pase `FormData`.
 */
export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const esFormData = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(esFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    const mensaje =
      typeof body.error === "string" ? body.error : `Error ${res.status}`;
    const code = typeof body.code === "string" ? body.code : "UNKNOWN";
    throw new ApiError(mensaje, code, res.status);
  }

  return (await res.json()) as T;
}

export type { OrderDTO, MenuItemDTO };
