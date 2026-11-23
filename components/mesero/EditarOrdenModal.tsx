"use client";

import { useEffect, useRef, useState } from "react";
import { normalizarNombre } from "@/lib/admin-validaciones";
import {
  MAX_OBSERVACIONES_ITEM,
  agregarProducto,
  bloqueoDeOrden,
  cambiosParaEnviar,
  crearLineas,
  describirCambios,
  ponerCantidad,
  stockRestante,
  totalDeLineas,
  type ItemDeOrden,
  type Linea,
  type ProductoEdicion,
} from "@/lib/edicion-orden";
import {
  NIVELES_PICANTE,
  esCategoriaCombo,
  obtenerEtiquetaNivelPicante,
  type NivelPicante,
} from "@/types/orden";

interface Orden {
  id: string;
  printRevision: number;
  tipoOrden: string;
  estado: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente?: string | null;
  costoEnvio: number | null;
  descuentoTipo?: string | null;
  descuentoValor?: number | string | null;
  total: number;
  montoPagado: number;
  items: ItemDeOrden[];
}

interface Props {
  orden: Orden;
  onClose: () => void;
  onSuccess: () => void;
}

const OTRA_RAZON = "Otra";
const RAZONES = [
  "Cliente pidió cambio",
  "Error al tomar la orden",
  "Se agotó un producto",
  OTRA_RAZON,
];

const ESTADOS: Record<string, string> = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  lista: "Lista",
};

const AVISO_BLOQUEO = {
  lista:
    "Cocina ya terminó esta orden. Puedes agregar, no quitar. Lo nuevo vuelve a cocina.",
  pagada:
    "Esta orden ya tiene un pago. Puedes agregar, no quitar. Lo nuevo queda por cobrar.",
};

const SIGNOS = {
  agrega: { signo: "+", color: "text-emerald-700" },
  quita: { signo: "−", color: "text-red-700" },
  cambia: { signo: "↻", color: "text-blue-700" },
};

const dolares = (valor: number) =>
  `${valor < 0 ? "−" : ""}$${Math.abs(valor).toFixed(2)}`;
const conSigno = (valor: number) =>
  valor > 0 ? `+${dolares(valor)}` : dolares(valor);

const cuadrado =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-xl font-bold text-slate-900 hover:bg-slate-100 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400";
const chip =
  "min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white";
const enlace =
  "min-h-11 text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900";
const principal =
  "min-h-12 rounded-lg bg-slate-900 px-5 font-bold text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-700";
const etiqueta = "inline-block rounded px-2 py-0.5 text-xs font-semibold";

function tituloDe(orden: Orden): string {
  return !orden.tipoOrden || orden.tipoOrden === "local"
    ? `Mesa ${orden.numeroMesa}`
    : (orden.nombreCliente ?? orden.telefonoCliente ?? "Cliente");
}

function EstadoDeLinea({ linea }: { linea: Linea }) {
  if (linea.esCortesia) {
    return (
      <span className={`${etiqueta} bg-amber-100 text-amber-900`}>
        🎁 Cortesía
      </span>
    );
  }
  if (linea.original === 0) {
    return (
      <span className={`${etiqueta} bg-emerald-100 text-emerald-900`}>
        Nuevo
      </span>
    );
  }
  if (linea.cantidad === 0) {
    return (
      <span className={`${etiqueta} bg-red-100 text-red-900`}>Se quita</span>
    );
  }
  if (linea.cantidad !== linea.original) {
    return (
      <span className={`${etiqueta} bg-blue-100 text-blue-900`}>
        Antes {linea.original}
      </span>
    );
  }
  return linea.nivelPicante !== linea.nivelOriginal ? (
    <span className={`${etiqueta} bg-blue-100 text-blue-900`}>
      Cambia picante
    </span>
  ) : null;
}

