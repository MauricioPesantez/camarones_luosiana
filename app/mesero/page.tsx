"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import CrearOrden from "@/components/mesero/CrearOrden";
import EditarOrdenModal from "@/components/mesero/EditarOrdenModal";
import { MetodoPago } from "@/types/orden";

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
    esCortesia?: boolean;
    adminCortesia?: string;
  }[];
}

export default function MeseroPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [vistaActiva, setVistaActiva] = useState<"crear" | "ordenes">("crear");
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [ordenEditar, setOrdenEditar] = useState<Orden | null>(null);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [ordenACobrar, setOrdenACobrar] = useState<Orden | null>(null);
  const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] =
    useState<MetodoPago>("efectivo");
  const [loadingCobrar, setLoadingCobrar] = useState(false);

  const ordenesPorCobrar = ordenes.filter((o) => o.estado === "lista");

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

  const cobrarOrden = async () => {
    if (!ordenACobrar) return;
    setLoadingCobrar(true);
    try {
      const res = await fetch(`/api/ordenes/${ordenACobrar.id}/cobrar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metodoPago: metodoPagoSeleccionado,
          cobradaPor: usuario?.nombre ?? "",
        }),
      });
      if (res.ok) {
        setOrdenACobrar(null);
        setMetodoPagoSeleccionado("efectivo");
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
      cargarOrdenes();
    }
  }, [usuario, vistaActiva]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario) return null;

  return (
    <div>
      {/* Header con navegación */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setVistaActiva("crear")}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                vistaActiva === "crear"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              ➕ Crear Orden
            </button>
            <button
              onClick={() => setVistaActiva("ordenes")}
              className={`relative px-4 py-2 rounded-lg font-semibold transition-colors ${
                vistaActiva === "ordenes"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              📋 Mis Órdenes
              {ordenesPorCobrar.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {ordenesPorCobrar.length}
                </span>
              )}
            </button>
            {usuario.rol === "cocina" && (
              <button
                onClick={() => router.push("/cocina")}
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                🍳 Vista Cocina
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white">
              Usuario: <span className="font-bold">{usuario.nombre}</span>
            </span>
            <button
              onClick={logout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {vistaActiva === "crear" ? (
        <CrearOrden />
      ) : (
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">
              Mis Órdenes Activas
            </h1>
            <button
              onClick={cargarOrdenes}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              🔄 Actualizar
            </button>
          </div>

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
                  const esLocal = !orden.tipoOrden || orden.tipoOrden === "local";
                  const estadosListos = ["lista"];
                  const puedeCobrarse = esLocal
                    ? estadosListos.includes(orden.estado)
                    : !orden.cobrada && orden.estado !== "cancelada";
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
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {orden.estado === "lista"
                              ? "✅ Lista"
                              : orden.estado === "en_preparacion"
                                ? "🍳 En preparación"
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
                                <span className="text-base leading-none">🎁</span>
                                <span className="text-sm font-semibold text-amber-900 flex-1">
                                  {item.cantidad}x {item.producto.nombre}
                                </span>
                                <span className="text-xs font-bold text-amber-600 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  CORTESÍA
                                </span>
                              </div>
                            ) : (
                              <div key={idx} className="text-sm text-gray-600">
                                {item.cantidad}x {item.producto.nombre}
                              </div>
                            )
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
                        {puedeCobrarse && (
                          <button
                            onClick={() => {
                              setOrdenACobrar(orden);
                              setMetodoPagoSeleccionado("efectivo");
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                          >
                            💵 Cobrar Orden
                          </button>
                        )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-gray-800">
              💵 Cobrar Orden
            </h3>
            <p className="text-gray-600 mb-1">
              {!ordenACobrar.tipoOrden || ordenACobrar.tipoOrden === "local"
                ? `Mesa ${ordenACobrar.numeroMesa}`
                : ordenACobrar.nombreCliente}
            </p>
            <p className="text-2xl font-bold text-green-600 mb-5">
              ${Number(ordenACobrar.total).toFixed(2)}
            </p>

            <p className="text-sm font-semibold text-gray-700 mb-3">
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
                  setMetodoPagoSeleccionado("efectivo");
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
    </div>
  );
}
