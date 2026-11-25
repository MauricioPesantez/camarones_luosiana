"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import Link from "next/link";
import EditarOrdenModal from "./EditarOrdenModal";
import type { OrdenesPorCobrar } from "@/types/por-cobrar";

const boton =
  "inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

async function consultar(
  cursor: string | null,
  signal: AbortSignal,
): Promise<OrdenesPorCobrar> {
  const response = await fetch(
    `/api/ordenes/por-cobrar${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    { cache: "no-store", signal },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "No se pudieron cargar los pendientes");
  return data;
}

export default function PorCobrar({
  onTotal,
}: {
  onTotal: (total: number) => void;
}) {
  const [datos, setDatos] = useState<OrdenesPorCobrar | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<
    ComponentProps<typeof EditarOrdenModal>["orden"] | null
  >(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const peticion = useRef<AbortController | null>(null);
  const aceptar = useCallback(
    (data: OrdenesPorCobrar, cursor: string | null) => {
      setDatos((actual) => ({
        ...data,
        ordenes:
          cursor && actual
            ? [...actual.ordenes, ...data.ordenes]
            : data.ordenes,
      }));
      onTotal(data.totalPendientes);
      setError("");
    },
    [onTotal],
  );

  const cargar = useCallback(
    async (cursor: string | null = null) => {
      peticion.current?.abort();
      const controller = new AbortController();
      peticion.current = controller;
      setLoading(true);
      try {
        const data = await consultar(cursor, controller.signal);
        if (!controller.signal.aborted) aceptar(data, cursor);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los pendientes",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [aceptar],
  );

  useEffect(() => {
    const controller = new AbortController();
    peticion.current = controller;
    consultar(null, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) aceptar(data, null);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los pendientes",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    const actualizar = () => {
      if (document.visibilityState === "visible") void cargar();
    };
    window.addEventListener("focus", actualizar);
    return () => {
      peticion.current?.abort();
      window.removeEventListener("focus", actualizar);
    };
  }, [aceptar, cargar]);

  const editar = async (id: string) => {
    setCargandoDetalle(true);
    try {
      const response = await fetch(`/api/ordenes/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo cargar la orden");
      setEditando(data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo cargar la orden",
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 text-slate-900 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          {datos
            ? `${datos.totalPendientes} ${datos.totalPendientes === 1 ? "orden" : "órdenes"} con saldo pendiente`
            : "Consultando pendientes…"}
        </p>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={loading}
          className={`${boton} border border-slate-400 bg-white`}
        >
          Actualizar
        </button>
      </div>
      <p className="text-sm text-slate-600">
        Tus mesas, los pedidos para llevar y los domicilios en efectivo. Puedes
        cobrar desde aquí aunque no se haya impreso la comanda.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {error}
          {datos && " Se muestran los datos de la última consulta correcta."}
        </p>
      )}
      {loading && <p>Cargando…</p>}
      {datos && (
        <p className="text-xs text-slate-600">
          Última consulta:{" "}
          {new Date(datos.consultadoAt).toLocaleString("es-EC", {
            timeZone: "America/Guayaquil",
          })}
        </p>
      )}
      {datos?.totalPendientes === 0 && !error && (
        <p className="rounded-lg bg-white p-6">
          No hay órdenes pendientes de cobrar.
        </p>
      )}
      <ul role="list" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {datos?.ordenes.map((orden) => (
          <li
            key={orden.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-slate-600">
                {orden.numero} · {orden.tipoOrden.replaceAll("_", " ")}
              </p>
              <h2 className="text-xl font-bold">{orden.titulo}</h2>
            </div>
            <p className="text-sm">
              {orden.estado.replaceAll("_", " ")} · Creó {orden.creador}
            </p>
            <p className="text-xs text-slate-600">
              {new Date(orden.createdAt).toLocaleString("es-EC", {
                timeZone: "America/Guayaquil",
              })}
              {orden.telefonoCliente && ` · ${orden.telefonoCliente}`}
            </p>
            <ul role="list" className="text-sm text-slate-700">
              {orden.items.map((item, i) => (
                <li key={i}>
                  {item.cantidad} × {item.nombre}
                </li>
              ))}
            </ul>
            <p className="mt-auto border-t pt-3 font-bold">
              Saldo del cliente: ${orden.saldoPendiente.toFixed(2)}
            </p>
            <p className="text-lg font-bold text-emerald-800">
              Recibes en efectivo: ${orden.importeEfectivo.toFixed(2)}
            </p>
            {orden.explicacionEfectivo && (
              <p className="text-sm text-slate-600">
                {orden.explicacionEfectivo}
              </p>
            )}
            {orden.destinoCobro ? (
              <Link
                href={orden.destinoCobro}
                aria-label={`Cobrar ${orden.numero}, ${orden.titulo}`}
                className={`${boton} bg-emerald-700 text-white`}
              >
                Cobrar
              </Link>
            ) : (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {orden.motivoBloqueoCobro}
              </p>
            )}
            {orden.puedeEditar && (
              <button
                type="button"
                disabled={cargandoDetalle}
                onClick={() => void editar(orden.id)}
                aria-label={`Editar ${orden.numero}, ${orden.titulo}`}
                className={`${boton} border border-blue-700 text-blue-800`}
              >
                Editar orden
              </button>
            )}
          </li>
        ))}
      </ul>
      {datos?.siguienteCursor && (
        <button
          type="button"
          onClick={() => void cargar(datos.siguienteCursor)}
          disabled={loading}
          className={`${boton} border border-slate-500 bg-white`}
        >
          Cargar más
        </button>
      )}
      {editando && (
        <EditarOrdenModal
          orden={editando}
          onClose={() => setEditando(null)}
          onSuccess={() => {
            setEditando(null);
            void cargar();
          }}
        />
      )}
    </div>
  );
}
