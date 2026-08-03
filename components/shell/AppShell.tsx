"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
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

const CONSULTA_MOVIL = "(max-width: 767px)";

// El drawer y la barra inferior se sacan del DOM en escritorio, no se ocultan
// solo con CSS: si se ocultaran, redimensionar con el drawer abierto dejaria
// el focus trap activo sobre un panel invisible. En el servidor devuelve false
// y el primer render en cliente lo corrige.
function useEsMovil(): boolean {
  return useSyncExternalStore(
    (alCambiar) => {
      const consulta = window.matchMedia(CONSULTA_MOVIL);
      consulta.addEventListener("change", alCambiar);
      return () => consulta.removeEventListener("change", alCambiar);
    },
    () => window.matchMedia(CONSULTA_MOVIL).matches,
    () => false,
  );
}

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
  // Se resuelve suscribiendose y no en el primer render: `Notification` no
  // existe en el servidor y leerlo directo produce mismatch de hidratacion.
  const [permisoNotificaciones, setPermisoNotificaciones] =
    useState<ContextoNav["permisoNotificaciones"]>("no-soportado");
  const esMovil = useEsMovil();

  // Se suscribe en vez de leer una sola vez: al conceder el permiso desde el
  // propio menu, el item "Activar notificaciones" tiene que desaparecer sin
  // que haga falta recargar. La Permissions API avisa del cambio; si no esta
  // disponible, queda la lectura puntual.
  useEffect(() => {
    if (typeof Notification === "undefined") return;

    let cancelado = false;
    let estado: PermissionStatus | null = null;
    const sincronizar = () => {
      if (!cancelado) setPermisoNotificaciones(Notification.permission);
    };

    const id = requestAnimationFrame(sincronizar);

    navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((resultado) => {
        if (cancelado) return;
        estado = resultado;
        resultado.addEventListener("change", sincronizar);
      })
      .catch(() => undefined);

    return () => {
      cancelado = true;
      cancelAnimationFrame(id);
      estado?.removeEventListener("change", sincronizar);
    };
  }, []);

  // Al pasar a escritorio el drawer se desmonta; se limpia tambien el estado
  // para que volver a movil no lo reabra solo.
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MOVIL);
    const alCambiar = () => {
      if (!consulta.matches) setDrawerAbierto(false);
    };
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  const secciones = useMemo(
    () => resolverNav(usuario.rol, { permisoNotificaciones }),
    [usuario.rol, permisoNotificaciones],
  );
  const inferiores = useMemo(() => itemsBarraInferior(secciones), [secciones]);
  const acento = acentoDeRol(usuario.rol);

  const cerrarDrawer = useCallback(() => setDrawerAbierto(false), []);
  const abrirDrawer = useCallback(() => setDrawerAbierto(true), []);

  const navegar = useCallback(
    (item: EntradaNav) => {
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
    },
    [onLogout, onAccion, router],
  );

  return (
    // El lienzo lo fija el shell: `globals.css` declara un fondo oscuro bajo
    // `prefers-color-scheme: dark` que ninguna pantalla contempla.
    <div className="min-h-screen bg-gray-100">
      <TopBar
        titulo={titulo}
        secciones={secciones}
        activoId={activoId}
        acento={acento}
        badges={badges}
        usuario={usuario}
        acciones={acciones}
        drawerAbierto={drawerAbierto}
        onAbrirDrawer={abrirDrawer}
        onNavegar={navegar}
      />

      {esMovil && (
        <DrawerNav
          abierto={drawerAbierto}
          onCerrar={cerrarDrawer}
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
