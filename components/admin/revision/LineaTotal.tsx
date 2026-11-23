import { aCentavos, aDolares } from "@/types/cobro";
import { obtenerCostoEnvio } from "@/types/orden";
import type { MarcaTotal } from "@/types/revision";
import { dolares, type OrdenAdmin } from "../orden-admin";
import { leerMonto } from "./leer-monto";
import Linea, { campo, opcion } from "./Linea";

/** "Está mal" abierto en el total, con o sin sus datos. */
export type TotalMal = { tipo: "de_mas" | "de_menos" | null; texto: string };

interface Props {
  orden: OrdenAdmin;
  marca: MarcaTotal;
  mal: TotalMal | null;
  onPoner: (mal: TotalMal | null, marca: MarcaTotal) => void;
  onEscribir: () => void;
  enfocar: (id: string) => void;
}

export default function LineaTotal({ orden, marca, mal, onPoner, onEscribir, enfocar }: Props) {
  const envases = aCentavos(orden.recargo);
  const envio = aCentavos(obtenerCostoEnvio(orden));
  const productos = orden.items.reduce((s, item) => s + aCentavos(item.subtotal), 0);
  // OrdenAdmin no trae el descuento: es lo que falta para llegar al total.
  const descuento = productos + envases + envio - aCentavos(orden.total);
  const desglose =
    envases > 0 || envio > 0 || descuento > 0
      ? [
          `Productos ${dolares(aDolares(productos))}`,
          envases > 0 && ` + envase ${dolares(aDolares(envases))}`,
          envio > 0 && ` + envío ${dolares(aDolares(envio))}`,
          descuento > 0 && ` − descuento ${dolares(aDolares(descuento))}`,
        ]
          .filter(Boolean)
          .join("")
      : null;

  const cambiarMal = (nuevo: TotalMal) => {
    const diferencia = leerMonto(nuevo.texto);
    onPoner(
      nuevo,
      nuevo.tipo !== null && diferencia !== null ? { estado: nuevo.tipo, diferencia } : null,
    );
  };

  return (
    <Linea
      id="rev-total"
      titulo="Total cobrado"
      detalles={[desglose]}
      precio={dolares(Number(orden.total))}
      estado={mal ? "mal" : marca ? "bien" : "pendiente"}
      onMarcar={() => onPoner(null, !mal && marca ? null : { estado: "bien" })}
      onMal={() => onPoner(mal ? null : { tipo: null, texto: "" }, null)}
    >
      {mal && (
        <>
          <p className="w-full font-semibold">Se cobró</p>
          {(["de_mas", "de_menos"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              aria-pressed={mal.tipo === tipo}
              className={opcion(mal.tipo === tipo)}
              onClick={() => {
                cambiarMal({ ...mal, tipo });
                enfocar("rev-monto");
              }}
            >
              {tipo === "de_mas" ? "De más" : "De menos"}
            </button>
          ))}
          {mal.tipo && (
            <>
              <label htmlFor="rev-monto">¿Cuánto? $</label>
              <input
                id="rev-monto"
                type="text"
                inputMode="decimal"
                placeholder="Ej. 3.00"
                autoComplete="off"
                value={mal.texto}
                onChange={(e) => {
                  onEscribir();
                  cambiarMal({ ...mal, texto: e.target.value });
                }}
                className={`${campo} min-h-11 w-[120px]`}
              />
            </>
          )}
        </>
      )}
    </Linea>
  );
}
