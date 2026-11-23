"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
import CierreCaja from "@/components/admin/CierreCaja";
import OrdenesDia from "@/components/admin/OrdenesDia";
import ResumenDia from "@/components/admin/ResumenDia";
import RevisionOrdenes from "@/components/admin/revision/RevisionOrdenes";
import { useColasRevision } from "@/components/admin/revision/useColasRevision";
import type {
  ConsumoDelDia,
  FiltroCobro,
  OrdenAdmin,
} from "@/components/admin/orden-admin";
import { moverFecha, obtenerFechaEcuador } from "@/lib/fecha-ecuador";
import type { SesionCaja } from "@/types/caja";
import { calcularResumenCuadre, estaPorCobrar } from "@/types/cuadre";
import type { OrdenPendienteAprobacion } from "@/types/orden";
import type { RetiroCaja } from "@/types/retiro";
import type { RevisionGuardada } from "@/types/revision";
import type { ProductoStockBajo } from "@/types/stock";

/** Los datos llevan su fecha: si no es la elegida, no se muestran. */
interface DatosDelDia {
  fecha: string;
  ordenes: OrdenAdmin[];
  retiros: RetiroCaja[];
  consumos: ConsumoDelDia[];
  caja: SesionCaja | null;
  revisiones: RevisionGuardada[];
}

const PESTANAS = [
  { id: "resumen", etiqueta: "Resumen", href: "/admin" },
  { id: "ordenes", etiqueta: "Órdenes", href: "/admin?tab=ordenes" },
  { id: "cierre", etiqueta: "Cierre", resto: " de caja", href: "/admin?tab=cierre" },
] as const;

const ESTADO_CAJA = {
  sin_iniciar: { etiqueta: "Caja sin iniciar", color: "bg-amber-100 text-amber-900" },
  abierta: { etiqueta: "Caja abierta", color: "bg-emerald-100 text-emerald-900" },
  cerrada: { etiqueta: "Caja cerrada", color: "bg-slate-200 text-slate-800" },
};

const botonFecha =
  "flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40";

