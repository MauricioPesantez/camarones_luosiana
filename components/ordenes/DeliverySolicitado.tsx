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
  const [motoEnCola, setMotoEnCola] = useState(false);

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

  const pedirMoto = async () => {
    setGuardando(true);
    setError("");
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "pedir" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo pedir la moto");
        return;
      }
      if (data.deliverySolicitadoAt) {
        setRegistrado(data.deliverySolicitadoAt);
        onRegistrado?.(data.deliverySolicitadoAt);
        return;
      }
      setMotoEnCola(true);
    } catch {
      setError("No se pudo pedir la moto");
    } finally {
      setGuardando(false);
    }
  };

  if (motoEnCola) {
    return <p className="text-sm text-purple-700 mt-1">🛵 Pidiendo moto al grupo Motos…</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={pedirMoto}
        disabled={guardando}
        className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
      >
        📣 Pedir moto
      </button>
      <button
        type="button"
        onClick={registrar}
        disabled={guardando}
        className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "🛵 Ya pedí la moto"}
      </button>
      <p className="w-full text-xs text-gray-500">&quot;Pedir moto&quot; avisa ya al grupo Motos por WhatsApp. &quot;Ya pedí&quot; solo registra que la pediste por fuera.</p>
      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
