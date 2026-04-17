"use client";

import { useState, useEffect } from "react";
import HistorialOrdenTimeline from "./HistorialOrdenTimeline";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  disponible: boolean;
}

interface ItemOrden {
  cantidad: number;
  producto: {
    nombre: string;
    categoria: string;
  };
  precioUnitario: number;
  subtotal: number;
  observaciones?: string;
  esCortesia?: boolean;
  adminCortesia?: string | null;
}

interface Orden {
  id: string;
  tipoOrden?: string;
  numeroMesa: number | null;
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  recargo?: number | null;
  costoEnvio?: number | null;
  mesero: string;
  estado: string;
  total: number;
  tiempoEstimado: number;
  modificada: boolean;
  cobrada?: boolean;
  metodoPago?: string | null;
  fechaCobro?: string | null;
  cobradaPor?: string | null;
  createdAt: string;
  updatedAt: string;
  observaciones?: string;
  items: ItemOrden[];
}

interface DetalleOrdenModalProps {
  orden: Orden;
  adminNombre?: string;
  onClose: () => void;
  onOrdenActualizada?: (ordenActualizada: Orden) => void;
}

const ESTADOS_EDITABLES = ["pendiente", "en_preparacion", "lista", "entregada"];

export default function DetalleOrdenModal({
  orden: ordenInicial,
  adminNombre,
  onClose,
  onOrdenActualizada,
}: DetalleOrdenModalProps) {
  const [orden, setOrden] = useState<Orden>(ordenInicial);
  const [pestanaActiva, setPestanaActiva] = useState<"resumen" | "historial">(
    "resumen",
  );

  // Estado del modal de cortesía
  const [mostrarModalCortesia, setMostrarModalCortesia] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<Producto | null>(null);
  const [cantidadCortesia, setCantidadCortesia] = useState(1);
  const [razonCortesia, setRazonCortesia] = useState("");
  const [loadingCortesia, setLoadingCortesia] = useState(false);
  const [errorCortesia, setErrorCortesia] = useState("");

  const puedeAgregarCortesia =
    adminNombre && ESTADOS_EDITABLES.includes(orden.estado);

  const itemsCortesia = orden.items.filter((i) => i.esCortesia);

  const cargarProductos = async () => {
    if (productos.length > 0) return;
    setCargandoProductos(true);
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();
      setProductos(data.filter((p: Producto) => p.disponible));
    } catch {
      setErrorCortesia("Error al cargar productos");
    } finally {
      setCargandoProductos(false);
    }
  };

  const abrirModalCortesia = () => {
    setMostrarModalCortesia(true);
    setProductoSeleccionado(null);
    setCantidadCortesia(1);
    setRazonCortesia("");
    setErrorCortesia("");
    cargarProductos();
  };

  const cerrarModalCortesia = () => {
    setMostrarModalCortesia(false);
    setBusquedaProducto("");
    setProductoSeleccionado(null);
    setErrorCortesia("");
  };

  const confirmarCortesia = async () => {
    if (!productoSeleccionado || !adminNombre) return;
    setLoadingCortesia(true);
    setErrorCortesia("");
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/cortesia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productoId: productoSeleccionado.id,
          cantidad: cantidadCortesia,
          adminNombre,
          razon: razonCortesia.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCortesia(data.error || "Error al aplicar cortesía");
        return;
      }
      const ordenActualizada = data.orden as Orden;
      setOrden(ordenActualizada);
      onOrdenActualizada?.(ordenActualizada);
      cerrarModalCortesia();
    } catch {
      setErrorCortesia("Error de red al aplicar cortesía");
    } finally {
      setLoadingCortesia(false);
    }
  };

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()),
  );

  // Sync if parent updates the orden
  useEffect(() => {
    setOrden(ordenInicial);
  }, [ordenInicial]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {!orden.tipoOrden || orden.tipoOrden === "local"
                ? `Mesa ${orden.numeroMesa}`
                : orden.nombreCliente}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date(orden.createdAt).toLocaleString("es-EC")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {puedeAgregarCortesia && (
              <button
                onClick={abrirModalCortesia}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
              >
                🎁 Agregar Cortesía
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="border-b bg-gray-50">
          <div className="flex gap-2 px-6">
            <button
              onClick={() => setPestanaActiva("resumen")}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 ${
                pestanaActiva === "resumen"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              📋 Resumen
            </button>
            <button
              onClick={() => setPestanaActiva("historial")}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                pestanaActiva === "historial"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              📜 Historial
              {orden.modificada && (
                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                  Modificada
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6">
          {pestanaActiva === "resumen" ? (
            <div className="space-y-6">
              {/* Tipo de Orden e Info del Cliente */}
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                    Tipo de Orden
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-semibold uppercase">
                      Tipo
                    </label>
                    <p className="mt-1">
                      {(!orden.tipoOrden || orden.tipoOrden === "local") && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                          🍽 Local
                        </span>
                      )}
                      {orden.tipoOrden === "para_llevar" && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800">
                          🥡 Para Llevar
                        </span>
                      )}
                      {orden.tipoOrden === "domicilio" && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800">
                          🛵 Domicilio
                        </span>
                      )}
                    </p>
                  </div>
                  {(!orden.tipoOrden || orden.tipoOrden === "local") && (
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">
                        Mesa
                      </label>
                      <p className="text-lg font-bold text-gray-800">
                        #{orden.numeroMesa}
                      </p>
                    </div>
                  )}
                  {(orden.tipoOrden === "para_llevar" ||
                    orden.tipoOrden === "domicilio") && (
                    <>
                      <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase">
                          Cliente
                        </label>
                        <p className="text-base font-semibold text-gray-800">
                          {orden.nombreCliente ?? "—"}
                        </p>
                      </div>
                      {orden.tipoOrden === "domicilio" && (
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase">
                            Teléfono
                          </label>
                          <p className="text-base text-gray-800">
                            {orden.telefonoCliente ?? "—"}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Información General */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 font-semibold">
                    Mesero
                  </label>
                  <p className="text-lg text-gray-800">{orden.mesero}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-semibold">
                    Estado
                  </label>
                  <p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        orden.estado === "completada"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {orden.estado}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-semibold">
                    Tiempo Estimado
                  </label>
                  <p className="text-lg text-gray-800">
                    {orden.tiempoEstimado} minutos
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-semibold">
                    Total
                  </label>
                  <p className="text-2xl font-bold text-green-600">
                    ${Number(orden.total).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Observaciones Generales */}
              {orden.observaciones && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <label className="text-sm text-blue-900 font-semibold">
                    Observaciones Generales:
                  </label>
                  <p className="text-blue-800 mt-1">{orden.observaciones}</p>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 text-lg">
                  Items de la Orden:
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Producto
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Categoría
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                          Cantidad
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          P. Unit.
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orden.items.map((item, idx) => (
                        <tr
                          key={idx}
                          className={
                            item.esCortesia
                              ? "bg-emerald-50 hover:bg-emerald-100"
                              : "hover:bg-gray-50"
                          }
                        >
                          <td className="px-4 py-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-800">
                                  {item.producto.nombre}
                                </p>
                                {item.esCortesia && (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                                    🎁 CORTESÍA
                                  </span>
                                )}
                              </div>
                              {item.observaciones && (
                                <p className="text-xs text-gray-500 italic">
                                  Nota: {item.observaciones}
                                </p>
                              )}
                              {item.esCortesia && item.adminCortesia && (
                                <p className="text-xs text-emerald-600 mt-0.5">
                                  Autorizado por: {item.adminCortesia}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.producto.categoria}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-800">
                            {item.cantidad}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {item.esCortesia ? (
                              <span className="text-emerald-600 font-semibold">
                                $0.00
                              </span>
                            ) : (
                              `$${Number(item.precioUnitario).toFixed(2)}`
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">
                            {item.esCortesia ? (
                              <span className="text-emerald-600">$0.00</span>
                            ) : (
                              `$${Number(item.subtotal).toFixed(2)}`
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      {itemsCortesia.length > 0 && (
                        <tr className="border-t border-emerald-200">
                          <td
                            colSpan={4}
                            className="px-4 py-2 text-right text-sm text-emerald-700"
                          >
                            🎁 Cortesías ({itemsCortesia.length} ítem
                            {itemsCortesia.length !== 1 ? "s" : ""}):
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-emerald-700 font-semibold">
                            $0.00
                          </td>
                        </tr>
                      )}
                      {(Number(orden.recargo) > 0 ||
                        Number(orden.costoEnvio) > 0) && (
                        <>
                          <tr className="border-t">
                            <td
                              colSpan={4}
                              className="px-4 py-2 text-right text-sm text-gray-600"
                            >
                              Subtotal productos:
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-700">
                              $
                              {(
                                Number(orden.total) -
                                Number(orden.recargo ?? 0) -
                                Number(orden.costoEnvio ?? 0)
                              ).toFixed(2)}
                            </td>
                          </tr>
                          {Number(orden.recargo) > 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-2 text-right text-sm text-gray-600"
                              >
                                Recargo (
                                {orden.tipoOrden === "domicilio"
                                  ? "domicilio"
                                  : "para llevar"}
                                ):
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-700">
                                +${Number(orden.recargo).toFixed(2)}
                              </td>
                            </tr>
                          )}
                          {Number(orden.costoEnvio) > 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-2 text-right text-sm text-gray-600"
                              >
                                🛵 Costo de envío:
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-700">
                                +${Number(orden.costoEnvio).toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                      <tr className="border-t-2 border-gray-300">
                        <td
                          colSpan={4}
                          className="px-4 py-3 text-right font-bold text-gray-800"
                        >
                          TOTAL:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-600 text-lg">
                          ${Number(orden.total).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Badge de Modificación */}
              {orden.modificada && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <p className="text-sm text-yellow-800 font-semibold">
                    ⚠️ Esta orden fue modificada después de su creación. Ver
                    pestaña &quot;Historial&quot; para detalles completos.
                  </p>
                </div>
              )}

              {/* Información de Cobro */}
              {orden.cobrada ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    ✅ Orden Cobrada
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">
                        Método de Pago
                      </label>
                      <p className="mt-1">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                            !orden.metodoPago
                              ? "bg-gray-100 text-gray-600"
                              : orden.metodoPago === "efectivo"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {!orden.metodoPago
                            ? "— Desconocido"
                            : orden.metodoPago === "efectivo"
                            ? "💵 Efectivo"
                            : "🏦 Transferencia"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">
                        Cobrado por
                      </label>
                      <p className="text-sm text-gray-800 mt-1 font-semibold">
                        {orden.cobradaPor ?? "—"}
                      </p>
                    </div>
                    {orden.fechaCobro && (
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 font-semibold uppercase">
                          Fecha de Cobro
                        </label>
                        <p className="text-sm text-gray-800 mt-1">
                          {new Date(orden.fechaCobro).toLocaleString("es-EC")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : orden.estado !== "cancelada" ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-700 font-semibold">
                    ⏳ Pendiente de cobro
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">
                Timeline de Cambios
              </h3>
              <HistorialOrdenTimeline ordenId={orden.id} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal de Cortesía */}
      {mostrarModalCortesia && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b bg-emerald-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
                🎁 Agregar Cortesía
              </h3>
              <button
                onClick={cerrarModalCortesia}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Buscador de producto */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Buscar Producto
                </label>
                <input
                  type="text"
                  placeholder="Escribe el nombre del producto..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              {/* Lista de productos */}
              <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {cargandoProductos ? (
                  <p className="text-center py-6 text-gray-500 text-sm">
                    Cargando productos...
                  </p>
                ) : productosFiltrados.length === 0 ? (
                  <p className="text-center py-6 text-gray-500 text-sm">
                    No se encontraron productos
                  </p>
                ) : (
                  productosFiltrados.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProductoSeleccionado(p)}
                      className={`w-full text-left px-4 py-3 flex justify-between items-center border-b last:border-b-0 transition-colors ${
                        productoSeleccionado?.id === p.id
                          ? "bg-emerald-100 border-l-4 border-l-emerald-500"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-gray-800 text-sm">
                          {p.nombre}
                        </p>
                        <p className="text-xs text-gray-500">{p.categoria}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        ${Number(p.precio).toFixed(2)}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Producto seleccionado */}
              {productoSeleccionado && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-sm text-emerald-800">
                    <span className="font-semibold">Seleccionado:</span>{" "}
                    {productoSeleccionado.nombre}
                  </p>
                </div>
              )}

              {/* Cantidad */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min={1}
                  value={cantidadCortesia}
                  onChange={(e) =>
                    setCantidadCortesia(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Razón (opcional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Razón{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Compensación por demora, Cumpleaños..."
                  value={razonCortesia}
                  onChange={(e) => setRazonCortesia(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Autorizado por */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
                👤 Autorizado por:{" "}
                <span className="font-semibold text-gray-800">
                  {adminNombre}
                </span>
              </div>

              {errorCortesia && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                  {errorCortesia}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t flex gap-3">
              <button
                onClick={cerrarModalCortesia}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCortesia}
                disabled={!productoSeleccionado || loadingCortesia}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg font-semibold"
              >
                {loadingCortesia ? "Aplicando..." : "✓ Confirmar Cortesía"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
