"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import DetalleOrdenModal from "@/components/admin/DetalleOrdenModal";

interface Orden {
  id: string;
  numeroMesa: number;
  mesero: string;
  estado: string;
  total: number;
  tiempoEstimado: number;
  modificada: boolean;
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
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(null);
  const [fechaFiltro, setFechaFiltro] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (usuario && usuario.rol === "admin") {
      cargarOrdenes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaFiltro, usuario]);

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
    if (orden.estado !== "completada" || !orden.tiempoEstimado) {
      return null; // No aplica para órdenes pendientes o sin tiempo estimado
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

  const ordenesPorEstado = {
    pendiente: ordenes.filter((o) => o.estado === "pendiente").length,
    completada: ordenes.filter((o) => o.estado === "completada").length,
    total: ordenes.length,
  };

  // Calcular estadísticas de tiempo
  const ordenesCompletadas = ordenes.filter((o) => o.estado === "completada");
  const ordenesATiempo = ordenesCompletadas.filter((o) => {
    const estado = calcularEstadoTiempo(o);
    return estado?.aTiempo;
  }).length;
  const ordenesRetrasadas = ordenesCompletadas.length - ordenesATiempo;

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
              className="border rounded-lg px-4 py-2"
            />
            <button
              onClick={cargarOrdenes}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xs text-gray-600 mb-2">Total del Día</h3>
            <p className="text-2xl font-bold text-green-600">
              ${totalDelDia.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xs text-gray-600 mb-2">Total Órdenes</h3>
            <p className="text-2xl font-bold text-blue-600">
              {ordenesPorEstado.total}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xs text-gray-600 mb-2">Completadas</h3>
            <p className="text-2xl font-bold text-green-600">
              {ordenesPorEstado.completada}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xs text-gray-600 mb-2">Pendientes</h3>
            <p className="text-2xl font-bold text-yellow-600">
              {ordenesPorEstado.pendiente}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xs text-gray-600 mb-2">A Tiempo ✓</h3>
            <p className="text-2xl font-bold text-emerald-600">
              {ordenesATiempo}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xs text-gray-600 mb-2">Retrasadas ⚠️</h3>
            <p className="text-2xl font-bold text-red-600">
              {ordenesRetrasadas}
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
                      Mesa
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
                          {new Date(orden.createdAt).toLocaleTimeString("es-EC")}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {orden.numeroMesa}
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
                              orden.estado === "completada"
                                ? "bg-green-100 text-green-800"
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
                                {estadoTiempo.aTiempo ? "✓ A Tiempo" : "⚠️ Retrasada"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {estadoTiempo.tiempoReal} / {estadoTiempo.tiempoEstimado} min
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          ${Number(orden.total).toFixed(2)}
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
    </div>
  );
}
