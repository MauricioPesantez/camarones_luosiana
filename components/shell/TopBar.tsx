"use client";

import {
  itemsTopBar,
  type Acento,
  type EntradaNav,
  type SeccionNav,
} from "@/lib/navegacion";
import type { Usuario } from "@/lib/auth";
import ItemNav from "./ItemNav";
import MenuNav from "./MenuNav";

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
  const { principales, cuenta } = itemsTopBar(secciones);
  const comunes = { activoId, acento, badges, onNavegar };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={onAbrirDrawer}
          aria-label="Abrir menú"
          aria-expanded={drawerAbierto}
          aria-controls="drawer-navegacion"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-gray-700 hover:bg-gray-100 lg:hidden"
        >
          ☰
        </button>

        <h1 className="truncate text-base font-semibold text-gray-900 lg:hidden">
          {titulo}
        </h1>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-1 lg:flex"
        >
          {principales.map((item) =>
            item.hijos?.length ? (
              <MenuNav
                key={item.id}
                etiqueta={item.label}
                emoji={item.emoji}
                items={item.hijos}
                {...comunes}
              />
            ) : (
              <ItemNav
                key={item.id}
                item={item}
                variante="topbar"
                activo={item.id === activoId}
                acento={acento}
                badge={badges[item.id]}
                onNavegar={onNavegar}
              />
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {acciones}
          <div className="hidden lg:block">
            <MenuNav
              etiqueta={usuario.nombre}
              emoji="👤"
              items={cuenta}
              alFinal
              {...comunes}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