function nombreDelDia(fecha: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T12:00:00Z`));
}

function AdminContenido() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  // La pestaña vive en la URL para que no se pierda al recargar.
  const parametros = useSearchParams();
  const tab = parametros.get("tab");
  // La revisión se abre encima de Órdenes.
  const pestana =
    tab === "cierre"
      ? tab
      : tab === "ordenes" || tab === "revision"
        ? "ordenes"
        : "resumen";

  const [fecha, setFecha] = useState(obtenerFechaEcuador);
  const [datos, setDatos] = useState<DatosDelDia | null>(null);
  const [errorCarga, setErrorCarga] = useState("");
  const [loading, setLoading] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [filtroCobro, setFiltroCobro] = useState<FiltroCobro>("todas");
  const [productosStockBajo, setProductosStockBajo] = useState<
    ProductoStockBajo[]
  >([]);
  const [ordenesPendientes, setOrdenesPendientes] = useState<
    OrdenPendienteAprobacion[]
  >([]);
  const [whatsappPendiente, setWhatsappPendiente] = useState(false);
  const ultimaCarga = useRef(0);

  const dia = datos?.fecha === fecha ? datos : null;
  const revisando =
    tab === "revision" && usuario?.rol === "admin" && dia !== null;
  const colas = useColasRevision(revisando, (revision) =>
    setDatos((actual) =>
      actual?.ordenes.some((orden) => orden.id === revision.ordenId)
        ? {
            ...actual,
            revisiones: [
              ...actual.revisiones.filter(
                (r) => r.ordenId !== revision.ordenId,
              ),
              revision,
            ],
          }
        : actual,
    ),
  );

  /** Devuelve si los datos quedaron al día. */
  const leerDia = async (): Promise<boolean> => {
    // Al pasar rápido de un día a otro gana la última petición, no la última
    // respuesta.
    const carga = ++ultimaCarga.current;
    setLoading(true);
    setErrorCarga("");
    try {
      const res = await fetch(`/api/admin/cuadre?fecha=${fecha}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al cargar el día");
      }
      if (carga !== ultimaCarga.current) return false;
      setDatos({
        fecha,
        ordenes: data.ordenes || [],
        retiros: data.retiros || [],
        consumos: data.consumosEmpleados || [],
        caja: data.caja ?? null,
        revisiones: data.revisiones || [],
      });
      return true;
    } catch (error) {
      console.error("Error al cargar el día:", error);
      if (carga !== ultimaCarga.current) return false;
      setErrorCarga(
        error instanceof Error ? error.message : "Error al cargar el día",
      );
      return false;
    } finally {
      if (carga === ultimaCarga.current) setLoading(false);
    }
  };

  const cargarDia = async () => {
    await leerDia();
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

  useEffect(() => {
    if (usuario && usuario.rol === "admin") {
      // Los setState ocurren dentro de las funciones async, no de forma
      // síncrona en el cuerpo del efecto.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarDia();
      cargarProductosStockBajo();
      cargarOrdenesPendientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, usuario, recarga]);

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
        <div className="text-xl text-gray-900">Cargando...</div>
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

  const resumen =
    dia &&
    calcularResumenCuadre(
      dia.ordenes,
      dia.retiros,
      dia.caja?.montoInicial ?? 0,
    );
  const cobrables = dia?.ordenes.filter(estaPorCobrar) ?? [];
  const porCobrar = {
    cantidad: cobrables.length,
    monto: calcularResumenCuadre(cobrables).ventaPorCobrar,
  };

  const pendientes = [
    ordenesPendientes.length > 0,
    productosStockBajo.length > 0,
    whatsappPendiente,
    porCobrar.cantidad > 0,
    (resumen?.ordenesConSaldoPendiente ?? 0) > 0,
    (resumen?.montoReembolsoPendiente ?? 0) > 0,
  ].filter(Boolean).length;

  const contadores = {
    resumen: pendientes || null,
    ordenes: dia?.ordenes.length ?? null,
    cierre: null,
  };

  const sinDatos = dia
    ? null
    : errorCarga
      ? "Sin datos de este día."
      : "Cargando…";

  const hoy = obtenerFechaEcuador();
  const esHoy = fecha === hoy;
  const estadoCaja = dia && ESTADO_CAJA[dia.caja?.estado ?? "sin_iniciar"];

  const verOrdenes = (filtro: FiltroCobro) => {
    setFiltroCobro(filtro);
    router.push("/admin?tab=ordenes");
  };

  const panel = (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo="Cuadre de caja"
      activoId="cuadre"
    >
      <div className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h2 className="w-full text-xl font-bold first-letter:uppercase sm:w-auto sm:text-2xl">
            {esHoy ? `Hoy, ${nombreDelDia(fecha)}` : nombreDelDia(fecha)}
          </h2>
          {estadoCaja && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${estadoCaja.color}`}
            >
              {estadoCaja.etiqueta}
            </span>
          )}
          <button
            type="button"
            onClick={() => setRecarga((n) => n + 1)}
            disabled={loading}
            className={`ml-auto sm:order-last sm:ml-0 ${botonFecha}`}
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              type="button"
              aria-label="Día anterior"
              onClick={() => setFecha(moverFecha(fecha, -1))}
              className={botonFecha}
            >
              ◀
            </button>
            <input
              type="date"
              aria-label="Fecha"
              value={fecha}
              onChange={(e) => {
                if (e.target.value) setFecha(e.target.value);
              }}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 [color-scheme:light]"
            />
            <button
              type="button"
              aria-label="Día siguiente"
              disabled={fecha >= hoy}
              onClick={() => setFecha(moverFecha(fecha, 1))}
              className={botonFecha}
            >
              ▶
            </button>
            {!esHoy && (
              <button
                type="button"
                onClick={() => setFecha(hoy)}
                className={botonFecha}
              >
                Ir a hoy
              </button>
            )}
          </div>
        </header>

        <nav
          aria-label="Secciones del día"
          className="mt-4 flex overflow-x-auto border-b border-slate-300"
        >
          {PESTANAS.map((item) => {
            const { id, etiqueta, href } = item;
            const activa = id === pestana;
            const contador = contadores[id];
            return (
              <Link
                key={id}
                href={href}
                scroll={false}
                aria-current={activa ? "page" : undefined}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-[3px] px-3 font-semibold sm:px-5 ${
                  activa
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>
                  {etiqueta}
                  {"resto" in item && (
                    <span className="hidden sm:inline">{item.resto}</span>
                  )}
                </span>
                {contador !== null && (
                  <span
                    className={`rounded-full px-2 text-sm ${
                      id === "resumen"
                        ? "bg-red-700 text-white"
                        : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {contador}
                    {id === "resumen" && (
                      <span className="sr-only"> pendientes</span>
                    )}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {errorCarga && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900"
          >
            <p>
              {errorCarga}.{" "}
              {dia
                ? "Lo que ves puede estar desactualizado."
                : "No hay datos de este día para mostrar."}
            </p>
            <button
              type="button"
              onClick={() => setRecarga((n) => n + 1)}
              className="min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Resumen y Órdenes quedan montados: conservan filtros y avisos al
            cambiar de pestaña. */}
        <div className="mt-6" hidden={pestana !== "resumen"}>
          <ResumenDia
            resumen={resumen}
            sinDatos={sinDatos}
            cajaIniciada={dia?.caja != null}
            esHoy={esHoy}
            porCobrar={porCobrar}
            ordenesPendientes={ordenesPendientes}
            productosStockBajo={productosStockBajo}
            adminId={usuario.id}
            recarga={recarga}
            pendientes={pendientes}
            onPendienteWhatsapp={setWhatsappPendiente}
            onAprobacionResuelta={cargarOrdenesPendientes}
            onVerOrdenes={verOrdenes}
            onVerCierre={() => router.push("/admin?tab=cierre")}
          />
        </div>
        <div className="mt-6" hidden={pestana !== "ordenes"}>
          <OrdenesDia
            ordenes={dia?.ordenes ?? []}
            revisiones={dia?.revisiones ?? []}
            sinDatos={sinDatos}
            admin={usuario}
            filtroCobro={filtroCobro}
            onFiltroCobro={setFiltroCobro}
            onCambio={cargarDia}
          />
        </div>
        <div className="mt-6" hidden={pestana !== "cierre"}>
          {dia && resumen ? (
            <CierreCaja
              key={fecha}
              fecha={fecha}
              caja={dia.caja}
              resumen={resumen}
              porCobrar={porCobrar}
              ordenes={dia.ordenes}
              retiros={dia.retiros}
              consumos={dia.consumos}
              onCajaCerrada={(caja) =>
                setDatos((actual) =>
                  actual?.fecha === fecha ? { ...actual, caja } : actual,
                )
              }
              onCambio={cargarDia}
              onVerOrdenes={verOrdenes}
            />
          ) : (
            <p className="text-slate-600">{sinDatos}</p>
          )}
        </div>
      </div>
    </AppShell>
  );

  return (
    <>
      <div inert={revisando}>{panel}</div>
      {revisando && (
        <RevisionOrdenes
          fecha={fecha}
          ordenes={dia.ordenes}
          revisiones={dia.revisiones}
          ordenInicial={parametros.get("orden")}
          colas={colas}
          onRecargar={async () => {
            if (!(await leerDia())) throw new Error("No se pudo recargar");
          }}
          onSalir={() => router.replace("/admin?tab=ordenes", { scroll: false })}
        />
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminContenido />
    </Suspense>
  );
}
