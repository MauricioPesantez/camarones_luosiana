"use client";

import { useEffect, useState } from "react";
import CrearOrden from "@/components/mesero/CrearOrden";

interface Orden {
  id: string;
  numeroMesa: number;
  mesero: string;
  estado: string;
  createdAt: string;
  items: any[];
  observaciones?: string;
}

import { useAuth } from "@/lib/auth";

export default function CocinaPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [vistaActiva, setVistaActiva] = useState<"cocina" | "mesero">("cocina");

  useEffect(() => {
    const cargarOrdenes = async () => {
      try {
        const res = await fetch("/api/ordenes?estado=pendiente");
        const data = await res.json();
        setOrdenes(data);
      } catch (error) {
        console.error("Error al cargar órdenes:", error);
      }
    };

    if (vistaActiva === "cocina" && usuario) {
      cargarOrdenes();
      const interval = setInterval(cargarOrdenes, 30000); // Actualizar cada 30 segundos
      return () => clearInterval(interval);
    }
  }, [vistaActiva, usuario]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-white">Cargando...</div>
      </div>
    );
  }

  if (!usuario) return null;

  // Si el usuario es cocinero y está en vista de mesero, mostrar componente de mesero
  if (usuario.rol === "cocina" && vistaActiva === "mesero") {
    return (
      <div>
        {/* Selector de vista */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setVistaActiva("cocina")}
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                🍳 Vista Cocina
              </button>
              <button
                onClick={() => setVistaActiva("mesero")}
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-blue-600 text-white"
              >
                📋 Vista Mesero
              </button>
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
        <CrearOrden />
      </div>
    );
  }

  const cambiarEstado = async (id: string, estado: string) => {
    try {
      await fetch(`/api/ordenes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      // Recargar órdenes después de cambiar estado
      const res = await fetch("/api/ordenes?estado=pendiente");
      const data = await res.json();
      setOrdenes(data);
    } catch (error) {
      console.error("Error al actualizar orden:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Selector de vista solo para cocineros */}
      {usuario.rol === "cocina" && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setVistaActiva("cocina")}
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-blue-600 text-white"
              >
                🍳 Vista Cocina
              </button>
              <button
                onClick={() => setVistaActiva("mesero")}
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                📋 Vista Mesero
              </button>
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
      )}

      <div className="p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Monitor de Cocina</h1>
          {usuario.rol !== "cocina" && (
            <div className="flex items-center gap-4">
              <span className="text-white">
                Usuario: <span className="font-bold">{usuario?.nombre}</span>
              </span>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ordenes.map((orden) => (
            <div key={orden.id} className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Mesa {orden.numeroMesa}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Mesero: {orden.mesero}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(orden.createdAt).toLocaleTimeString("es-EC")}
                  </p>
                </div>
                <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold">
                  {orden.estado}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {orden.observaciones && (
                  <p className="text-sm text-red-600">
                    ⚠️ {orden.observaciones}
                  </p>
                )}
                {orden.items.map((item, idx) => (
                  <div key={idx} className="border-b pb-2">
                    <p className="font-bold">
                      {item.cantidad}x {item.producto.nombre}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => cambiarEstado(orden.id, "completada")}
                className="w-full bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700"
              >
                Marcar como Lista
              </button>
            </div>
          ))}
        </div>

        {ordenes.length === 0 && (
          <div className="text-center text-white text-2xl mt-20">
            No hay órdenes pendientes
          </div>
        )}
      </div>
    </div>
  );
}
