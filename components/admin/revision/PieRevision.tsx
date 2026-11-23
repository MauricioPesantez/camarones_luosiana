import type { EstadoGuardado } from "./cola-guardado";
import { boton } from "./Linea";

interface Props {
  estadoGuardado: EstadoGuardado | undefined;
  /** Por qué el servidor no aceptó el último envío. */
  rechazo: string | null;
  errorRecarga: boolean;
  ocupado: boolean;
  /** Lo que impide marcarla revisada; reemplaza al resumen. */
  falta: string | null;
  resumen: string;
  revisada: boolean;
  sinMarcar: number;
  nadaMarcado: boolean;
  onReintentar: () => void;
  onRecargar: () => void;
  onQuitarRevisada: () => void;
  onLoDemas: () => void;
  onAvanzar: () => void;
  enfocar: (id: string) => void;
}

export default function PieRevision({
  estadoGuardado,
  rechazo,
  errorRecarga,
  ocupado,
  falta,
  resumen,
  revisada,
  sinMarcar,
  nadaMarcado,
  onReintentar,
  onRecargar,
  onQuitarRevisada,
  onLoDemas,
  onAvanzar,
  enfocar,
}: Props) {
  return (
    <footer className="border-t border-slate-300 bg-white px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 min-[900px]:px-5 min-[900px]:pb-[calc(10px+env(safe-area-inset-bottom))] min-[900px]:pt-2.5">
      <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-x-3 gap-y-2">
        {(estadoGuardado === "error" || estadoGuardado === "conflicto") && (
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
            <p role="alert" className="font-bold text-red-700">
              {estadoGuardado === "error"
                ? `No se guardó el último cambio.${rechazo ? ` ${rechazo}` : ""}`
                : errorRecarga
                  ? "No se pudo recargar. Intenta de nuevo."
                  : "La orden o su revisión cambió."}
            </p>
            <button
              type="button"
              className={`${boton} min-h-11 px-3.5`}
              aria-disabled={ocupado}
              onClick={() => {
                if (estadoGuardado === "conflicto") return onRecargar();
                onReintentar();
                enfocar("rev-marcar");
              }}
            >
              {estadoGuardado === "error" ? "Reintentar" : "Recargar"}
            </button>
          </div>
        )}
        <div className="min-w-full flex-1 text-[15px] min-[900px]:min-w-[180px]">
          {falta ? (
            <p role="alert" className="font-bold text-red-700">{falta}</p>
          ) : (
            <p className="font-bold">{resumen}</p>
          )}
          <p className="text-sm text-slate-600">
            Se guarda solo. No cambia la orden ni la caja.
            {estadoGuardado === "guardando" && " Guardando…"}
            {estadoGuardado === "guardado" && " Guardado."}
          </p>
        </div>
        <div className="flex w-full gap-2 min-[900px]:w-auto">
          {revisada ? (
            <button
              type="button"
              className={`${boton} min-h-[52px] flex-1 px-2 min-[900px]:whitespace-nowrap min-[900px]:px-3.5`}
              aria-disabled={ocupado}
              onClick={() => {
                onQuitarRevisada();
                enfocar("rev-marcar");
              }}
            >
              Quitar revisada
            </button>
          ) : (
            sinMarcar > 0 && (
              <button
                type="button"
                className={`${boton} min-h-[52px] flex-1 px-2 min-[900px]:whitespace-nowrap min-[900px]:px-3.5`}
                aria-disabled={ocupado}
                onClick={onLoDemas}
              >
                {nadaMarcado ? "Todo está bien" : "Lo demás está bien"}
              </button>
            )
          )}
          <button
            id="rev-marcar"
            type="button"
            aria-disabled={ocupado}
            className="min-h-[52px] flex-1 rounded-[10px] border border-slate-900 bg-slate-900 px-2 font-semibold text-white hover:bg-slate-800 min-[900px]:whitespace-nowrap min-[900px]:px-5"
            onClick={onAvanzar}
          >
            {revisada ? "Siguiente" : "Marcar revisada"}
          </button>
        </div>
      </div>
    </footer>
  );
}
