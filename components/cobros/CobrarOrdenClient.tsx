"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { AuthenticatedUser } from "@/lib/session";
import {
  obtenerEtiquetaNivelPicante,
  type MetodoPago,
  type NivelPicante,
} from "@/types/orden";

interface CobroOrder {
  id: string;
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  mesero: string;
  estado: string;
  printRevision: number;
  recargo: number;
  costoEnvio: number;
  total: number;
  metodoPagoPrevisto: string | null;
  createdAt: string;
  observaciones: string | null;
  items: Array<{
    id: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    observaciones: string | null;
    nivelPicante: string | null;
    esCortesia: boolean;
    producto: { nombre: string };
  }>;
}

function orderTitle(order: CobroOrder): string {
  if (!order.tipoOrden || order.tipoOrden === "local") {
    return `Mesa ${order.numeroMesa ?? "-"}`;
  }
  return order.nombreCliente || order.telefonoCliente || "Cliente";
}

export default function CobrarOrdenClient({
  token,
  orden,
  usuario,
  successUrl,
}: {
  token: string;
  orden: CobroOrder;
  usuario: AuthenticatedUser;
  successUrl: string;
}) {
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [confirmCash, setConfirmCash] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const subtotalProductos = orden.items.reduce(
    (total, item) => total + item.subtotal,
    0,
  );
  const efectivoLocal =
    orden.tipoOrden === "domicilio"
      ? Math.max(0, orden.total - orden.costoEnvio)
      : orden.total;

  const cobrar = async (metodoPago: MetodoPago) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/cobros/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metodoPago,
          expectedRevision: orden.printRevision,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo registrar el cobro");
      router.replace(successUrl);
      router.refresh();
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "No se pudo registrar el cobro",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg">
          <p className="text-sm text-slate-300">Cobro autenticado</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                Orden #{orden.numeroDiario ?? orden.id.slice(-6)}
              </h1>
              <p className="text-slate-300">{orderTitle(orden)}</p>
            </div>
            <div className="text-right text-sm">
              <p>Cobra: <strong>{usuario.nombre}</strong></p>
              <p className="text-slate-400">Creada por {orden.mesero}</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Tipo</span><p className="font-semibold">{orden.tipoOrden.replaceAll("_", " ").toUpperCase()}</p></div>
            <div><span className="text-slate-500">Fecha</span><p className="font-semibold">{new Date(orden.createdAt).toLocaleString("es-EC")}</p></div>
            {orden.telefonoCliente && <div><span className="text-slate-500">Teléfono</span><p className="font-semibold">{orden.telefonoCliente}</p></div>}
            <div><span className="text-slate-500">Estado</span><p className="font-semibold">{orden.estado.replaceAll("_", " ")}</p></div>
          </div>

          <h2 className="mb-2 font-bold">Detalle de la orden</h2>
          <div className="divide-y">
            {orden.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">
                    {item.cantidad}x {item.producto.nombre}
                    {item.esCortesia && <span className="ml-2 text-amber-600">CORTESÍA</span>}
                  </p>
                  {item.nivelPicante && (
                    <p className="text-sm text-red-700">
                      Salsa: {obtenerEtiquetaNivelPicante(item.nivelPicante as NivelPicante)}
                    </p>
                  )}
                  {item.observaciones && <p className="text-sm text-slate-500">{item.observaciones}</p>}
                </div>
                <p className="font-semibold">${item.subtotal.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><span>Productos</span><span>${subtotalProductos.toFixed(2)}</span></div>
            {orden.recargo > 0 && <div className="flex justify-between"><span>Recipientes</span><span>${orden.recargo.toFixed(2)}</span></div>}
            {orden.costoEnvio > 0 && <div className="flex justify-between"><span>Envío del motorizado</span><span>${orden.costoEnvio.toFixed(2)}</span></div>}
            <div className="flex justify-between border-t pt-2 text-2xl font-bold"><span>Total cliente</span><span className="text-emerald-700">${orden.total.toFixed(2)}</span></div>
          </div>

          {orden.tipoOrden === "domicilio" && (
            <div className="mt-4 rounded-xl bg-purple-50 p-4 text-sm text-purple-900">
              <p><strong>Si paga en efectivo:</strong> el local recibe ${efectivoLocal.toFixed(2)}; el motorizado conserva ${orden.costoEnvio.toFixed(2)}.</p>
              <p className="mt-1"><strong>Si paga por transferencia:</strong> el local recibe ${orden.total.toFixed(2)} y entrega ${orden.costoEnvio.toFixed(2)} al motorizado.</p>
            </div>
          )}
        </section>

        {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => { setShowTransfer(false); setConfirmCash(true); }}
            disabled={loading}
            className="rounded-2xl bg-emerald-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-emerald-700 disabled:bg-slate-400"
          >
            💵 Efectivo
          </button>
          <button
            onClick={() => { setConfirmCash(false); setShowTransfer(true); }}
            disabled={loading}
            className="rounded-2xl bg-blue-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-blue-700 disabled:bg-slate-400"
          >
            🏦 Transferencia
          </button>
        </section>

        {showTransfer && (
          <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow">
            <h2 className="text-lg font-bold">Comprobante de transferencia</h2>
            <p className="mt-1 text-sm text-slate-600">Toma una foto clara del comprobante mostrado por el cliente.</p>
            <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-blue-400 p-5 text-center font-bold text-blue-700 hover:bg-blue-50">
              📷 Tomar foto
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              />
            </label>
            {photo && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Foto seleccionada: <strong>{photo.name}</strong>. La carga persistente a S3 queda preparada para la siguiente fase; esta versión todavía no envía el archivo.
              </div>
            )}
            <button
              onClick={() => void cobrar("transferencia")}
              disabled={loading || !photo}
              className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              {loading ? "Registrando…" : "Confirmar transferencia"}
            </button>
          </section>
        )}
      </div>

      {confirmCash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Confirmar cobro</h2>
            <p className="mt-2 text-slate-600">¿Confirmas que recibiste <strong>${orden.total.toFixed(2)}</strong> en efectivo?</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => void cobrar("efectivo")} disabled={loading} className="flex-1 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:bg-slate-400">{loading ? "Procesando…" : "Aceptar"}</button>
              <button onClick={() => setConfirmCash(false)} disabled={loading} className="flex-1 rounded-xl bg-slate-200 py-3 font-bold text-slate-800">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
