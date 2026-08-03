"use client";

import { useEffect, useRef, useState } from "react";
import type { Acento, EntradaNav, SeccionNav } from "@/lib/navegacion";
import type { Usuario } from "@/lib/auth";
import ItemNav from "./ItemNav";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  secciones: SeccionNav[];
  activoId: string;
  acento: Acento;
  badges: Record<string, number>;
  usuario: Usuario;
  onNavegar: (item: EntradaNav) => void;
}

const SELECTOR_FOCUSABLE =
  'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export default function DrawerNav({
  abierto,
  onCerrar,
  secciones,
  activoId,
  acento,
  badges,
  usuario,
  onNavegar,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [expandidos, setExpandidos] = useState<string[]>([]);

  // Abre por defecto el grupo que contiene la vista activa.
  useEffect(() => {
    if (!abierto) return;
    const padre = secciones
      .flatMap((s) => s.items)
      .find((item) => item.hijos?.some((h) => h.id === activoId));
    if (padre) {
      setExpandidos((prev) =>
        prev.includes(padre.id) ? prev : [...prev, padre.id],
      );
    }
  }, [abierto, activoId, secciones]);

  // Bloquea el scroll del fondo mientras el drawer esta abierto.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  // Foco al abrir, ESC para cerrar, Tab atrapado dentro del panel, y al cerrar
  // el foco vuelve a donde estaba (el burger).
  useEffect(() => {
    if (!abierto) return;
    const panel = panelRef.current;
    if (!panel) return;

    const origen = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABLE));

    focusables()[0]?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onCerrar();
        return;
      }
      if (evento.key !== "Tab") return;

      const elementos = focusables();
      if (elementos.length === 0) return;
      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", alPresionar);
    return () => {
      document.removeEventListener("keydown", alPresionar);
      origen?.focus();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const alternarGrupo = (id: string) =>
    setExpandidos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 motion-safe:animate-[fadeIn_150ms_ease-out] md:hidden"
        onClick={onCerrar}
        aria-hidden="true"
      />
      <div
        id="drawer-navegacion"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className="fixed inset-y-0 left-0 z-[51] flex w-[82%] max-w-xs flex-col overflow-y-auto bg-white motion-safe:animate-[slideIn_180ms_ease-out] md:hidden"
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${acento.fondo} ${acento.texto}`}
            aria-hidden="true"
          >
            {iniciales(usuario.nombre)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-gray-900">
              {usuario.nombre}
            </p>
            <p className="text-xs capitalize text-gray-500">{usuario.rol}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar menú"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 px-2 py-3">
          {secciones.map((seccion) => (
            <div key={seccion.titulo} className="mb-3">
              {seccion.items.length > 1 && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {seccion.titulo}
                </p>
              )}
              {seccion.items.map((item) =>
                item.hijos && item.hijos.length > 0 ? (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => alternarGrupo(item.id)}
                      aria-expanded={expandidos.includes(item.id)}
                      aria-controls={`grupo-${item.id}`}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] text-gray-700 hover:bg-gray-100"
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        {item.emoji}
                      </span>
                      {item.label}
                      <span
                        aria-hidden="true"
                        className="ml-auto text-xs text-gray-400"
                      >
                        {expandidos.includes(item.id) ? "▲" : "▼"}
                      </span>
                    </button>
                    {expandidos.includes(item.id) && (
                      <div id={`grupo-${item.id}`}>
                        {item.hijos.map((hijo) => (
                          <ItemNav
                            key={hijo.id}
                            item={hijo}
                            variante="drawer"
                            activo={hijo.id === activoId}
                            acento={acento}
                            badge={badges[hijo.id]}
                            onNavegar={onNavegar}
                            sangria
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <ItemNav
                    key={item.id}
                    item={item}
                    variante="drawer"
                    activo={item.id === activoId}
                    acento={acento}
                    badge={badges[item.id]}
                    onNavegar={onNavegar}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
