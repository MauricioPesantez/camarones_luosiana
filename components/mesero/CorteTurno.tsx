"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MONTO_MAXIMO_CAJA,
  cortesVigentes,
  ultimoCorteVigente,
  type CajaMesero,
  type SalidaDeTurno,
} from "@/types/caja";
import { obtenerEtiquetaCategoriaRetiro } from "@/types/retiro";

interface Props {
  caja: CajaMesero;
  usuarioId: string;
  onCambio: () => Promise<void>;
}

const hora = (fecha: string) =>
  new Date(fecha).toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  });

const dolares = (monto: number) => `$${monto.toFixed(2)}`;

const botonPrincipal =
  "min-h-12 w-full rounded-lg bg-amber-700 px-5 font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-gray-400";
const botonSecundario =
  "min-h-12 w-full rounded-lg border border-gray-400 bg-white px-5 font-bold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

/** Conteo a ciegas: revisar salidas, contar, entregar. Nunca muestra si cuadra. */
export default function CorteTurno({ caja, usuarioId, onCambio }: Props) {
  const [paso, setPaso] = useState<"salidas" | "contar" | "confirmar">("salidas");
  const [salidas, setSalidas] = useState<SalidaDeTurno[] | null>(null);
  const [intento, setIntento] = useState(0);
  const [montoContado, setMontoContado] = useState("");
  const [entregando, setEntregando] = useState(false);
  const [error, setError] = useState("");

  const ultimo = ultimoCorteVigente(caja.cortes);
  const entregado = ultimo?.usuarioId === usuarioId ? ultimo : null;
  const ultimoDeTodos = caja.cortes.at(-1);
  const meAnularon =
    ultimoDeTodos?.usuarioId === usuarioId && ultimoDeTodos.anuladoAt !== null;

  useEffect(() => {
    if (entregado) return;
    let vigente = true;
    fetch("/api/caja/corte", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar las salidas");
        if (vigente) setSalidas(data.salidas);
      })
      .catch((err) => {
        if (vigente) {
          setError(err instanceof Error ? err.message : "Error al cargar las salidas");
        }
      });
    return () => {
      vigente = false;
    };
  }, [entregado, intento]);

  const entregar = async () => {
    setError("");
    setEntregando(true);
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
      if (res.ok || res.status === 409) {
        // Entregado, o el turno cambió: las salidas mostradas ya no son las suyas.
        setMontoContado("");
        setSalidas(null);
        setIntento((valor) => valor + 1);
        setPaso("salidas");
      }
      if (!res.ok) throw new Error(data.error || "Error al entregar el conteo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al entregar el conteo");
    } finally {
      // Recarga siempre: tras un choque con otro mesero el número de turno cambia.
      await onCambio();
      setEntregando(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h3 className="text-xl font-bold text-gray-900">🔁 Corte de turno</h3>

      {entregado ? (
        <div
          role="status"
          className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-gray-800"
        >
          <p className="text-base font-bold">
            ✅ Conteo entregado: {dolares(entregado.montoContado)} ·{" "}
            {hora(entregado.createdAt)}
          </p>
          <p className="mt-1 text-sm">
            El administrador lo revisará. Si escribiste mal el monto, pídele que
            anule el conteo.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-700">
            Turno {cortesVigentes(caja.cortes).length + 1} ·
            recibió{" "}
            <strong>{dolares(ultimo?.montoContado ?? caja.montoInicial)}</strong>{" "}
            {ultimo
              ? `de ${ultimo.usuarioNombre} · ${hora(ultimo.createdAt)}`
              : "de fondo inicial"}
          </p>
          {meAnularon && (
            <p role="status" className="mt-3 rounded-lg border border-amber-400 bg-white p-3 text-sm font-semibold text-amber-900">
              El administrador anuló tu conteo. Revisa las salidas y vuelve a contar.
            </p>
          )}

          {paso === "salidas" && (
            <section aria-labelledby="paso-salidas" className="mt-4 space-y-3">
              <h4 id="paso-salidas" className="font-bold text-gray-900">
                1. Antes de contar, revisa las salidas de este turno
              </h4>
              {salidas === null ? (
                !error && <p className="text-sm text-gray-600">Cargando salidas...</p>
              ) : salidas.length === 0 ? (
                <p className="rounded-lg bg-white p-3 text-sm text-gray-700">
                  No hay salidas registradas en este turno.
                </p>
              ) : (
                <ul className="divide-y divide-amber-200 rounded-lg bg-white px-3 text-sm text-gray-800">
                  {salidas.map((salida) => (
                    <li key={salida.id} className="flex justify-between gap-3 py-2">
                      <span>
                        {hora(salida.createdAt)} ·{" "}
                        {obtenerEtiquetaCategoriaRetiro(salida.categoria)} ·{" "}
                        {salida.usuarioNombre}
                      </span>
                      <span className="font-semibold">{dolares(salida.monto)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-gray-700">
                ¿Salió dinero que no está aquí, como un adelanto o una compra?
                Regístralo antes de contar.
              </p>
              <Link
                href="/mesero?vista=retiro"
                className={`${botonSecundario} inline-flex items-center justify-center text-center`}
              >
                Registrar una salida
              </Link>
              {salidas !== null && (
                <button
                  type="button"
                  className={botonPrincipal}
                  onClick={() => {
                    setError("");
                    setPaso("contar");
                  }}
                >
                  Están todas, continuar
                </button>
              )}
              {salidas === null && error && (
                <button
                  type="button"
                  className={botonPrincipal}
                  onClick={() => {
                    setError("");
                    setIntento((valor) => valor + 1);
                  }}
                >
                  Reintentar
                </button>
              )}
            </section>
          )}

          {paso === "contar" && (
            <form
              className="mt-4 space-y-3"
              onSubmit={(evento) => {
                evento.preventDefault();
                setError("");
                setPaso("confirmar");
              }}
            >
              <label className="block text-sm font-semibold text-gray-800">
                2. Cuenta todo el efectivo de la caja
                <div className="mt-2 flex rounded-lg border border-gray-300 bg-white focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100">
                  <span className="px-4 py-3 text-xl font-bold text-gray-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={MONTO_MAXIMO_CAJA}
                    step="0.01"
                    required
                    value={montoContado}
                    onChange={(e) => setMontoContado(e.target.value)}
                    className="min-w-0 flex-1 rounded-r-lg px-3 py-3 text-xl font-bold text-gray-900 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </label>
              <p className="text-sm text-gray-700">
                Cuenten juntos quien sale y quien entra. El dinero se queda en la
                caja para el siguiente turno.
              </p>
              <button type="submit" className={botonPrincipal} disabled={montoContado === ""}>
                Revisar
              </button>
              <button
                type="button"
                className={botonSecundario}
                onClick={() => {
                  // Al volver se releen: pudo registrarse una salida mientras tanto.
                  setSalidas(null);
                  setIntento((valor) => valor + 1);
                  setPaso("salidas");
                }}
              >
                Volver a las salidas
              </button>
            </form>
          )}

          {paso === "confirmar" && (
            <section aria-labelledby="paso-confirmar" className="mt-4 space-y-3">
              <h4 id="paso-confirmar" className="font-bold text-gray-900">
                3. Confirma tu conteo
              </h4>
              <p className="rounded-lg bg-white p-4 text-gray-800">
                Vas a entregar{" "}
                <strong className="text-2xl">{dolares(Number(montoContado))}</strong>
                <span className="mt-1 block text-sm">
                  Después no podrás cambiarlo; solo el administrador puede anularlo.
                </span>
              </p>
              <button type="button" className={botonPrincipal} disabled={entregando} onClick={entregar}>
                {entregando ? "Entregando..." : "Entregar conteo"}
              </button>
              <button
                type="button"
                className={botonSecundario}
                disabled={entregando}
                onClick={() => setPaso("contar")}
              >
                Corregir monto
              </button>
            </section>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {caja.cortes.length > 0 && (
        <ul className="mt-5 divide-y divide-amber-200 text-sm text-gray-700">
          {caja.cortes.map((corte) => (
            <li key={corte.id} className="flex justify-between gap-3 py-2">
              <span>
                {corte.usuarioNombre} · {hora(corte.createdAt)}
                {corte.anuladoAt && " · Anulado"}
              </span>
              <span className={corte.anuladoAt ? "line-through" : "font-semibold"}>
                {dolares(corte.montoContado)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
