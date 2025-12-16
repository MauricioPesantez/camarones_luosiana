"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

interface Estadisticas {
  resumen: {
    totalModificaciones: number;
    ordenesModificadas: number;
    impactoFinanciero: {
      aumentos: number;
      reducciones: number;
    };
  };
  topItemsEliminados: Array<{ nombre: string; cantidad: number }>;
  topItemsAgregados: Array<{ nombre: string; cantidad: number }>;
  topMeseros: Array<{
    nombre: string;
    total: number;
    agregados: number;
    eliminados: number;
    modificados: number;
  }>;
  graficoDias: Array<{ fecha: string; cantidad: number }>;
  topRazones: Array<{ razon: string; cantidad: number }>;
}

export default function ReportesPage() {
  const { usuario, loading: authLoading } = useAuth();
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [fechaFin, setFechaFin] = useState(
    new Date().toISOString().split("T")[0]
  );

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/reportes/modificaciones?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      );
      const data = await res.json();
      setEstadisticas(data);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usuario && usuario.rol === "admin") {
      cargarEstadisticas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Reportes de Modificaciones
          </h1>
          <p className="text-gray-600">
            Análisis detallado de las modificaciones realizadas a las órdenes
          </p>
        </div>

        {/* Filtros de Fecha */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Fecha Inicio:
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="border rounded-lg px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Fecha Fin:
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="border rounded-lg px-4 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={cargarEstadisticas}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-600">
            Cargando estadísticas...
          </div>
        ) : estadisticas ? (
          <div className="space-y-6">
            {/* Resumen General */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xs text-gray-600 mb-2 uppercase font-semibold">
                  Total Modificaciones
                </h3>
                <p className="text-3xl font-bold text-blue-600">
                  {estadisticas.resumen.totalModificaciones}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xs text-gray-600 mb-2 uppercase font-semibold">
                  Órdenes Modificadas
                </h3>
                <p className="text-3xl font-bold text-purple-600">
                  {estadisticas.resumen.ordenesModificadas}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xs text-gray-600 mb-2 uppercase font-semibold">
                  Aumentos Totales
                </h3>
                <p className="text-3xl font-bold text-green-600">
                  ${estadisticas.resumen.impactoFinanciero.aumentos.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xs text-gray-600 mb-2 uppercase font-semibold">
                  Reducciones Totales
                </h3>
                <p className="text-3xl font-bold text-red-600">
                  $
                  {estadisticas.resumen.impactoFinanciero.reducciones.toFixed(
                    2
                  )}
                </p>
              </div>
            </div>

            {/* Impacto Neto */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Impacto Financiero Neto
              </h3>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Balance Total</p>
                  <p
                    className={`text-5xl font-bold ${
                      estadisticas.resumen.impactoFinanciero.aumentos -
                        estadisticas.resumen.impactoFinanciero.reducciones >=
                      0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {estadisticas.resumen.impactoFinanciero.aumentos -
                      estadisticas.resumen.impactoFinanciero.reducciones >=
                    0
                      ? "+"
                      : "-"}
                    $
                    {Math.abs(
                      estadisticas.resumen.impactoFinanciero.aumentos -
                        estadisticas.resumen.impactoFinanciero.reducciones
                    ).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Gráfico de Modificaciones por Día */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Modificaciones por Día
              </h3>
              <div className="space-y-2">
                {estadisticas.graficoDias.map((dia) => (
                  <div key={dia.fecha} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-28">
                      {new Date(dia.fecha + "T12:00:00").toLocaleDateString(
                        "es-EC",
                        { month: "short", day: "numeric" }
                      )}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                      <div
                        className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{
                          width: `${
                            (dia.cantidad /
                              Math.max(
                                ...estadisticas.graficoDias.map((d) => d.cantidad)
                              )) *
                            100
                          }%`,
                          minWidth: "30px",
                        }}
                      >
                        <span className="text-xs font-bold text-white">
                          {dia.cantidad}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dos columnas: Items Eliminados y Agregados */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Items Más Eliminados */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Items Más Eliminados
                </h3>
                <div className="space-y-2">
                  {estadisticas.topItemsEliminados.length > 0 ? (
                    estadisticas.topItemsEliminados.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                      >
                        <span className="font-medium text-gray-800">
                          {item.nombre}
                        </span>
                        <span className="font-bold text-red-600">
                          {item.cantidad}x
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No hay datos disponibles
                    </p>
                  )}
                </div>
              </div>

              {/* Items Más Agregados */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Items Más Agregados
                </h3>
                <div className="space-y-2">
                  {estadisticas.topItemsAgregados.length > 0 ? (
                    estadisticas.topItemsAgregados.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                      >
                        <span className="font-medium text-gray-800">
                          {item.nombre}
                        </span>
                        <span className="font-bold text-green-600">
                          {item.cantidad}x
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No hay datos disponibles
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Meseros con Más Modificaciones */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Meseros con Más Modificaciones
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Mesero
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Total
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Agregados
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Eliminados
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Modificados
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {estadisticas.topMeseros.length > 0 ? (
                      estadisticas.topMeseros.map((mesero, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {mesero.nombre}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-blue-600">
                            {mesero.total}
                          </td>
                          <td className="px-4 py-3 text-center text-green-600">
                            {mesero.agregados}
                          </td>
                          <td className="px-4 py-3 text-center text-red-600">
                            {mesero.eliminados}
                          </td>
                          <td className="px-4 py-3 text-center text-yellow-600">
                            {mesero.modificados}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          No hay datos disponibles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Razones Más Comunes */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Razones Más Comunes para Modificaciones
              </h3>
              <div className="space-y-2">
                {estadisticas.topRazones.length > 0 ? (
                  estadisticas.topRazones.map((razon, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="flex-1 text-gray-800">
                        {razon.razon}
                      </span>
                      <span className="font-bold text-blue-600">
                        {razon.cantidad}x
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No hay datos disponibles
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No hay datos para mostrar
          </div>
        )}
      </div>
    </div>
  );
}
