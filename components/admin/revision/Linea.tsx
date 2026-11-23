import { useEffect, useRef, type ReactNode } from "react";

// Sin alto, relleno ni color de texto: los pone cada uso, porque dos utilidades
// de la misma propiedad no se pisan por orden de escritura.
export const boton =
  "rounded-[10px] border border-slate-500 bg-white font-semibold hover:bg-slate-50";
export const enlace =
  "min-h-11 shrink-0 rounded-[10px] font-semibold underline underline-offset-[3px]";
export const campo =
  "rounded-[10px] border border-slate-500 bg-white px-3 text-slate-900 placeholder:text-slate-600 [color-scheme:light]";
export const caja = "overflow-hidden rounded-[14px] border border-slate-300 bg-white";
export const tituloSeccion = "mb-1.5 text-[15px] font-bold text-slate-700";

export const frase = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Enfoca por id después de dibujar: el destino puede no existir todavía. */
export function useEnfocar(): (id: string) => void {
  const porEnfocar = useRef<string | null>(null);
  useEffect(() => {
    if (!porEnfocar.current) return;
    document.getElementById(porEnfocar.current)?.focus();
    porEnfocar.current = null;
  });
  return (id) => {
    porEnfocar.current = id;
  };
}

export const opcion = (elegida: boolean) =>
  `min-h-11 rounded-[10px] border px-3.5 font-semibold ${
    elegida
      ? "border-amber-900 bg-amber-900 text-white"
      : "border-slate-500 bg-white text-slate-900 hover:bg-slate-50"
  }`;

/** Cantidad con − y +; quien la usa decide los límites. */
export function Cantidad({
  id,
  etiqueta,
  nombre,
  valor,
  onCambiar,
}: {
  id: string;
  etiqueta: string;
  nombre: string;
  valor: number;
  onCambiar: (paso: 1 | -1) => void;
}) {
  const paso = `${boton} min-h-11 w-12 text-[22px] leading-none text-slate-900`;
  return (
    <>
      <span>{etiqueta}</span>
      <button type="button" className={paso} aria-label={`Restar ${nombre}`} onClick={() => onCambiar(-1)}>
        −
      </button>
      <output className="min-w-8 text-center text-xl font-bold tabular-nums">
        {valor}
      </output>
      <button id={id} type="button" className={paso} aria-label={`Sumar ${nombre}`} onClick={() => onCambiar(1)}>
        +
      </button>
    </>
  );
}

/** Una fila de producto, cobro o total: tocarla la marca bien; "Está mal" abre sus opciones. */
export default function Linea({
  id,
  titulo,
  nombre = titulo,
  detalles = [],
  precio,
  estado,
  onMarcar,
  onMal,
  children,
}: {
  id: string;
  titulo: string;
  /** Para el lector de pantalla, si el título solo no distingue la fila. */
  nombre?: string;
  detalles?: (string | null | undefined | false)[];
  precio?: string;
  estado: "pendiente" | "bien" | "mal";
  onMarcar: () => void;
  onMal: () => void;
  children?: ReactNode;
}) {
  const bien = estado === "bien";
  const mal = estado === "mal";
  const caja = bien
    ? "border-emerald-700 bg-emerald-700 text-white"
    : mal
      ? "border-amber-800 bg-amber-100 text-amber-900"
      : "border-slate-500 bg-white";
  return (
    <div className={`border-t border-slate-200 first:border-t-0 ${mal ? "bg-amber-50" : ""}`}>
      <div className="flex items-center gap-1 pr-1 min-[900px]:pr-3">
        <button
          id={id}
          type="button"
          role="checkbox"
          aria-checked={bien}
          onClick={onMarcar}
          className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-3 pl-3 pr-2 text-left hover:bg-slate-100 focus-visible:-outline-offset-2! min-[900px]:gap-3.5 min-[900px]:pl-4"
        >
          <span
            aria-hidden="true"
            className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 font-bold ${caja}`}
          >
            {bien ? "✓" : mal ? "!" : ""}
          </span>
          {/* El precio baja de línea si no cabe: en 320 px no debe partir el nombre. */}
          <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3">
            <span className="min-w-0 max-w-full break-words">
              <span className="font-semibold">{titulo}</span>
              {detalles.filter(Boolean).map((detalle, i) => (
                <span key={i} className="block text-sm text-slate-600">
                  {detalle}
                </span>
              ))}
              {mal && <span className="sr-only">, con error anotado</span>}
            </span>
            {precio && <span className="tabular-nums text-slate-700">{precio}</span>}
          </span>
        </button>
        <button
          type="button"
          className={`${enlace} px-2 text-slate-700 hover:text-slate-900`}
          aria-expanded={mal}
          aria-label={`${mal ? "Quitar error" : "Está mal"}: ${nombre}`}
          onClick={onMal}
        >
          {mal ? "Quitar error" : "Está mal"}
        </button>
      </div>
      {mal && (
        <div
          role="group"
          aria-label={`Error en ${nombre}`}
          className="flex flex-wrap items-center gap-x-2.5 gap-y-2 pb-3.5 pl-[52px] pr-4 text-amber-900 min-[900px]:pl-[58px]"
        >
          {children}
        </div>
      )}
    </div>
  );
}
