"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
import GestionStock from "@/components/admin/GestionStock";
import GestionMenu from "@/components/admin/GestionMenu";

function ProductosContenido() {
  const { usuario, loading: authLoading, logout } = useAuth();
  // La pestaña vive en la URL para que el menú pueda enlazarla directo y no
  // se pierda al recargar.
  const searchParams = useSearchParams();
  const pestana = searchParams.get("tab") === "menu" ? "menu" : "stock";

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario || usuario.rol !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-xl text-red-600">Acceso denegado</div>
      </div>
    );
  }

  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo={pestana === "stock" ? "Stock" : "Menú"}
      activoId={pestana}
    >
      <div className="min-h-screen bg-gray-100">
        {pestana === "stock" ? <GestionStock /> : <GestionMenu />}
      </div>
    </AppShell>
  );
}

export default function ProductosPage() {
  return (
    <Suspense fallback={null}>
      <ProductosContenido />
    </Suspense>
  );
}
