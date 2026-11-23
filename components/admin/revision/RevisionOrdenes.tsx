"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  construirDetalle,
  erroresDe,
  pendientes,
  sePuedeRevisar,
  type MarcasRevision,
  type RevisionGuardada,
} from "@/types/revision";
import { dolares, tituloOrden, type OrdenAdmin } from "../orden-admin";
import { boton, enlace, frase } from "./Linea";
import OrdenEnRevision from "./OrdenEnRevision";
import { borradorInicial, type Borrador, type ColasRevision } from "./useColasRevision";

interface Props {
  fecha: string;
  ordenes: OrdenAdmin[];
  revisiones: RevisionGuardada[];
  ordenInicial: string | null;
  colas: ColasRevision;
  /** Rechaza si no se pudo recargar. */
  onRecargar: () => Promise<void>;
  onSalir: () => void;
}

/** Cuánto puede tardar un guardado normal antes de avisar al salir. */
const ESPERA_SALIR = 1000;

const FILTROS = [
  { id: "todas", etiqueta: "Todas" },
  { id: "sin", etiqueta: "Sin revisar" },
  { id: "con", etiqueta: "Con errores" },
] as const;

const contarMarcados = ({ productos, faltantes, cobro, total }: MarcasRevision) =>
  productos.filter((p) => p.estado === "mal").length +
  faltantes.length +
  (cobro !== null && cobro !== "bien" ? 1 : 0) +
  (total !== null && total.estado !== "bien" ? 1 : 0);

/** Los mismos que guardará el servidor; para contar no hace falta el nombre del faltante. */
const contarErrores = (orden: OrdenAdmin, { marcas, anteriores }: Borrador) => {
  const catalogo = new Map(
    marcas.faltantes.map((f) => [f.productoId, { nombre: f.productoId, precio: 0 }]),
  );
  const construido = construirDetalle(orden, marcas, catalogo, {
    faltantes: [],
    itemsVistos: [],
    anteriores,
  });
  // Sin guardar y con la orden ya distinta, las marcas pueden no encajar en ella.
  return construido.ok
    ? erroresDe(construido.detalle).length
    : contarMarcados(marcas) +
        anteriores.filter((e) => !marcas.quitados?.includes(e.clave)).length;
};

