// Un resultado ambiguo bloquea otros envíos hasta resolver exactamente la operación original.
export function crearEnvioIdempotente(transportar: typeof fetch = fetch) {
  let pendiente: { firma: string; clientRequestId: string } | null = null;
  let enCurso: Promise<unknown> | null = null;
  return async function enviar<T>(url: string, cuerpo: Record<string, unknown>): Promise<T> {
    const firma = JSON.stringify([url, cuerpo]);
    if (pendiente && pendiente.firma !== firma) throw new Error("Hay una operación sin confirmar. Restablezca los datos del envío anterior y reintente esa misma operación antes de registrar otra. No se ha enviado este cambio.");
    if (enCurso) return enCurso as Promise<T>;
    const clientRequestId = pendiente?.clientRequestId ?? crypto.randomUUID();
    pendiente = { firma, clientRequestId };
    const operacion = async () => {
      const res = await transportar(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cuerpo, clientRequestId }) });
      const data = await res.json();
      if (res.ok || res.status < 500) pendiente = null;
      if (!res.ok) throw new Error(data.error || "No se pudo guardar. Reintente la misma operación.");
      return data as T;
    };
    enCurso = operacion();
    try { return await enCurso as T; }
    finally { enCurso = null; }
  };
}
