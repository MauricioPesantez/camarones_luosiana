"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SesionCaja } from "@/types/caja";

function formatearFechaHora(fecha: string): string {
  return new Date(fecha).toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function InicioCaja({ requerida = false }: { requerida?: boolean }) {
  const [caja, setCaja] = useState<SesionCaja | null>(null);
  const [montoInicial, setMontoInicial] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [montoContado, setMontoContado] = useState("");
  const [cortando, setCortando] = useState(false);
  const [errorCorte, setErrorCorte] = useState("");
  const [corteHecho, setCorteHecho] = useState<{
    montoEsperado: number;
    montoContado: number;
    diferencia: number;
    ordenesConSaldoPendiente: number;
  } | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch("/api/caja", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar la caja");
        if (vigente) setCaja(data.caja ?? null);
      })
      .catch((err) => {
        if (vigente) {
          setError(err instanceof Error ? err.message : "Error al cargar la caja");
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const iniciarCaja = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError("");
    setConfirmacion("");
    setGuardando(true);
    try {
      const res = await fetch("/api/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montoInicial: Number(montoInicial) }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.caja) setCaja(data.caja);
        throw new Error(data.error || "Error al iniciar la caja");
      }
      setCaja(data.caja);
      setConfirmacion(
        `Caja iniciada con $${Number(data.caja.montoInicial).toFixed(2)}.`,
      );
      setMontoInicial("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar la caja");
    } finally {
      setGuardando(false);
    }
  };

  const hacerCorte = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!caja) return;
    setErrorCorte("");
    setCorteHecho(null);
    setCortando(true);
    try {
      const res = await fetch("/api/caja/corte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero: caja.cortes.length + 1,
          montoContado: Number(montoContado),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al hacer el corte");
      setCorteHecho({
        ...data.corte,
        ordenesConSaldoPendiente: data.ordenesConSaldoPendiente,
      });
      setMontoContado("");
    } catch (err) {
      setErrorCorte(err instanceof Error ? err.message : "Error al hacer el corte");
    } finally {
      setCortando(false);
      // Recarga siempre: tras un choque con otro mesero el número de turno cambia.
      fetch("/api/caja", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setCaja(data.caja ?? null))
        .catch(() => {});
    }
  };

  const ultimoCorte = caja?.cortes.at(-1);

  if (cargando) {
    return <div className="p-8 text-center text-gray-500">Cargando caja...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold text-gray-900">💵 Inicio de caja</h2>
          {requerida && !caja && !error && (
            <p role="status" className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              Antes de crear tu primera orden del día, inicia la caja registrando
              el fondo inicial. Solo un mesero necesita hacerlo para todo el equipo.
            </p>
          )}
          <p className="mt-2 text-sm text-gray-600">
            Registra efectivo físico existente antes del primer cobro. Se suma a
            ventas en efectivo y se resta retiros para calcular cierre.
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {confirmacion && (
            <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {confirmacion}
            </p>
          )}

          {caja ? (
            <div
              className={`mt-6 rounded-xl border p-5 ${
                caja.estado === "abierta"
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-300 bg-slate-100"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                    Caja {caja.estado}
                  </p>
                  <p className="mt-1 text-4xl font-black text-gray-900">
                    ${caja.montoInicial.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">Fondo inicial</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${
                    caja.estado === "abierta"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 text-white"
                  }`}
                >
                  {caja.estado === "abierta" ? "Lista para operar" : "Cerrada"}
                </span>
              </div>
              <p className="mt-4 text-sm text-gray-700">
                Iniciada por <strong>{caja.abiertaPorNombre}</strong> ·{" "}
                {formatearFechaHora(caja.abiertaAt)}
              </p>
              {caja.estado === "cerrada" && (
                <p className="mt-2 text-sm text-gray-600">
                  La caja de hoy ya fue cerrada por el administrador. Podrás crear
                  nuevas órdenes en la siguiente jornada.
                </p>
              )}
              {caja.estado === "abierta" && (
                <Link
                  href="/mesero?vista=crear"
                  className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-5 font-bold text-white hover:bg-blue-700"
                >
                  Continuar a crear orden
                </Link>
              )}
              {caja.estado === "abierta" && (
                <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
                  <h3 className="text-xl font-bold text-gray-900">🔁 Corte de turno</h3>
                  <p className="mt-1 text-sm text-gray-700">
                    Turno {caja.cortes.length + 1} · recibió{" "}
                    <strong>
                      ${(ultimoCorte?.montoContado ?? caja.montoInicial).toFixed(2)}
                    </strong>{" "}
                    {ultimoCorte
                      ? `de ${ultimoCorte.usuarioNombre} · ${formatearFechaHora(ultimoCorte.createdAt)}`
                      : "de fondo inicial"}
                  </p>
                  <p className="mt-2 text-sm text-gray-700">
                    Al terminar tu turno, cuenta todo el efectivo de la caja y
                    escríbelo. El dinero se queda en la caja para el siguiente turno.
                  </p>

                  {corteHecho && (
                    <div
                      role="status"
                      className={`mt-4 rounded-lg border p-4 text-sm ${
                        corteHecho.diferencia === 0
                          ? "border-green-300 bg-green-50 text-green-800"
                          : "border-red-300 bg-red-50 text-red-800"
                      }`}
                    >
                      <p className="text-base font-bold">
                        {corteHecho.diferencia === 0
                          ? "✅ Caja cuadrada"
                          : corteHecho.diferencia > 0
                            ? `Sobran $${corteHecho.diferencia.toFixed(2)}`
                            : `Faltan $${Math.abs(corteHecho.diferencia).toFixed(2)}`}
                      </p>
                      <p className="mt-1">
                        Debía haber ${corteHecho.montoEsperado.toFixed(2)} · contaste $
                        {corteHecho.montoContado.toFixed(2)}
                      </p>
                      {corteHecho.ordenesConSaldoPendiente > 0 && (
                        <p className="mt-2">
                          Hay {corteHecho.ordenesConSaldoPendiente} orden(es) con saldo
                          pendiente: su efectivo puede aparecer en el siguiente turno.
                        </p>
                      )}
                    </div>
                  )}
                  {errorCorte && (
                    <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {errorCorte}
                    </p>
                  )}

                  <form onSubmit={hacerCorte} className="mt-4 space-y-3">
                    <label className="block text-sm font-semibold text-gray-800">
                      Efectivo contado en caja
                      <div className="mt-2 flex rounded-lg border border-gray-300 bg-white focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100">
                        <span className="px-4 py-3 text-xl font-bold text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          max="9999.99"
                          step="0.01"
                          required
                          value={montoContado}
                          onChange={(e) => setMontoContado(e.target.value)}
                          className="min-w-0 flex-1 rounded-r-lg px-3 py-3 text-xl font-bold text-gray-900 outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </label>
                    <button
                      type="submit"
                      disabled={cortando || montoContado === ""}
                      className="min-h-12 w-full rounded-lg bg-amber-600 px-5 font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                    >
                      {cortando ? "Guardando..." : "Hacer corte de turno"}
                    </button>
                  </form>

                  {caja.cortes.length > 0 && (
                    <ul className="mt-5 divide-y divide-amber-200 text-sm text-gray-700">
                      {caja.cortes.map((corte) => (
                        <li key={corte.id} className="flex justify-between gap-3 py-2">
                          <span>
                            Turno {corte.numero} · {corte.usuarioNombre} ·{" "}
                            {formatearFechaHora(corte.createdAt)}
                          </span>
                          <span className="font-semibold">
                            ${corte.montoContado.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={iniciarCaja} className="mt-6 space-y-5">
              <label className="block text-sm font-semibold text-gray-800">
                Fondo inicial en efectivo
                <div className="mt-2 flex rounded-lg border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  <span className="px-4 py-3 text-xl font-bold text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    max="9999.99"
                    step="0.01"
                    required
                    value={montoInicial}
                    onChange={(e) => setMontoInicial(e.target.value)}
                    className="min-w-0 flex-1 rounded-r-lg px-3 py-3 text-xl font-bold text-gray-900 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </label>
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Confirma contando dinero físico. Después de guardar no puede
                editarse; administrador verá autor, hora y valor.
              </p>
              <button
                type="submit"
                disabled={guardando || montoInicial === ""}
                className="min-h-12 w-full rounded-lg bg-blue-600 px-5 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {guardando ? "Iniciando..." : "Iniciar caja"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
