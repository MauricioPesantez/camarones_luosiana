"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import CrearOrden from "@/components/mesero/CrearOrden";
import EditarOrdenModal from "@/components/mesero/EditarOrdenModal";

interface Orden {
  id: string;
  numeroMesa: number;
  mesero: string;
  estado: string;
  total: number;
  tiempoEstimado: number;
  modificada: boolean;
  createdAt: string;
  items: {
    id: string;
    cantidad: number;
    producto: {
      id: string;
      nombre: string;
      categoria: string;
      precio: number;
    };
    precioUnitario: number;
    subtotal: number;
  }[];
}

export default function MeseroPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [vistaActiva, setVistaActiva] = useState<"crear" | "ordenes">("crear");
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [ordenEditar, setOrdenEditar] = useState<Orden | null>(null);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);

  const cargarOrdenes = async () => {
    setLoadingOrdenes(true);
    try {
      const res = await fetch("/api/ordenes?estado=pendiente");
      const data = await res.json();
      // Filtrar solo las órdenes del mesero actual
      const ordenesDelMesero = data.filter(
        (orden: Orden) => orden.mesero === usuario?.nombre
      );
      setOrdenes(ordenesDelMesero);
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
    } finally {
      setLoadingOrdenes(false);
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
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                vistaActiva === "ordenes"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              📋 Mis Órdenes
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
              Mis Órdenes Pendientes
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
              No tienes órdenes pendientes
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ordenes.map((orden) => (
                <div
                  key={orden.id}
                  className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200 hover:border-blue-400 transition-colors"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">
                        Mesa {orden.numeroMesa}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {new Date(orden.createdAt).toLocaleString("es-EC")}
                      </p>
                    </div>
                    {orden.modificada && (
                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                        🔄 Modificada
                      </span>
                    )}
                  </div>

                  {/* Items */}
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-700 text-sm mb-2">
                      Items:
                    </h3>
                    <div className="space-y-1">
                      {orden.items.map((item, idx) => (
                        <div key={idx} className="text-sm text-gray-600">
                          {item.cantidad}x {item.producto.nombre}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="border-t pt-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Total:</span>
                      <span className="text-xl font-bold text-green-600">
                        ${Number(orden.total).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Botón Editar */}
                  <button
                    onClick={() => setOrdenEditar(orden)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    ✏️ Editar Orden
                  </button>
                </div>
              ))}
            </div>
          )}
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
