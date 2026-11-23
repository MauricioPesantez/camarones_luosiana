"use client";

import { useState } from "react";
import { abrirComprobanteFirmado } from "@/lib/comprobante-cliente";
import { montoACobrarEnCaja } from "@/types/cobro";
import { calcularResumenCuadre, estaPorCobrar } from "@/types/cuadre";
import {
  calcularSaldo,
  calcularVentaPropia,
  obtenerCostoEnvio,
  obtenerEtiquetaNivelPicante,
  type MetodoPago,
} from "@/types/orden";
import { obtenerEtiquetaRol, ROLES } from "@/types/usuario";
import DetalleOrdenModal from "./DetalleOrdenModal";
import {
  dolares,
  horaCorta,
  tituloOrden,
  type FiltroCobro,
  type OrdenAdmin,
} from "./orden-admin";

interface Props {
  ordenes: OrdenAdmin[];
  /** Qué decir mientras no haya datos del día; null cuando ya están. */
  sinDatos: string | null;
  admin: { id: string; nombre: string };
  filtroCobro: FiltroCobro;
  onFiltroCobro: (filtro: FiltroCobro) => void;
  onCambio: () => Promise<void>;
}

const FILTROS_COBRO: { valor: FiltroCobro; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "sin_cobrar", etiqueta: "Sin cobrar" },
  { valor: "con_abono", etiqueta: "Pagadas a medias" },
  { valor: "cobradas", etiqueta: "Cobradas" },
  { valor: "anuladas", etiqueta: "Anuladas" },
];

const TIPOS: Record<string, { etiqueta: string; color: string }> = {
  local: { etiqueta: "🍽 Local", color: "bg-blue-100 text-blue-900" },
  para_llevar: {
    etiqueta: "🥡 Para llevar",
    color: "bg-yellow-100 text-yellow-900",
  },
  domicilio: { etiqueta: "🛵 Domicilio", color: "bg-rose-100 text-rose-900" },
};

const ESTADOS: Record<string, { etiqueta: string; color: string }> = {
  pendiente_aprobacion_stock: {
    etiqueta: "Espera aprobación",
    color: "bg-red-100 text-red-900",
  },
  pendiente: { etiqueta: "Pendiente", color: "bg-yellow-100 text-yellow-900" },
  en_preparacion: {
    etiqueta: "En preparación",
    color: "bg-orange-100 text-orange-900",
  },
  lista: { etiqueta: "Lista", color: "bg-emerald-100 text-emerald-900" },
  entregada: { etiqueta: "Entregada", color: "bg-purple-100 text-purple-900" },
  cobrada: { etiqueta: "Cobrada", color: "bg-green-100 text-green-900" },
  cancelada: { etiqueta: "Cancelada", color: "bg-red-100 text-red-900" },
};

const ETIQUETAS_METODO: Record<string, string> = {
  efectivo: "💵 Efectivo",
  transferencia: "🏦 Transferencia",
  mixto: "🔀 Mixto",
};

const ficha = "inline-block rounded px-2 py-0.5 text-xs font-semibold";
const campo =
  "mt-1 block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-slate-900";

const tieneAbono = (orden: OrdenAdmin) =>
  !orden.anulada &&
  !orden.empleadoId &&
  Number(orden.montoPagado) > 0 &&
  calcularSaldo(orden) > 0;

function pasaFiltroCobro(orden: OrdenAdmin, filtro: FiltroCobro): boolean {
  switch (filtro) {
    case "sin_cobrar":
      return estaPorCobrar(orden);
    case "con_abono":
      return tieneAbono(orden);
    case "cobradas":
      return orden.cobrada && !orden.anulada;
    case "anuladas":
      return orden.anulada;
    default:
      return true;
  }
}

