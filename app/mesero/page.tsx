"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
import CrearOrden from "@/components/mesero/CrearOrden";
import EditarOrdenModal from "@/components/mesero/EditarOrdenModal";
import RetiroCaja from "@/components/mesero/RetiroCaja";
import { montoACobrarEnCaja } from "@/types/cobro";
import {
  MetodoPago,
  type NivelPicante,
  obtenerEtiquetaNivelPicante,
} from "@/types/orden";

interface Orden {
  id: string;
  cobroUrl: string | null;
  printRevision: number;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  recargo: number | null;
  costoEnvio: number | null;
  mesero: string;
  estado: string;
  total: number;
  montoPagado: number;
  tiempoEstimado: number;
  modificada: boolean;
  cobrada: boolean;
  metodoPago: string | null;
  metodoPagoPrevisto: MetodoPago | null;
  cobradaPor: string | null;
  createdAt: string;
  items: {
    id: string;
    cantidad: number;
    producto: {
      id: string;
      nombre: string;
      categoria: string;
      precio: number;
      stock: number;
      disponible: boolean;
    };
    precioUnitario: number;
    subtotal: number;
    nivelPicante?: NivelPicante | null;
    esCortesia?: boolean;
    adminCortesia?: string;
  }[];
}

function MeseroContenido() {
  const { usuario, loading: authLoading, logout } = useAuth("mesero");
  // La vista vive en la URL: el cobro por QR devuelve al mesero a su lista con
  // ?vista=ordenes, y el drawer y la barra inferior navegan al mismo sitio.
  const searchParams = useSearchParams();
  const vistaParam = searchParams.get("vista");
  const vistaActiva: "crear" | "ordenes" | "retiro" =
    vistaParam === "ordenes" || vistaParam === "retiro" ? vistaParam : "crear";
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [ordenEditar, setOrdenEditar] = useState<Orden | null>(null);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [ordenACobrar, setOrdenACobrar] = useState<Orden | null>(null);
  const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] =
    useState<MetodoPago | "mixto">("efectivo");
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState("");
  const [loadingCobrar, setLoadingCobrar] = useState(false);

  const puedeOrdenCobrarse = (o: Orden): boolean => {
    const esLocal = !o.tipoOrden || o.tipoOrden === "local";
    return esLocal
      ? o.estado === "lista"
      : !o.cobrada &&
          o.estado !== "cancelada" &&
          o.estado !== "pendiente_aprobacion_stock";
  };

  const ordenesPorCobrar = ordenes.filter(puedeOrdenCobrarse);

  const saldoCentavos = ordenACobrar
    ? Math.max(
        0,
        Math.round(Number(ordenACobrar.total) * 100) -
          Math.round(Number(ordenACobrar.montoPagado) * 100),
      )
    : 0;
  const saldo = saldoCentavos / 100;
  const efectivoMixtoCentavos = Math.round(Number(montoEfectivoMixto || 0) * 100);
  const transferenciaMixtoCentavos = saldoCentavos - efectivoMixtoCentavos;

  const cargarOrdenes = async () => {
    setLoadingOrdenes(true);
    try {
      const res = await fetch("/api/ordenes");
      const data = await res.json();
      // Filtrar órdenes del mesero actual que no estén cobradas ni canceladas
      const ordenesDelMesero = data.filter(
        (orden: Orden) =>
          orden.mesero === usuario?.nombre &&
          orden.estado !== "cobrada" &&
          orden.estado !== "cancelada",
      );
      setOrdenes(ordenesDelMesero);
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
    } finally {
      setLoadingOrdenes(false);
    }
  };

  const cobrarOrden = async (
    partes: Array<{ metodoPago: string; monto: number }>,
  ) => {
    if (!ordenACobrar) return;
    setLoadingCobrar(true);
    try {
      const res = await fetch(`/api/ordenes/${ordenACobrar.id}/cobrar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partes,
          expectedRevision: ordenACobrar.printRevision,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (res.ok) {
        setOrdenACobrar(null);
        setMetodoPagoSeleccionado("efectivo");
        setMontoEfectivoMixto("");
        await cargarOrdenes();
      } else {
        const error = await res.json();
        alert(error.error || "Error al cobrar la orden");
      }
    } catch (error) {
      console.error("Error al cobrar:", error);
      alert("Error al cobrar la orden");
    } finally {
      setLoadingCobrar(false);
    }
  };

  useEffect(() => {
    if (usuario && vistaActiva === "ordenes") {
      // El setState ocurre dentro de la función async, no de forma síncrona
      // en el cuerpo del efecto.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarOrdenes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, vistaActiva]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario) return null;

  const titulos = {
    crear: "Crear orden",
    ordenes: "Mis órdenes",
    retiro: "Retiro de caja",
  } as const;

  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo={titulos[vistaActiva]}
      activoId={vistaActiva}
      badges={{ ordenes: ordenesPorCobrar.length }}
      acciones={
        vistaActiva === "ordenes" ? (
          <button
            onClick={cargarOrdenes}
            className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            🔄 Actualizar
          </button>
        ) : undefined
      }
    >
      {vistaActiva === "crear" && <CrearOrden />}

      {vistaActiva === "retiro" && <RetiroCaja usuario={usuario} />}

      {vistaActiva === "ordenes" && (
        <div className="p-6 max-w-7xl mx-auto">
          {loadingOrdenes ? (
            <div className="text-center py-12">Cargando órdenes...</div>
          ) : ordenes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No tienes órdenes activas
            </div>
          ) : (
            <>
              {ordenesPorCobrar.length > 0 && (
                <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-6 flex items-center gap-3">
                  <span className="text-2xl">💵</span>
                  <div>
                    <p className="font-bold text-green-800">
                      {ordenesPorCobrar.length}{" "}
                      {ordenesPorCobrar.length === 1
                        ? "orden lista para cobrar"
                        : "órdenes listas para cobrar"}
                    </p>
                    <p className="text-sm text-green-700">
                      Las tarjetas con borde verde tienen el botón{" "}
                      <strong>💵 Cobrar Orden</strong>
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ordenes.map((orden) => {
                  const puedeCobrarse = puedeOrdenCobrarse(orden);
                  const tituloOrden =
                    !orden.tipoOrden || orden.tipoOrden === "local"
                      ? `Mesa ${orden.numeroMesa}`
                      : (orden.nombreCliente ?? "Sin nombre");
                  return (
                    <div
                      key={orden.id}
                      className={`bg-white rounded-lg shadow-lg p-6 border-2 transition-colors ${
                        puedeCobrarse
                          ? "border-green-400 hover:border-green-500"
                          : "border-gray-200 hover:border-blue-400"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                orden.tipoOrden === "domicilio"
                                  ? "bg-purple-100 text-purple-700"
                                  : orden.tipoOrden === "para_llevar"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {orden.tipoOrden === "domicilio"
                                ? "🛵 Domicilio"
                                : orden.tipoOrden === "para_llevar"
                                  ? "🥡 Para llevar"
                                  : "🪑 Local"}
                            </span>
                          </div>
                          <h2 className="text-xl font-bold text-gray-800">
                            {tituloOrden}
                          </h2>
                          {orden.tipoOrden === "domicilio" &&
                            orden.telefonoCliente && (
                              <p className="text-xs text-purple-600 font-medium">
                                📞 {orden.telefonoCliente}
                              </p>
                            )}
                          <p className="text-xs text-gray-500">
                            {new Date(orden.createdAt).toLocaleString("es-EC")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {orden.modificada && (
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                              🔄 Modificada
                            </span>
                          )}
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded ${
                              orden.estado === "lista"
                                ? "bg-green-100 text-green-800"
                                : orden.estado === "en_preparacion"
                                  ? "bg-orange-100 text-orange-800"
                                  : orden.estado === "entregada"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {orden.estado === "lista"
                              ? "✅ Lista"
                              : orden.estado === "en_preparacion"
                                ? "🍳 En preparación"
                                : orden.estado === "entregada"
                                  ? "📦 Entregada"
                                  : "⏳ Pendiente"}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-700 text-sm mb-2">
                          Items:
                        </h3>
                        <div className="space-y-1.5">
                          {orden.items.map((item, idx) =>
                            item.esCortesia ? (
                              <div
                                key={idx}
                                className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-lg px-2.5 py-1.5"
                              >
                                <span className="text-base leading-none">
                                  🎁
                                </span>
                                <span className="text-sm font-semibold text-amber-900 flex-1">
                                  {item.cantidad}x {item.producto.nombre}
                                </span>
                                {item.nivelPicante && (
                                  <span className="text-xs font-bold text-red-700">
                                    🌶️ {obtenerEtiquetaNivelPicante(item.nivelPicante)}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-amber-600 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  CORTESÍA
                                </span>
                              </div>
                            ) : (
                              <div key={idx} className="text-sm text-gray-600">
                                {item.cantidad}x {item.producto.nombre}
                                {item.nivelPicante && (
                                  <span className="ml-2 font-bold text-red-700">
                                    🌶️ {obtenerEtiquetaNivelPicante(item.nivelPicante)}
                                  </span>
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </div>

                      {/* Total */}
                      <div className="border-t pt-3 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">
                            Total:
                          </span>
                          <span className="text-xl font-bold text-green-600">
                            ${Number(orden.total).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Botones */}
                      <div className="flex flex-col gap-2">
                        {orden.montoPagado > 0 && Number(orden.total) > Number(orden.montoPagado) && (
                          <span className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
                            SALDO ${(orden.total - orden.montoPagado).toFixed(2)}
                          </span>
                        )}
                        {puedeCobrarse && (
                          <button
                            onClick={() => {
                              if (orden.cobroUrl) {
                                const paymentUrl = new URL(
                                  orden.cobroUrl,
                                  window.location.origin,
                                );
                                // origen=lista: se navega en la misma pestaña,
                                // así que al terminar se vuelve en vez de cerrar.
                                window.location.assign(
                                  `${paymentUrl.pathname}?origen=lista`,
                                );
                                return;
                              }
                              setOrdenACobrar(orden);
                              // En domicilio ya se acordó la modalidad al crear;
                              // se puede cambiar, pero queda registrado el override.
                              setMetodoPagoSeleccionado(
                                orden.metodoPagoPrevisto ?? "efectivo",
                              );
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                          >
                            💵 Cobrar Orden
                          </button>
                        )}
                        {!orden.cobrada && (
                          <button
                            onClick={() => setOrdenEditar(orden)}
                            className={`w-full py-2 rounded-lg font-semibold transition-colors text-white ${
                              orden.estado === "lista"
                                ? "bg-orange-500 hover:bg-orange-600"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            {orden.estado === "lista"
                              ? "➕ Agregar más items"
                              : "✏️ Editar Orden"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Cobrar */}
      {ordenACobrar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-gray-800">
              💵 Cobrar Orden
            </h3>
            <p className="text-gray-600 mb-1">
              {!ordenACobrar.tipoOrden || ordenACobrar.tipoOrden === "local"
                ? `Mesa ${ordenACobrar.numeroMesa}`
                : (ordenACobrar.nombreCliente ??
                  ordenACobrar.telefonoCliente ??
                  "Cliente")}
            </p>
            <p className="text-2xl font-bold text-green-600 mb-1">
              $
              {montoACobrarEnCaja({
                tipoOrden: ordenACobrar.tipoOrden,
                total: saldo,
                costoEnvio: ordenACobrar.costoEnvio,
                metodoPago: metodoPagoSeleccionado === "mixto" ? "efectivo" : metodoPagoSeleccionado,
              }).toFixed(2)}
              {ordenACobrar.montoPagado > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  saldo de ${Number(ordenACobrar.total).toFixed(2)}
                </span>
              )}
            </p>
            {ordenACobrar.tipoOrden === "domicilio" &&
              Number(ordenACobrar.costoEnvio ?? 0) > 0 && (
                <p className="text-sm text-gray-500 mb-5">
                  {metodoPagoSeleccionado === "efectivo"
                    ? `El cliente paga $${Number(ordenACobrar.total).toFixed(2)}; el motorizado conserva $${Number(ordenACobrar.costoEnvio ?? 0).toFixed(2)} del envío.`
                    : metodoPagoSeleccionado === "mixto"
                      ? (efectivoMixtoCentavos >=
                          Math.round(Number(ordenACobrar.costoEnvio ?? 0) * 100)
                          ? `El motorizado te entrega $${((efectivoMixtoCentavos - Math.round(Number(ordenACobrar.costoEnvio ?? 0) * 100)) / 100).toFixed(2)}.`
                          : `Le entregas $${((Math.round(Number(ordenACobrar.costoEnvio ?? 0) * 100) - efectivoMixtoCentavos) / 100).toFixed(2)} al motorizado.`)
                      : `Entra el total; luego se entregan $${Number(ordenACobrar.costoEnvio ?? 0).toFixed(2)} en efectivo al motorizado.`}
                </p>
              )}
            <p className="mt-4 text-sm font-semibold text-gray-700 mb-3">
              Método de pago:
            </p>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setMetodoPagoSeleccionado("efectivo")}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPagoSeleccionado === "efectivo"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                }`}
              >
                💵 Efectivo
              </button>
              <button
                onClick={() => setMetodoPagoSeleccionado("transferencia")}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPagoSeleccionado === "transferencia"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                🏦 Transferencia
              </button>
              <button
                onClick={() => setMetodoPagoSeleccionado("mixto")}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPagoSeleccionado === "mixto"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
                }`}
              >
                🔀 Mixto
              </button>
            </div>

            {metodoPagoSeleccionado === "mixto" && (
              <div className="mb-6 space-y-2 rounded-lg bg-gray-50 p-4">
                <label className="block text-sm font-semibold text-gray-700">
                  Monto en efectivo
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={montoEfectivoMixto}
                    onChange={(event) => setMontoEfectivoMixto(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-xl font-bold"
                    placeholder="0.00"
                  />
                </label>
                <div className="flex justify-between text-sm">
                  <span>Transferencia</span>
                  <span className="font-semibold">
                    ${Math.max(0, transferenciaMixtoCentavos / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {metodoPagoSeleccionado !== "mixto" &&
              ordenACobrar.metodoPagoPrevisto &&
              metodoPagoSeleccionado !== ordenACobrar.metodoPagoPrevisto && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-6">
                  <p className="text-sm text-amber-800">
                    ⚠️ El pedido se acordó en{" "}
                    <strong>{ordenACobrar.metodoPagoPrevisto}</strong>. El cambio
                    queda registrado en el historial y altera la liquidación con
                    el motorizado.
                  </p>
                </div>
              )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (metodoPagoSeleccionado !== "mixto") {
                    void cobrarOrden([
                      { metodoPago: metodoPagoSeleccionado, monto: saldo },
                    ]);
                    return;
                  }
                  if (efectivoMixtoCentavos <= 0 || transferenciaMixtoCentavos <= 0) {
                    alert("En un cobro mixto las dos partes deben ser mayores a cero.");
                    return;
                  }
                  void cobrarOrden([
                    { metodoPago: "efectivo", monto: efectivoMixtoCentavos / 100 },
                    { metodoPago: "transferencia", monto: transferenciaMixtoCentavos / 100 },
                  ]);
                }}
                disabled={loadingCobrar}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-bold transition-colors"
              >
                {loadingCobrar ? "Procesando..." : "✓ Confirmar Cobro"}
              </button>
              <button
                onClick={() => {
                  setOrdenACobrar(null);
                  setMetodoPagoSeleccionado("efectivo");
                  setMontoEfectivoMixto("");
                }}
                disabled={loadingCobrar}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white py-2 rounded-lg font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      {ordenEditar && (
        <EditarOrdenModal
          orden={ordenEditar}
          onClose={() => setOrdenEditar(null)}
          onSuccess={() => {
            setOrdenEditar(null);
            cargarOrdenes();
          }}
          usuario={usuario}
        />
      )}
    </AppShell>
  );
}

export default function MeseroPage() {
  return (
    <Suspense fallback={null}>
      <MeseroContenido />
    </Suspense>
  );
}
