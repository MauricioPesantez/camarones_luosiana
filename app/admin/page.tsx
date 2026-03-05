"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import DetalleOrdenModal from "@/components/admin/DetalleOrdenModal";
import { ProductoStockBajo } from "@/types/stock";
import { OrdenPendienteAprobacion, MetodoPago } from "@/types/orden";

interface Orden {
  id: string;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  recargo: number | null;
  costoEnvio: number | null;
  mesero: string;
  estado: string;
  total: number;
  tiempoEstimado: number;
  modificada: boolean;
  cobrada: boolean;
  metodoPago: string | null;
  fechaCobro: string | null;
  cobradaPor: string | null;
  createdAt: string;
  updatedAt: string;
  observaciones?: string;
  items: {
    cantidad: number;
    producto: {
      nombre: string;
      categoria: string;
    };
    precioUnitario: number;
    subtotal: number;
    observaciones?: string;
  }[];
}

export default function AdminPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(
    null,
  );
  const [fechaFiltro, setFechaFiltro] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(false);
  const [productosStockBajo, setProductosStockBajo] = useState<
    ProductoStockBajo[]
  >([]);
  const [ordenesPendientes, setOrdenesPendientes] = useState<
    OrdenPendienteAprobacion[]
  >([]);
  const [mostrarModalAprobacion, setMostrarModalAprobacion] = useState(false);
  const [ordenParaAprobar, setOrdenParaAprobar] =
    useState<OrdenPendienteAprobacion | null>(null);
  const [razonAprobacion, setRazonAprobacion] = useState("");
  const [ordenACobrar, setOrdenACobrar] = useState<Orden | null>(null);
  const [metodoPagoAdmin, setMetodoPagoAdmin] =
    useState<MetodoPago>("efectivo");
  const [loadingCobrar, setLoadingCobrar] = useState(false);

  const cargarOrdenes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cuadre?fecha=${fechaFiltro}`);
      const data = await res.json();
      setOrdenes(data);
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarProductosStockBajo = async () => {
    try {
      const res = await fetch("/api/stock/bajo");
      const data = await res.json();
      setProductosStockBajo(data.productos || []);
    } catch (error) {
      console.error("Error al cargar productos con stock bajo:", error);
    }
  };

  const cargarOrdenesPendientes = async () => {
    try {
      const res = await fetch("/api/ordenes/aprobacion/pendientes");
      const data = await res.json();
      setOrdenesPendientes(data.ordenes || []);
    } catch (error) {
      console.error("Error al cargar órdenes pendientes:", error);
    }
  };

  const aprobarOrden = async (ordenId: string, razon?: string) => {
    if (!usuario) return;

    try {
      const res = await fetch("/api/ordenes/aprobacion/aprobar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordenId,
          adminId: usuario.id,
          razon,
        }),
      });

      if (res.ok) {
        alert("Orden aprobada exitosamente");
        await cargarOrdenesPendientes();
        setMostrarModalAprobacion(false);
        setOrdenParaAprobar(null);
        setRazonAprobacion("");
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
    if (!usuario) return;
    if (!confirm("¿Estás seguro de rechazar esta orden? Será cancelada."))
      return;

    try {
      const res = await fetch("/api/ordenes/aprobacion/rechazar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordenId,
          adminId: usuario.id,
          razon: "Rechazada por falta de stock",
        }),
      });

      if (res.ok) {
        alert("Orden rechazada exitosamente");
        await cargarOrdenesPendientes();
      } else {
        const error = await res.json();
        alert(error.error || "Error al rechazar orden");
      }
    } catch (error) {
      console.error("Error al rechazar orden:", error);
      alert("Error al rechazar orden");
    }
  };

  const cobrarOrden = async () => {
    if (!ordenACobrar) return;
    setLoadingCobrar(true);
    try {
      const res = await fetch(`/api/ordenes/${ordenACobrar.id}/cobrar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metodoPago: metodoPagoAdmin,
          cobradaPor: usuario?.nombre ?? "",
        }),
      });
      if (res.ok) {
        setOrdenACobrar(null);
        setMetodoPagoAdmin("efectivo");
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
    if (usuario && usuario.rol === "admin") {
      cargarOrdenes();
      cargarProductosStockBajo();
      cargarOrdenesPendientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaFiltro, usuario]);

  // Polling para actualizar órdenes pendientes cada 30 segundos
  useEffect(() => {
    if (usuario && usuario.rol === "admin") {
      const interval = setInterval(() => {
        cargarOrdenesPendientes();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [usuario]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario || usuario.rol !== "admin") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">Acceso denegado</div>
      </div>
    );
  }

  // Función para calcular si una orden salió a tiempo
  const calcularEstadoTiempo = (orden: Orden) => {
    const estadosFinales = ["entregada", "cobrada"];
    if (!estadosFinales.includes(orden.estado) || !orden.tiempoEstimado) {
      return null;
    }

    const creacion = new Date(orden.createdAt).getTime();
    const completada = new Date(orden.updatedAt).getTime();
    const tiempoReal = Math.floor((completada - creacion) / 60000); // en minutos

    return {
      tiempoReal,
      tiempoEstimado: orden.tiempoEstimado,
      aTiempo: tiempoReal <= orden.tiempoEstimado,
    };
  };

  const totalDelDia = ordenes.reduce(
    (total, orden) => total + Number(orden.total),
    0,
  );

  const ordenesCobradas = ordenes.filter((o) => o.estado === "cobrada");
  const totalEfectivo = ordenesCobradas
    .filter((o) => o.metodoPago === "efectivo")
    .reduce((total, orden) => total + Number(orden.total), 0);
  const totalTransferencia = ordenesCobradas
    .filter((o) => o.metodoPago === "transferencia")
    .reduce((total, orden) => total + Number(orden.total), 0);

  const ordenesPorEstado = {
    pendiente: ordenes.filter(
      (o) =>
        o.estado === "pendiente" ||
        o.estado === "en_preparacion" ||
        o.estado === "lista" ||
        o.estado === "entregada",
    ).length,
    cobrada: ordenesCobradas.length,
    total: ordenes.length,
  };

  // Calcular estadísticas de tiempo (usadas por fila)

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">
            Panel de Administración
          </h1>
          <div className="flex items-center gap-4">
            <a
              href="/admin/reportes"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold"
            >
              📊 Reportes
            </a>
            <a
              href="/admin/productos"
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-semibold"
            >
              📦 Productos
            </a>
            <span className="text-gray-600">
              Admin: <span className="font-bold">{usuario?.nombre}</span>
            </span>
            <button
              onClick={logout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Filtro de Fecha */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4">
            <label className="font-semibold text-gray-700">
              Fecha del Cuadre:
            </label>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="border rounded-lg px-4 py-2 text-black"
            />
            <button
              onClick={cargarOrdenes}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Alertas y Notificaciones */}
        {(ordenesPendientes.length > 0 || productosStockBajo.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Órdenes Pendientes de Aprobación */}
            {ordenesPendientes.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
                    ⚠️ Órdenes Pendientes de Aprobación
                    <span className="bg-red-600 text-white rounded-full px-3 py-1 text-sm">
                      {ordenesPendientes.length}
                    </span>
                  </h2>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {ordenesPendientes.map((orden) => (
                    <div
                      key={orden.id}
                      className="bg-white rounded-lg p-4 border border-red-300"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-lg">
                            {!orden.tipoOrden || orden.tipoOrden === "local"
                              ? `Mesa ${orden.numeroMesa}`
                              : orden.nombreCliente}{" "}
                            - {orden.mesero}
                          </p>
                          <p className="text-sm text-gray-600">
                            Total: ${Number(orden.total).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(orden.createdAt).toLocaleString("es-EC")}
                          </p>
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-red-700 mb-1">
                          Items sin stock:
                        </p>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {orden.itemsSinStock.map((item, idx) => (
                            <li key={idx} className="flex justify-between">
                              <span>{item.productoNombre}</span>
                              <span className="text-red-600 font-semibold">
                                Solicitado: {item.cantidadSolicitada} |
                                Disponible: {item.stockDisponible}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setOrdenParaAprobar(orden);
                            setMostrarModalAprobacion(true);
                          }}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                        >
                          ✓ Aprobar
                        </button>
                        <button
                          onClick={() => rechazarOrden(orden.id)}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
                        >
                          ✕ Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Productos con Stock Bajo */}
            {productosStockBajo.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-yellow-800 flex items-center gap-2">
                    📦 Productos con Stock Bajo
                    <span className="bg-yellow-600 text-white rounded-full px-3 py-1 text-sm">
                      {productosStockBajo.length}
                    </span>
                  </h2>
                  <a
                    href="/admin/productos"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Ver todos
                  </a>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {productosStockBajo.map((producto) => (
                    <div
                      key={producto.id}
                      className="bg-white rounded-lg p-3 border border-yellow-300 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold text-orange-500">
                          {producto.nombre}
                        </p>
                        <p className="text-sm text-gray-600">
                          {producto.categoria}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            producto.stock === 0
                              ? "text-red-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {producto.stock} unidades
                        </p>
                        <p className="text-xs text-gray-500">
                          Mínimo: {producto.stockMinimo}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal de Aprobación */}
        {mostrarModalAprobacion && ordenParaAprobar && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">
                Aprobar Orden sin Stock
              </h3>
              <p className="text-gray-700 mb-4">
                {!ordenParaAprobar.tipoOrden ||
                ordenParaAprobar.tipoOrden === "local"
                  ? `Mesa ${ordenParaAprobar.numeroMesa}`
                  : ordenParaAprobar.nombreCliente}{" "}
                - {ordenParaAprobar.mesero}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón de aprobación (opcional):
                </label>
                <textarea
                  value={razonAprobacion}
                  onChange={(e) => setRazonAprobacion(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Ej: Cliente VIP, reposición en camino..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    aprobarOrden(ordenParaAprobar.id, razonAprobacion)
                  }
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                >
                  Confirmar Aprobación
                </button>
                <button
                  onClick={() => {
                    setMostrarModalAprobacion(false);
                    setOrdenParaAprobar(null);
                    setRazonAprobacion("");
                  }}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs text-gray-600 mb-1">Total del Día</h3>
            <p className="text-xl font-bold text-green-600">
              ${totalDelDia.toFixed(2)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4 border border-green-200">
            <h3 className="text-xs text-gray-600 mb-1">💵 Efectivo</h3>
            <p className="text-xl font-bold text-green-700">
              ${totalEfectivo.toFixed(2)}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
            <h3 className="text-xs text-gray-600 mb-1">🏦 Transferencia</h3>
            <p className="text-xl font-bold text-blue-700">
              ${totalTransferencia.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs text-gray-600 mb-1">Total Órdenes</h3>
            <p className="text-xl font-bold text-blue-600">
              {ordenesPorEstado.total}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs text-gray-600 mb-1">Cobradas ✓</h3>
            <p className="text-xl font-bold text-green-600">
              {ordenesPorEstado.cobrada}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs text-gray-600 mb-1">Activas</h3>
            <p className="text-xl font-bold text-yellow-600">
              {ordenesPorEstado.pendiente}
            </p>
          </div>
        </div>

        {/* Tabla de Órdenes */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-bold">Órdenes del Día</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">Cargando...</div>
          ) : ordenes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No hay órdenes para esta fecha
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Mesa / Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Mesero
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tiempo Entrega
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pago
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ordenes.map((orden) => {
                    const estadoTiempo = calcularEstadoTiempo(orden);
                    return (
                      <tr
                        key={orden.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setOrdenSeleccionada(orden)}
                      >
                        <td className="px-6 py-4 text-sm">
                          {new Date(orden.createdAt).toLocaleTimeString(
                            "es-EC",
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {(!orden.tipoOrden ||
                            orden.tipoOrden === "local") && (
                            <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              🍽 Local
                            </span>
                          )}
                          {orden.tipoOrden === "para_llevar" && (
                            <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              🥡 Para Llevar
                            </span>
                          )}
                          {orden.tipoOrden === "domicilio" && (
                            <span className="text-xs font-bold bg-red-100 text-red-800 px-2 py-1 rounded">
                              🛵 Domicilio
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {!orden.tipoOrden || orden.tipoOrden === "local"
                            ? `Mesa ${orden.numeroMesa}`
                            : orden.nombreCliente}
                        </td>
                        <td className="px-6 py-4 text-sm">{orden.mesero}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="space-y-1">
                            {orden.items.map((item, idx) => (
                              <div key={idx} className="text-xs">
                                {item.cantidad}x {item.producto.nombre}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              orden.estado === "cobrada"
                                ? "bg-green-100 text-green-800"
                                : orden.estado === "cancelada"
                                  ? "bg-red-100 text-red-800"
                                  : orden.estado === "lista"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : orden.estado === "entregada"
                                      ? "bg-purple-100 text-purple-800"
                                      : orden.estado === "en_preparacion"
                                        ? "bg-orange-100 text-orange-800"
                                        : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {orden.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {estadoTiempo ? (
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                                  estadoTiempo.aTiempo
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : "bg-red-100 text-red-800 border border-red-300"
                                }`}
                              >
                                {estadoTiempo.aTiempo
                                  ? "✓ A Tiempo"
                                  : "⚠️ Retrasada"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {estadoTiempo.tiempoReal} /{" "}
                                {estadoTiempo.tiempoEstimado} min
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          ${Number(orden.total).toFixed(2)}
                        </td>
                        <td
                          className="px-6 py-4 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {orden.cobrada ? (
                            <div className="flex flex-col gap-1">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  orden.metodoPago === "efectivo"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {orden.metodoPago === "efectivo"
                                  ? "💵 Efectivo"
                                  : "🏦 Transferencia"}
                              </span>
                              {orden.cobradaPor && (
                                <span className="text-xs text-gray-500">
                                  por {orden.cobradaPor}
                                </span>
                              )}
                            </div>
                          ) : orden.estado !== "cancelada" ? (
                            <button
                              onClick={() => {
                                setOrdenACobrar(orden);
                                setMetodoPagoAdmin("efectivo");
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded-lg font-bold transition-colors"
                            >
                              💵 Cobrar
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalle de Orden */}
      {ordenSeleccionada && (
        <DetalleOrdenModal
          orden={ordenSeleccionada}
          onClose={() => setOrdenSeleccionada(null)}
        />
      )}

      {/* Modal Cobrar (Admin) */}
      {ordenACobrar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-gray-800">
              💵 Cobrar Orden
            </h3>
            <p className="text-gray-600 mb-1">
              {!ordenACobrar.tipoOrden || ordenACobrar.tipoOrden === "local"
                ? `Mesa ${ordenACobrar.numeroMesa}`
                : ordenACobrar.nombreCliente}{" "}
              — {ordenACobrar.mesero}
            </p>
            <p className="text-2xl font-bold text-green-600 mb-5">
              ${Number(ordenACobrar.total).toFixed(2)}
            </p>

            <p className="text-sm font-semibold text-gray-700 mb-3">
              Método de pago:
            </p>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setMetodoPagoAdmin("efectivo")}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPagoAdmin === "efectivo"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                }`}
              >
                💵 Efectivo
              </button>
              <button
                onClick={() => setMetodoPagoAdmin("transferencia")}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPagoAdmin === "transferencia"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                🏦 Transferencia
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={cobrarOrden}
                disabled={loadingCobrar}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-bold transition-colors"
              >
                {loadingCobrar ? "Procesando..." : "✓ Confirmar Cobro"}
              </button>
              <button
                onClick={() => {
                  setOrdenACobrar(null);
                  setMetodoPagoAdmin("efectivo");
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
    </div>
  );
}