/** Solo hay tiempo real cuando la orden ya salió. */
function calcularEstadoTiempo(orden: OrdenAdmin) {
  if (
    !["entregada", "cobrada"].includes(orden.estado) ||
    !orden.tiempoEstimado
  ) {
    return null;
  }
  const tiempoReal = Math.floor(
    (new Date(orden.updatedAt).getTime() -
      new Date(orden.createdAt).getTime()) /
      60000,
  );
  return { tiempoReal, aTiempo: tiempoReal <= orden.tiempoEstimado };
}

function Comprobante({
  ordenId,
  pagoId,
  tieneArchivo,
  origen,
}: {
  ordenId: string;
  pagoId?: string;
  tieneArchivo: boolean;
  origen?: string | null;
}) {
  if (tieneArchivo) {
    return (
      <button
        type="button"
        onClick={() => void abrirComprobanteFirmado(ordenId, pagoId)}
        className="font-semibold text-blue-700 underline"
      >
        📎 Ver comprobante
      </button>
    );
  }
  // La captura de comprobante solo existe en el flujo por QR: en el resto de
  // orígenes (lista interna, creación o aprobación de domicilio con
  // transferencia) nunca fue posible pedirla, así que la advertencia ahí sería
  // ruido que el admin aprende a ignorar.
  return origen === "qr" ? (
    <span className="font-semibold text-amber-800">⚠️ Sin comprobante</span>
  ) : null;
}

function PagoDeOrden({
  orden,
  onCobrar,
}: {
  orden: OrdenAdmin;
  onCobrar: () => void;
}) {
  if (orden.empleadoId) {
    return (
      <span className={`${ficha} bg-purple-100 text-purple-900`}>
        👤 A cuenta de {orden.empleadoNombre}
      </span>
    );
  }

  if (orden.cobrada) {
    const pagos = orden.pagos ?? [];
    return (
      <div className="space-y-1 text-xs">
        <span className="block text-sm font-semibold">
          {ETIQUETAS_METODO[orden.metodoPago ?? ""] ?? "🏦 Transferencia"}
        </span>
        {pagos.length > 0
          ? pagos.map((pago) => (
              <span key={pago.id} className="flex flex-wrap gap-x-2">
                {pagos.length > 1 && (
                  <span>
                    {pago.metodoPago === "efectivo" ? "💵" : "🏦"}{" "}
                    {dolares(pago.monto)}
                  </span>
                )}
                {pago.metodoPago === "transferencia" && (
                  <Comprobante
                    ordenId={orden.id}
                    pagoId={pago.id}
                    tieneArchivo={!!pago.comprobanteTransferenciaKey}
                    origen={pago.origen}
                  />
                )}
              </span>
            ))
          : orden.metodoPago === "transferencia" && (
              <Comprobante
                ordenId={orden.id}
                tieneArchivo={!!orden.comprobanteTransferenciaKey}
                origen={orden.origenCobro}
              />
            )}
        {tieneAbono(orden) && (
          <span className="block font-semibold text-amber-800">
            Debe {dolares(calcularSaldo(orden))}
          </span>
        )}
        {orden.cobradaPor && (
          <span className="block text-slate-600">por {orden.cobradaPor}</span>
        )}
      </div>
    );
  }

  if (!estaPorCobrar(orden)) {
    return <span className="text-sm text-slate-600">No se cobra</span>;
  }

  const sePuedeCobrar =
    (orden.tipoOrden && orden.tipoOrden !== "local") ||
    ["lista", "entregada"].includes(orden.estado);

  return (
    <div className="space-y-1">
      {tieneAbono(orden) && (
        <span className="block text-xs font-semibold text-amber-800">
          Pagó {dolares(Number(orden.montoPagado))}, debe{" "}
          {dolares(calcularSaldo(orden))}
        </span>
      )}
      {sePuedeCobrar ? (
        <button
          type="button"
          onClick={onCobrar}
          className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"
        >
          Cobrar
        </button>
      ) : (
        <span className="text-sm text-slate-600">Aún en cocina</span>
      )}
    </div>
  );
}

