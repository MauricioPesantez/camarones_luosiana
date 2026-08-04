"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
import DetalleOrdenModal from "@/components/admin/DetalleOrdenModal";
import { ProductoStockBajo } from "@/types/stock";
import {
  OrdenPendienteAprobacion,
  MetodoPago,
  type NivelPicante,
  calcularVentaPropia,
  obtenerCostoEnvio,
  obtenerEtiquetaNivelPicante,
} from "@/types/orden";
import { calcularResumenCuadre } from "@/types/cuadre";
import { montoACobrarEnCaja } from "@/types/cobro";
import { obtenerFechaEcuador } from "@/lib/fecha-ecuador";
import { obtenerEtiquetaRol, ROLES } from "@/types/usuario";
import {
  ESTADO_RETIRO_ANULADO,
  obtenerEtiquetaCategoriaRetiro,
  type RetiroCaja,
} from "@/types/retiro";

interface Orden {
  id: string;
  cobroUrl: string | null;
  printRevision: number;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  recargo: number | null;
  costoEnvio: number | null;
  mesero: string;
  creadorNombre: string;
  creadorRol: string;
  estado: string;
  total: number;
  tiempoEstimado: number;
  modificada: boolean;
  cobrada: boolean;
  metodoPago: string | null;
  metodoPagoPrevisto: string | null;
  fechaCobro: string | null;
  cobradaPor: string | null;
  createdAt: string;
  updatedAt: string;
  observaciones?: string;
  items: {
    cantidad: number;
    producto: {
      nombre: string;
      categoria: string;
    };
    precioUnitario: number;
    subtotal: number;
    observaciones?: string;
    nivelPicante?: NivelPicante | null;
  }[];
}

function obtenerTituloOrden(orden: {
  tipoOrden?: string | null;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente?: string | null;
}): string {
  if (!orden.tipoOrden || orden.tipoOrden === "local") {
    return `Mesa ${orden.numeroMesa}`;
  }

  return orden.nombreCliente ?? orden.telefonoCliente ?? "Cliente";
}