export default function RevisionOrdenes({
  fecha,
  ordenes,
  revisiones,
  ordenInicial,
  colas,
  onRecargar,
  onSalir,
}: Props) {
  const router = useRouter();
  const { guardados } = colas.estado;

  const lista = ordenes
    .filter(sePuedeRevisar)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const revisionDe = (id: string) => revisiones.find((r) => r.ordenId === id) ?? null;
  // Sin argumento, lo que está dibujado; después de un await, lo que hay ahora.
  const borradorDe = (orden: OrdenAdmin, ahora = colas.estado): Borrador =>
    ahora.borradores[orden.id] ?? borradorInicial(orden, revisionDe(orden.id));
  const noGuardada = (id: string, ahora = colas.estado) =>
    ahora.guardados[id] === "error" || ahora.guardados[id] === "conflicto";
  const estaRevisada = (orden: OrdenAdmin, ahora = colas.estado) =>
    borradorDe(orden, ahora).revisada && !noGuardada(orden.id, ahora);

  const [actualId, setActualId] = useState<string | null>(
    () =>
      (
        lista.find((o) => o.id === ordenInicial) ??
        lista.find((o) => !estaRevisada(o)) ??
        lista[0]
      )?.id ?? null,
  );
  // Cambia cada vez que se pide ver una orden: ahí se enfoca el título.
  const [visita, setVisita] = useState(0);
  const [recargas, setRecargas] = useState(0);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todas");
  const [verLista, setVerLista] = useState(false);
  const [fin, setFin] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [errorRecarga, setErrorRecarga] = useState(false);
  const [aviso, setAviso] = useState<{ ordenId: string; texto: string; cambios: string[] } | null>(
    null,
  );
  const [saliendo, setSaliendo] = useState(false);
  const salida = useRef<(() => void) | null>(null);
  const [focoPrevio] = useState(() => document.activeElement);

  const filas = lista.map((orden) => {
    const borrador = borradorDe(orden);
    return {
      orden,
      revisada: estaRevisada(orden),
      cambio: borrador.eraRevisada && borrador.cambios.length > 0,
      errores: contarErrores(orden, borrador),
    };
  });
  const revisadas = filas.filter((f) => f.revisada);
  const conErrores = revisadas.filter((f) => f.errores > 0);
  const porFiltro = {
    todas: filas,
    sin: filas.filter((f) => !f.revisada),
    con: conErrores,
  };
  const actual = lista.find((o) => o.id === actualId) ?? lista[0];
  const sinGuardar = lista
    .map((o) => o.id)
    .filter((id) => guardados[id] && guardados[id] !== "guardado");

  const titulo = `Revisión del ${new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T12:00:00Z`))}`;

  useEffect(() => {
    document.getElementById("rev-titulo")?.focus({ preventScroll: true });
  }, [visita, fin]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      // Con "Atrás" a media salida ya no hay a dónde llevarlo.
      salida.current = null;
      if (focoPrevio instanceof HTMLElement) focoPrevio.focus({ preventScroll: true });
    };
  }, [focoPrevio]);

  const cancelarSalida = () => {
    salida.current = null;
    setSaliendo(false);
  };
  const seguirRevisando = () => {
    cancelarSalida();
    // El título tiene que estar a la vista para recibir el foco.
    setVerLista(false);
    setVisita((n) => n + 1);
  };

  const poner = (orden: OrdenAdmin, borrador: Borrador, revisada = borrador.revisada) => {
    setAviso(null);
    cancelarSalida();
    colas.poner(orden, revisionDe(orden.id)?.version ?? 0, borrador, revisada);
  };

  const cambiar = (orden: OrdenAdmin, marcas: MarcasRevision) => {
    if (ocupado) return;
    const borrador = borradorDe(orden);
    const revisada = borrador.revisada && pendientes(orden, marcas).cuantos === 0;
    poner(orden, { ...borrador, marcas, revisada });
  };

  const abrir = (id: string) => {
    if (ocupado) return;
    setActualId(id);
    setFin(false);
    setVerLista(false);
    setErrorRecarga(false);
    setVisita((n) => n + 1);
  };

  const avanzar = async (orden: OrdenAdmin) => {
    if (ocupado) return;
    setOcupado(true);
    const borrador = borradorDe(orden);
    // Solo el servidor la deja revisada: si falla, la orden sigue sin revisar.
    if (!borrador.revisada) poner(orden, borrador, true);
    colas.reintentar(orden.id);
    const guardada = await colas.vaciar([orden.id]);
    setOcupado(false);
    if (!guardada) return;

    if (!borrador.revisada) {
      setAviso({
        ordenId: orden.id,
        texto: `Orden #${orden.numeroDiario ?? orden.id.slice(-6)} revisada`,
        cambios: borrador.cambios,
      });
    }
    const i = lista.findIndex((o) => o.id === orden.id);
    const ahora = colas.leer();
    const siguiente = [...lista.slice(i + 1), ...lista.slice(0, i)].find(
      (o) => !estaRevisada(o, ahora),
    );
    if (siguiente) abrir(siguiente.id);
    else setFin(true);
  };

  const deshacer = () => {
    const orden = lista.find((o) => o.id === aviso?.ordenId);
    if (ocupado || !aviso || !orden) return;
    poner(orden, { ...borradorDe(orden), revisada: false, cambios: aviso.cambios });
    abrir(orden.id);
  };

  const recargar = async (orden: OrdenAdmin) => {
    if (ocupado) return;
    setOcupado(true);
    setErrorRecarga(false);
    // Con todo lo demás ya guardado, los datos nuevos lo incluyen.
    const ids = Object.keys(colas.leer().guardados);
    await colas.vaciar(ids);
    try {
      await onRecargar();
      const ahora = colas.leer().guardados;
      colas.olvidar(ids.filter((id) => id === orden.id || ahora[id] === "guardado"));
      setRecargas((n) => n + 1);
      setVisita((n) => n + 1);
    } catch {
      setErrorRecarga(true);
    } finally {
      setOcupado(false);
    }
  };

  const salir = async (destino: () => void) => {
    if (sinGuardar.length === 0) return destino();
    salida.current = destino;
    const reloj = setTimeout(() => {
      if (salida.current === destino) setSaliendo(true);
    }, ESPERA_SALIR);
    const guardado = await colas.vaciar(sinGuardar);
    clearTimeout(reloj);
    if (salida.current !== destino) return;
    if (guardado) destino();
    else setSaliendo(true);
  };

  const nombreProducto = (orden: OrdenAdmin) => (id: string) =>
    colas.catalogo.productos.find((p) => p.id === id)?.nombre ??
    revisionDe(orden.id)?.detalle.faltantes.find((f) => f.productoId === id)?.nombre ??
    "Producto";

  const franja = aviso && (
    <div className="flex items-center justify-center gap-2 border-t border-emerald-200 bg-emerald-50 px-5 py-1 text-emerald-900">
      <span>
        <span aria-hidden="true">✓ </span>
        {aviso.texto}
      </span>
      <button type="button" data-conserva-aviso className={`${enlace} px-2 text-emerald-900`} onClick={deshacer}>
        Deshacer
      </button>
    </div>
  );

  const textoFila = ({ orden, revisada, cambio, errores }: (typeof filas)[number]) =>
    noGuardada(orden.id)
      ? "No se guardó"
      : revisada
        ? errores
          ? `Revisada, ${frase(errores, "error", "errores")}`
          : "Revisada, todo bien"
        : cambio
          ? "Cambió, por revisar"
          : "Sin revisar";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-[70] flex flex-col bg-slate-100 text-slate-900 [&_:focus-visible]:outline-3 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-blue-700"
      onClickCapture={(e) => {
        const control = (e.target as Element).closest("button, a, input");
        if (control && !control.hasAttribute("data-conserva-aviso")) setAviso(null);
      }}
    >
      <header className="flex items-center gap-2.5 border-b border-slate-300 bg-white px-3 py-2 min-[900px]:gap-4 min-[900px]:px-5 min-[900px]:py-2.5">
        <h1 className="hidden text-lg font-bold min-[900px]:block">{titulo}</h1>
        {filas.length > 0 && (
          <div className="min-w-0 max-w-[420px] flex-1">
            <p className="mb-1 text-sm text-slate-600">
              {revisadas.length} de {filas.length} revisadas
              {conErrores.length > 0 && ` · ${conErrores.length} con errores`}
            </p>
            <div
              role="progressbar"
              aria-label="Órdenes revisadas"
              aria-valuemin={0}
              aria-valuemax={filas.length}
              aria-valuenow={revisadas.length}
              className="h-2 overflow-hidden rounded bg-slate-200"
            >
              <div
                className="h-full bg-emerald-700"
                style={{ width: `${(revisadas.length / filas.length) * 100}%` }}
              />
            </div>
          </div>
        )}
        <div className="ml-auto flex shrink-0 gap-2">
          {filas.length > 0 && (
            <button
              type="button"
              data-conserva-aviso
              className={`${boton} min-h-11 px-2.5 min-[900px]:hidden`}
              aria-expanded={verLista}
              onClick={() => setVerLista(!verLista)}
            >
              {verLista ? "Ver orden" : "Ver lista"}
            </button>
          )}
          <button type="button" className={`${boton} min-h-11 px-2.5 min-[900px]:px-3.5`} onClick={() => void salir(onSalir)}>
            Salir
          </button>
        </div>
      </header>

      {saliendo && sinGuardar.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-red-300 bg-red-50 px-3 py-2 text-red-900 min-[900px]:px-5">
          <p role="alert" className="font-semibold">
            Hay cambios sin guardar. Si sales, se pierden.
          </p>
          <button
            type="button"
            className={`${boton} min-h-11 px-3.5 text-slate-900`}
            onClick={() => {
              colas.descartar(sinGuardar);
              salida.current?.();
            }}
          >
            Salir sin guardar
          </button>
          <button type="button" className={`${boton} min-h-11 px-3.5 text-slate-900`} onClick={seguirRevisando}>
            Seguir revisando
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] min-[900px]:grid-cols-[320px_minmax(0,1fr)]">
        {!actual ? (
          <p
            id="rev-titulo"
            tabIndex={-1}
            className="col-span-full px-5 py-16 text-center text-slate-600 outline-none!"
          >
            No hay órdenes para revisar en esta fecha.
          </p>
        ) : (
          <>
            <aside
              aria-label="Órdenes del día"
              inert={ocupado}
              className={`${verLista ? "block" : "hidden"} overflow-y-auto border-slate-300 bg-white p-3 min-[900px]:block min-[900px]:border-r`}
            >
              <div role="group" aria-label="Filtrar órdenes" className="mb-2.5 flex flex-wrap gap-2">
                {FILTROS.map(({ id, etiqueta }) => (
                  <button
                    key={id}
                    type="button"
                    data-conserva-aviso
                    aria-pressed={filtro === id}
                    onClick={() => setFiltro(id)}
                    className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${
                      filtro === id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white hover:bg-slate-50"
                    }`}
                  >
                    {etiqueta} {porFiltro[id].length}
                  </button>
                ))}
              </div>
              {porFiltro[filtro].length === 0 && (
                <p className="text-[15px] text-slate-600">No hay órdenes con este filtro.</p>
              )}
              {porFiltro[filtro].map((fila) => {
                const { orden, revisada, errores } = fila;
                const mal = noGuardada(orden.id) || (revisada && errores > 0);
                return (
                  <button
                    key={orden.id}
                    type="button"
                    aria-current={orden === actual && !fin}
                    onClick={() => abrir(orden.id)}
                    className={`flex min-h-[60px] w-full items-center gap-3 rounded-[10px] p-2.5 text-left ${
                      orden === actual && !fin ? "bg-slate-200" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`grid size-[26px] shrink-0 place-items-center rounded-full border-2 text-sm font-bold leading-none ${
                        mal
                          ? "border-amber-800 bg-amber-100 text-amber-900"
                          : revisada
                            ? "border-emerald-700 bg-emerald-700 text-white"
                            : "border-slate-500"
                      }`}
                    >
                      {mal ? "!" : revisada ? "✓" : ""}
                    </span>
                    <span className="min-w-0 break-words">
                      <span className="block font-semibold">
                        #{orden.numeroDiario ?? orden.id.slice(-6)} · {tituloOrden(orden)}
                      </span>
                      <span
                        className={`block text-sm ${noGuardada(orden.id) ? "font-semibold text-red-700" : "text-slate-600"}`}
                      >
                        {textoFila(fila)} · {dolares(Number(orden.total))}
                      </span>
                    </span>
                  </button>
                );
              })}
            </aside>

            <div className={`${verLista ? "hidden" : "flex"} min-h-0 flex-col min-[900px]:flex`}>
              {fin ? (
                <>
                  <div className="flex-1 overflow-y-auto px-5 py-16 text-center">
                    <h2 id="rev-titulo" tabIndex={-1} className="text-2xl font-bold outline-none!">
                      Terminaste la revisión
                    </h2>
                    <p className="mb-5 mt-1.5 text-[15px] text-slate-600">
                      {frase(revisadas.length, "orden revisada", "órdenes revisadas")},{" "}
                      {conErrores.length} con errores.
                    </p>
                    <button
                      type="button"
                      className="min-h-[52px] rounded-[10px] bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800"
                      onClick={() => void salir(() => router.push(`/admin/reportes?tab=bitacora&desde=${fecha}&hasta=${fecha}`))}
                    >
                      Ver bitácora de errores
                    </button>
                  </div>
                  {franja}
                </>
              ) : (
                <OrdenEnRevision
                  key={`${actual.id}:${recargas}`}
                  orden={actual}
                  {...borradorDe(actual)}
                  errores={contarErrores(actual, borradorDe(actual))}
                  estadoGuardado={guardados[actual.id]}
                  errorRecarga={errorRecarga}
                  ocupado={ocupado}
                  rechazo={colas.estado.rechazos[actual.id] ?? null}
                  catalogo={colas.catalogo}
                  nombreProducto={nombreProducto(actual)}
                  onCargarCatalogo={() => void colas.cargarCatalogo()}
                  onCambiar={(marcas) => cambiar(actual, marcas)}
                  onAvanzar={() => void avanzar(actual)}
                  onQuitarRevisada={() => {
                    if (!ocupado) poner(actual, { ...borradorDe(actual), revisada: false });
                  }}
                  onReintentar={() => colas.reintentar(actual.id)}
                  onRecargar={() => void recargar(actual)}
                  aviso={franja}
                />
              )}
            </div>
          </>
        )}
      </div>
      <div role="status" className="sr-only">
        {aviso?.texto}
      </div>
    </div>
  );
}
