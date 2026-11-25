"use client";

import { useState } from "react";
import UbicacionEntrega from "@/components/ordenes/UbicacionEntrega";
import DeliverySolicitado from "@/components/ordenes/DeliverySolicitado";
import HistorialOrdenTimeline from "./HistorialOrdenTimeline";
import { abrirComprobanteFirmado } from "@/lib/comprobante-cliente";
import {
  type NivelPicante,
  type TipoDescuento,
  descuentoDeOrden,
  esDescuentoSolicitado,
  etiquetaDescuento,
  obtenerEtiquetaNivelPicante,
} from "@/types/orden";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: string | number;
  disponible: boolean;
}

interface ItemOrden {
  cantidad: number;
  producto: {
    nombre: string;
    categoria: string;
  };
  precioUnitario: number;
  subtotal: number;
  observaciones?: string;
  nivelPicante?: NivelPicante | null;
  esCortesia?: boolean;
  adminCortesia?: string | null;
}

interface Orden {
  id: string;
  numeroDiario?: number | null;
  cobroUrl?: string | null;
  tipoOrden?: string;
  numeroMesa: number | null;
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  ubicacionUrl?: string | null;
  referenciaEntrega?: string | null;
  deliverySolicitadoAt?: string | null;
  recargo?: number | null;
  costoEnvio?: number | null;
  descuento?: number | string | null;
  descuentoTipo?: string | null;
  descuentoValor?: number | string | null;
  descuentoPor?: string | null;
  montoPagado?: number | string | null;
  mesero: string;
  estado: string;
  total: number;
  tiempoEstimado: number;
  modificada: boolean;
  cobrada?: boolean;
  empleadoId?: string | null;
  metodoPago?: string | null;
  metodoPagoPrevisto?: string | null;
  comprobanteTransferenciaKey?: string | null;
  pagos?: {
    id: string;
    metodoPago: string;
    monto: number;
    comprobanteTransferenciaKey: string | null;
  }[];
  fechaCobro?: string | null;
  cobradaPor?: string | null;
  anulada?: boolean;
  anuladaPorNombre?: string | null;
  razonAnulacion?: string | null;
  anuladaAt?: string | null;
  createdAt: string;
  updatedAt: string;
  observaciones?: string;
  items: ItemOrden[];
}

interface DetalleOrdenModalProps {
  orden: Orden;
  adminId?: string;
  adminNombre?: string;
  onClose: () => void;
  onOrdenActualizada?: (ordenActualizada: Orden) => void;
}

const ESTADOS_EDITABLES = ["pendiente", "en_preparacion", "lista", "entregada"];

