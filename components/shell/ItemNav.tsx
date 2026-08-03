"use client";

import type { Acento, EntradaNav } from "@/lib/navegacion";

interface Props {
  item: EntradaNav;
  variante: "drawer" | "topbar" | "inferior";
  activo: boolean;
  acento: Acento;
  badge?: number;
  onNavegar: (item: EntradaNav) => void;
  sangria?: boolean;
}

function etiquetaBadge(valor: number): string {
  return `${valor} pendiente${valor === 1 ? "" : "s"}`;
}

function Badge({ valor }: { valor: number }) {
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-bold text-white">
      {valor}
      <span className="sr-only"> {etiquetaBadge(valor)}</span>
    </span>
  );
}

export default function ItemNav({
  item,
  variante,
  activo,
  acento,
  badge,
  onNavegar,
  sangria = false,
}: Props) {
  const conBadge = typeof badge === "number" && badge > 0 ? badge : null;

  if (variante === "inferior") {
    return (
      <button
        type="button"
        onClick={() => onNavegar(item)}
        aria-current={activo ? "page" : undefined}
        className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 ${
          activo ? acento.texto : "text-gray-500"
        }`}
      >
        <span aria-hidden="true" className="text-xl leading-none">
          {item.emoji}
        </span>
        <span className="text-[11px] font-semibold leading-none">
          {item.labelCorto ?? item.label}
        </span>
        {conBadge !== null && (
          <span className="absolute right-[22%] top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-green-600 px-1 text-[11px] font-bold leading-4 text-white">
            {conBadge}
            <span className="sr-only"> {etiquetaBadge(conBadge)}</span>
          </span>
        )}
      </button>
    );
  }

  if (variante === "topbar") {
    return (
      <button
        type="button"
        onClick={() => onNavegar(item)}
        aria-current={activo ? "page" : undefined}
        className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
          activo
            ? `${acento.fondo} ${acento.texto}`
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <span aria-hidden="true">{item.emoji}</span>
        {item.label}
        {conBadge !== null && <Badge valor={conBadge} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavegar(item)}
      aria-current={activo ? "page" : undefined}
      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition-colors ${
        sangria ? "pl-10" : ""
      } ${
        activo
          ? `${acento.fondo} ${acento.texto} font-semibold`
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        {item.emoji}
      </span>
      {item.label}
      {conBadge !== null && <Badge valor={conBadge} />}
    </button>
  );
}
