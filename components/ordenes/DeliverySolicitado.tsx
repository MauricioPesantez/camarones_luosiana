"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DeliverySolicitadoProps {
  ordenId: string;
  deliverySolicitadoAt: string | null;
  editable: boolean;
  onRegistrado?: (deliverySolicitadoAt: string) => void;
}

interface AvisoMoto {
  estado: string;
  disponibleAt: string;
}

interface EstadoDelivery {
  deliverySolicitadoAt?: string | null;
  aviso?: AvisoMoto | null;
  error?: string;
}

const EN_ESPERA = ["PENDIENTE", "REINTENTO"];
const YA_SALIO = ["ENVIADA", "PROCESANDO"];

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

/** "HH:MM" de un input time, para hoy en la hora del navegador. */
function horaDeHoy(valor: string): string {
  const [h, m] = valor.split(":").map(Number);
  const fecha = new Date();
  fecha.setHours(h, m, 0, 0);
  return fecha.toISOString();
}

const aInputTime = (fecha: Date) =>
  `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;

/**
 * Pide la moto al grupo Motos (ya o a una hora) o registra que se pidió por fuera.
 * La página no se refresca sola: antes de pedir se consulta el estado real.
 */
export default function DeliverySolicitado({
  ordenId,
  deliverySolicitadoAt,
  editable,
  onRegistrado,
}: DeliverySolicitadoProps) {
  const [registrado, setRegistrado] = useState(deliverySolicitadoAt);
  const [aviso, setAviso] = useState<AvisoMoto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [horaElegida, setHoraElegida] = useState("");

  // Ref: el padre pasa un callback nuevo en cada render y no debe relanzar la consulta.
  const onRegistradoRef = useRef(onRegistrado);
  useEffect(() => {
    onRegistradoRef.current = onRegistrado;
  });

  const aplicar = useCallback((data: EstadoDelivery) => {
    if (data.deliverySolicitadoAt) {
      setRegistrado(data.deliverySolicitadoAt);
      onRegistradoRef.current?.(data.deliverySolicitadoAt);
    }
    if (data.aviso !== undefined) setAviso(data.aviso);
  }, []);

  const consultar = useCallback(async (): Promise<EstadoDelivery | null> => {
    const res = await fetch(`/api/ordenes/${ordenId}/delivery`, { cache: "no-store" });
    const data: EstadoDelivery = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo consultar la moto");
      return null;
    }
    aplicar(data);
    return data;
  }, [ordenId, aplicar]);

  useEffect(() => {
    // El setState ocurre tras el fetch, no de forma síncrona en el cuerpo del efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (editable && !deliverySolicitadoAt) void consultar().catch(() => undefined);
  }, [editable, deliverySolicitadoAt, consultar]);

  if (registrado) {
    return <p className="text-sm text-gray-700 mt-1">🛵 Delivery pedido: {hora(registrado)}</p>;
  }
  if (!editable) return null;
  const enEspera = aviso && EN_ESPERA.includes(aviso.estado);
  if (aviso && (YA_SALIO.includes(aviso.estado) || (enEspera && new Date(aviso.disponibleAt) <= new Date()))) {
    return (
      <p className="text-sm text-purple-700 mt-1">
        🛵 {aviso.estado === "ENVIADA" ? "Moto pedida al grupo Motos" : "Pidiendo moto al grupo Motos…"}
      </p>
    );
  }

  const programada = enEspera ? aviso.disponibleAt : null;

  const enviar = async (cuerpo: Record<string, string>, fallo: string) => {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      // Otro usuario o el envío automático pudo pedirla mientras esta pantalla seguía abierta.
      const fresco = await consultar();
      if (!fresco) return;
      if (fresco.deliverySolicitadoAt || (fresco.aviso && YA_SALIO.includes(fresco.aviso.estado))) {
        setMensaje("La moto ya fue pedida; no se volvió a pedir.");
        return;
      }
      const res = await fetch(`/api/ordenes/${ordenId}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data: EstadoDelivery = await res.json();
      aplicar(data);
      if (!res.ok) setError(data.error || fallo);
      else setHoraElegida("");
    } catch {
      setError(fallo);
    } finally {
      setGuardando(false);
    }
  };

  const pedirMoto = () => {
    if (programada && !confirm(`La moto está programada para las ${hora(programada)}. ¿Pedirla ahora?`)) return;
    void enviar({ accion: "pedir" }, "No se pudo pedir la moto");
  };

  const programar = () => {
    if (!horaElegida) return;
    void enviar({ accion: "programar", hora: horaDeHoy(horaElegida) }, "No se pudo cambiar la hora");
  };

  const registrar = () => void enviar({ accion: "solicitar" }, "No se pudo registrar el delivery");

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {programada && (
        <p className="w-full text-sm text-purple-700">🕒 Moto programada para las {hora(programada)}</p>
      )}
      <button
        type="button"
        onClick={pedirMoto}
        disabled={guardando}
        className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {guardando ? "Verificando..." : "📣 Pedir moto"}
      </button>
      <button
        type="button"
        onClick={registrar}
        disabled={guardando}
        className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
      >
        🛵 Ya pedí la moto
      </button>
      <label className="flex items-center gap-1 text-sm text-gray-700">
        {programada ? "Cambiar hora" : "Programar"}
        <input
          type="time"
          value={horaElegida || (programada ? aInputTime(new Date(programada)) : "")}
          onChange={(e) => setHoraElegida(e.target.value)}
          disabled={guardando}
          className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
        />
      </label>
      <button
        type="button"
        onClick={programar}
        disabled={guardando || !horaElegida}
        className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Guardar hora
      </button>
      <p className="w-full text-xs text-gray-500">
        &quot;Pedir moto&quot; avisa ya al grupo Motos por WhatsApp. &quot;Ya pedí&quot; solo registra que la pediste por fuera.
      </p>
      {mensaje && <p className="w-full text-sm text-amber-700">{mensaje}</p>}
      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
