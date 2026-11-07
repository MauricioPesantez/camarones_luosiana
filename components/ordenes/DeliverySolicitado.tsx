"use client";

import { useState } from "react";

interface DeliverySolicitadoProps {
  ordenId: string;
  deliverySolicitadoAt: string | null;
  editable: boolean;
  onRegistrado?: (deliverySolicitadoAt: string) => void;
}

/** Registra que alguien ya pidió el motorizado fuera del sistema; el POS no lo contrata. */
export default function DeliverySolicitado({
  ordenId,
  deliverySolicitadoAt,
  editable,
  onRegistrado,
}: DeliverySolicitadoProps) {
  const [registrado, setRegistrado] = useState(deliverySolicitadoAt);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  if (registrado) {
    return (
      <p className="text-sm text-gray-700 mt-1">
        🛵 Delivery pedido:{" "}
        {new Date(registrado).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
      </p>
    );
  }
  if (!editable) return null;

  const registrar = async () => {
    setGuardando(true);
    setError("");
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "solicitar" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo registrar el delivery");
        return;
      }
      setRegistrado(data.deliverySolicitadoAt);
      onRegistrado?.(data.deliverySolicitadoAt);
    } catch {
      setError("No se pudo registrar el delivery");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={registrar}
        disabled={guardando}
        className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "🛵 Ya pedí el delivery"}
      </button>
      <p className="text-xs text-gray-500 mt-1">Registra que lo pediste y cancela el aviso de WhatsApp.</p>
      {error && (
        <p role="alert" className="text-sm text-red-700 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
