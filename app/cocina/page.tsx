"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CrearOrden from "@/components/mesero/CrearOrden";
import OrdenCard from "@/components/cocina/OrdenCard";
import EditarOrdenModal from "@/components/mesero/EditarOrdenModal";
import { useAuth } from "@/lib/auth";

interface Producto {
  nombre: string;
  categoria: string;
}

interface Item {
  cantidad: number;
  producto: Producto;
  observaciones?: string;
}

interface Orden {
  id: string;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  mesero: string;
  estado: string;
  total: number;
  createdAt: string;
  tiempoEstimado: number;
  items: Item[];
  observaciones?: string;
  modificada?: boolean;
  sinStock?: boolean;
}

interface Notificacion {
  id: string;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  mesero: string;
  tiempoEstimado: number;
  itemsCount: number;
}

export default function CocinaPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [vistaActiva, setVistaActiva] = useState<"cocina" | "mesero">("cocina");
  const [ordenEditar, setOrdenEditar] = useState<Orden | null>(null);
  const [notificacion, setNotificacion] = useState<Notificacion | null>(null);
  const [permisoBrowser, setPermisoBrowser] = useState<boolean>(false);
  const notificacionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Genera un doble pitido usando Web Audio API (sin archivos externos)
  const reproducirSonido = useCallback(() => {
    try {
      type AudioCtxCtor = typeof AudioContext;
      const AudioCtx: AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: AudioCtxCtor })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      [0, 0.25].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime + offset);
        gain.gain.setValueAtTime(0.35, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + offset + 0.22,
        );
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.22);
      });
      // Cerrar el AudioContext una vez que termina el último beep
      const totalDurationMs = (0.25 + 0.22 + 0.1) * 1000; // último offset + duración + margen
      setTimeout(() => {
        void ctx.close();
      }, totalDurationMs);
    } catch {
      /* El navegador bloqueó el audio */
    }
  }, []);

  const cargarOrdenes = useCallback(async () => {
    try {
      const res = await fetch("/api/ordenes?estado=pendiente,en_preparacion");
      const data = await res.json();
      setOrdenes(data);
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
    }
  }, []);

  // Polling de respaldo cada 30 s (cubre casos donde SSE no esté disponible)
  useEffect(() => {
    if (vistaActiva === "cocina" && usuario) {
      cargarOrdenes();
      const interval = setInterval(cargarOrdenes, 30000);
      return () => clearInterval(interval);
    }
  }, [vistaActiva, usuario, cargarOrdenes]);

  // Verificar soporte de notificaciones del navegador (sólo client-side)
  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      setPermisoBrowser(true);
    }
  }, []);

  // Conexión SSE — recibe notificaciones en tiempo real cuando llega una nueva orden
  useEffect(() => {
    // Abrir SSE solo para usuarios de cocina
    if (!usuario || usuario.rol !== "cocina") return;

    const eventSource = new EventSource("/api/ordenes/events");

    eventSource.addEventListener("nueva-orden", (e: MessageEvent) => {
      const orden = JSON.parse(e.data) as Notificacion;

      // Mostrar banner y auto-ocultar a los 8 s
      setNotificacion(orden);
      if (notificacionTimer.current) clearTimeout(notificacionTimer.current);
      notificacionTimer.current = setTimeout(() => setNotificacion(null), 8000);

      // Recargar lista inmediatamente
      cargarOrdenes();

      // Sonido de alerta
      reproducirSonido();

      // Notificación nativa del navegador (si el usuario dio permiso)
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const titulo =
          orden.tipoOrden === "local"
            ? `Mesa ${orden.numeroMesa}`
            : (orden.nombreCliente ?? "Cliente");
        new Notification(`🍳 Nueva orden — ${titulo}`, {
          body: `Mesero: ${orden.mesero} · ${orden.itemsCount} ítem(s)`,
          icon: "/favicon.ico",
        });
      }
    });

    // Evento: orden lista regresa a cocina con nuevos items
    eventSource.addEventListener("regresa-a-cocina", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as {
        ordenId: string;
        tituloOrden: string;
        itemsNuevos: number;
      };

      cargarOrdenes();
      reproducirSonido();

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(`🔄 Orden modificada — ${data.tituloOrden}`, {
          body: `${data.itemsNuevos} item(s) nuevo(s) agregado(s)`,
          icon: "/favicon.ico",
        });
      }
    });

    return () => {
      eventSource.close();
      if (notificacionTimer.current) clearTimeout(notificacionTimer.current);
    };
  }, [usuario, cargarOrdenes, reproducirSonido]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-white">Cargando...</div>
      </div>
    );
  }

  if (!usuario) return null;

  // Si el usuario es cocinero y está en vista de mesero, mostrar componente de mesero
  if (usuario.rol === "cocina" && vistaActiva === "mesero") {
    return (
      <div>
        {/* Selector de vista */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setVistaActiva("cocina")}
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                🍳 Vista Cocina
              </button>
              <button
                onClick={() => setVistaActiva("mesero")}
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-blue-600 text-white"
              >
                📋 Vista Mesero
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white">
                Usuario: <span className="font-bold">{usuario.nombre}</span>
              </span>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
        <CrearOrden />
      </div>
    );
  }

  const cambiarEstado = async (id: string, estado: string) => {
    try {
      await fetch(`/api/ordenes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      // Recargar órdenes después de cambiar estado
      const res = await fetch("/api/ordenes?estado=pendiente,en_preparacion");
      const data = await res.json();
      setOrdenes(data);
    } catch (error) {
      console.error("Error al actualizar orden:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Banner de notificación nueva orden (tiempo real via SSE) */}
      {notificacion && (
        <div className="fixed top-0 left-0 right-0 z-50 shadow-2xl">
          <div className="bg-green-500 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl animate-bounce">🔔</span>
              <div>
                <p className="text-xl font-bold">
                  ¡Nueva orden!{" "}
                  {notificacion.tipoOrden === "local"
                    ? `Mesa ${notificacion.numeroMesa}`
                    : `${
                        notificacion.tipoOrden === "domicilio"
                          ? "🛵 Domicilio"
                          : "🥡 Para llevar"
                      } — ${notificacion.nombreCliente}`}
                </p>
                <p className="text-sm opacity-90">
                  Mesero: {notificacion.mesero} · {notificacion.itemsCount}
                   ítem(s)
                  {notificacion.tiempoEstimado > 0 &&
                    ` · Est. ${notificacion.tiempoEstimado} min`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setNotificacion(null)}
              className="text-white text-2xl hover:text-green-100 font-bold leading-none px-2"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Selector de vista solo para cocineros */}
      {usuario.rol === "cocina" && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setVistaActiva("cocina")}
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-blue-600 text-white"
              >
                🍳 Vista Cocina
              </button>
              <button
                onClick={() => setVistaActiva("mesero")}
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                📋 Vista Mesero
              </button>
            </div>
            <div className="flex items-center gap-4">
              {/* Botón para activar notificaciones nativas del navegador */}
              {permisoBrowser && (
                <button
                  onClick={() =>
                    Notification.requestPermission().then((p) => {
                      if (p !== "default") setPermisoBrowser(false);
                    })
                  }
                  className="bg-yellow-500 text-white px-3 py-2 rounded-lg hover:bg-yellow-600 text-sm font-semibold"
                  title="Recibir notificaciones incluso con la pestaña en segundo plano"
                >
                  🔔 Activar notificaciones
                </button>
              )}
              <span className="text-white">
                Usuario: <span className="font-bold">{usuario.nombre}</span>
              </span>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Monitor de Cocina</h1>
          {usuario.rol !== "cocina" && (
            <div className="flex items-center gap-4">
              <span className="text-white">
                Usuario: <span className="font-bold">{usuario?.nombre}</span>
              </span>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ordenes.map((orden) => (
            <OrdenCard
              key={orden.id}
              orden={orden}
              onMarcarLista={(id) => cambiarEstado(id, "lista")}
              onEditarOrden={
                usuario.rol === "cocina"
                  ? (orden) => setOrdenEditar(orden as any)
                  : undefined
              }
            />
          ))}
        </div>

        {ordenes.length === 0 && (
          <div className="text-center text-white text-2xl mt-20">
            No hay órdenes pendientes
          </div>
        )}

        {/* Modal de edición usando el componente EditarOrdenModal */}
        {ordenEditar && usuario && (
          <EditarOrdenModal
            orden={ordenEditar as any}
            usuario={usuario}
            onClose={() => setOrdenEditar(null)}
            onSuccess={() => {
              setOrdenEditar(null);
              cargarOrdenes();
            }}
          />
        )}
      </div>
    </div>
  );
}
