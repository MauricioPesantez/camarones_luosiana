import { useState } from "react";
import { normalizarNombre } from "@/lib/admin-validaciones";
import type { MarcasRevision } from "@/types/revision";
import { Cantidad, boton, campo, enlace, useEnfocar } from "./Linea";
import type { Catalogo } from "./useColasRevision";

type Faltantes = MarcasRevision["faltantes"];

interface Props {
  faltantes: Faltantes;
  catalogo: Catalogo;
  nombreProducto: (productoId: string) => string;
  onCargarCatalogo: () => void;
  onPoner: (faltantes: Faltantes) => void;
}

const MAX_FALTANTES = 50;
const MAX_CANTIDAD = 99;

/** Productos que faltaron en la orden y el buscador para agregar otro. */
export default function FaltoProducto({
  faltantes,
  catalogo,
  nombreProducto,
  onCargarCatalogo,
  onPoner,
}: Props) {
  const [busqueda, setBusqueda] = useState<string | null>(null);
  const enfocar = useEnfocar();

  const hallados =
    busqueda === null
      ? []
      : catalogo.productos
          .filter(
            (p) =>
              normalizarNombre(p.nombre).includes(normalizarNombre(busqueda)) &&
              !faltantes.some((f) => f.productoId === p.id),
          )
          .slice(0, 8);
  const cerrarBusqueda = () => {
    setBusqueda(null);
    enfocar("rev-falto");
  };

  return (
    <>
      {faltantes.map((faltante) => {
        const nombre = nombreProducto(faltante.productoId);
        return (
          <div key={faltante.productoId} className="border-t border-slate-200 bg-amber-50 first:border-t-0">
            <div className="flex items-center gap-1 pb-1 pl-3 pr-1 pt-3 min-[900px]:pl-4 min-[900px]:pr-3">
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-amber-800 bg-amber-100 text-sm font-bold text-amber-900"
              >
                !
              </span>
              <span className="min-w-0 flex-1 break-words pl-2.5 font-semibold">
                Faltó {faltante.cantidad} × {nombre}
              </span>
              <button
                type="button"
                className={`${enlace} px-2 text-slate-700 hover:text-slate-900`}
                aria-label={`Quitar error: Faltó ${nombre}`}
                onClick={() => {
                  onPoner(faltantes.filter((f) => f !== faltante));
                  enfocar(busqueda === null ? "rev-falto" : "rev-buscar");
                }}
              >
                Quitar error
              </button>
            </div>
            <div
              role="group"
              aria-label={`Cuánto faltó de ${nombre}`}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-2 pb-3.5 pl-[52px] pr-4 text-amber-900 min-[900px]:pl-[58px]"
            >
              <Cantidad
                id={`rev-sumar-${faltante.productoId}`}
                etiqueta="Cantidad"
                nombre={nombre}
                valor={faltante.cantidad}
                onCambiar={(paso) => {
                  const cantidad = faltante.cantidad + paso;
                  if (cantidad < 1 || cantidad > MAX_CANTIDAD) return;
                  onPoner(faltantes.map((f) => (f === faltante ? { ...f, cantidad } : f)));
                }}
              />
            </div>
          </div>
        );
      })}

      {busqueda !== null ? (
        <div className="border-t border-slate-200 px-4 py-3.5">
          <label htmlFor="rev-buscar" className="mb-1.5 block font-semibold">
            ¿Qué producto faltó?
          </label>
          <input
            id="rev-buscar"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Cola"
            autoComplete="off"
            className={`${campo} min-h-12 w-full`}
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {catalogo.estado === "error" ? (
              <>
                <p role="alert" className="text-red-700">No se pudieron cargar los productos.</p>
                <button
                  type="button"
                  className={`${boton} min-h-11 px-3.5`}
                  onClick={() => {
                    onCargarCatalogo();
                    enfocar("rev-buscar");
                  }}
                >
                  Reintentar
                </button>
              </>
            ) : catalogo.estado !== "listo" ? (
              <p role="status" className="text-slate-600">Cargando productos…</p>
            ) : hallados.length === 0 ? (
              <p className="text-slate-600">Ningún producto coincide.</p>
            ) : (
              hallados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${boton} min-h-11 max-w-full break-words px-3.5`}
                  onClick={() => {
                    onPoner([...faltantes, { productoId: p.id, cantidad: 1 }]);
                    setBusqueda(null);
                    enfocar(`rev-sumar-${p.id}`);
                  }}
                >
                  {p.nombre}
                </button>
              ))
            )}
          </div>
          <button type="button" className={`${boton} mt-2.5 min-h-11 px-3.5`} onClick={cerrarBusqueda}>
            Cancelar
          </button>
        </div>
      ) : (
        faltantes.length < MAX_FALTANTES && (
          <button
            id="rev-falto"
            type="button"
            className="min-h-14 w-full border-t border-slate-200 px-4 text-left font-semibold text-blue-700 hover:bg-slate-50 focus-visible:-outline-offset-2!"
            onClick={() => {
              setBusqueda("");
              if (catalogo.estado === "sin_pedir") onCargarCatalogo();
              enfocar("rev-buscar");
            }}
          >
            + Faltó un producto
          </button>
        )
      )}
    </>
  );
}