export default function AdminPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(
    null,
  );
  const [fechaFiltro, setFechaFiltro] = useState(
    obtenerFechaEcuador,
  );
  const [rolCreadorFiltro, setRolCreadorFiltro] = useState("todos");
  const [usuarioCreadorFiltro, setUsuarioCreadorFiltro] = useState("todos");
  const [tipoOrdenFiltro, setTipoOrdenFiltro] = useState("todos");
  const [estadoCobroFiltro, setEstadoCobroFiltro] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [productosStockBajo, setProductosStockBajo] = useState<
    ProductoStockBajo[]
  >([]);
  const [ordenesPendientes, setOrdenesPendientes] = useState<
    OrdenPendienteAprobacion[]
  >([]);
  const [mostrarModalAprobacion, setMostrarModalAprobacion] = useState(false);
  const [ordenParaAprobar, setOrdenParaAprobar] =
    useState<OrdenPendienteAprobacion | null>(null);
  const [razonAprobacion, setRazonAprobacion] = useState("");
  const [retiros, setRetiros] = useState<RetiroCaja[]>([]);
  const [retiroAAnular, setRetiroAAnular] = useState<RetiroCaja | null>(null);
  const [razonAnulacion, setRazonAnulacion] = useState("");
  const [loadingAnular, setLoadingAnular] = useState(false);
  const [ordenACobrar, setOrdenACobrar] = useState<Orden | null>(null);
  const [metodoPagoAdmin, setMetodoPagoAdmin] =
    useState<MetodoPago>("efectivo");
  const [loadingCobrar, setLoadingCobrar] = useState(false);

  const cargarOrdenes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cuadre?fecha=${fechaFiltro}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al cargar el cuadre");
      }
      setOrdenes(data.ordenes || []);
      setRetiros(data.retiros || []);
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarProductosStockBajo = async () => {
    try {
      const res = await fetch("/api/stock/bajo");
      const data = await res.json();
      setProductosStockBajo(data.productos || []);
    } catch (error) {
      console.error("Error al cargar productos con stock bajo:", error);
    }
  };

  const cargarOrdenesPendientes = async () => {
    try {
      const res = await fetch("/api/ordenes/aprobacion/pendientes");
      const data = await res.json();
      setOrdenesPendientes(data.ordenes || []);
    } catch (error) {
      console.error("Error al cargar órdenes pendientes:", error);
    }
  };

  const aprobarOrden = async (ordenId: string, razon?: string) => {
    if (!usuario) return;

    try {
      const res = await fetch("/api/ordenes/aprobacion/aprobar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordenId,
          adminId: usuario.id,
          razon,
        }),
      });

      if (res.ok) {
        alert("Orden aprobada exitosamente");
        await cargarOrdenesPendientes();
        setMostrarModalAprobacion(false);
        setOrdenParaAprobar(null);
        setRazonAprobacion("");
      } else {
        const error = await res.json();
        alert(error.error || "Error al aprobar orden");
      }
    } catch (error) {
      console.error("Error al aprobar orden:", error);
      alert("Error al aprobar orden");
    }
  };

  const rechazarOrden = async (ordenId: string) => {
    if (!usuario) return;
    if (!confirm("¿Estás seguro de rechazar esta orden? Será cancelada."))
      return;

    try {
      const res = await fetch("/api/ordenes/aprobacion/rechazar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordenId,
          adminId: usuario.id,
          razon: "Rechazada por falta de stock",
        }),
      });

      if (res.ok) {
        alert("Orden rechazada exitosamente");
        await cargarOrdenesPendientes();
      } else {
        const error = await res.json();
        alert(error.error || "Error al rechazar orden");
      }
    } catch (error) {
      console.error("Error al rechazar orden:", error);
      alert("Error al rechazar orden");
    }
  };

  const cobrarOrden = async () => {
    if (!ordenACobrar) return;
    setLoadingCobrar(true);
    try {
      const res = await fetch(`/api/ordenes/${ordenACobrar.id}/cobrar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metodoPago: metodoPagoAdmin,
          cobradaPor: usuario?.nombre ?? "",
          expectedRevision: ordenACobrar.printRevision,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (res.ok) {
        setOrdenACobrar(null);
        setMetodoPagoAdmin("efectivo");
        await cargarOrdenes();
      } else {
        const error = await res.json();
        alert(error.error || "Error al cobrar la orden");
      }
    } catch (error) {
      console.error("Error al cobrar:", error);
      alert("Error al cobrar la orden");
    } finally {
      setLoadingCobrar(false);
    }
  };

  useEffect(() => {
    if (usuario && usuario.rol === "admin") {
      cargarOrdenes();
      cargarProductosStockBajo();
      cargarOrdenesPendientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaFiltro, usuario]);

  // Polling para actualizar órdenes pendientes cada 30 segundos
  useEffect(() => {
    if (usuario && usuario.rol === "admin") {
      const interval = setInterval(() => {
        cargarOrdenesPendientes();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [usuario]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario || usuario.rol !== "admin") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">Acceso denegado</div>
      </div>
    );
  }

  // Función para calcular si una orden salió a tiempo
  const calcularEstadoTiempo = (orden: Orden) => {
    const estadosFinales = ["entregada", "cobrada"];
    if (!estadosFinales.includes(orden.estado) || !orden.tiempoEstimado) {
      return null;
    }

    const creacion = new Date(orden.createdAt).getTime();
    const completada = new Date(orden.updatedAt).getTime();
    const tiempoReal = Math.floor((completada - creacion) / 60000); // en minutos

    return {
      tiempoReal,
      tiempoEstimado: orden.tiempoEstimado,
      aTiempo: tiempoReal <= orden.tiempoEstimado,
    };
  };

  const anularRetiro = async () => {
    if (!retiroAAnular || !usuario) return;
    setLoadingAnular(true);
    try {
      const res = await fetch(`/api/retiros/${retiroAAnular.id}/anular`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razon: razonAnulacion }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al anular el retiro");
      }
      setRetiroAAnular(null);
      setRazonAnulacion("");
      await cargarOrdenes();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error al anular el retiro");
    } finally {
      setLoadingAnular(false);
    }
  };

  const creadoresDisponibles = Array.from(
    new Map(
      ordenes
        .filter(
          (orden) =>
            rolCreadorFiltro === "todos" ||
            orden.creadorRol === rolCreadorFiltro,
        )
        .map((orden) => [
          orden.creadorNombre,
          { nombre: orden.creadorNombre, rol: orden.creadorRol },
        ]),
    ).values(),
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const ordenesFiltradas = ordenes.filter(
    (orden) =>
      (rolCreadorFiltro === "todos" ||
        orden.creadorRol === rolCreadorFiltro) &&
      (usuarioCreadorFiltro === "todos" ||
        orden.creadorNombre === usuarioCreadorFiltro) &&
      (tipoOrdenFiltro === "todos" || orden.tipoOrden === tipoOrdenFiltro) &&
      (estadoCobroFiltro === "todos" ||
        (estadoCobroFiltro === "cobradas" && orden.cobrada) ||
        (estadoCobroFiltro === "sin_cobrar" && !orden.cobrada)),
  );
  // Un retiro no tiene tipo de orden ni estado de cobro. Si esos filtros estan
  // activos, mezclar todos los retiros con un subconjunto de las ventas daria
  // un efectivo en caja sin significado: mejor dejarlos fuera y avisarlo.
  const filtrosDeOrdenActivos =
    tipoOrdenFiltro !== "todos" || estadoCobroFiltro !== "todos";

  // La tabla siempre muestra los retiros de quien se este filtrando; lo que
  // cambia es si entran o no al calculo de la caja.
  const retirosVisibles = retiros.filter(
    (retiro) =>
      (rolCreadorFiltro === "todos" || retiro.usuarioRol === rolCreadorFiltro) &&
      (usuarioCreadorFiltro === "todos" ||
        retiro.usuarioNombre === usuarioCreadorFiltro),
  );

  const resumenCuadre = calcularResumenCuadre(
    ordenesFiltradas,
    filtrosDeOrdenActivos ? [] : retirosVisibles,
  );

  const ordenesPorEstado = {
    pendiente: ordenesFiltradas.filter(
      (o) =>
        o.estado === "pendiente" ||
        o.estado === "en_preparacion" ||
        o.estado === "lista" ||
        o.estado === "entregada",
    ).length,
    cobrada: resumenCuadre.ordenesCobradas,
    total: ordenesFiltradas.length,
  };

  // Calcular estadísticas de tiempo (usadas por fila)

  if (!usuario) return null;

  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo="Cuadre de caja"
      activoId="cuadre"
    >
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
        {/* Filtros del cuadre */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <label className="text-sm font-semibold text-gray-700">
              Fecha del cuadre
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="mt-1 block w-full border rounded-lg px-4 py-2 text-black"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Rol que creó la orden
              <select
                value={rolCreadorFiltro}
                onChange={(e) => {
                  setRolCreadorFiltro(e.target.value);
                  setUsuarioCreadorFiltro("todos");
                }}
                className="mt-1 block w-full border rounded-lg px-4 py-2 text-black bg-white"
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
            <label className="text-sm font-semibold text-gray-700">
              Usuario creador
              <select
                value={usuarioCreadorFiltro}
                onChange={(e) => setUsuarioCreadorFiltro(e.target.value)}
                className="mt-1 block w-full border rounded-lg px-4 py-2 text-black bg-white"
              >
                <option value="todos">Todos los usuarios</option>
                {creadoresDisponibles.map((creador) => (
                  <option key={creador.nombre} value={creador.nombre}>
                    {creador.nombre} · {obtenerEtiquetaRol(creador.rol)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Tipo de orden
              <select
                value={tipoOrdenFiltro}
                onChange={(e) => setTipoOrdenFiltro(e.target.value)}
                className="mt-1 block w-full border rounded-lg px-4 py-2 text-black bg-white"
              >
                <option value="todos">Todos los tipos</option>
                <option value="local">Local / mesa</option>
                <option value="para_llevar">Para llevar</option>
                <option value="domicilio">Domicilio</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Estado de cobro
              <select
                value={estadoCobroFiltro}
                onChange={(e) => setEstadoCobroFiltro(e.target.value)}
                className="mt-1 block w-full border rounded-lg px-4 py-2 text-black bg-white"
              >
                <option value="todos">Todas</option>
                <option value="cobradas">Cobradas</option>
                <option value="sin_cobrar">No cobradas</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              El reporte incluye órdenes creadas en Ecuador durante la fecha
              seleccionada. El monto de órdenes incluye cobradas y no cobradas;
              la caja y las transferencias solo incluyen pagos confirmados.
            </p>
            <button
              onClick={cargarOrdenes}
              className="shrink-0 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Alertas y Notificaciones */}
        {(ordenesPendientes.length > 0 || productosStockBajo.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Órdenes Pendientes de Aprobación */}
            {ordenesPendientes.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
                    ⚠️ Órdenes Pendientes de Aprobación
                    <span className="bg-red-600 text-white rounded-full px-3 py-1 text-sm">
                      {ordenesPendientes.length}
                    </span>
                  </h2>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {ordenesPendientes.map((orden) => (
                    <div
                      key={orden.id}
                      className="bg-white rounded-lg p-4 border border-red-300"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-lg">
                            {obtenerTituloOrden(orden)}{" "}
                            - {orden.mesero}
                          </p>
                          <p className="text-sm text-gray-600">
                            Total: ${Number(orden.total).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(orden.createdAt).toLocaleString("es-EC")}
                          </p>
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-red-700 mb-1">
                          Items sin stock:
                        </p>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {orden.itemsSinStock.map((item, idx) => (
                            <li key={idx} className="flex justify-between">
                              <span>{item.productoNombre}</span>
                              <span className="text-red-600 font-semibold">
                                Solicitado: {item.cantidadSolicitada} |
                                Disponible: {item.stockDisponible}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setOrdenParaAprobar(orden);
                            setMostrarModalAprobacion(true);
                          }}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                        >
                          ✓ Aprobar
                        </button>
                        <button
                          onClick={() => rechazarOrden(orden.id)}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
                        >
                          ✕ Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Productos con Stock Bajo */}
            {productosStockBajo.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-yellow-800 flex items-center gap-2">
                    📦 Productos con Stock Bajo
                    <span className="bg-yellow-600 text-white rounded-full px-3 py-1 text-sm">
                      {productosStockBajo.length}
                    </span>
                  </h2>
                  <a
                    href="/admin/productos"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Ver todos
                  </a>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {productosStockBajo.map((producto) => (
                    <div
                      key={producto.id}
                      className="bg-white rounded-lg p-3 border border-yellow-300 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold text-orange-500">
                          {producto.nombre}
                        </p>
                        <p className="text-sm text-gray-600">
                          {producto.categoria}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            producto.stock === 0
                              ? "text-red-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {producto.stock} unidades
                        </p>
                        <p className="text-xs text-gray-500">
                          Mínimo: {producto.stockMinimo}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal de Aprobación */}
        {mostrarModalAprobacion && ordenParaAprobar && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">
                Aprobar Orden sin Stock
              </h3>
              <p className="text-gray-700 mb-4">
                {obtenerTituloOrden(ordenParaAprobar)}{" "}
                - {ordenParaAprobar.mesero}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón de aprobación (opcional):
                </label>
                <textarea
                  value={razonAprobacion}
                  onChange={(e) => setRazonAprobacion(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Ej: Cliente VIP, reposición en camino..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    aprobarOrden(ordenParaAprobar.id, razonAprobacion)
                  }
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                >
                  Confirmar Aprobación
                </button>
                <button
                  onClick={() => {
                    setMostrarModalAprobacion(false);
                    setOrdenParaAprobar(null);
                    setRazonAprobacion("");
                  }}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cuadro de caja */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-900 p-5 shadow-lg">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-white">Cuadro de caja</h2>
              <p className="text-sm text-slate-300">
                Resultado según los filtros seleccionados
              </p>
            </div>
            <p className="text-sm text-slate-300">
              {resumenCuadre.ordenesCobradas} cobradas ·{" "}
              {resumenCuadre.ordenesSinCobrar} no cobradas
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-lg bg-violet-500 p-4 text-white">
              <h3 className="text-sm font-semibold text-violet-50">
                🧾 Venta del local
              </h3>
              <p className="mt-1 text-3xl font-black">
                ${resumenCuadre.ventasTotales.toFixed(2)}
              </p>
              <p className="mt-2 text-xs text-violet-50">
                Cobradas y no cobradas, sin el envío del motorizado
              </p>
            </div>
            <div className="rounded-lg bg-amber-500 p-4 text-white">
              <h3 className="text-sm font-semibold text-amber-50">
                ⏳ Pendiente por cobrar
              </h3>
              <p className="mt-1 text-3xl font-black">
                ${resumenCuadre.ventasSinCobrar.toFixed(2)}
              </p>
              <p className="mt-2 text-xs text-amber-50">
                Venta de las órdenes que todavía no registran pago
              </p>
            </div>
            <div
              className={`rounded-lg p-4 text-white ${
                resumenCuadre.efectivoEnCaja < 0 ? "bg-red-600" : "bg-emerald-500"
              }`}
            >
              <h3 className="text-sm font-semibold text-emerald-50">
                💰 Efectivo que debe haber en caja
              </h3>
              <p className="mt-1 text-3xl font-black">
                ${resumenCuadre.efectivoEnCaja.toFixed(2)}
              </p>
              <p className="mt-2 text-xs text-emerald-50">
                Ventas + cobros a motorizados − entregas a motorizados − retiros
              </p>
              {filtrosDeOrdenActivos && (
                <p className="mt-2 rounded bg-black/20 px-2 py-1 text-xs">
                  ⚠️ Retiros excluidos por los filtros de orden aplicados
                </p>
              )}
            </div>
            <div className="rounded-lg bg-blue-500 p-4 text-white">
              <h3 className="text-sm font-semibold text-blue-50">
                🏦 Ventas por transferencia
              </h3>
              <p className="mt-1 text-3xl font-black">
                ${resumenCuadre.transferenciasVentas.toFixed(2)}
              </p>
              <p className="mt-2 text-xs text-blue-50">
                Ingreso propio depositado, sin el envío del motorizado
              </p>
            </div>
            <div className="rounded-lg bg-sky-700 p-4 text-white">
              <h3 className="text-sm font-semibold text-sky-100">
                🧾 Recibido en el banco
              </h3>
              <p className="mt-1 text-3xl font-black">
                ${resumenCuadre.depositosRecibidos.toFixed(2)}
              </p>
              <p className="mt-2 text-xs text-sky-100">
                Lo que debe constar en el extracto: incluye $
                {resumenCuadre.efectivoEntregadoMotorizados.toFixed(2)} de envío
                que se devuelve en efectivo
              </p>
            </div>
            <div className="rounded-lg border border-slate-600 bg-slate-800 p-4 text-white">
              <h3 className="text-sm font-semibold text-slate-300">
                Venta cobrada
              </h3>
              <p className="mt-1 text-3xl font-black">
                ${resumenCuadre.ventasCobradas.toFixed(2)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Órdenes con pago registrado, sin el envío
              </p>
            </div>
            <div className="rounded-lg border border-slate-600 bg-slate-800 p-4">
              <h3 className="text-xs text-slate-300">💵 Cobrado en el local</h3>
              <p className="mt-1 text-xl font-bold text-emerald-300">
                +${resumenCuadre.efectivoVentasDirectas.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-600 bg-slate-800 p-4">
              <h3 className="text-xs text-slate-300">
                🛵 Cobrado a motorizados
              </h3>
              <p className="mt-1 text-xl font-bold text-emerald-300">
                +${resumenCuadre.efectivoCobradoMotorizados.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-600 bg-slate-800 p-4">
              <h3 className="text-xs text-slate-300">
                🛵 Entregado a motorizados
              </h3>
              <p className="mt-1 text-xl font-bold text-amber-300">
                -${resumenCuadre.efectivoEntregadoMotorizados.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-600 bg-slate-800 p-4">
              <h3 className="text-xs text-slate-300">💸 Retiros de caja</h3>
              <p className="mt-1 text-xl font-bold text-amber-300">
                -${resumenCuadre.retirosEfectivo.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {resumenCuadre.cantidadRetiros} vigente
                {resumenCuadre.cantidadRetiros === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-slate-600 bg-slate-800 p-4">
              <h3 className="text-xs text-slate-300">
                📦 Envíos que no son del local
              </h3>
              <p className="mt-1 text-xl font-bold text-slate-400">
                ${resumenCuadre.enviosMotorizados.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Dinero del motorizado. Fuera de toda cifra de venta
              </p>
            </div>
            {resumenCuadre.montoReembolsoPendiente > 0 && (
              <div className="rounded-lg border border-red-400 bg-red-950 p-4">
                <h3 className="text-xs font-semibold text-red-200">
                  ⚠️ Reembolsos pendientes
                </h3>
                <p className="mt-1 text-xl font-bold text-red-200">
                  ${resumenCuadre.montoReembolsoPendiente.toFixed(2)}
                </p>
                <p className="mt-2 text-xs text-red-300">
                  Dinero recibido que todavía debe devolverse al cliente
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Retiros de caja */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                💸 Retiros de caja
              </h2>
              <p className="text-sm text-gray-600">
                Efectivo que los empleados sacaron para gastos del local
              </p>
            </div>
            {filtrosDeOrdenActivos && retiros.length > 0 && (
              <p className="text-sm text-amber-700">
                ⚠️ Fuera del cuadre por los filtros de orden aplicados
              </p>
            )}
          </div>

          {retirosVisibles.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-500">
              No hay retiros registrados en esta fecha
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Registró
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Categoría
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Motivo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {retirosVisibles.map((retiro) => {
                    const anulado = retiro.estado === ESTADO_RETIRO_ANULADO;
                    return (
                      <tr
                        key={retiro.id}
                        className={anulado ? "bg-gray-50 text-gray-400" : ""}
                      >
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(retiro.createdAt).toLocaleTimeString(
                            "es-EC",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="font-semibold text-gray-800">
                            {retiro.usuarioNombre}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {obtenerEtiquetaRol(retiro.usuarioRol)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {obtenerEtiquetaCategoriaRetiro(retiro.categoria)}
                          {retiro.beneficiarioNombre && (
                            <span className="block text-xs text-gray-500">
                              para {retiro.beneficiarioNombre}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                          {retiro.motivo}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm font-bold ${
                            anulado ? "line-through" : "text-amber-700"
                          }`}
                        >
                          -${Number(retiro.monto).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {anulado ? (
                            <div>
                              <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
                                Anulado
                              </span>
                              <span className="block text-xs text-gray-500 mt-1">
                                {retiro.anuladoPorNombre}
                                {retiro.razonAnulacion
                                  ? `: ${retiro.razonAnulacion}`
                                  : ""}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setRetiroAAnular(retiro);
                                setRazonAnulacion("");
                              }}
                              className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-200"
                            >
                              Anular
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de anulación de retiro */}
        {retiroAAnular && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Anular retiro
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {retiroAAnular.usuarioNombre} registró $
                {Number(retiroAAnular.monto).toFixed(2)} por{" "}
                {obtenerEtiquetaCategoriaRetiro(retiroAAnular.categoria)}. El
                retiro no se borra: queda visible como anulado y deja de restar
                de la caja.
              </p>
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Razón de la anulación *
                <textarea
                  value={razonAnulacion}
                  onChange={(e) => setRazonAnulacion(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full border rounded-lg px-4 py-2 text-black"
                  placeholder="Ej: Se registró dos veces el mismo gasto"
                />
              </label>
              <div className="flex gap-3">
                <button
                  onClick={anularRetiro}
                  disabled={loadingAnular || razonAnulacion.trim() === ""}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 font-semibold"
                >
                  {loadingAnular ? "Anulando..." : "Confirmar anulación"}
                </button>
                <button
                  onClick={() => {
                    setRetiroAAnular(null);
                    setRazonAnulacion("");
                  }}
                  disabled={loadingAnular}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Estadísticas operativas */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs text-gray-600 mb-1">Total Órdenes</h3>
            <p className="text-xl font-bold text-blue-600">
              {ordenesPorEstado.total}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs text-gray-600 mb-1">Cobradas ✓</h3>
            <p className="text-xl font-bold text-green-600">
              {ordenesPorEstado.cobrada}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs text-gray-600 mb-1">Activas</h3>
            <p className="text-xl font-bold text-yellow-600">
              {ordenesPorEstado.pendiente}
            </p>
          </div>
        </div>

        {/* Tabla de Órdenes */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-blue-800">Órdenes del Día</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">Cargando...</div>
          ) : ordenesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-black">
              No hay órdenes que coincidan con los filtros
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Mesa / Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Creada por
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tiempo Entrega
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Venta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pago
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ordenesFiltradas.map((orden) => {
                    const estadoTiempo = calcularEstadoTiempo(orden);
                    return (
                      <tr
                        key={orden.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setOrdenSeleccionada(orden)}
                      >
                        <td className="px-6 py-4 text-sm text-blue-700">
                          {new Date(orden.createdAt).toLocaleTimeString(
                            "es-EC",
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {(!orden.tipoOrden ||
                            orden.tipoOrden === "local") && (
                            <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              🍽 Local
                            </span>
                          )}
                          {orden.tipoOrden === "para_llevar" && (
                            <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              🥡 Para Llevar
                            </span>
                          )}
                          {orden.tipoOrden === "domicilio" && (
                            <span className="text-xs font-bold bg-red-100 text-red-800 px-2 py-1 rounded">
                              🛵 Domicilio
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-700">
                          {obtenerTituloOrden(orden)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div className="font-medium">
                            {orden.creadorNombre || orden.mesero}
                          </div>
                          <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            {obtenerEtiquetaRol(orden.creadorRol)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div className="space-y-1">
                            {orden.items.map((item, idx) => (
                              <div key={idx} className="text-xs text-gray-700">
                                {item.cantidad}x {item.producto.nombre}
                                {item.nivelPicante && (
                                  <span className="ml-1 font-bold text-red-700">
                                    🌶️ {obtenerEtiquetaNivelPicante(item.nivelPicante)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              orden.estado === "cobrada"
                                ? "bg-green-100 text-green-800"
                                : orden.estado === "cancelada"
                                  ? "bg-red-100 text-red-800"
                                  : orden.estado === "lista"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : orden.estado === "entregada"
                                      ? "bg-purple-100 text-purple-800"
                                      : orden.estado === "en_preparacion"
                                        ? "bg-orange-100 text-orange-800"
                                        : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {orden.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {estadoTiempo ? (
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                                  estadoTiempo.aTiempo
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : "bg-red-100 text-red-800 border border-red-300"
                                }`}
                              >
                                {estadoTiempo.aTiempo
                                  ? "✓ A Tiempo"
                                  : "⚠️ Retrasada"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {estadoTiempo.tiempoReal} /{" "}
                                {estadoTiempo.tiempoEstimado} min
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-800">
                          ${calcularVentaPropia(orden).toFixed(2)}
                          {obtenerCostoEnvio(orden) > 0 && (
                            <span className="block text-xs font-normal text-gray-500">
                              +${obtenerCostoEnvio(orden).toFixed(2)} envío ·
                              cliente paga ${Number(orden.total).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-6 py-4 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {orden.cobrada ? (
                            <div className="flex flex-col gap-1">
                               {/* Badge método de pago */}
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  orden.metodoPago === "efectivo"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {orden.metodoPago === "efectivo"
                                  ? "💵 Efectivo"
                                  : "🏦 Transferencia"}
                              </span>
                              {/* Badge cuando el pago llegó antes de que cocina termine */}
                              {orden.estado !== "cobrada" && (
                                <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
                                  ⏳ Pagada ·{" "}
                                  {orden.estado === "en_preparacion"
                                    ? "En preparación"
                                    : orden.estado === "pendiente"
                                      ? "Pendiente"
                                      : orden.estado === "lista"
                                        ? "Lista"
                                        : orden.estado === "entregada"
                                          ? "Entregada"
                                          : orden.estado}
                                </span>
                              )}
                              {orden.cobradaPor && (
                                <span className="text-xs text-gray-500">
                                  por {orden.cobradaPor}
                                </span>
                              )}
                            </div>
                          ) : orden.estado !== "cancelada" &&
                            orden.estado !== "pendiente_aprobacion_stock" ? (
                            ((!orden.tipoOrden || orden.tipoOrden === "local")
                              ? ["lista", "entregada"].includes(orden.estado)
                              : true) ? (
                              <button
                                onClick={() => {
                                  if (orden.cobroUrl) {
                                    const paymentUrl = new URL(
                                      orden.cobroUrl,
                                      window.location.origin,
                                    );
                                    // origen=lista: se navega en la misma pestaña,
                                    // así que al terminar se vuelve en vez de cerrar.
                                    window.location.assign(
                                      `${paymentUrl.pathname}?origen=lista`,
                                    );
                                    return;
                                  }
                                  setOrdenACobrar(orden);
                                  setMetodoPagoAdmin("efectivo");
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded-lg font-bold transition-colors"
                              >
                                💵 Cobrar
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                En cocina…
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalle de Orden */}
      {ordenSeleccionada && (
        <DetalleOrdenModal
          orden={ordenSeleccionada}
          adminId={usuario?.id}
          adminNombre={usuario?.nombre}
          onClose={() => setOrdenSeleccionada(null)}
          onOrdenActualizada={(ordenActualizada) => {
            setOrdenSeleccionada(ordenActualizada as unknown as Orden);
            cargarOrdenes();
          }}
        />
      )}

      {/* Modal Cobrar (Admin) */}
      {ordenACobrar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-gray-800">
              💵 Cobrar Orden
            </h3>
            <p className="text-gray-600 mb-1">
              {obtenerTituloOrden(ordenACobrar)}{" "}
              — {ordenACobrar.mesero}
            </p>
            <p className="text-2xl font-bold text-green-600 mb-1">
              $
              {montoACobrarEnCaja({
                tipoOrden: ordenACobrar.tipoOrden,
                total: ordenACobrar.total,
                costoEnvio: ordenACobrar.costoEnvio,
                metodoPago: metodoPagoAdmin,
              }).toFixed(2)}
            </p>
            {ordenACobrar.tipoOrden === "domicilio" &&
              Number(ordenACobrar.costoEnvio ?? 0) > 0 && (
                <p className="text-sm text-gray-500 mb-5">
                  {metodoPagoAdmin === "efectivo"
                    ? `El cliente paga $${Number(ordenACobrar.total).toFixed(2)}; el motorizado conserva $${Number(ordenACobrar.costoEnvio ?? 0).toFixed(2)} del envío.`
                    : `Entra el total; luego se entregan $${Number(ordenACobrar.costoEnvio ?? 0).toFixed(2)} en efectivo al motorizado.`}
                </p>
              )}

            <p className="mt-4 text-sm font-semibold text-gray-700 mb-3">
              Método de pago:
            </p>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setMetodoPagoAdmin("efectivo")}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPagoAdmin === "efectivo"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                }`}
              >
                💵 Efectivo
              </button>
              <button
                onClick={() => setMetodoPagoAdmin("transferencia")}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPagoAdmin === "transferencia"
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
                disabled={loadingCobrar}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-bold transition-colors"
              >
                {loadingCobrar ? "Procesando..." : "✓ Confirmar Cobro"}
              </button>
              <button
                onClick={() => {
                  setOrdenACobrar(null);
                  setMetodoPagoAdmin("efectivo");
                }}
                disabled={loadingCobrar}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white py-2 rounded-lg font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
