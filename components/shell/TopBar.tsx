"use client";

import type { Acento, EntradaNav, SeccionNav } from "@/lib/navegacion";
import type { Usuario } from "@/lib/auth";
import ItemNav from "./ItemNav";

interface Props {
  titulo: string;
  secciones: SeccionNav[];
  activoId: string;
  acento: Acento;
  badges: Record<string, number>;
  usuario: Usuario;
  acciones?: React.ReactNode;
  drawerAbierto: boolean;
  onAbrirDrawer: () => void;
  onNavegar: (item: EntradaNav) => void;
}

export default function TopBar({
  titulo,
  secciones,
  activoId,
  acento,
  badges,
  usuario,
  acciones,
  drawerAbierto,
  onAbrirDrawer,
  onNavegar,
}: Props) {
  const itemLogout = secciones
    .flatMap((s) => s.items)
    .find((item) => item.id === "logout");

  // En escritorio no hay grupos plegables: los hijos se rinden al mismo nivel.
  const itemsHorizontales = secciones
    .filter((s) => s.titulo !== "Sesión")
    .flatMap((s) => s.items)
    .flatMap((item) => (item.hijos?.length ? item.hijos : [item]))
    .filter((item) => !item.href.startsWith("#"));

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={onAbrirDrawer}
          aria-label="Abrir menú"
          aria-expanded={drawerAbierto}
          aria-controls="drawer-navegacion"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-gray-700 hover:bg-gray-100 md:hidden"
        >
          ☰
        </button>

        <h1 className="truncate text-base font-semibold text-gray-900 md:hidden">
          {titulo}
        </h1>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-1 md:flex"
        >
          {itemsHorizontales.map((item) => (
            <ItemNav
              key={item.id}
              item={item}
              variante="topbar"
              activo={item.id === activoId}
              acento={acento}
              badge={badges[item.id]}
              onNavegar={onNavegar}
            />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {acciones}
          <span className="hidden text-sm text-gray-600 md:inline">
            {usuario.nombre}
          </span>
          {itemLogout && (
            <button
              type="button"
              onClick={() => onNavegar(itemLogout)}
              className="hidden min-h-11 rounded-lg bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600 md:block"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
