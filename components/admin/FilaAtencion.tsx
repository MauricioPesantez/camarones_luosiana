import type { ReactNode } from "react";

interface Props {
  icono: string;
  titulo: string;
  detalle: string;
  critico?: boolean;
  children: ReactNode;
}

/** Un pendiente del día: se lee en una línea y se abre para resolverlo. */
export default function FilaAtencion({
  icono,
  titulo,
  detalle,
  critico = false,
  children,
}: Props) {
  return (
    <details
      className={`group rounded-lg border border-l-4 bg-white ${
        critico
          ? "border-red-200 border-l-red-600"
          : "border-slate-200 border-l-amber-500"
      }`}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-xl">
          {icono}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">{titulo}</span>
          <span className="block text-sm text-slate-600">{detalle}</span>
        </span>
        <span
          aria-hidden
          className="text-slate-500 transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-slate-100 px-4 py-3">{children}</div>
    </details>
  );
}