export default function EditarOrdenModal({ orden, onClose, onSuccess }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const [lineas, setLineas] = useState(() => crearLineas(orden.items));
  const [paso, setPaso] = useState<"editar" | "confirmar" | "guardado">(
    "editar",
  );
  const [panel, setPanel] = useState<"orden" | "menu">("orden");
  const [productos, setProductos] = useState<ProductoEdicion[]>([]);
  const [errorProductos, setErrorProductos] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [comboPorElegir, setComboPorElegir] = useState<string | null>(null);
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);
  const [razon, setRazon] = useState("");
  const [otraRazon, setOtraRazon] = useState("");
  const [error, setError] = useState("");
  const [ordenCambio, setOrdenCambio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState({ impresa: true, aCocina: false });

  const cargarProductos = async () => {
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProductos(data);
      setErrorProductos("");
    } catch (causa) {
      console.error("Error al cargar productos:", causa);
      setErrorProductos("No se pudo cargar el menú.");
    }
  };

  useEffect(() => {
    dialogo.current?.showModal();
    // Los setState ocurren después del fetch, no de forma síncrona en el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarProductos();
  }, []);

  // Al cambiar de paso el lector de pantalla y el teclado arrancan en el título.
  useEffect(() => {
    titulo.current?.focus();
  }, [paso]);

  const bloqueo = bloqueoDeOrden(orden);
  const cambios = describirCambios(lineas);
  const hayCambios = cambios.length > 0;
  const totalAnterior = Number(orden.total);
  const totalNuevo = hayCambios ? totalDeLineas(lineas, orden) : totalAnterior;
  const diferencia = Math.round((totalNuevo - totalAnterior) * 100) / 100;
  // Lo que el total se mueve sin ser un producto: sigue a los combos y al subtotal.
  const ajuste =
    Math.round(
      (diferencia - cambios.reduce((suma, c) => suma + c.monto, 0)) * 100,
    ) / 100;
  const montoPagado = Number(orden.montoPagado ?? 0);

  const catalogo = new Map(productos.map((p) => [p.id, p]));
  const restante = (producto: ProductoEdicion) =>
    stockRestante(lineas, catalogo.get(producto.id) ?? producto);

  const textoBusqueda = normalizarNombre(busqueda);
  const categorias = [
    "Todas",
    ...Array.from(new Set(productos.map((p) => p.categoria))),
  ];
  const visibles = productos.filter(
    (p) =>
      (categoria === "Todas" || p.categoria === categoria) &&
      normalizarNombre(p.nombre).includes(textoBusqueda),
  );

  const cerrar = () => {
    if (guardando) return;
    if (paso === "guardado") {
      onSuccess();
      return;
    }
    if (
      hayCambios &&
      !window.confirm("Tienes cambios sin guardar. ¿Salir y perderlos?")
    ) {
      return;
    }
    onClose();
  };

  const cambiarLinea = (id: string, datos: Partial<Linea>) =>
    setLineas((actuales) =>
      actuales.map((linea) =>
        linea.id === id ? { ...linea, ...datos } : linea,
      ),
    );

  const cambiarCantidad = (id: string, cantidad: number) => {
    setError("");
    setLineas((actuales) => ponerCantidad(actuales, id, cantidad));
  };

  const agregar = (producto: ProductoEdicion, nivel: NivelPicante | null) => {
    setError("");
    setComboPorElegir(null);
    setLineas((actuales) => agregarProducto(actuales, producto, nivel));
    navigator.vibrate?.(40);
  };

  const revisar = () => {
    if (!hayCambios) {
      setError("Todavía no cambiaste nada.");
      return;
    }
    if (!lineas.some((linea) => linea.cantidad > 0 && !linea.esCortesia)) {
      setError(
        "La orden no puede quedar vacía. Para cancelarla, pide al administrador que la anule.",
      );
      return;
    }
    setError("");
    setPaso("confirmar");
  };

  const guardar = async () => {
    const razonFinal = razon === OTRA_RAZON ? otraRazon.trim() : razon;
    if (!razonFinal) {
      setError(
        razon === OTRA_RAZON ? "Escribe la razón." : "Elige por qué cambia.",
      );
      return;
    }

    setGuardando(true);
    setError("");
    setOrdenCambio(false);
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cambiosParaEnviar(lineas),
          razon: razonFinal,
          expectedRevision: orden.printRevision,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrdenCambio(res.status === 409);
        throw new Error(data.error || "No se pudo modificar la orden");
      }
      setResultado({
        impresa: Boolean(data.impresionEnCola),
        aCocina: Boolean(data.regresaACocina),
      });
      setPaso("guardado");
    } catch (causa) {
      setError(
        causa instanceof Error ? causa.message : "No se pudo modificar la orden",
      );
      // El rechazo pudo ser por stock: se refresca lo que queda de cada producto.
      void cargarProductos();
    } finally {
      setGuardando(false);
    }
  };

  const mensajeError = error && (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
    >
      {error}
      {ordenCambio && (
        <button
          type="button"
          onClick={onSuccess}
          className="ml-2 min-h-11 font-semibold underline underline-offset-2"
        >
          Salir y recargar la orden
        </button>
      )}
    </div>
  );

  const encabezado = (texto: string, detalle: string) => (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2
          ref={titulo}
          tabIndex={-1}
          id="titulo-editar-orden"
          className="truncate text-xl font-bold outline-none"
        >
          {texto}
        </h2>
        <p className="text-sm text-slate-600">{detalle}</p>
      </div>
      <button
        type="button"
        onClick={cerrar}
        disabled={guardando}
        aria-label="Cerrar"
        className={cuadrado}
      >
        ×
      </button>
    </header>
  );

  const panelOrden = (
    <ul className="divide-y divide-slate-200">
      {lineas.map((linea) => {
        const { producto } = linea;
        const esOriginal = linea.original > 0;
        const seQuita = linea.cantidad === 0;
        const noBaja = bloqueo !== null && linea.cantidad <= linea.original;
        const sinStock = restante(producto) <= 0;
        const esCombo = esCategoriaCombo(producto.categoria);
        const picanteFijo =
          linea.esCortesia || seQuita || (bloqueo !== null && esOriginal);
        return (
          <li
            key={linea.id}
            className={`px-4 py-3 sm:px-5 ${seQuita ? "bg-slate-50" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span
                  className={`mr-2 font-semibold ${seQuita ? "text-slate-600 line-through" : ""}`}
                >
                  {linea.esCortesia && `${linea.cantidad}× `}
                  {producto.nombre}
                </span>
                <EstadoDeLinea linea={linea} />
                {linea.esCortesia && (
                  <p className="text-sm text-slate-600">
                    La cambia solo el administrador
                  </p>
                )}
                {linea.observaciones && notaAbierta !== linea.id && (
                  <p className="text-sm break-words text-slate-600">
                    Nota: {linea.observaciones}
                  </p>
                )}
                {linea.nivelPicante && picanteFijo && (
                  <p className="text-sm font-semibold text-red-700">
                    🌶️ {obtenerEtiquetaNivelPicante(linea.nivelPicante)}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {linea.esCortesia
                  ? "Gratis"
                  : dolares(linea.cantidad * linea.precioUnitario)}
              </span>
            </div>

            {!linea.esCortesia && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3">
                  {esCombo && !picanteFijo && (
                    <select
                      aria-label={`Nivel de picante de ${producto.nombre}`}
                      value={linea.nivelPicante ?? ""}
                      onChange={(e) =>
                        cambiarLinea(linea.id, {
                          nivelPicante: e.target.value as NivelPicante,
                        })
                      }
                      className="min-h-11 rounded-lg border border-slate-400 bg-white px-2 text-slate-900"
                    >
                      <option value="" disabled>
                        Elige el picante
                      </option>
                      {NIVELES_PICANTE.map((nivel) => (
                        <option key={nivel.value} value={nivel.value}>
                          🌶️ {nivel.label}
                          {linea.cantidad > 1 ? ` (los ${linea.cantidad})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {!esOriginal && notaAbierta !== linea.id && (
                    <button
                      type="button"
                      onClick={() => setNotaAbierta(linea.id)}
                      className={enlace}
                    >
                      {linea.observaciones ? "Cambiar nota" : "Agregar nota"}
                    </button>
                  )}
                </div>
                {seQuita ? (
                  <button
                    type="button"
                    onClick={() =>
                      cambiarLinea(linea.id, {
                        cantidad: linea.original,
                        nivelPicante: linea.nivelOriginal,
                      })
                    }
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    ↺ Deshacer
                  </button>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        cambiarCantidad(linea.id, linea.cantidad - 1)
                      }
                      disabled={noBaja}
                      aria-label={
                        noBaja
                          ? `No se puede quitar ${producto.nombre}`
                          : linea.cantidad === 1
                            ? `Quitar ${producto.nombre}`
                            : `Uno menos de ${producto.nombre}`
                      }
                      className={cuadrado}
                    >
                      {noBaja ? "🔒" : linea.cantidad === 1 ? "🗑️" : "−"}
                    </button>
                    <span
                      aria-live="polite"
                      className="min-w-7 text-center text-lg font-bold tabular-nums"
                    >
                      {linea.cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        cambiarCantidad(linea.id, linea.cantidad + 1)
                      }
                      disabled={sinStock}
                      aria-label={
                        sinStock
                          ? `No queda más stock de ${producto.nombre}`
                          : `Uno más de ${producto.nombre}`
                      }
                      className={cuadrado}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            )}
            {sinStock && !linea.esCortesia && !seQuita && (
              <p className="mt-1 text-right text-sm text-slate-600">
                No queda más stock
              </p>
            )}
            {notaAbierta === linea.id && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={linea.observaciones}
                  maxLength={MAX_OBSERVACIONES_ITEM}
                  onChange={(e) =>
                    cambiarLinea(linea.id, { observaciones: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setNotaAbierta(null);
                  }}
                  aria-label={`Nota para cocina de ${producto.nombre}`}
                  placeholder="Sin cebolla"
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-400 bg-white px-3 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setNotaAbierta(null)}
                  className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold"
                >
                  Listo
                </button>
              </div>
            )}
          </li>
        );
      })}
      <li className="p-4 lg:hidden">
        <button
          type="button"
          onClick={() => setPanel("menu")}
          className="min-h-12 w-full rounded-lg border border-slate-400 bg-white font-semibold text-slate-900 hover:bg-slate-50"
        >
          + Agregar productos
        </button>
      </li>
    </ul>
  );

  const panelMenu = (
    <>
      <div className="sticky top-0 z-10 space-y-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          className="min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-slate-900"
        />
        <div
          role="group"
          aria-label="Categoría"
          className="flex gap-2 overflow-x-auto"
        >
          {categorias.map((nombre) => (
            <button
              key={nombre}
              type="button"
              aria-pressed={categoria === nombre}
              onClick={() => setCategoria(nombre)}
              className={`shrink-0 ${chip}`}
            >
              {nombre}
            </button>
          ))}
        </div>
      </div>
      {errorProductos ? (
        <div role="alert" className="p-5 text-red-800">
          {errorProductos}{" "}
          <button
            type="button"
            onClick={() => void cargarProductos()}
            className={enlace}
          >
            Reintentar
          </button>
        </div>
      ) : productos.length === 0 ? (
        <p className="p-5 text-slate-600">Cargando el menú…</p>
      ) : visibles.length === 0 ? (
        <p className="p-5 text-slate-600">
          Ningún producto coincide con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {visibles.map((producto) => {
            const quedan = restante(producto);
            const esCombo = esCategoriaCombo(producto.categoria);
            const eligiendo = comboPorElegir === producto.id;
            const agregados = lineas
              .filter((l) => l.producto.id === producto.id && !l.esCortesia)
              .reduce(
                (suma, l) => suma + Math.max(0, l.cantidad - l.original),
                0,
              );
            return (
              <li key={producto.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{producto.nombre}</p>
                    <p className="text-sm text-slate-600">
                      {dolares(Number(producto.precio))}
                      {quedan <= 0 ? (
                        <span className="font-semibold text-red-700">
                          {" "}
                          · Agotado
                        </span>
                      ) : (
                        quedan <= 5 && ` · Quedan ${quedan}`
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {agregados > 0 && (
                      <span
                        className={`${etiqueta} bg-emerald-100 text-emerald-900`}
                      >
                        +{agregados}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={quedan <= 0}
                      aria-expanded={esCombo ? eligiendo : undefined}
                      aria-label={`Agregar ${producto.nombre}`}
                      onClick={() =>
                        esCombo
                          ? setComboPorElegir(eligiendo ? null : producto.id)
                          : agregar(producto, null)
                      }
                      className={cuadrado}
                    >
                      +
                    </button>
                  </div>
                </div>
                {eligiendo && quedan > 0 && (
                  <div
                    role="group"
                    aria-label={`Nivel de picante de ${producto.nombre}`}
                    className="mt-2"
                  >
                    <p className="mb-2 text-sm text-slate-600">
                      ¿Qué nivel de picante?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {NIVELES_PICANTE.map((nivel) => (
                        <button
                          key={nivel.value}
                          type="button"
                          onClick={() => agregar(producto, nivel.value)}
                          className={chip}
                        >
                          {nivel.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-editar-orden"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        cerrar();
      }}
      onCancel={(e) => {
        e.preventDefault();
        cerrar();
      }}
      // El navegador puede cerrarlo por su cuenta (gesto atrás) aunque se cancele:
      // con cambios pendientes se vuelve a abrir para no perderlos.
      onClose={() => {
        if (paso === "guardado") onSuccess();
        else if (hayCambios || guardando) dialogo.current?.showModal();
        else onClose();
      }}
      className={`m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-hidden bg-white text-slate-900 backdrop:bg-black/50 open:flex sm:m-auto sm:rounded-2xl ${
        paso === "editar"
          ? "sm:h-[90dvh] sm:max-w-2xl lg:max-w-5xl"
          : "sm:h-auto sm:max-h-[90dvh] sm:max-w-lg"
      }`}
    >
      {paso === "editar" && (
        <>
          {encabezado(
            tituloDe(orden),
            `Editar orden · ${ESTADOS[orden.estado] ?? orden.estado}`,
          )}
          {bloqueo && (
            <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-5">
              <span aria-hidden>🔒 </span>
              {AVISO_BLOQUEO[bloqueo]}
            </p>
          )}
          <div className="flex border-b border-slate-200 lg:hidden">
            {(
              [
                ["orden", "La orden"],
                ["menu", "Agregar"],
              ] as const
            ).map(([id, texto]) => (
              <button
                key={id}
                type="button"
                aria-pressed={panel === id}
                onClick={() => setPanel(id)}
                className="min-h-12 flex-1 border-b-[3px] border-transparent font-semibold text-slate-600 aria-pressed:border-slate-900 aria-pressed:text-slate-900"
              >
                {texto}
              </button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 lg:grid-cols-2">
            <section
              aria-label="Agregar productos"
              className={`min-h-0 overflow-y-auto overscroll-contain lg:block lg:border-r lg:border-slate-200 ${panel === "menu" ? "" : "hidden"}`}
            >
              {panelMenu}
            </section>
            <section
              aria-label="Productos de la orden"
              className={`min-h-0 overflow-y-auto overscroll-contain lg:block ${panel === "orden" ? "" : "hidden"}`}
            >
              {panelOrden}
            </section>
          </div>
          <footer className="space-y-2 border-t border-slate-300 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-600">
                {hayCambios ? `Antes ${dolares(totalAnterior)}` : "Sin cambios"}
              </span>
              <span
                aria-live="polite"
                className="text-xl font-bold tabular-nums"
              >
                {dolares(totalNuevo)}
                {diferencia !== 0 && (
                  <span className="ml-2 text-sm font-semibold text-slate-600">
                    ({conSigno(diferencia)})
                  </span>
                )}
              </span>
            </p>
            {mensajeError}
            <button
              type="button"
              onClick={revisar}
              className={`w-full ${principal}`}
            >
              {hayCambios
                ? `Revisar ${cambios.length} ${cambios.length === 1 ? "cambio" : "cambios"}`
                : "Revisar cambios"}
            </button>
          </footer>
        </>
      )}

      {paso === "confirmar" && (
        <>
          {encabezado("Confirmar cambios", tituloDe(orden))}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul className="divide-y divide-slate-200">
              {cambios.map((cambio, idx) => (
                <li
                  key={idx}
                  className="flex items-baseline justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <span className="min-w-0 break-words">
                    <span
                      className={`mr-2 font-bold ${SIGNOS[cambio.tipo].color}`}
                    >
                      {SIGNOS[cambio.tipo].signo}
                    </span>
                    {cambio.texto}
                  </span>
                  {cambio.monto !== 0 && (
                    <span className="shrink-0 tabular-nums">
                      {conSigno(cambio.monto)}
                    </span>
                  )}
                </li>
              ))}
              {ajuste !== 0 && (
                <li className="flex items-baseline justify-between gap-3 px-4 py-3 text-slate-600 sm:px-5">
                  <span>Ajuste de envases y descuento</span>
                  <span className="shrink-0 tabular-nums">
                    {conSigno(ajuste)}
                  </span>
                </li>
              )}
            </ul>
            <div
              role="group"
              aria-labelledby="titulo-razon"
              className="border-y border-slate-200 px-4 py-4 sm:px-5"
            >
              <p id="titulo-razon" className="mb-2 font-semibold">
                ¿Por qué cambia?
              </p>
              <div className="flex flex-wrap gap-2">
                {RAZONES.map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    aria-pressed={razon === opcion}
                    onClick={() => {
                      setRazon(opcion);
                      setError("");
                    }}
                    className={chip}
                  >
                    {opcion}
                  </button>
                ))}
              </div>
              {razon === OTRA_RAZON && (
                <input
                  autoFocus
                  type="text"
                  value={otraRazon}
                  maxLength={200}
                  onChange={(e) => {
                    setOtraRazon(e.target.value);
                    setError("");
                  }}
                  aria-label="Otra razón"
                  placeholder="Llegó más gente a la mesa"
                  className="mt-3 min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-slate-900"
                />
              )}
            </div>
            <div className="space-y-2 px-4 py-4 sm:px-5">
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-slate-600">
                  Antes {dolares(totalAnterior)}
                </span>
                <span className="text-xl font-bold tabular-nums">
                  {dolares(totalNuevo)}
                </span>
              </p>
              {montoPagado > 0 && (
                <p className="text-sm font-semibold text-amber-900">
                  Quedará por cobrar{" "}
                  {dolares(Math.max(0, totalNuevo - montoPagado))}.
                </p>
              )}
              <p className="text-sm text-slate-600">
                {orden.estado === "lista"
                  ? "La orden vuelve a cocina para preparar lo nuevo."
                  : "Cocina recibe una comanda con estos cambios."}
              </p>
              {orden.estado === "en_preparacion" &&
                cambios.some((cambio) => cambio.tipo !== "agrega") && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Cocina puede estar preparando lo que quitas o cambias.
                    Avísales.
                  </p>
                )}
            </div>
          </div>
          <footer className="space-y-2 border-t border-slate-300 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5">
            {mensajeError}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setPaso("editar");
                }}
                disabled={guardando}
                className="min-h-12 rounded-lg border border-slate-400 px-5 font-semibold text-slate-900 hover:bg-slate-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={guardando}
                className={`flex-1 ${principal}`}
              >
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </footer>
        </>
      )}

      {paso === "guardado" && (
        <>
          {encabezado("Cambios guardados", tituloDe(orden))}
          <div className="space-y-3 px-4 py-5 sm:px-5">
            {resultado.aCocina && (
              <p>La orden volvió a cocina para preparar lo nuevo.</p>
            )}
            {resultado.impresa ? (
              <p>La comanda de cambio quedó en la cola de impresión.</p>
            ) : (
              <p
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900"
              >
                ⚠️ Los cambios se guardaron, pero no se enviaron a impresión.
                Avisa a cocina y verifica la configuración de la cola.
              </p>
            )}
            <button
              type="button"
              onClick={onSuccess}
              className={`w-full ${principal}`}
            >
              Volver a mis órdenes
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
