"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
import CrearOrden from "@/components/mesero/CrearOrden";
import RetiroCaja from "@/components/mesero/RetiroCaja";
import InicioCaja from "@/components/mesero/InicioCaja";
import PorCobrar from "@/components/mesero/PorCobrar";

function MeseroContenido() {
  const { usuario, loading, logout } = useAuth("mesero");
  const params = useSearchParams();
  const vista = params.get("vista");
  const activa =
    vista === "ordenes" || vista === "caja" || vista === "retiro"
      ? vista
      : "crear";
  const [pendientes, setPendientes] = useState(0);
  if (loading) return <div className="p-6 text-slate-900">Cargando…</div>;
  if (!usuario) return null;
  const titulos = {
    crear: "Crear orden",
    ordenes: "Por cobrar",
    caja: "Inicio de caja",
    retiro: "Retiro de caja",
  };
  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo={titulos[activa]}
      activoId={activa}
      badges={{ ordenes: pendientes }}
    >
      {activa === "crear" && <CrearOrden />}
      {activa === "caja" && (
        <InicioCaja
          usuarioId={usuario.id}
          requerida={params.get("requerida") === "1"}
        />
      )}
      {activa === "retiro" && <RetiroCaja usuario={usuario} />}
      {activa === "ordenes" && <PorCobrar onTotal={setPendientes} />}
    </AppShell>
  );
}

export default function MeseroPage() {
  return (
    <Suspense fallback={null}>
      <MeseroContenido />
    </Suspense>
  );
}
