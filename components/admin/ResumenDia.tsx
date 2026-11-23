"use client";

import { useState } from "react";
import type { OrdenPendienteAprobacion } from "@/types/orden";
import type { ProductoStockBajo } from "@/types/stock";
import type { ResumenCuadre } from "@/types/cuadre";
import AvisoPorCobrar from "./AvisoPorCobrar";
import FilaAtencion from "./FilaAtencion";
import RevisionWhatsapp from "./RevisionWhatsapp";
import { dolares, tituloOrden, type FiltroCobro } from "./orden-admin";

interface Props {
  /** null mientras no estén los datos de la fecha elegida. */
  resumen: ResumenCuadre | null;
  /** Qué decir mientras no haya datos. */
  sinDatos: string | null;
  cajaIniciada: boolean;
  esHoy: boolean;
  porCobrar: { cantidad: number; monto: number };
  ordenesPendientes: OrdenPendienteAprobacion[];
  productosStockBajo: ProductoStockBajo[];
  adminId: string;
  recarga: number;
  pendientes: number;
  onPendienteWhatsapp: (hayAlgo: boolean) => void;
  onAprobacionResuelta: () => Promise<void>;
  onVerOrdenes: (filtro: FiltroCobro) => void;
  onVerCierre: () => void;
}

const enlace =
  "min-h-11 text-left text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900";

