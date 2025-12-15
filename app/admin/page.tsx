"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

interface Orden {
  id: string;
  numeroMesa: number;
  mesero: string;
  estado: string;
  total: number;
  createdAt: string;
  items: {
    cantidad: number;
    producto: {
      nombre: string;
    };
    precioUnitario: number;
    subtotal: number;
  }[];
}

export default function AdminPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
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

  const totalDelDia = ordenes.reduce(
    (total, orden) => total + Number(orden.total),
    0,
  );

  const ordenesPorEstado = {
    pendiente: ordenes.filter((o) => o.estado === "pendiente").length,
    completada: ordenes.filter((o) => o.estado === "completada").length,
    total: ordenes.length,
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">
            Panel de Administración
          </h1>
          <div className="flex items-center gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm text-gray-600 mb-2">Total del Día</h3>
            <p className="text-3xl font-bold text-green-600">
              ${totalDelDia.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm text-gray-600 mb-2">Total Órdenes</h3>
            <p className="text-3xl font-bold text-blue-600">
              {ordenesPorEstado.total}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm text-gray-600 mb-2">Completadas</h3>
            <p className="text-3xl font-bold text-green-600">
              {ordenesPorEstado.completada}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm text-gray-600 mb-2">Pendientes</h3>
            <p className="text-3xl font-bold text-yellow-600">
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
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ordenes.map((orden) => (
                    <tr key={orden.id} className="hover:bg-gray-50">
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
                      <td className="px-6 py-4 text-sm font-bold">
                        ${Number(orden.total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
