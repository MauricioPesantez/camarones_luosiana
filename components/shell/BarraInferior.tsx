"use client";

import { esItemActivo, type Acento, type EntradaNav } from "@/lib/navegacion";
import ItemNav from "./ItemNav";

interface Props {
  items: EntradaNav[];
  activoId: string;
  acento: Acento;
  badges: Record<string, number>;
  onNavegar: (item: EntradaNav) => void;
}

export default function BarraInferior({
  items,
  activoId,
  acento,
  badges,
  onNavegar,
}: Props) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white md:hidden"
      // El home indicator de iPhone se come el ultimo item sin esto.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => (
        <ItemNav
          key={item.id}
          item={item}
          variante="inferior"
          activo={esItemActivo(item, activoId)}
          acento={acento}
          badge={badges[item.id]}
          onNavegar={onNavegar}
        />
      ))}
    </nav>
  );
}
