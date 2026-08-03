"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Usuario } from "@/lib/auth";
import {
  acentoDeRol,
  itemsBarraInferior,
  resolverNav,
  type ContextoNav,
  type EntradaNav,
} from "@/lib/navegacion";
import TopBar from "./TopBar";
import DrawerNav from "./DrawerNav";
import BarraInferior from "./BarraInferior";

interface Props {
  usuario: Usuario;
  onLogout: () => void;
  titulo: string;
  activoId: string;
  badges?: Record<string, number>;
  acciones?: React.ReactNode;
  onAccion?: (id: string) => void;
  children: React.ReactNode;
}

const SIN_BADGES: Record<string, number> = {};

export default function AppShell({
  usuario,
  onLogout,
  titulo,
  activoId,
  badges = SIN_BADGES,
  acciones,
  onAccion,
  children,
}: Props) {
  const router = useRouter();
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  // Se resuelve en efecto y no en el primer render: `Notification` no existe
  // en el servidor y leerlo directo produce mismatch de hidratacion.
  const [permisoNotificaciones, setPermisoNotificaciones] =
    useState<ContextoNav["permisoNotificaciones"]>("no-soportado");
  // El drawer y la barra inferior se sacan del DOM en escritorio, no se ocultan
  // solo con CSS: si se ocultaran, redimensionar con el drawer abierto dejaria
  // el focus trap activo sobre un panel invisible.
  const [esMovil, setEsMovil] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermisoNotificaciones(Notification.permission);
  }, []);

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 767px)");
    const sincronizar = () => {
      setEsMovil(consulta.matches);
      if (!consulta.matches) setDrawerAbierto(false);
    };
    sincronizar();
    consulta.addEventListener("change", sincronizar);
    return () => consulta.removeEventListener("change", sincronizar);
  }, []);

  const secciones = useMemo(
    () => resolverNav(usuario.rol, { permisoNotificaciones }),
    [usuario.rol, permisoNotificaciones],
  );
  const inferiores = useMemo(() => itemsBarraInferior(secciones), [secciones]);
  const acento = acentoDeRol(usuario.rol);

  const navegar = (item: EntradaNav) => {
    setDrawerAbierto(false);
    if (item.id === "logout") {
      onLogout();
      return;
    }
    if (item.href.startsWith("#")) {
      onAccion?.(item.id);
      return;
    }
    router.push(item.href);
  };

  return (
    <div className="min-h-screen">
      <TopBar
        titulo={titulo}
        secciones={secciones}
        activoId={activoId}
        acento={acento}
        badges={badges}
        usuario={usuario}
        acciones={acciones}
        drawerAbierto={drawerAbierto}
        onAbrirDrawer={() => setDrawerAbierto(true)}
        onNavegar={navegar}
      />

      {esMovil && (
        <DrawerNav
          abierto={drawerAbierto}
          onCerrar={() => setDrawerAbierto(false)}
          secciones={secciones}
          activoId={activoId}
          acento={acento}
          badges={badges}
          usuario={usuario}
          onNavegar={navegar}
        />
      )}

      <main inert={drawerAbierto ? true : undefined} className="pb-20 md:pb-0">
        {children}
      </main>

      {esMovil && (
        <BarraInferior
          items={inferiores}
          activoId={activoId}
          acento={acento}
          badges={badges}
          onNavegar={navegar}
        />
      )}
    </div>
  );
}
