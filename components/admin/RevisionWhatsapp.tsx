"use client";

import { useCallback, useEffect, useState } from "react";
import FilaAtencion from "./FilaAtencion";

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

interface Props {
  /** Cambia cada vez que se actualiza la pantalla. */
  recarga: number;
  onPendiente: (hayAlgo: boolean) => void;
}

const TIPOS: Record<string, string> = {
  RESPUESTA_EMPLEADO: "Respuesta al empleado",
  PUBLICACION_GRUPO: "Publicación al grupo",
  ACTUALIZACION_GRUPO: "Cambio al grupo",
  RECORDATORIO_DELIVERY: "Aviso de delivery",
  RECORDATORIO_COBRO: "Aviso de órdenes sin cobrar",
  RESUMEN_CIERRE: "Resumen del cierre de caja",
};

const hora = (fecha: string) =>
  new Date(fecha).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });

const resumen = (texto: string | null) => (texto ?? "").split("\n").slice(0, 2).join(" · ");

function problemaDelAgente(revision: Revision): string | null {
  const { agente } = revision;
  if (!agente) return "El agente no está conectado: no entran ni salen mensajes.";
  if (!agente.activo) return `El agente no responde desde ${hora(agente.lastSeenAt)}.`;
  return agente.sesionLista ? null : "La sesión de WhatsApp está desconectada.";
}

/** Solo aparece si hay mensajes por revisar o el agente falla. */
export default function RevisionWhatsapp({ recarga, onPendiente }: Props) {
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
  }, [cargar, recarga]);

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

  const activa = revision?.habilitada ? revision : null;
  const entradas = activa?.entradas ?? [];
  const salidas = activa?.salidas ?? [];
  const pendientes = entradas.length + salidas.length;
  const problema = activa ? problemaDelAgente(activa) : null;
  const hayAlgo = error !== "" || pendientes > 0 || problema !== null;

  useEffect(() => onPendiente(hayAlgo), [hayAlgo, onPendiente]);

  if (!hayAlgo) return null;

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
    <FilaAtencion
      icono="💬"
      titulo={
        pendientes > 0
          ? `WhatsApp: ${pendientes} ${pendientes === 1 ? "mensaje" : "mensajes"} por revisar`
          : "WhatsApp con problemas"
      }
      detalle={error || (problema ?? "No se procesaron ni se enviaron.")}
      critico={problema !== null}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-gray-600">
          {pendientes > 0
            ? "Revisa el chat o el POS y, si hace falta, corrige a mano. Descartar solo lo quita de esta lista."
            : "Revisa el equipo donde corre WhatsApp y comprueba de nuevo."}
        </p>
        <button
          type="button"
          onClick={cargar}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg border text-gray-700 hover:bg-gray-50"
        >
          Comprobar de nuevo
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}

      {pendientes > 0 && (
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
      )}
    </FilaAtencion>
  );
}
