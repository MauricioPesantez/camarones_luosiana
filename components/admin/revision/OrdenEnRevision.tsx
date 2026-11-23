"use client";

import { useState, type ReactNode } from "react";
import { abrirComprobanteFirmado } from "@/lib/comprobante-cliente";
import { aCentavos, aDolares } from "@/types/cobro";
import { obtenerEtiquetaNivelPicante } from "@/types/orden";
import {
  llevaCobro,
  metodoRegistrado,
  pendientes,
  type ErrorAnterior,
  type MarcaProducto,
  type MarcaTotal,
  type MarcasRevision,
} from "@/types/revision";
import { dolares, horaCorta, tituloOrden, type OrdenAdmin } from "../orden-admin";
import type { EstadoGuardado } from "./cola-guardado";
import FaltoProducto from "./FaltoProducto";
import Linea, { Cantidad, boton, caja, enlace, frase, opcion, tituloSeccion, useEnfocar } from "./Linea";
import LineaTotal, { type TotalMal } from "./LineaTotal";
import PieRevision from "./PieRevision";
import type { Catalogo } from "./useColasRevision";

interface Props {
  orden: OrdenAdmin;
  marcas: MarcasRevision;
  revisada: boolean;
  /** Qué cambió en la orden desde que se marcó. */
  cambios: string[];
  /** Errores anotados antes de ese cambio. */
  anteriores: ErrorAnterior[];
  errores: number;
  estadoGuardado: EstadoGuardado | undefined;
  /** Por qué el servidor no aceptó el último envío. */
  rechazo: string | null;
  errorRecarga: boolean;
  /** Se está confirmando la revisión o recargando: no se puede marcar nada. */
  ocupado: boolean;
  catalogo: Catalogo;
  nombreProducto: (productoId: string) => string;
  onCargarCatalogo: () => void;
  onCambiar: (marcas: MarcasRevision) => void;
  /** "Marcar revisada" con todo completo, o "Siguiente" si ya lo está. */
  onAvanzar: () => void;
  onQuitarRevisada: () => void;
  onReintentar: () => void;
  onRecargar: () => void;
  aviso: ReactNode;
}

const METODOS = { efectivo: "Efectivo", transferencia: "Transferencia", mixto: "Mixto" } as const;
const TIPOS: Record<string, string> = { para_llevar: "Para llevar", domicilio: "Domicilio" };
const MAX_CANTIDAD = 99;