export default function ResumenDia({
  resumen,
  sinDatos,
  cajaIniciada,
  esHoy,
  porCobrar,
  ordenesPendientes,
  productosStockBajo,
  adminId,
  recarga,
  pendientes,
  onPendienteWhatsapp,
  onAprobacionResuelta,
  onVerOrdenes,
  onVerCierre,
}: Props) {
  const [ordenParaAprobar, setOrdenParaAprobar] =
    useState<OrdenPendienteAprobacion | null>(null);
  const [razonAprobacion, setRazonAprobacion] = useState("");

  const cerrarAprobacion = () => {
    setOrdenParaAprobar(null);
    setRazonAprobacion("");
  };

  const aprobarOrden = async (ordenId: string, razon?: string) => {
    try {
      const res = await fetch("/api/ordenes/aprobacion/aprobar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordenId, adminId, razon }),
      });

      if (res.ok) {
        alert("Orden aprobada exitosamente");
        await onAprobacionResuelta();
        cerrarAprobacion();
      } else {
        const error = await res.json();
        alert(error.error || "Error al aprobar orden");
      }
    } catch (error) {
      console.error("Error al aprobar orden:", error);
      alert("Error al aprobar orden");
    }
  };

  const rechazarOrden = async (ordenId: string) => {
    if (!confirm("¿Estás seguro de rechazar esta orden? Será cancelada."))
      return;

    try {
      const res = await fetch("/api/ordenes/aprobacion/rechazar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordenId,
          adminId,
          razon: "Rechazada por falta de stock",
        }),
      });

      if (res.ok) {
        alert("Orden rechazada exitosamente");
        await onAprobacionResuelta();
      } else {
        const error = await res.json();
        alert(error.error || "Error al rechazar orden");
      }
    } catch (error) {
      console.error("Error al rechazar orden:", error);
      alert("Error al rechazar orden");
    }
  };

  const agotados = productosStockBajo.filter((p) => p.stock === 0).length;
  const cobrado = resumen ? resumen.ventasTotales - resumen.ventaPorCobrar : 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-6">
        <section
          aria-labelledby="ventas-del-dia"
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <h2 id="ventas-del-dia" className="text-lg font-bold">
            ¿Cuánto se vendió?
          </h2>
          {!resumen ? (
            <p className="mt-3 text-slate-600">{sinDatos}</p>
          ) : (
            <>
              <p className="mt-3 text-5xl font-bold tracking-tight">
                {dolares(resumen.ventasTotales)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Venta del local, sin el envío de los motorizados
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <dt className="text-sm text-slate-600">
                    <span aria-hidden className="text-emerald-700">✓ </span>
                    Ya cobrado
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold">
                    {dolares(cobrado)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-600">
                    <span aria-hidden className="text-amber-700">⏳ </span>
                    Falta cobrar
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold">
                    {dolares(resumen.ventaPorCobrar)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-slate-600">
                {resumen.totalOrdenes}{" "}
                {resumen.totalOrdenes === 1 ? "orden" : "órdenes"}:{" "}
                {resumen.ordenesCobradas} cobradas · {resumen.ordenesSinCobrar}{" "}
                sin cobrar
                {resumen.ordenesAnuladas > 0 && (
                  <>
                    {" "}
                    · además {resumen.ordenesAnuladas}{" "}
                    {resumen.ordenesAnuladas === 1
                      ? "anulada que no cuenta"
                      : "anuladas que no cuentan"}
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => onVerOrdenes("todas")}
                className={enlace}
              >
                Ver las órdenes
              </button>
            </>
          )}
        </section>

        <section
          aria-labelledby="donde-esta"
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <h2 id="donde-esta" className="text-lg font-bold">
            ¿Dónde está el dinero?
          </h2>
          {!resumen ? (
            <p className="mt-3 text-slate-600">{sinDatos}</p>
          ) : (
            <>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div
                  className={`rounded-lg p-4 ${resumen.efectivoEnCaja < 0 ? "bg-red-50" : "bg-slate-50"}`}
                >
                  <dt className="text-sm text-slate-600">
                    <span aria-hidden>💵 </span>Debe haber en la caja
                  </dt>
                  <dd
                    className={`mt-1 text-2xl font-semibold ${resumen.efectivoEnCaja < 0 ? "text-red-700" : ""}`}
                  >
                    {dolares(resumen.efectivoEnCaja)}
                  </dd>
                  <dd className="mt-1 text-sm text-slate-600">
                    {cajaIniciada
                      ? `En efectivo, con los ${dolares(resumen.fondoInicial)} con que abrió`
                      : "La caja de este día no se ha iniciado"}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <dt className="text-sm text-slate-600">
                    <span aria-hidden>🏦 </span>Debe constar en el banco
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold">
                    {dolares(resumen.depositosRecibidos)}
                  </dd>
                  <dd className="mt-1 text-sm text-slate-600">
                    Transferencias recibidas en el día
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={onVerCierre}
                className={`mt-2 ${enlace}`}
              >
                Ver cómo se calcula y cerrar la caja
              </button>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="atencion" className="space-y-3">
        <h2 id="atencion" className="text-lg font-bold">
          Requiere tu atención
        </h2>

        {ordenesPendientes.length > 0 && (
          <FilaAtencion
            critico
            icono="⚠️"
            titulo={
              ordenesPendientes.length === 1
                ? "1 orden pide más stock del que hay"
                : `${ordenesPendientes.length} órdenes piden más stock del que hay`
            }
            detalle="Esperan que las apruebes o rechaces."
          >
            <ul className="divide-y divide-slate-100">
              {ordenesPendientes.map((orden) => (
                <li key={orden.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-semibold">
                    {tituloOrden(orden)} · {dolares(Number(orden.total))}
                  </p>
                  <p className="text-sm text-slate-600">
                    {orden.mesero} ·{" "}
                    {new Date(orden.createdAt).toLocaleString("es-EC", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                  <ul className="mt-2 text-sm">
                    {orden.itemsSinStock.map((item, idx) => (
                      <li key={idx}>
                        {item.productoNombre}:{" "}
                        <strong className="text-red-700">
                          pide {item.cantidadSolicitada}, hay{" "}
                          {item.stockDisponible}
                        </strong>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOrdenParaAprobar(orden)}
                      className="min-h-11 flex-1 rounded-lg bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => rechazarOrden(orden.id)}
                      className="min-h-11 flex-1 rounded-lg border border-red-300 px-4 font-semibold text-red-700 hover:bg-red-50"
                    >
                      Rechazar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </FilaAtencion>
        )}

        {resumen && resumen.ordenesConSaldoPendiente > 0 && (
          <FilaAtencion
            critico
            icono="🧾"
            titulo={
              resumen.ordenesConSaldoPendiente === 1
                ? "1 orden pagada a medias"
                : `${resumen.ordenesConSaldoPendiente} órdenes pagadas a medias`
            }
            detalle={`Deben ${dolares(resumen.montoSaldoPendiente)}. No se puede cerrar la caja así.`}
          >
            <button
              type="button"
              onClick={() => onVerOrdenes("con_abono")}
              className={enlace}
            >
              Ver cuáles son
            </button>
          </FilaAtencion>
        )}

        {resumen && resumen.montoReembolsoPendiente > 0 && (
          <FilaAtencion
            critico
            icono="↩️"
            titulo={`Hay que devolver ${dolares(resumen.montoReembolsoPendiente)}`}
            detalle="Dinero recibido que todavía es del cliente."
          >
            <button
              type="button"
              onClick={() => onVerOrdenes("todas")}
              className={enlace}
            >
              Ver las órdenes
            </button>
          </FilaAtencion>
        )}

        {resumen && porCobrar.cantidad > 0 && (
          <FilaAtencion
            icono="⏳"
            titulo={
              porCobrar.cantidad === 1
                ? "1 orden por cobrar"
                : `${porCobrar.cantidad} órdenes por cobrar`
            }
            detalle={`Suman ${dolares(porCobrar.monto)}.`}
          >
            <button
              type="button"
              onClick={() => onVerOrdenes("sin_cobrar")}
              className={enlace}
            >
              Ver cuáles son
            </button>
            {esHoy && (
              <div className="mt-2 border-t border-slate-100 pt-3">
                <AvisoPorCobrar />
              </div>
            )}
          </FilaAtencion>
        )}

        <RevisionWhatsapp recarga={recarga} onPendiente={onPendienteWhatsapp} />

        {productosStockBajo.length > 0 && (
          <FilaAtencion
            icono="📦"
            titulo={
              productosStockBajo.length === 1
                ? "1 producto con poco stock"
                : `${productosStockBajo.length} productos con poco stock`
            }
            detalle={
              agotados > 0
                ? `${agotados} ${agotados === 1 ? "está agotado" : "están agotados"}.`
                : "Todavía hay, pero bajo el mínimo."
            }
          >
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto text-sm">
              {productosStockBajo.map((producto) => (
                <li
                  key={producto.id}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  <span>
                    {producto.nombre}{" "}
                    <span className="text-slate-600">
                      · {producto.categoria}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 ${producto.stock === 0 ? "font-semibold text-red-700" : ""}`}
                  >
                    {producto.stock === 0
                      ? "Agotado"
                      : `Quedan ${producto.stock}`}{" "}
                    <span className="font-normal text-slate-600">
                      (mín. {producto.stockMinimo})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <a
              href="/admin/productos?tab=stock"
              className={`mt-2 inline-flex items-center ${enlace}`}
            >
              Ir a stock
            </a>
          </FilaAtencion>
        )}

        {resumen && pendientes === 0 && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
            <span aria-hidden>✓ </span>Todo al día. No hay nada pendiente.
          </p>
        )}
      </section>

      {ordenParaAprobar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Aprobar orden sin stock</h3>
            <p className="text-gray-700 mb-4">
              {tituloOrden(ordenParaAprobar)} - {ordenParaAprobar.mesero}
            </p>
            <label className="mb-4 block text-sm font-medium text-gray-700">
              Razón de aprobación (opcional):
              <textarea
                value={razonAprobacion}
                onChange={(e) => setRazonAprobacion(e.target.value)}
                className="mt-2 w-full border rounded-lg px-3 py-2"
                rows={3}
                placeholder="Ej: Cliente VIP, reposición en camino..."
              />
            </label>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  aprobarOrden(ordenParaAprobar.id, razonAprobacion)
                }
                className="flex-1 bg-emerald-700 text-white px-4 py-2 rounded hover:bg-emerald-800 font-semibold"
              >
                Confirmar aprobación
              </button>
              <button
                onClick={cerrarAprobacion}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
