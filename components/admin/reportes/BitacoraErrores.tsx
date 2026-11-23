"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bitacora } from "@/lib/bitacora-revision";
import type { TipoError } from "@/types/revision";

interface Props {
  fechaInicio: string;
  fechaFin: string;
  /** Sube cada vez que el admin pulsa "Actualizar". */
  recarga: number;
}

const ETIQUETA: Record<TipoError, string> = {
  falto: "Faltó producto",
  no_iba: "No iba",
  cantidad: "Otra cantidad",
  metodo: "Método de cobro",
  total: "Total",
};
const TIPOS = Object.keys(ETIQUETA) as TipoError[];

const errores = (n: number) => `${n} ${n === 1 ? "error" : "errores"}`;
const ordenes = (n: number) => `${n} ${n === 1 ? "orden revisada" : "órdenes revisadas"}`;
const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

export default function BitacoraErrores({ fechaInicio, fechaFin, recarga }: Props) {
  const [datos, setDatos] = useState<Bitacora | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  // Las fechas se leen al pedir, no al teclear: solo "Actualizar" recarga.
  const fechas = useRef({ fechaInicio, fechaFin });
  useEffect(() => {
    fechas.current = { fechaInicio, fechaFin };
  });
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const mio = ++pedido.current;
    setCargando(true);
    setError(null);
    const qs = new URLSearchParams(fechas.current);
    // Sin red o con un cuerpo que no es JSON el error del navegador sale en inglés.
    const res = await fetch(`/api/admin/reportes/revision?${qs}`).catch(() => null);
    const cuerpo = await res?.json().catch(() => null);
    if (mio !== pedido.current) return;
    const bien = res?.ok && cuerpo;
    setDatos(bien ? (cuerpo as Bitacora) : null);
    setError(bien ? null : cuerpo?.error || "No se pudo cargar la bitácora.");
    setCargando(false);
  }, []);

  useEffect(() => {
    // El setState ocurre dentro de la función async, no en el cuerpo del efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar, recarga]);

  if (cargando) {
    return <p role="status" className="py-12 text-center text-slate-600">Cargando bitácora...</p>;
  }
  if (error || !datos) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
        <p className="mb-3 text-red-800">{error}</p>
        <button
          type="button"
          onClick={cargar}
          className="min-h-11 rounded-xl bg-slate-900 px-5 font-semibold text-white hover:bg-slate-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const total = datos.errores.length;
  return (
    <div className="space-y-5 text-slate-900">
      <p className="text-lg font-bold">
        {ordenes(datos.ordenesRevisadas)} · {errores(total)}
      </p>

      {total === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
          No hay errores anotados en estas fechas.
        </p>
      ) : (
        <>
          <section aria-labelledby="bit-tipos" className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 id="bit-tipos" className="mb-2 text-sm font-bold uppercase text-slate-700">Por tipo</h2>
            <ul className="flex flex-wrap gap-2">
              {TIPOS.filter((t) => datos.porTipo[t] > 0).map((t) => (
                <li key={t} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-800">
                  {ETIQUETA[t]} <strong>{datos.porTipo[t]}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="bit-personas" className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 id="bit-personas" className="mb-1 text-sm font-bold uppercase text-slate-700">Por persona</h2>
            <p className="mb-2 text-sm text-slate-700">Referencia según quién creó o cobró la orden.</p>
            <ul className="divide-y divide-slate-100">
              {datos.porPersona.map((p) => (
                <li key={p.nombre} className="py-2 text-sm">
                  <strong>{p.nombre}</strong> {errores(p.total)}:{" "}
                  {TIPOS.filter((t) => p.porTipo[t] > 0)
                    .map((t) => `${ETIQUETA[t].toLowerCase()} ${p.porTipo[t]}`)
                    .join(", ")}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="bit-lista" className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 id="bit-lista" className="mb-2 text-sm font-bold uppercase text-slate-700">Lista</h2>
            <ul className="divide-y divide-slate-100">
              {datos.errores.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 py-2 text-sm">
                  <span className="text-slate-700">{diaMes(e.fecha)}</span>
                  <span className="font-semibold">#{e.numeroDiario ?? e.ordenId.slice(-6)}</span>
                  <span className="min-w-0 break-words">{e.texto}</span>
                  <span className="text-slate-700">{e.persona}</span>
                  {e.cambio && <span className="text-amber-800">la orden cambió</span>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