export default function DetalleOrdenModal({
  orden: ordenInicial,
  adminId,
  adminNombre,
  onClose,
  onOrdenActualizada,
}: DetalleOrdenModalProps) {
  const [orden, setOrden] = useState<Orden>(ordenInicial);
  // Sync si el padre actualiza la orden. En vez de un efecto, se ajusta el
  // estado durante el render comparando contra el valor anterior de la prop
  // (patrón recomendado por React para "adjusting state when a prop changes").
  const [ordenInicialAnterior, setOrdenInicialAnterior] =
    useState(ordenInicial);
  if (ordenInicial !== ordenInicialAnterior) {
    setOrdenInicialAnterior(ordenInicial);
    setOrden(ordenInicial);
  }
  const [pestanaActiva, setPestanaActiva] = useState<"resumen" | "historial">(
    "resumen",
  );
  const [abriendoComprobante, setAbriendoComprobante] = useState(false);
  const [estadoCopia, setEstadoCopia] = useState<
    "inicial" | "copiando" | "copiado" | "error"
  >("inicial");

  const copiarEnlaceCobro = async () => {
    if (!orden.cobroUrl) return;
    setEstadoCopia("copiando");
    try {
      await navigator.clipboard.writeText(orden.cobroUrl);
      setEstadoCopia("copiado");
    } catch {
      setEstadoCopia("error");
    }
  };

  // Estado del modal de cortesía
  const [mostrarModalCortesia, setMostrarModalCortesia] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<Producto | null>(null);
  const [cantidadCortesia, setCantidadCortesia] = useState(1);
  const [razonCortesia, setRazonCortesia] = useState("");
  const [loadingCortesia, setLoadingCortesia] = useState(false);
  const [errorCortesia, setErrorCortesia] = useState("");

  const puedeAgregarCortesia =
    adminId && !orden.anulada && ESTADOS_EDITABLES.includes(orden.estado);

  const itemsCortesia = orden.items.filter((i) => i.esCortesia);

  // Descuento: solo admin; con un pago registrado el total no puede bajar.
  const descuentoActual = descuentoDeOrden(orden);
  const montoDescuento = Number(orden.descuento ?? 0);
  const puedeDescontar =
    Boolean(adminId) && !orden.anulada && orden.estado !== "cancelada";
  const [mostrarDescuento, setMostrarDescuento] = useState(false);
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuento>("monto");
  const [valorDescuento, setValorDescuento] = useState("");
  const [razonDescuento, setRazonDescuento] = useState("");
  const [loadingDescuento, setLoadingDescuento] = useState(false);
  const [errorDescuento, setErrorDescuento] = useState("");

  const abrirDescuento = () => {
    setTipoDescuento(descuentoActual?.tipo ?? "monto");
    setValorDescuento(descuentoActual ? String(descuentoActual.valor) : "");
    setRazonDescuento("");
    setErrorDescuento("");
    setMostrarDescuento(true);
  };

  const guardarDescuento = async (quitar: boolean) => {
    const descuento = quitar
      ? null
      : { tipo: tipoDescuento, valor: Number(valorDescuento.replace(",", ".")) };
    if (descuento && !esDescuentoSolicitado(descuento)) {
      setErrorDescuento(
        "Descuento no válido: un monto en dólares o un porcentaje hasta 100%",
      );
      return;
    }
    setLoadingDescuento(true);
    setErrorDescuento("");
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/descuento`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descuento,
          razon: razonDescuento.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorDescuento(data.error || "Error al aplicar descuento");
        return;
      }
      // La respuesta no trae los pagos: se conservan los que ya tenía el modal.
      const ordenActualizada = { ...orden, ...(data.orden as Orden) };
      setOrden(ordenActualizada);
      onOrdenActualizada?.(ordenActualizada);
      setMostrarDescuento(false);
    } catch {
      setErrorDescuento("Error de red al aplicar descuento");
    } finally {
      setLoadingDescuento(false);
    }
  };

  const cargarProductos = async () => {
    if (productos.length > 0) return;
    setCargandoProductos(true);
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();
      setProductos(data.filter((p: Producto) => p.disponible));
    } catch {
      setErrorCortesia("Error al cargar productos");
    } finally {
      setCargandoProductos(false);
    }
  };

  const abrirModalCortesia = () => {
    setMostrarModalCortesia(true);
    setProductoSeleccionado(null);
    setCantidadCortesia(1);
    setRazonCortesia("");
    setErrorCortesia("");
    cargarProductos();
  };

  const cerrarModalCortesia = () => {
    setMostrarModalCortesia(false);
    setBusquedaProducto("");
    setProductoSeleccionado(null);
    setErrorCortesia("");
  };

  const confirmarCortesia = async () => {
    if (!productoSeleccionado || !adminId) return;
    setLoadingCortesia(true);
    setErrorCortesia("");
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/cortesia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productoId: productoSeleccionado.id,
          cantidad: cantidadCortesia,
          adminId,
          razon: razonCortesia.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCortesia(data.error || "Error al aplicar cortesía");
        return;
      }
      const ordenActualizada = data.orden as Orden;
      setOrden(ordenActualizada);
      onOrdenActualizada?.(ordenActualizada);
      cerrarModalCortesia();
    } catch {
      setErrorCortesia("Error de red al aplicar cortesía");
    } finally {
      setLoadingCortesia(false);
    }
  };

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()),
  );

  // Pago acordado del domicilio: se cambia antes de cobrar (p. ej. el cliente ahora transfiere).
  const puedeCambiarPrevisto =
    Boolean(adminId) &&
    orden.tipoOrden === "domicilio" &&
    !orden.anulada &&
    orden.estado !== "cancelada" &&
    Number(orden.montoPagado ?? 0) === 0;
  const [cambiandoPrevisto, setCambiandoPrevisto] = useState(false);
  const [errorPrevisto, setErrorPrevisto] = useState("");

  const cambiarMetodoPrevisto = async () => {
    const nuevo = orden.metodoPagoPrevisto === "efectivo" ? "transferencia" : "efectivo";
    if (!window.confirm(`¿Cambiar el pago acordado a ${nuevo}?`)) return;
    setCambiandoPrevisto(true);
    setErrorPrevisto("");
    try {
      const res = await fetch(`/api/admin/ordenes/${orden.id}/metodo-pago`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodoPago: nuevo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorPrevisto(data.error || "Error al cambiar método de pago");
        return;
      }
      const actualizada = { ...orden, metodoPagoPrevisto: data.orden.metodoPagoPrevisto };
      setOrden(actualizada);
      onOrdenActualizada?.(actualizada);
    } catch {
      setErrorPrevisto("Error de red al cambiar método de pago");
    } finally {
      setCambiandoPrevisto(false);
    }
  };

  // Cobro registrado con el método equivocado. El servidor exige la caja abierta.
  const pagoUnico = orden.pagos?.length === 1 ? orden.pagos[0] : null;
  const puedeCorregirCobro =
    Boolean(adminId) &&
    pagoUnico !== null &&
    !orden.anulada &&
    !orden.empleadoId &&
    orden.estado !== "cancelada";
  const metodoCorregido =
    pagoUnico?.metodoPago === "efectivo" ? "transferencia" : "efectivo";
  const [mostrarCorreccion, setMostrarCorreccion] = useState(false);
  const [razonCorreccion, setRazonCorreccion] = useState("");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [errorCorreccion, setErrorCorreccion] = useState("");

  const corregirCobro = async () => {
    setCorrigiendo(true);
    setErrorCorreccion("");
    try {
      const res = await fetch(`/api/admin/ordenes/${orden.id}/corregir-cobro`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodoPago: metodoCorregido, razon: razonCorreccion }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCorreccion(data.error || "Error al corregir el cobro");
        return;
      }
      const actualizada = {
        ...orden,
        metodoPago: data.orden.metodoPago,
        pagos: orden.pagos?.map((pago) =>
          pago.id === data.cobroId
            ? { ...pago, metodoPago: data.orden.metodoPago }
            : pago,
        ),
      };
      setOrden(actualizada);
      onOrdenActualizada?.(actualizada);
      setMostrarCorreccion(false);
      setRazonCorreccion("");
    } catch {
      setErrorCorreccion("Error de red al corregir el cobro");
    } finally {
      setCorrigiendo(false);
    }
  };

  const abrirComprobante = async (cobroId?: string) => {
    setAbriendoComprobante(true);
    try {
      await abrirComprobanteFirmado(orden.id, cobroId);
    } finally {
      setAbriendoComprobante(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              #{orden.numeroDiario ?? orden.id.slice(-6)} ·{" "}
              {!orden.tipoOrden || orden.tipoOrden === "local"
                ? `Mesa ${orden.numeroMesa}`
                : (orden.nombreCliente ?? orden.telefonoCliente ?? "Cliente")}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date(orden.createdAt).toLocaleString("es-EC")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {puedeAgregarCortesia && (
              <button
                onClick={abrirModalCortesia}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
              >
                🎁 Agregar Cortesía
              </button>
            )}
            {puedeDescontar && (
              <button
                onClick={abrirDescuento}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
              >
                🏷️ Descuento
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="border-b bg-gray-50">
          <div className="flex gap-2 px-6">
            <button
              onClick={() => setPestanaActiva("resumen")}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 ${
                pestanaActiva === "resumen"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              📋 Resumen
            </button>
            <button
              onClick={() => setPestanaActiva("historial")}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                pestanaActiva === "historial"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              📜 Historial
              {orden.modificada && (
                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                  Modificada
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6">
          {pestanaActiva === "resumen" ? (
            <div className="space-y-6">
              {/* Tipo de Orden e Info del Cliente */}
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                    Tipo de Orden
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-semibold uppercase">
                      Tipo
                    </label>
                    <p className="mt-1">
                      {(!orden.tipoOrden || orden.tipoOrden === "local") && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                          🍽 Local
                        </span>
                      )}
                      {orden.tipoOrden === "para_llevar" && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800">
                          🥡 Para Llevar
                        </span>
                      )}
                      {orden.tipoOrden === "domicilio" && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800">
                          🛵 Domicilio
                        </span>
                      )}
                    </p>
                  </div>
                  {(!orden.tipoOrden || orden.tipoOrden === "local") && (
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">
                        Mesa
                      </label>
                      <p className="text-lg font-bold text-gray-800">
                        #{orden.numeroMesa}
                      </p>
                    </div>
                  )}
                  {(orden.tipoOrden === "para_llevar" ||
                    orden.tipoOrden === "domicilio") && (
                    <>
                      <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase">
                          Cliente
                        </label>
                        <p className="text-base font-semibold text-gray-800">
                          {orden.nombreCliente ?? "—"}
                        </p>
                      </div>
                      {orden.tipoOrden === "domicilio" && (
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase">
                            Teléfono
                          </label>
                          <p className="text-base text-gray-800">
                            {orden.telefonoCliente ?? "—"}
                          </p>
                        </div>
                      )}
                      {orden.tipoOrden === "domicilio" && (
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase">
                            Pago acordado
                          </label>
                          <p className="flex flex-wrap items-center gap-2 text-base text-gray-800">
                            {orden.metodoPagoPrevisto === "transferencia"
                              ? "🏦 Transferencia"
                              : orden.metodoPagoPrevisto === "efectivo"
                                ? "💵 Efectivo"
                                : "—"}
                            {puedeCambiarPrevisto && (
                              <button
                                onClick={() => void cambiarMetodoPrevisto()}
                                disabled={cambiandoPrevisto}
                                className="text-xs font-bold text-amber-700 underline disabled:opacity-50"
                              >
                                {cambiandoPrevisto
                                  ? "Cambiando…"
                                  : `🔁 Cambiar a ${orden.metodoPagoPrevisto === "efectivo" ? "transferencia" : "efectivo"}`}
                              </button>
                            )}
                          </p>
                          {errorPrevisto && (
                            <p className="text-sm text-red-600">{errorPrevisto}</p>
                          )}
                        </div>
                      )}
                      {orden.tipoOrden === "domicilio" && (
                        <div className="col-span-full">
                          <label className="text-xs text-gray-500 font-semibold uppercase">
                            Entrega
                          </label>
                          <UbicacionEntrega
                            key={`${orden.id}:${orden.ubicacionUrl}:${orden.referenciaEntrega}`}
                            ordenId={orden.id}
                            ubicacionUrl={orden.ubicacionUrl ?? null}
                            referenciaEntrega={orden.referenciaEntrega ?? null}
                            editable={!orden.anulada}
                            onActualizada={(ubicacion) => {
                              const actualizada = { ...orden, ...ubicacion };
                              setOrden(actualizada);
                              onOrdenActualizada?.(actualizada);
                            }}
                          />
                          <DeliverySolicitado
                            key={`${orden.id}:${orden.deliverySolicitadoAt}`}
                            ordenId={orden.id}
                            deliverySolicitadoAt={orden.deliverySolicitadoAt ?? null}
                            editable={
                              !orden.anulada &&
                              !["cancelada", "pendiente_aprobacion_stock"].includes(orden.estado)
                            }
                            onRegistrado={(deliverySolicitadoAt) => {
                              const actualizada = { ...orden, deliverySolicitadoAt };
                              setOrden(actualizada);
                              onOrdenActualizada?.(actualizada);
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Información General */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 font-semibold">
                    Mesero
                  </label>
                  <p className="text-lg text-gray-800">{orden.mesero}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-semibold">
                    Estado
                  </label>
                  <p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        orden.estado === "completada"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {orden.estado}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-semibold">
                    Tiempo Estimado
                  </label>
                  <p className="text-lg text-gray-800">
                    {orden.tiempoEstimado} minutos
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-semibold">
                    Total
                  </label>
                  <p className="text-2xl font-bold text-green-600">
                    ${Number(orden.total).toFixed(2)}
                  </p>
                </div>
              </div>

              {orden.pagos && orden.pagos.length > 0 ? (
                <div className="mt-4">
                  <p className="text-sm font-bold text-gray-500">Pagos</p>
                  <ul className="mt-1 space-y-1">
                    {orden.pagos.map((pago) => (
                      <li key={pago.id} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{pago.metodoPago}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-semibold">${pago.monto.toFixed(2)}</span>
                          {pago.metodoPago === "transferencia" &&
                            (pago.comprobanteTransferenciaKey ? (
                              <button
                                onClick={() => void abrirComprobante(pago.id)}
                                disabled={abriendoComprobante}
                                className="text-xs font-bold text-blue-700 underline disabled:opacity-50"
                              >
                                📎 Ver
                              </button>
                            ) : (
                              <span className="text-xs text-amber-700">sin comprobante</span>
                            ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {puedeCorregirCobro && !mostrarCorreccion && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorCorreccion("");
                        setMostrarCorreccion(true);
                      }}
                      className="mt-2 min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Corregir: fue {metodoCorregido}
                    </button>
                  )}
                  {puedeCorregirCobro && mostrarCorreccion && (
                    <form
                      className="mt-2 space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3"
                      onSubmit={(evento) => {
                        evento.preventDefault();
                        void corregirCobro();
                      }}
                    >
                      <label className="block text-sm font-semibold text-slate-800">
                        ¿Por qué el cobro fue {metodoCorregido}?
                        <input
                          type="text"
                          required
                          maxLength={200}
                          value={razonCorreccion}
                          onChange={(e) => setRazonCorreccion(e.target.value)}
                          placeholder="Comprobado en el banco"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                        />
                      </label>
                      <p className="text-xs text-slate-600">
                        Cambia lo que debe haber en la caja y en el banco. Queda en el
                        historial y en el resumen del cierre.
                      </p>
                      {errorCorreccion && (
                        <p role="alert" className="text-sm text-red-700">
                          {errorCorreccion}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={corrigiendo || !razonCorreccion.trim()}
                          className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-700"
                        >
                          {corrigiendo ? "Corrigiendo..." : `Cambiar a ${metodoCorregido}`}
                        </button>
                        <button
                          type="button"
                          disabled={corrigiendo}
                          onClick={() => setMostrarCorreccion(false)}
                          className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                orden.metodoPago === "transferencia" && (
                  <div className="mt-4">
                    <p className="text-sm font-bold text-gray-500">Comprobante</p>
                    {orden.comprobanteTransferenciaKey ? (
                      <button
                        onClick={() => void abrirComprobante()}
                        disabled={abriendoComprobante}
                        className="mt-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-400"
                      >
                        {abriendoComprobante ? "Abriendo…" : "📎 Ver comprobante"}
                      </button>
                    ) : (
                      <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Registrado sin comprobante
                      </p>
                    )}
                  </div>
                )
              )}

              {/* Observaciones Generales */}
              {orden.observaciones && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <label className="text-sm text-blue-900 font-semibold">
                    Observaciones Generales:
                  </label>
                  <p className="text-blue-800 mt-1">{orden.observaciones}</p>
                </div>
              )}

              {mostrarDescuento && (
                <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-gray-800">
                    Descuento sobre productos
                  </h3>
                  <p className="text-xs text-gray-600">
                    Envases y envío no se descuentan. Si la orden ya tiene un
                    pago registrado, el total no puede bajar.
                  </p>
                  <div className="flex gap-2">
                    <select
                      aria-label="Tipo de descuento"
                      value={tipoDescuento}
                      onChange={(e) =>
                        setTipoDescuento(e.target.value as TipoDescuento)
                      }
                      className="border rounded-lg px-3 py-2 text-black bg-white"
                    >
                      <option value="monto">$</option>
                      <option value="porcentaje">%</option>
                    </select>
                    <input
                      aria-label="Valor del descuento"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={valorDescuento}
                      onChange={(e) => setValorDescuento(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-black bg-white"
                      placeholder={
                        tipoDescuento === "porcentaje" ? "Ej: 10" : "Ej: 2.00"
                      }
                    />
                  </div>
                  <input
                    aria-label="Razón del descuento"
                    type="text"
                    value={razonDescuento}
                    onChange={(e) => setRazonDescuento(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-black bg-white"
                    placeholder="Razón (opcional)"
                  />
                  {errorDescuento && (
                    <p className="text-sm text-red-600">{errorDescuento}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => guardarDescuento(false)}
                      disabled={loadingDescuento || !valorDescuento.trim()}
                      className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold"
                    >
                      {loadingDescuento ? "Guardando..." : "Aplicar descuento"}
                    </button>
                    {descuentoActual && (
                      <button
                        onClick={() => guardarDescuento(true)}
                        disabled={loadingDescuento}
                        className="border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 px-4 py-2 rounded-lg font-semibold"
                      >
                        Quitar descuento
                      </button>
                    )}
                    <button
                      onClick={() => setMostrarDescuento(false)}
                      disabled={loadingDescuento}
                      className="text-gray-600 px-4 py-2"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 text-lg">
                  Items de la Orden:
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Producto
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Categoría
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                          Cantidad
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          P. Unit.
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orden.items.map((item, idx) => (
                        <tr
                          key={idx}
                          className={
                            item.esCortesia
                              ? "bg-emerald-50 hover:bg-emerald-100"
                              : "hover:bg-gray-50"
                          }
                        >
                          <td className="px-4 py-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-800">
                                  {item.producto.nombre}
                                </p>
                                {item.esCortesia && (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                                    🎁 CORTESÍA
                                  </span>
                                )}
                              </div>
                              {item.observaciones && (
                                <p className="text-xs text-gray-500 italic">
                                  Nota: {item.observaciones}
                                </p>
                              )}
                              {item.nivelPicante && (
                                <p className="text-xs font-bold text-red-700 mt-0.5">
                                  🌶️ {obtenerEtiquetaNivelPicante(item.nivelPicante)}
                                </p>
                              )}
                              {item.esCortesia && item.adminCortesia && (
                                <p className="text-xs text-emerald-600 mt-0.5">
                                  Autorizado por: {item.adminCortesia}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.producto.categoria}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-800">
                            {item.cantidad}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {item.esCortesia ? (
                              <span className="text-emerald-600 font-semibold">
                                $0.00
                              </span>
                            ) : (
                              `$${Number(item.precioUnitario).toFixed(2)}`
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">
                            {item.esCortesia ? (
                              <span className="text-emerald-600">$0.00</span>
                            ) : (
                              `$${Number(item.subtotal).toFixed(2)}`
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      {itemsCortesia.length > 0 && (
                        <tr className="border-t border-emerald-200">
                          <td
                            colSpan={4}
                            className="px-4 py-2 text-right text-sm text-emerald-700"
                          >
                            🎁 Cortesías ({itemsCortesia.length} ítem
                            {itemsCortesia.length !== 1 ? "s" : ""}):
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-emerald-700 font-semibold">
                            $0.00
                          </td>
                        </tr>
                      )}
                      {(Number(orden.recargo) > 0 ||
                        Number(orden.costoEnvio) > 0 ||
                        montoDescuento > 0) && (
                        <>
                          <tr className="border-t">
                            <td
                              colSpan={4}
                              className="px-4 py-2 text-right text-sm text-gray-600"
                            >
                              Subtotal productos:
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-700">
                              $
                              {(
                                Number(orden.total) -
                                Number(orden.recargo ?? 0) -
                                Number(orden.costoEnvio ?? 0) +
                                montoDescuento
                              ).toFixed(2)}
                            </td>
                          </tr>
                          {montoDescuento > 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-2 text-right text-sm text-amber-700"
                              >
                                🏷️ Descuento
                                {descuentoActual
                                  ? ` (${etiquetaDescuento(descuentoActual)})`
                                  : ""}
                                {orden.descuentoPor
                                  ? ` · ${orden.descuentoPor}`
                                  : ""}
                                :
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-amber-700 font-semibold">
                                -${montoDescuento.toFixed(2)}
                              </td>
                            </tr>
                          )}
                          {Number(orden.recargo) > 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-2 text-right text-sm text-gray-600"
                              >
                                Envases de combos (
                                {orden.tipoOrden === "domicilio"
                                  ? "domicilio"
                                  : "para llevar"}
                                ):
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-700">
                                +${Number(orden.recargo).toFixed(2)}
                              </td>
                            </tr>
                          )}
                          {Number(orden.costoEnvio) > 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-2 text-right text-sm text-gray-600"
                              >
                                🛵 Costo de envío:
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-700">
                                +${Number(orden.costoEnvio).toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                      <tr className="border-t-2 border-gray-300">
                        <td
                          colSpan={4}
                          className="px-4 py-3 text-right font-bold text-gray-800"
                        >
                          TOTAL:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-600 text-lg">
                          ${Number(orden.total).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Orden anulada: sigue existiendo, pero fuera del cuadre */}
              {orden.anulada && (
                <div className="bg-gray-100 border-l-4 border-gray-400 p-4 rounded">
                  <p className="text-sm font-bold text-gray-700">
                    🚫 Orden anulada
                    {orden.anuladaPorNombre
                      ? ` por ${orden.anuladaPorNombre}`
                      : ""}
                    {orden.anuladaAt
                      ? ` · ${new Date(orden.anuladaAt).toLocaleString("es-EC")}`
                      : ""}
                  </p>
                  {orden.razonAnulacion && (
                    <p className="text-sm text-gray-600 mt-1">
                      Razón: {orden.razonAnulacion}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    No cuenta en el cuadre de caja ni en los reportes.
                  </p>
                </div>
              )}

              {/* Badge de Modificación */}
              {orden.modificada && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <p className="text-sm text-yellow-800 font-semibold">
                    ⚠️ Esta orden fue modificada después de su creación. Ver
                    pestaña &quot;Historial&quot; para detalles completos.
                  </p>
                </div>
              )}

              {/* Información de Cobro */}
              {orden.cobrada ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    ✅ Orden Cobrada
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">
                        Método de Pago
                      </label>
                      <p className="mt-1">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                            !orden.metodoPago
                              ? "bg-gray-100 text-gray-600"
                              : orden.metodoPago === "efectivo"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {!orden.metodoPago
                            ? "— Desconocido"
                            : orden.metodoPago === "efectivo"
                              ? "💵 Efectivo"
                              : orden.metodoPago === "mixto"
                                ? "🔀 Mixto"
                                : "🏦 Transferencia"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">
                        Cobrado por
                      </label>
                      <p className="text-sm text-gray-800 mt-1 font-semibold">
                        {orden.cobradaPor ?? "—"}
                      </p>
                    </div>
                    {orden.fechaCobro && (
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 font-semibold uppercase">
                          Fecha de Cobro
                        </label>
                        <p className="text-sm text-gray-800 mt-1">
                          {new Date(orden.fechaCobro).toLocaleString("es-EC")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : !orden.anulada && orden.estado !== "cancelada" ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-700 font-semibold">
                    ⏳ Pendiente de cobro
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">
                Timeline de Cambios
              </h3>
              <HistorialOrdenTimeline ordenId={orden.id} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 space-y-3">
          <p role="status" className="text-sm text-emerald-700 empty:hidden">
            {estadoCopia === "copiado" && "Link de cobro copiado."}
          </p>
          {estadoCopia === "error" && orden.cobroUrl && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-amber-800">
                No se pudo copiar automáticamente. Selecciona el enlace y cópialo.
              </p>
              <input
                aria-label="Link de cobro"
                readOnly
                value={orden.cobroUrl}
                onFocus={(evento) => evento.currentTarget.select()}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            {orden.cobroUrl && (
              <button
                type="button"
                onClick={copiarEnlaceCobro}
                disabled={estadoCopia === "copiando"}
                className="flex-1 min-h-11 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
              >
                <span aria-hidden="true">🔗</span>{" "}
                {estadoCopia === "copiando"
                  ? "Copiando…"
                  : "Copiar link de cobro"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Cortesía */}
      {mostrarModalCortesia && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b bg-emerald-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
                🎁 Agregar Cortesía
              </h3>
              <button
                onClick={cerrarModalCortesia}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Buscador de producto */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Buscar Producto
                </label>
                <input
                  type="text"
                  placeholder="Escribe el nombre del producto..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              {/* Lista de productos */}
              <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {cargandoProductos ? (
                  <p className="text-center py-6 text-gray-500 text-sm">
                    Cargando productos...
                  </p>
                ) : productosFiltrados.length === 0 ? (
                  <p className="text-center py-6 text-gray-500 text-sm">
                    No se encontraron productos
                  </p>
                ) : (
                  productosFiltrados.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProductoSeleccionado(p)}
                      className={`w-full text-left px-4 py-3 flex justify-between items-center border-b last:border-b-0 transition-colors ${
                        productoSeleccionado?.id === p.id
                          ? "bg-emerald-100 border-l-4 border-l-emerald-500"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-gray-800 text-sm">
                          {p.nombre}
                        </p>
                        <p className="text-xs text-gray-500">{p.categoria}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        ${Number(p.precio).toFixed(2)}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Producto seleccionado */}
              {productoSeleccionado && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-sm text-emerald-800">
                    <span className="font-semibold">Seleccionado:</span>{" "}
                    {productoSeleccionado.nombre}
                  </p>
                </div>
              )}

              {/* Cantidad */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min={1}
                  value={cantidadCortesia}
                  onChange={(e) =>
                    setCantidadCortesia(
                      Math.max(1, parseInt(e.target.value) || 1),
                    )
                  }
                  className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Razón (opcional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Razón{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Compensación por demora, Cumpleaños..."
                  value={razonCortesia}
                  onChange={(e) => setRazonCortesia(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Autorizado por */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
                👤 Autorizado por:{" "}
                <span className="font-semibold text-gray-800">
                  {adminNombre}
                </span>
              </div>

              {errorCortesia && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                  {errorCortesia}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t flex gap-3">
              <button
                onClick={cerrarModalCortesia}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCortesia}
                disabled={!productoSeleccionado || loadingCortesia}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg font-semibold"
              >
                {loadingCortesia ? "Aplicando..." : "✓ Confirmar Cortesía"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