export default function OrdenesDia({
  ordenes,
  sinDatos,
  admin,
  filtroCobro,
  onFiltroCobro,
  onCambio,
}: Props) {
  const [rolFiltro, setRolFiltro] = useState("todos");
  const [usuarioFiltro, setUsuarioFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [ordenSeleccionada, setOrdenSeleccionada] =
    useState<OrdenAdmin | null>(null);
  const [ordenACobrar, setOrdenACobrar] = useState<OrdenAdmin | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [cobrando, setCobrando] = useState(false);
  const [ordenAAnular, setOrdenAAnular] = useState<OrdenAdmin | null>(null);
  const [razonAnulacion, setRazonAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [reimprimiendoId, setReimprimiendoId] = useState<string | null>(null);

  const abrirCobro = (orden: OrdenAdmin) => {
    if (orden.cobroUrl) {
      const paymentUrl = new URL(orden.cobroUrl, window.location.origin);
      // origen=lista: se navega en la misma pestaña, así que al terminar se
      // vuelve en vez de cerrar.
      window.location.assign(`${paymentUrl.pathname}?origen=lista`);
      return;
    }
    setOrdenACobrar(orden);
    setMetodoPago("efectivo");
  };

  const cerrarCobro = () => {
    setOrdenACobrar(null);
    setMetodoPago("efectivo");
  };

  const cobrarOrden = async () => {
    if (!ordenACobrar) return;
    setCobrando(true);
    try {
      const res = await fetch(`/api/ordenes/${ordenACobrar.id}/cobrar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metodoPago,
          cobradaPor: admin.nombre,
          expectedRevision: ordenACobrar.printRevision,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (res.ok) {
        cerrarCobro();
        await onCambio();
      } else {
        const error = await res.json();
        alert(error.error || "Error al cobrar la orden");
      }
    } catch (error) {
      console.error("Error al cobrar:", error);
      alert("Error al cobrar la orden");
    } finally {
      setCobrando(false);
    }
  };

  const anularOrden = async () => {
    if (!ordenAAnular) return;
    setAnulando(true);
    try {
      const res = await fetch(`/api/ordenes/${ordenAAnular.id}/anular`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razon: razonAnulacion }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al anular la orden");
      }
      setOrdenAAnular(null);
      setRazonAnulacion("");
      await onCambio();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error al anular la orden");
    } finally {
      setAnulando(false);
    }
  };

  const reimprimirOrden = async (ordenId: string) => {
    setReimprimiendoId(ordenId);
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/reimprimir`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al reimprimir");
      alert(
        data.impresionEnCola
          ? "Ticket enviado a la cola de impresión"
          : "Ticket enviado a la impresora",
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error al reimprimir");
    } finally {
      setReimprimiendoId(null);
    }
  };

  const creadores = Array.from(
    new Map(
      ordenes
        .filter(
          (orden) => rolFiltro === "todos" || orden.creadorRol === rolFiltro,
        )
        .map((orden) => [orden.creadorNombre, orden.creadorRol]),
    ),
  ).sort(([a], [b]) => a.localeCompare(b, "es"));

  const ordenesSinFiltroCobro = ordenes.filter(
    (orden) =>
      (rolFiltro === "todos" || orden.creadorRol === rolFiltro) &&
      (usuarioFiltro === "todos" || orden.creadorNombre === usuarioFiltro) &&
      (tipoFiltro === "todos" || (orden.tipoOrden || "local") === tipoFiltro),
  );
  const visibles = ordenesSinFiltroCobro.filter((orden) =>
    pasaFiltroCobro(orden, filtroCobro),
  );
  const hayFiltros =
    filtroCobro !== "todas" ||
    rolFiltro !== "todos" ||
    usuarioFiltro !== "todos" ||
    tipoFiltro !== "todos";

  const resumen = calcularResumenCuadre(visibles);
  const cifras = [
    ["Vendido", resumen.ventasTotales],
    ["Cobrado en efectivo", resumen.efectivoVentasDirectas + resumen.efectivoCobradoMotorizados],
    ["Cobrado por transferencia", resumen.transferenciasVentas],
    ["Falta cobrar", resumen.ventaPorCobrar],
  ] as const;

  return (
    <div className="space-y-4">
      <section
        aria-label="Filtros de órdenes"
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div
          role="group"
          aria-label="Estado de cobro"
          className="flex flex-wrap gap-2"
        >
          {FILTROS_COBRO.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              type="button"
              aria-pressed={filtroCobro === valor}
              onClick={() => onFiltroCobro(valor)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                filtroCobro === valor
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              {etiqueta}{" "}
              {
                ordenesSinFiltroCobro.filter((orden) =>
                  pasaFiltroCobro(orden, valor),
                ).length
              }
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold">
            Tipo de orden
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className={campo}
            >
              <option value="todos">Todos los tipos</option>
              <option value="local">Local / mesa</option>
              <option value="para_llevar">Para llevar</option>
              <option value="domicilio">Domicilio</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Rol de quien la creó
            <select
              value={rolFiltro}
              onChange={(e) => {
                setRolFiltro(e.target.value);
                setUsuarioFiltro("todos");
              }}
              className={campo}
            >
              <option value="todos">Todos los roles</option>
              {ROLES.map((rol) => (
                <option key={rol.value} value={rol.value}>
                  {rol.label}
                </option>
              ))}
              {ordenes.some((orden) => orden.creadorRol === "desconocido") && (
                <option value="desconocido">Sin rol identificado</option>
              )}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Persona que la creó
            <select
              value={usuarioFiltro}
              onChange={(e) => setUsuarioFiltro(e.target.value)}
              className={campo}
            >
              <option value="todos">Todas las personas</option>
              {creadores.map(([nombre, rol]) => (
                <option key={nombre} value={nombre}>
                  {nombre} · {obtenerEtiquetaRol(rol)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              onFiltroCobro("todas");
              setRolFiltro("todos");
              setUsuarioFiltro("todos");
              setTipoFiltro("todos");
            }}
            className="mt-2 min-h-11 text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            Quitar filtros
          </button>
        )}
      </section>

      <section
        aria-labelledby="lista-ordenes"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <h2 id="lista-ordenes" className="text-lg font-bold">
            {sinDatos
              ? "Órdenes"
              : `${visibles.length} ${visibles.length === 1 ? "orden" : "órdenes"}`}
            {!sinDatos && hayFiltros && " con estos filtros"}
          </h2>
          {!sinDatos && (
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 xl:flex xl:flex-wrap">
              {cifras.map(([etiqueta, monto]) => (
                <div key={etiqueta}>
                  <dt className="text-sm text-slate-600">{etiqueta}</dt>
                  <dd className="font-semibold tabular-nums">
                    {dolares(monto)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {sinDatos ? (
          <p className="p-8 text-center text-slate-600">{sinDatos}</p>
        ) : visibles.length === 0 ? (
          <p className="p-8 text-center text-slate-600">
            {hayFiltros
              ? "Ninguna orden coincide con los filtros."
              : "No hay órdenes en esta fecha."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {visibles.map((orden) => {
              const tipo = TIPOS[orden.tipoOrden || "local"];
              const estado = orden.anulada
                ? { etiqueta: "Anulada", color: "bg-slate-200 text-slate-800" }
                : (ESTADOS[orden.estado] ?? {
                    etiqueta: orden.estado,
                    color: "bg-yellow-100 text-yellow-900",
                  });
              const tiempo = calcularEstadoTiempo(orden);
              const envio = obtenerCostoEnvio(orden);
              return (
                <li
                  key={orden.id}
                  className={`grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 p-4 sm:px-5 xl:py-3 xl:grid-cols-[13rem_1fr_9rem_8rem_10rem_11rem] xl:items-start ${
                    orden.anulada ? "bg-slate-50" : ""
                  }`}
                >
                  {/* En celular se reordena: quién y cuánto, qué, cómo va. */}
                  <div className="order-1 xl:order-none">
                    <button
                      type="button"
                      onClick={() => setOrdenSeleccionada(orden)}
                      className="min-h-11 text-left font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 xl:min-h-0"
                    >
                      {tituloOrden(orden)}
                    </button>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      {horaCorta(orden.createdAt)}
                      {tipo && (
                        <span className={`${ficha} ${tipo.color}`}>
                          {tipo.etiqueta}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {orden.creadorNombre || orden.mesero} ·{" "}
                      {obtenerEtiquetaRol(orden.creadorRol)}
                    </p>
                  </div>

                  <ul className="order-3 col-span-2 text-sm xl:order-none xl:col-span-1">
                    {orden.items.map((item, idx) => (
                      <li key={idx}>
                        {item.cantidad}× {item.producto.nombre}
                        {item.nivelPicante && (
                          <span className="ml-1 font-semibold text-red-700">
                            🌶️ {obtenerEtiquetaNivelPicante(item.nivelPicante)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="order-4 text-sm xl:order-none">
                    <span className={`${ficha} ${estado.color}`}>
                      {estado.etiqueta}
                    </span>
                    {tiempo && !orden.anulada && (
                      <span
                        className={`mt-1 block text-xs ${tiempo.aTiempo ? "text-slate-600" : "font-semibold text-red-700"}`}
                      >
                        {tiempo.aTiempo ? "A tiempo" : "Retrasada"}:{" "}
                        {tiempo.tiempoReal} de {orden.tiempoEstimado} min
                      </span>
                    )}
                    {orden.anulada && (
                      <span className="mt-1 block text-xs text-slate-600">
                        {orden.anuladaPorNombre}
                        {orden.razonAnulacion && `: ${orden.razonAnulacion}`}
                      </span>
                    )}
                  </div>

                  <div className="order-2 max-w-40 text-right tabular-nums xl:order-none xl:text-left">
                    <span
                      className={`font-bold ${orden.anulada ? "text-slate-600 line-through" : ""}`}
                    >
                      {dolares(calcularVentaPropia(orden))}
                    </span>
                    {envio > 0 && (
                      <span className="block text-xs text-slate-600">
                        + {dolares(envio)} de envío. Cliente paga{" "}
                        {dolares(Number(orden.total))}
                      </span>
                    )}
                  </div>

                  <div className="order-5 max-w-40 xl:order-none">
                    <PagoDeOrden
                      orden={orden}
                      onCobrar={() => abrirCobro(orden)}
                    />
                  </div>

                  <div className="order-6 col-span-2 flex flex-wrap gap-2 xl:order-none xl:col-span-1 xl:justify-end">
                    {!orden.anulada && (
                      <>
                        <button
                          type="button"
                          onClick={() => void reimprimirOrden(orden.id)}
                          disabled={reimprimiendoId === orden.id}
                          className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 xl:min-h-9 xl:border-transparent xl:px-2"
                        >
                          {reimprimiendoId === orden.id
                            ? "Enviando..."
                            : "Reimprimir"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOrdenAAnular(orden);
                            setRazonAnulacion("");
                          }}
                          className="min-h-11 rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 xl:min-h-9 xl:border-transparent xl:px-2"
                        >
                          Anular
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {ordenSeleccionada && (
        <DetalleOrdenModal
          orden={ordenSeleccionada}
          adminId={admin.id}
          adminNombre={admin.nombre}
          onClose={() => setOrdenSeleccionada(null)}
          onOrdenActualizada={(ordenActualizada) => {
            setOrdenSeleccionada(ordenActualizada as unknown as OrdenAdmin);
            void onCambio();
          }}
        />
      )}

      {ordenAAnular && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Anular orden
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {tituloOrden(ordenAAnular)} — {ordenAAnular.mesero} ·{" "}
              {dolares(Number(ordenAAnular.total))}. La orden no se borra: queda
              visible como anulada y deja de contar en el cuadre y en los
              reportes.
            </p>
            {ordenAAnular.empleadoId && (
              <p className="mb-4 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-800">
                Orden a cuenta de {ordenAAnular.empleadoNombre}: al anularla se
                abona el cargo en su cuenta.
              </p>
            )}
            {ordenAAnular.cobrada && !ordenAAnular.empleadoId && (
              <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ⚠️ Esta orden ya fue cobrada
                {ordenAAnular.metodoPago === "efectivo"
                  ? " en efectivo"
                  : ordenAAnular.metodoPago === "transferencia"
                    ? " por transferencia"
                    : ""}
                . Al anularla el pago sale de la caja del día: devuelve el dinero
                al cliente.
              </p>
            )}
            <p className="mb-4 text-xs text-gray-500">
              El stock no se devuelve automáticamente. Si el producto no se
              preparó, ajústalo en la pantalla de productos.
            </p>
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Razón de la anulación *
              <textarea
                value={razonAnulacion}
                onChange={(e) => setRazonAnulacion(e.target.value)}
                rows={3}
                className="mt-1 block w-full border rounded-lg px-4 py-2 text-black"
                placeholder="Ej: El cliente se retiró sin consumir"
              />
            </label>
            <div className="flex gap-3">
              <button
                onClick={anularOrden}
                disabled={anulando || razonAnulacion.trim() === ""}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 font-semibold"
              >
                {anulando ? "Anulando..." : "Confirmar anulación"}
              </button>
              <button
                onClick={() => {
                  setOrdenAAnular(null);
                  setRazonAnulacion("");
                }}
                disabled={anulando}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {ordenACobrar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-gray-800">
              💵 Cobrar orden
            </h3>
            <p className="text-gray-600 mb-1">
              {tituloOrden(ordenACobrar)} — {ordenACobrar.mesero}
            </p>
            <p className="text-2xl font-bold text-green-700 mb-1">
              {dolares(
                montoACobrarEnCaja({
                  tipoOrden: ordenACobrar.tipoOrden,
                  total: ordenACobrar.total,
                  costoEnvio: ordenACobrar.costoEnvio,
                  metodoPago,
                }),
              )}
            </p>
            {ordenACobrar.tipoOrden === "domicilio" &&
              Number(ordenACobrar.costoEnvio ?? 0) > 0 && (
                <p className="text-sm text-gray-500 mb-5">
                  {metodoPago === "efectivo"
                    ? `El cliente paga $${Number(ordenACobrar.total).toFixed(2)}; el motorizado conserva $${Number(ordenACobrar.costoEnvio ?? 0).toFixed(2)} del envío.`
                    : `Entra el total; luego se entregan $${Number(ordenACobrar.costoEnvio ?? 0).toFixed(2)} en efectivo al motorizado.`}
                </p>
              )}

            <p className="mt-4 text-sm font-semibold text-gray-700 mb-3">
              Método de pago:
            </p>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setMetodoPago("efectivo")}
                aria-pressed={metodoPago === "efectivo"}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPago === "efectivo"
                    ? "bg-green-700 text-white border-green-700"
                    : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                }`}
              >
                💵 Efectivo
              </button>
              <button
                onClick={() => setMetodoPago("transferencia")}
                aria-pressed={metodoPago === "transferencia"}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPago === "transferencia"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                🏦 Transferencia
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={cobrarOrden}
                disabled={cobrando}
                className="flex-1 bg-green-700 hover:bg-green-800 disabled:bg-gray-400 text-white py-2 rounded-lg font-bold transition-colors"
              >
                {cobrando ? "Procesando..." : "✓ Confirmar cobro"}
              </button>
              <button
                onClick={cerrarCobro}
                disabled={cobrando}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white py-2 rounded-lg font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
