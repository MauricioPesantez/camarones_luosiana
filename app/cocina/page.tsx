"use client";

import { useEffect, useState } from "react";
import CrearOrden from "@/components/mesero/CrearOrden";
import OrdenCard from "@/components/cocina/OrdenCard";
import EditarOrdenModal from "@/components/mesero/EditarOrdenModal";
import { useAuth } from "@/lib/auth";

interface Producto {
  nombre: string;
  categoria: string;
}

interface Item {
  cantidad: number;
  producto: Producto;
  observaciones?: string;
}

interface Orden {
  id: string;
  numeroMesa: number;
  mesero: string;
  estado: string;
  total: number;
  createdAt: string;
  tiempoEstimado: number;
  items: Item[];
  observaciones?: string;
  modificada?: boolean;
  sinStock?: boolean;
}

export default function CocinaPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [vistaActiva, setVistaActiva] = useState<"cocina" | "mesero">("cocina");
  const [ordenEditar, setOrdenEditar] = useState<Orden | null>(null);

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
            <OrdenCard
              key={orden.id}
              orden={orden}
              onMarcarLista={(id) => cambiarEstado(id, "completada")}
              onEditarOrden={usuario.rol === "cocina" ? (orden) => setOrdenEditar(orden as any) : undefined}
            />
          ))}
        </div>

        {ordenes.length === 0 && (
          <div className="text-center text-white text-2xl mt-20">
            No hay órdenes pendientes
          </div>
        )}

        {/* Modal de edición usando el componente EditarOrdenModal */}
        {ordenEditar && usuario && (
          <EditarOrdenModal
            orden={ordenEditar as any}
            usuario={usuario}
            onClose={() => setOrdenEditar(null)}
            onSuccess={() => {
              setOrdenEditar(null);
              // Recargar órdenes
              fetch("/api/ordenes?estado=pendiente")
                .then((res) => res.json())
                .then((data) => setOrdenes(data))
                .catch((error) => console.error("Error al cargar órdenes:", error));
            }}
          />
        )}
      </div>
    </div>
  );
}
