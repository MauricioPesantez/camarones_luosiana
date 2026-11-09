"use client";

import { useCallback, useEffect, useState } from "react";

interface Revision {
  habilitada: boolean;
  agente: { lastSeenAt: string; activo: boolean; sesionLista: boolean } | null;
  entradas: { id: string; recibidaAt: string; error: string | null; texto: string | null }[];
  salidas: {
    id: string;
    tipo: string;
    createdAt: string;
    ultimoError: string | null;
    texto: string;
    orden: { numeroDiario: number | null } | null;
  }[];
}

const TIPOS: Record<string, string> = {
  RESPUESTA_EMPLEADO: "Respuesta al empleado",
  PUBLICACION_GRUPO: "Publicación al grupo",
  ACTUALIZACION_GRUPO: "Cambio al grupo",
  RECORDATORIO_DELIVERY: "Aviso de delivery",
  RECORDATORIO_COBRO: "Aviso de órdenes sin cobrar",
};

const hora = (fecha: string) =>
  new Date(fecha).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });

const resumen = (texto: string | null) => (texto ?? "").split("\n").slice(0, 2).join(" · ");

export default function RevisionWhatsapp() {
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState("");
  const [descartando, setDescartando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo leer WhatsApp");
        return;
      }
      setRevision(data);
      setError("");
    } catch {
      setError("No se pudo leer WhatsApp");
    }
  }, []);

  useEffect(() => {
    // El setState ocurre después del fetch, no de forma síncrona en el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const descartar = async (tipo: "entrada" | "salida", id: string) => {
    setDescartando(id);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id }),
      });
      if (!res.ok) setError((await res.json()).error || "No se pudo descartar");
      await cargar();
    } catch {
      setError("No se pudo descartar");
    } finally {
      setDescartando(null);
    }
  };

  if (error && !revision) {
    return <p role="alert" className="text-sm text-red-700 mb-6">WhatsApp: {error}</p>;
  }
  if (!revision?.habilitada) return null;

  const { agente, entradas, salidas } = revision;
  const estadoAgente = !agente
    ? { texto: "Agente sin conectar", color: "text-red-700" }
    : !agente.activo
      ? { texto: `Agente sin respuesta desde ${hora(agente.lastSeenAt)}`, color: "text-red-700" }
      : agente.sesionLista
        ? { texto: "Agente y sesión de WhatsApp activos", color: "text-green-700" }
        : { texto: "Agente activo, sesión de WhatsApp desconectada", color: "text-amber-700" };
  const pendientes = entradas.length + salidas.length;

  const boton = (tipo: "entrada" | "salida", id: string) => (
    <button
      type="button"
      onClick={() => descartar(tipo, id)}
      disabled={descartando !== null}
      className="shrink-0 text-sm font-semibold px-3 py-1.5 rounded-lg border text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {descartando === id ? "Descartando..." : "Descartar"}
    </button>
  );

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6" aria-labelledby="revision-whatsapp">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="revision-whatsapp" className="text-xl font-bold text-gray-900">
            WhatsApp {pendientes > 0 && `· ${pendientes} por revisar`}
          </h2>
          <p className={`text-sm font-medium ${estadoAgente.color}`}>{estadoAgente.texto}</p>
        </div>
        <button
          type="button"
          onClick={cargar}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg border text-gray-700 hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}

      {pendientes > 0 && (
        <>
          <p className="text-sm text-gray-500 mt-3">
            Nada de esto se procesó ni se envió. Revisa el chat o el POS y, si hace falta, corrige a mano.
            Descartar solo lo quita de esta lista.
          </p>
          <ul className="mt-3 divide-y">
            {entradas.map((entrada) => (
              <li key={entrada.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-gray-800">
                    Mensaje recibido sin procesar · {hora(entrada.recibidaAt)}
                  </p>
                  <p className="text-gray-600">Motivo: {entrada.error ?? "en revisión"}</p>
                  <p className="text-gray-500 break-words">{resumen(entrada.texto)}</p>
                </div>
                {boton("entrada", entrada.id)}
              </li>
            ))}
            {salidas.map((salida) => (
              <li key={salida.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-gray-800">
                    {TIPOS[salida.tipo] ?? salida.tipo}
                    {salida.orden?.numeroDiario != null && ` · Orden #${salida.orden.numeroDiario}`} ·{" "}
                    {hora(salida.createdAt)}
                  </p>
                  <p className="text-gray-600">Motivo: {salida.ultimoError ?? "en revisión"}</p>
                  <p className="text-gray-500 break-words">{resumen(salida.texto)}</p>
                </div>
                {boton("salida", salida.id)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
