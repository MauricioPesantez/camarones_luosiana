"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import OrdenCard from "@/components/cocina/OrdenCard";
import AppShell from "@/components/shell/AppShell";
import { useAuth } from "@/lib/auth";
import { NivelPicante } from "@/types/orden";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  disponible: boolean;
  stock: number;
}

interface Item {
  id: string;
  cantidad: number;
  producto: Producto;
  precioUnitario: number;
  subtotal: number;
  observaciones?: string;
  nivelPicante?: NivelPicante | null;
}

interface Orden {
  id: string;
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  printRevision: number;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  recargo: number | null;
  costoEnvio: number | null;
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
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  revision: number;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  mesero: string;
  tiempoEstimado: number;
  itemsCount: number;
}

export default function CocinaPage() {
  const { usuario, loading: authLoading, logout } = useAuth("cocina");
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [notificacion, setNotificacion] = useState<Notificacion | null>(null);
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
    if (!usuario) return;

    const fetchOrdenes = () => {
      cargarOrdenes().catch(console.error);
    };

    fetchOrdenes();
    const interval = setInterval(fetchOrdenes, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  // Conexión SSE — recibe notificaciones en tiempo real cuando llega una nueva orden
  useEffect(() => {
    if (!usuario) return;

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
            : (orden.nombreCliente ?? orden.telefonoCliente ?? "Cliente");
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
        numeroDiario: number | null;
        fechaNumeroDiario: string | null;
        revision: number;
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
          body: `Orden #${data.numeroDiario ?? data.ordenId.slice(-6)} · Rev ${data.revision} · ${data.itemsNuevos} item(s) nuevo(s)`,
          icon: "/favicon.ico",
        });
      }
    });

    // Evento: admin aplicó una cortesía a una orden
    eventSource.addEventListener("cortesia-aplicada", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as {
        ordenId: string;
        tituloOrden: string;
        productoNombre: string;
        cantidad: number;
        adminNombre: string;
      };

      cargarOrdenes();
      reproducirSonido();

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(`🎁 Cortesía — ${data.tituloOrden}`, {
          body: `${data.cantidad}x ${data.productoNombre} (por ${data.adminNombre})`,
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
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo="Monitor de cocina"
      activoId="monitor"
      // El item se retira solo del menú: AppShell observa el permiso.
      onAccion={(id) => {
        if (id === "notificaciones") void Notification.requestPermission();
      }}
    >
      <div className="min-h-screen bg-gray-900">
      {/* Banner de notificación nueva orden (tiempo real via SSE) */}
      {notificacion && (
        <div className="fixed top-0 left-0 right-0 z-40 shadow-2xl">
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
                      } — ${
                        notificacion.nombreCliente ??
                        notificacion.telefonoCliente ??
                        "Cliente"
                      }`}
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

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ordenes.map((orden) => (
              <OrdenCard
                key={orden.id}
                orden={orden}
                onMarcarLista={(id) => cambiarEstado(id, "lista")}
              />
            ))}
          </div>

          {ordenes.length === 0 && (
            <div className="text-center text-white text-2xl mt-20">
              No hay órdenes pendientes
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
