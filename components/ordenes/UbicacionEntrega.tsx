"use client";

import { FormEvent, useState } from "react";
import { MAX_REFERENCIA_ENTREGA, normalizarUbicacionUrl } from "@/lib/delivery-location";

interface Ubicacion {
  ubicacionUrl: string | null;
  referenciaEntrega: string | null;
}

interface UbicacionEntregaProps extends Ubicacion {
  ordenId: string;
  editable: boolean;
  onActualizada?: (ubicacion: Ubicacion) => void;
}

export default function UbicacionEntrega({
  ordenId,
  ubicacionUrl,
  referenciaEntrega,
  editable,
  onActualizada,
}: UbicacionEntregaProps) {
  const [guardada, setGuardada] = useState<Ubicacion>({ ubicacionUrl, referenciaEntrega });
  const [editando, setEditando] = useState(false);
  const [enlace, setEnlace] = useState(ubicacionUrl ?? "");
  const [referencia, setReferencia] = useState(referenciaEntrega ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const enlaceSeguro = guardada.ubicacionUrl
    ? normalizarUbicacionUrl(guardada.ubicacionUrl)
    : null;

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/ubicacion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ubicacionUrl: enlace, referenciaEntrega: referencia }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar la ubicación");
        return;
      }
      setGuardada(data);
      setEditando(false);
      onActualizada?.(data);
    } catch {
      setError("No se pudo guardar la ubicación");
    } finally {
      setGuardando(false);
    }
  };

  if (editando) {
    return (
      <form onSubmit={guardar} className="mt-1 space-y-2">
        <div>
          <label htmlFor={`ubicacion-${ordenId}`} className="block text-xs font-medium text-gray-700">
            Enlace de Google Maps
          </label>
          <input
            id={`ubicacion-${ordenId}`}
            type="url"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm text-black"
            placeholder="https://maps.app.goo.gl/..."
          />
        </div>
        <div>
          <label htmlFor={`referencia-${ordenId}`} className="block text-xs font-medium text-gray-700">
            Referencia de entrega
          </label>
          <input
            id={`referencia-${ordenId}`}
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            maxLength={MAX_REFERENCIA_ENTREGA}
            className="w-full border rounded-lg px-3 py-2 text-sm text-black"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={guardando}
            className="bg-purple-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            disabled={guardando}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg border text-gray-700"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-1 text-sm">
      {enlaceSeguro ? (
        <a
          href={enlaceSeguro}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-purple-700 underline"
        >
          📍 Ver ubicación
        </a>
      ) : (
        <p className="font-medium text-amber-700">📍 Ubicación pendiente</p>
      )}
      {guardada.referenciaEntrega && (
        <p className="text-gray-700 break-words">{guardada.referenciaEntrega}</p>
      )}
      {editable && (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="block text-xs font-semibold text-gray-600 underline mt-1"
        >
          {enlaceSeguro ? "Editar ubicación" : "Completar ubicación"}
        </button>
      )}
    </div>
  );
}