export default function OrdenEnRevision({
  orden,
  marcas,
  revisada,
  cambios,
  anteriores,
  errores,
  estadoGuardado,
  rechazo,
  errorRecarga,
  ocupado,
  catalogo,
  nombreProducto,
  onCargarCatalogo,
  onCambiar,
  onAvanzar,
  onQuitarRevisada,
  onReintentar,
  onRecargar,
  aviso,
}: Props) {
  // "Está mal" ya abierto pero sin sus datos: la marca guardada sigue en null.
  const [cobroMal, setCobroMal] = useState(marcas.cobro !== null && marcas.cobro !== "bien");
  const [totalMal, setTotalMal] = useState<TotalMal | null>(() =>
    marcas.total && marcas.total.estado !== "bien"
      ? { tipo: marcas.total.estado, texto: marcas.total.diferencia.toFixed(2) }
      : null,
  );
  const [falta, setFalta] = useState<{ texto: string } | null>(null);

  const enfocar = useEnfocar();

  const conCobro = llevaCobro(orden);
  const metodo = metodoRegistrado(orden);
  const pagos = orden.pagos ?? [];
  const pagadoCon = (m: string) =>
    dolares(aDolares(pagos.filter((p) => p.metodoPago === m).reduce((s, p) => s + aCentavos(p.monto), 0)));
  const comprobantes = pagos.filter(
    (p) => p.metodoPago === "transferencia" && p.comprobanteTransferenciaKey,
  );

  const abiertos =
    (cobroMal && marcas.cobro === null ? 1 : 0) + (totalMal && marcas.total === null ? 1 : 0);
  const sinMarcar = pendientes(orden, marcas).cuantos - abiertos;
  const nadaMarcado =
    sinMarcar === orden.items.length + (conCobro ? 1 : 0) + 1 && marcas.faltantes.length === 0;
  const erroresVistos = errores + abiertos;

  const conservados = anteriores.filter((e) => !marcas.quitados?.includes(e.clave));

  const marcaDe = (itemId: string) => marcas.productos.find((p) => p.itemId === itemId);
  const marcarProducto = (itemId: string, marca: MarcaProducto | null) =>
    onCambiar({
      ...marcas,
      productos: [
        ...marcas.productos.filter((p) => p.itemId !== itemId),
        ...(marca ? [marca] : []),
      ],
    });
  const pasarCantidad = (item: OrdenAdmin["items"][number], real: number, paso: 1 | -1) => {
    let nueva = real + paso;
    if (nueva === item.cantidad) nueva += paso;
    if (nueva < 0 || nueva > MAX_CANTIDAD) return;
    marcarProducto(item.id, { itemId: item.id, estado: "mal", cantidadReal: nueva });
  };

  const alternarCobroMal = () => {
    setCobroMal(!cobroMal);
    if (marcas.cobro !== null) onCambiar({ ...marcas, cobro: null });
  };
  const marcarCobroBien = () => {
    setCobroMal(false);
    onCambiar({ ...marcas, cobro: !cobroMal && marcas.cobro === "bien" ? null : "bien" });
  };

  const ponerTotal = (mal: TotalMal | null, total: MarcaTotal) => {
    setTotalMal(mal);
    if (total !== null || marcas.total !== null) onCambiar({ ...marcas, total });
  };

  const marcarLoDemas = () => {
    onCambiar({
      ...marcas,
      productos: [
        ...marcas.productos,
        ...orden.items
          .filter((item) => !marcaDe(item.id))
          .map((item) => ({ itemId: item.id, estado: "bien" as const })),
      ],
      cobro: conCobro && !cobroMal ? (marcas.cobro ?? "bien") : marcas.cobro,
      total: totalMal ? marcas.total : (marcas.total ?? { estado: "bien" }),
    });
    enfocar("rev-marcar");
  };

  /** Lo primero que impide marcarla revisada: qué decir y qué enfocar. */
  const primeraFalta = (): [string, string] | null => {
    const item = orden.items.find((i) => !marcaDe(i.id));
    if (item) return ["Marca lo que falta", `rev-item-${item.id}`];
    if (conCobro && marcas.cobro === null)
      return [cobroMal ? "Elige cómo fue el cobro" : "Marca lo que falta", "rev-cobro"];
    if (marcas.total !== null) return null;
    if (!totalMal) return ["Marca lo que falta", "rev-total"];
    if (!totalMal.tipo) return ["Elige si se cobró de más o de menos", "rev-total"];
    return ["Escribe cuánto se cobró de más o de menos", "rev-monto"];
  };
  const avanzar = () => {
    const pendiente = revisada ? null : primeraFalta();
    if (!pendiente) return onAvanzar();
    setFalta({ texto: pendiente[0] });
    enfocar(pendiente[1]);
  };

  const subtitulo = [
    TIPOS[orden.tipoOrden],
    horaCorta(orden.createdAt),
    `Creó ${orden.creadorNombre || orden.mesero}`,
    orden.empleadoId
      ? `A cuenta de ${orden.empleadoNombre}`
      : !conCobro
        ? null
        : !metodo
          ? "Sin cobrar"
          : orden.cobradaPor && `Cobró ${orden.cobradaPor}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const resumen = revisada
    ? erroresVistos
      ? `Revisada, ${frase(erroresVistos, "error", "errores")}`
      : "Revisada, todo bien"
    : sinMarcar > 0
      ? sinMarcar === 1
        ? "Falta 1 por marcar"
        : `Faltan ${sinMarcar} por marcar`
      : erroresVistos
        ? frase(erroresVistos, "error anotado", "errores anotados")
        : "Todo bien";

  return (
    // Cualquier toque borra el aviso de lo que falta; "Marcar revisada" lo vuelve a poner.
    <div className="flex min-h-0 flex-1 flex-col" onClickCapture={() => setFalta(null)}>
      <div inert={ocupado} className="flex-1 overflow-y-auto px-3 py-3.5 min-[900px]:p-5">
        <div className="mx-auto max-w-[720px]">
          <div className="flex items-baseline justify-between gap-3 text-[21px] font-bold min-[900px]:text-2xl">
            <h2 id="rev-titulo" tabIndex={-1} className="min-w-0 break-words outline-none!">
              #{orden.numeroDiario ?? orden.id.slice(-6)} · {tituloOrden(orden)}
            </h2>
            <span className="tabular-nums">{dolares(Number(orden.total))}</span>
          </div>
          <p className="mt-0.5 text-[15px] text-slate-600">{subtitulo}</p>
          {orden.observaciones && (
            <p className="mt-1 break-words text-[15px] text-slate-700">
              Observaciones: {orden.observaciones}
            </p>
          )}
          {cambios.length > 0 && (
            <p className="mt-3 break-words rounded-[10px] bg-amber-100 px-3.5 py-2.5 text-amber-900">
              Cambió después de marcarla: {cambios.join(", ")}.
              {sinMarcar > 0 && " Vuelve a marcar lo que falta."}
            </p>
          )}

          {conservados.length > 0 && (
            <section aria-labelledby="rev-h-anteriores" className="mt-[22px]">
              <h3 id="rev-h-anteriores" className={tituloSeccion}>Errores anteriores</h3>
              <p className="mb-2 text-[15px] text-slate-600">
                Se anotaron antes de que la orden cambiara. Se conservan en la bitácora al marcarla
                revisada.
              </p>
              <ul className={caja}>
                {conservados.map((error) => (
                  <li
                    key={error.clave}
                    className="flex items-center gap-1 border-t border-slate-200 bg-amber-50 py-1 pl-4 pr-1 text-amber-900 first:border-t-0 min-[900px]:pr-3"
                  >
                    <span className="min-w-0 flex-1 break-words font-semibold">{error.texto}</span>
                    <button
                      type="button"
                      className={`${enlace} px-2 text-slate-700 hover:text-slate-900`}
                      aria-label={`Quitar error: ${error.texto}`}
                      onClick={() => {
                        onCambiar({ ...marcas, quitados: [...(marcas.quitados ?? []), error.clave] });
                        enfocar("rev-titulo");
                      }}
                    >
                      Quitar error
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="rev-h-productos" className="mt-[22px]">
            <h3 id="rev-h-productos" className={tituloSeccion}>Productos</h3>
            <div className={caja}>
              {orden.items.map((item) => {
                const marca = marcaDe(item.id);
                const producto = item.nombreProducto ?? item.producto.nombre;
                const picante =
                  item.nivelPicante && obtenerEtiquetaNivelPicante(item.nivelPicante);
                // Dos filas del mismo producto se distinguen por esto.
                const conSeñas = [producto, picante, item.observaciones].filter(Boolean).join(", ");
                return (
                  <Linea
                    key={item.id}
                    id={`rev-item-${item.id}`}
                    titulo={`${item.cantidad} × ${producto}`}
                    nombre={`${item.cantidad} × ${conSeñas}`}
                    detalles={[
                      picante,
                      item.observaciones,
                      item.esCortesia && "Cortesía",
                    ]}
                    precio={dolares(Number(item.subtotal))}
                    estado={marca?.estado ?? "pendiente"}
                    onMarcar={() =>
                      marcarProducto(
                        item.id,
                        marca?.estado === "bien" ? null : { itemId: item.id, estado: "bien" },
                      )
                    }
                    onMal={() =>
                      marcarProducto(
                        item.id,
                        marca?.estado === "mal"
                          ? null
                          : {
                              itemId: item.id,
                              estado: "mal",
                              cantidadReal: Math.min(MAX_CANTIDAD, item.cantidad - 1),
                            },
                      )
                    }
                  >
                    {marca?.estado === "mal" && (
                      <>
                        <p className="w-full font-semibold">
                          {marca.cantidadReal === 0
                            ? "No iba en la orden"
                            : `Registrado ${item.cantidad}, en realidad ${marca.cantidadReal}`}
                        </p>
                        <Cantidad
                          id={`rev-cantidad-${item.id}`}
                          etiqueta="Cantidad real"
                          nombre={conSeñas}
                          valor={marca.cantidadReal}
                          onCambiar={(paso) => pasarCantidad(item, marca.cantidadReal, paso)}
                        />
                      </>
                    )}
                  </Linea>
                );
              })}

              <FaltoProducto
                faltantes={marcas.faltantes}
                catalogo={catalogo}
                nombreProducto={nombreProducto}
                onCargarCatalogo={onCargarCatalogo}
                onPoner={(faltantes) => onCambiar({ ...marcas, faltantes })}
              />
            </div>
          </section>

          {conCobro && (
            <section aria-labelledby="rev-h-cobro" className="mt-[22px]">
              <h3 id="rev-h-cobro" className={tituloSeccion}>Cobro</h3>
              <div className={caja}>
                <Linea
                  id="rev-cobro"
                  titulo={metodo ? METODOS[metodo] : "Está por cobrar"}
                  detalles={[
                    metodo === "mixto" &&
                      `Efectivo ${pagadoCon("efectivo")} + transferencia ${pagadoCon("transferencia")}`,
                  ]}
                  precio={
                    metodo
                      ? dolares(aDolares(pagos.reduce((s, p) => s + aCentavos(p.monto), 0)))
                      : undefined
                  }
                  estado={cobroMal ? "mal" : marcas.cobro === "bien" ? "bien" : "pendiente"}
                  onMarcar={marcarCobroBien}
                  onMal={alternarCobroMal}
                >
                  <p className="w-full font-semibold">
                    {metodo ? "En realidad fue" : "Sí se cobró, fue"}
                  </p>
                  {(Object.keys(METODOS) as (keyof typeof METODOS)[])
                    .filter((m) => m !== metodo)
                    .map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={marcas.cobro === m}
                        className={opcion(marcas.cobro === m)}
                        onClick={() => onCambiar({ ...marcas, cobro: m })}
                      >
                        {METODOS[m]}
                      </button>
                    ))}
                </Linea>
              </div>
              {comprobantes.map((pago) => (
                <button
                  key={pago.id}
                  type="button"
                  className={`${boton} mr-2 mt-2 min-h-11 px-3.5`}
                  onClick={() => void abrirComprobanteFirmado(orden.id, pago.id)}
                >
                  Ver comprobante{comprobantes.length > 1 && ` de ${dolares(pago.monto)}`}
                </button>
              ))}
            </section>
          )}

          <section aria-labelledby="rev-h-total" className="mt-[22px]">
            <h3 id="rev-h-total" className={tituloSeccion}>Total</h3>
            <div className={caja}>
              <LineaTotal
                orden={orden}
                marca={marcas.total}
                mal={totalMal}
                onPoner={ponerTotal}
                onEscribir={() => setFalta(null)}
                enfocar={enfocar}
              />
            </div>
          </section>
        </div>
      </div>

      {aviso}

      <PieRevision
        estadoGuardado={estadoGuardado}
        rechazo={rechazo}
        errorRecarga={errorRecarga}
        ocupado={ocupado}
        falta={falta?.texto ?? null}
        resumen={resumen}
        revisada={revisada}
        sinMarcar={sinMarcar}
        nadaMarcado={nadaMarcado}
        onReintentar={onReintentar}
        onRecargar={onRecargar}
        onQuitarRevisada={onQuitarRevisada}
        onLoDemas={marcarLoDemas}
        onAvanzar={avanzar}
        enfocar={enfocar}
      />
    </div>
  );
}
