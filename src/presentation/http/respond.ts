import { NextResponse } from "next/server";

import type { Result } from "@/domain/shared/Result";
import { isErr } from "@/domain/shared/Result";

import { errorResponse } from "./apiError";

/**
 * Convierte un `Result<T>` de un caso de uso en una `NextResponse`: `ok` →
 * `status` (200 por defecto) con el cuerpo serializado; `err` → el status HTTP
 * que corresponde al `DomainError` (`errorResponse`).
 *
 * @param resultado Resultado del caso de uso.
 * @param serializar Proyecta el valor de éxito a un DTO plano.
 * @param status Status para el caso de éxito (p. ej. 201 al crear).
 */
export function respondResult<T>(
  resultado: Result<T>,
  serializar: (valor: T) => unknown,
  status = 200,
): NextResponse {
  if (isErr(resultado)) {
    return errorResponse(resultado.error);
  }
  return NextResponse.json(serializar(resultado.value), { status });
}
