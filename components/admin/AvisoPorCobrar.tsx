"use client";

import { useState } from "react";

interface OrdenPorCobrar {
  id: string;
  numeroDiario: number | null;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  mesero: string;
  total: string;
  montoPagado: string;
  estado: string;
  createdAt: string;
}

const lugar = (o: OrdenPorCobrar) =>
  o.tipoOrden === "local"
    ? `Mesa ${o.numeroMesa ?? "-"}`
    : `${o.tipoOrden === "domicilio" ? "Domicilio" : "Para llevar"}${o.nombreCliente ? ` · ${o.nombreCliente}` : ""}`;

const minutosDesde = (fecha: string) => Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);

/** El admin decide a mano: evita avisar de órdenes que aún se preparan o se están sirviendo. */
export default function AvisoPorCobrar() {
  const [minutos, setMinutos] = useState("60");
  const [ordenes, setOrdenes] = useState<OrdenPorCobrar[] | null>(null);
  const [buscadoCon, setBuscadoCon] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const buscar = async () => {
    setCargando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/admin/ordenes/por-cobrar?minutos=${encodeURIComponent(minutos)}`);
      const data = await res.json();
      if (!res.ok) {
        setMensaje({ texto: data.error || "No se pudieron buscar las órdenes", error: true });
        return;
      }
      setOrdenes(data);
      setBuscadoCon(minutos);
    } catch {
      setMensaje({ texto: "No se pudieron buscar las órdenes", error: true });
    } finally {
      setCargando(false);
    }
  };

  const enviar = async () => {
    setCargando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/ordenes/por-cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutos: Number(buscadoCon) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensaje({ texto: data.error || "No se pudo enviar el aviso", error: true });
        return;
      }
      setOrdenes(data.ordenes);
      setMensaje(
        data.enviadas > 0
          ? { texto: `Aviso con ${data.enviadas} órdenes en cola para el grupo de pedidos.`, error: false }
          : { texto: "Ya no quedan órdenes por cobrar; no se envió nada.", error: false },
      );
    } catch {
      setMensaje({ texto: "No se pudo enviar el aviso", error: true });
    } finally {
      setCargando(false);
    }
  };

  // Cambiar los minutos obliga a revisar la lista de nuevo antes de enviarla.
  const listaVigente = ordenes !== null && buscadoCon === minutos;

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6" aria-labelledby="aviso-por-cobrar">
      <h2 id="aviso-por-cobrar" className="text-xl font-bold text-gray-900">Órdenes sin cobrar</h2>
      <p className="text-sm text-gray-500 mt-1">
        Busca las órdenes de hoy sin cobrar con más de cierto tiempo y pide al grupo de pedidos que las cierren.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-700">
          Más de (minutos)
          <input
            type="number"
            min={0}
            max={1440}
            step={1}
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            className="mt-1 block w-32 border rounded-lg px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={buscar}
          disabled={cargando || minutos === ""}
          className="text-sm font-semibold px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Buscar
        </button>
        <button
          type="button"
          onClick={enviar}
          disabled={cargando || !listaVigente || ordenes.length === 0}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          {cargando ? "..." : "Enviar al grupo"}
        </button>
      </div>
      {mensaje && (
        <p role={mensaje.error ? "alert" : "status"} className={`text-sm mt-3 ${mensaje.error ? "text-red-700" : "text-green-700"}`}>
          {mensaje.texto}
        </p>
      )}
      {listaVigente &&
        (ordenes.length === 0 ? (
          <p className="text-sm text-gray-600 mt-3">No hay órdenes sin cobrar con más de {buscadoCon} min.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {ordenes.map((o) => (
              <li key={o.id} className="py-2 flex flex-wrap justify-between gap-2">
                <span className="font-semibold text-gray-800">
                  #{o.numeroDiario ?? "?"} · {lugar(o)} · {o.mesero}
                </span>
                <span className="text-gray-600">
                  ${(Number(o.total) - Number(o.montoPagado)).toFixed(2)} · {o.estado} · hace {minutosDesde(o.createdAt)} min
                </span>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
