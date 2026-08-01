"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import GestionStock from "@/components/admin/GestionStock";

type Pestana = "stock" | "menu";

export default function ProductosPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [pestana, setPestana] = useState<Pestana>("stock");

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

  const claseTab = (valor: Pestana) =>
    `flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-colors ${
      pestana === valor
        ? "bg-blue-500 text-white"
        : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-800 leading-tight">
              Productos
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              Inventario y catálogo del menú
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => (window.location.href = "/admin")}
              className="px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 whitespace-nowrap"
            >
              ← Admin
            </button>
            <button
              onClick={logout}
              className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 whitespace-nowrap"
            >
              Salir
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-3 flex gap-2 bg-gray-50 p-1 rounded-xl">
          <button onClick={() => setPestana("stock")} className={claseTab("stock")}>
            📦 Stock
          </button>
          <button onClick={() => setPestana("menu")} className={claseTab("menu")}>
            🍽️ Menú
          </button>
        </div>
      </div>

      {pestana === "stock" ? <GestionStock /> : null}
    </div>
  );
}
