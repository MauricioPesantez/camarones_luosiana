"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import CrearOrden from "@/components/mesero/CrearOrden";

export default function MeseroPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [vistaActiva, setVistaActiva] = useState<"mesero" | "cocina">("mesero");

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario) return null;

  // Si el usuario es cocinero y quiere ir a vista cocina, redirigir
  if (usuario.rol === "cocina" && vistaActiva === "cocina") {
    router.push("/cocina");
    return null;
  }

  return (
    <div>
      {/* Selector de vista solo para cocineros */}
      {usuario.rol === "cocina" && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/cocina")}
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
      )}
      <CrearOrden />
    </div>
  );
}
