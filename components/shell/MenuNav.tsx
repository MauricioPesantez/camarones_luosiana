"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Acento, EntradaNav } from "@/lib/navegacion";
import ItemNav, { Badge } from "./ItemNav";

interface Props {
  etiqueta: string;
  emoji: string;
  items: EntradaNav[];
  activoId: string;
  acento: Acento;
  badges: Record<string, number>;
  onNavegar: (item: EntradaNav) => void;
  /** El panel se alinea al borde derecho: evita salirse de la pantalla. */
  alFinal?: boolean;
}

/** Grupo desplegable de la topbar de escritorio. */
export default function MenuNav({
  etiqueta,
  emoji,
  items,
  activoId,
  acento,
  badges,
  onNavegar,
  alFinal = false,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idPanel = useId();

  useEffect(() => {
    if (!abierto) return;
    // Safari no da foco a los botones al hacer clic, asi que no basta con blur.
    const alPulsarFuera = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener("pointerdown", alPulsarFuera);
    document.addEventListener("keydown", alPresionar);
    return () => {
      document.removeEventListener("pointerdown", alPulsarFuera);
      document.removeEventListener("keydown", alPresionar);
    };
  }, [abierto]);

  const activo = items.some((item) => item.id === activoId);
  const pendientes = items.reduce(
    (suma, item) => suma + (badges[item.id] ?? 0),
    0,
  );

  return (
    <div
      ref={raiz}
      className="relative"
      onBlur={(evento) => {
        // Al salir con Tab se cierra; un clic interno no cambia de raiz.
        if (
          evento.relatedTarget &&
          !evento.currentTarget.contains(evento.relatedTarget)
        ) {
          setAbierto(false);
        }
      }}
    >
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-controls={idPanel}
        className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
          activo
            ? `${acento.fondo} ${acento.texto}`
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <span aria-hidden="true">{emoji}</span>
        <span className="max-w-40 truncate">{etiqueta}</span>
        {pendientes > 0 && <Badge valor={pendientes} />}
        <span
          aria-hidden="true"
          className={`text-xs transition-transform ${abierto ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      <div
        id={idPanel}
        hidden={!abierto}
        className={`absolute top-full z-10 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-1 shadow-lg ${
          alFinal ? "right-0" : "left-0"
        }`}
      >
        {items.map((item) => (
          <ItemNav
            key={item.id}
            item={item}
            variante="drawer"
            activo={item.id === activoId}
            acento={acento}
            badge={badges[item.id]}
            onNavegar={(elegido) => {
              setAbierto(false);
              onNavegar(elegido);
            }}
          />
        ))}
      </div>
    </div>
  );
}
