"use client";

import { useEffect, useState } from "react";
import type { EtiquetaOrdenMesero, OrdenesDelDiaMesero } from "@/lib/ordenes-mesero";
import { obtenerEtiquetaCategoriaRetiro } from "@/types/retiro";

const ETIQUETAS: Record<EtiquetaOrdenMesero, { texto: string; color: string }> = {
  efectivo: { texto: "Efectivo", color: "bg-emerald-100 text-emerald-900" },
  transferencia: { texto: "Transferencia", color: "bg-blue-100 text-blue-900" },
  mixto: { texto: "Mixto", color: "bg-slate-200 text-slate-900" },
  sin_cobrar: { texto: "Sin cobrar", color: "bg-amber-100 text-amber-900" },
  anulada: { texto: "Anulada", color: "bg-red-100 text-red-900" },
  rechazada: { texto: "Rechazada", color: "bg-red-100 text-red-900" },
  sin_aprobar: { texto: "Sin aprobar", color: "bg-amber-100 text-amber-900" },
  cuenta_empleado: { texto: "Cuenta de empleado", color: "bg-slate-200 text-slate-900" },
};

const hora = (fecha: string) =>
  new Date(fecha).toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  });

const dolares = (monto: number) =>
  `${monto < 0 ? "− " : ""}$${Math.abs(monto).toFixed(2)}`;

function Fila({
  texto,
  monto,
  className = "",
}: {
  texto: string;
  monto: number | null;
  className?: string;
}) {
  return (
    <div className={`flex justify-between gap-3 ${className}`}>
      <span>{texto}</span>
      {monto !== null && (
        <span className="shrink-0 tabular-nums">{dolares(monto)}</span>
      )}
    </div>
  );
}

/** Solo lectura: sirve para hallar el error, no para volver a contar. */
export default function OrdenesDelDia() {
  const [datos, setDatos] = useState<OrdenesDelDiaMesero | null>(null);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    fetch("/api/caja/ordenes", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar las órdenes");
        if (!vigente) return;
        setDatos(data);
        setError("");
      })
      .catch((err) => {
        if (!vigente) return;
        // Sin permiso o con la caja cerrada no deben quedar a la vista.
        setDatos(null);
        setError(err instanceof Error ? err.message : "Error al cargar las órdenes");
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  return (
    <section
      aria-labelledby="ordenes-del-dia"
      className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm text-gray-900"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 id="ordenes-del-dia" className="text-lg font-bold">
            Órdenes de hoy
          </h4>
          <p className="text-gray-600">
            Solo lectura{datos && ` · ${datos.ordenes.length} órdenes`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIntento((valor) => valor + 1)}
          className="min-h-11 rounded-lg border border-gray-400 px-4 font-semibold text-gray-800 hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {!datos && !error && <p className="mt-3 text-gray-600">Cargando órdenes...</p>}

      {datos && (
        <>
          <ul className="mt-3 divide-y divide-slate-200">
            {datos.ordenes.map((orden) => {
              const tachada = orden.etiqueta === "anulada" || orden.etiqueta === "rechazada";
              return (
                <li key={orden.id} className="space-y-1 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-bold ${tachada ? "line-through" : ""}`}>
                      {orden.numero} · {orden.titulo}
                    </span>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${ETIQUETAS[orden.etiqueta].color}`}
                    >
                      {ETIQUETAS[orden.etiqueta].texto}
                    </span>
                  </div>
                  <p className="text-gray-600">
                    {hora(orden.createdAt)} · {orden.quien}
                  </p>
                  {orden.items.map((item, i) => (
                    <Fila
                      key={i}
                      texto={`${item.cantidad} × ${item.nombre}${item.esCortesia ? " · cortesía" : ""}`}
                      monto={item.subtotal}
                      className={tachada ? "text-gray-600 line-through" : ""}
                    />
                  ))}
                  {orden.extras.map((extra) => (
                    <Fila
                      key={extra.concepto}
                      texto={extra.concepto}
                      monto={extra.monto}
                      className="text-gray-600"
                    />
                  ))}
                  {orden.lineas.length > 0 && (
                    <div className="border-t border-dashed border-slate-300 pt-1 font-bold">
                      {orden.lineas.map((linea) => (
                        <Fila key={linea.concepto} texto={linea.concepto} monto={linea.monto} />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-1 border-t border-slate-200 pt-3">
            <h5 className="font-bold">Salidas de dinero</h5>
            {datos.salidas.length === 0 ? (
              <p className="text-gray-600">No hay salidas registradas hoy.</p>
            ) : (
              datos.salidas.map((salida) => (
                <Fila
                  key={salida.id}
                  texto={`${hora(salida.createdAt)} · ${obtenerEtiquetaCategoriaRetiro(salida.categoria)} · ${salida.usuarioNombre}`}
                  monto={-salida.monto}
                />
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
