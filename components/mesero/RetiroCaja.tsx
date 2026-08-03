"use client";

import { useEffect, useState } from "react";
import { obtenerFechaEcuador } from "@/lib/fecha-ecuador";
import {
  CATEGORIAS_RETIRO,
  CATEGORIA_ADELANTO,
  ESTADO_RETIRO_ANULADO,
  obtenerEtiquetaCategoriaRetiro,
  type CategoriaRetiro,
  type RetiroCaja as Retiro,
} from "@/types/retiro";

interface UsuarioSimple {
  id: string;
  nombre: string;
  rol: string;
}

interface Props {
  usuario: UsuarioSimple;
}

/**
 * Identificador del envio. Viaja al servidor para que un doble clic o un
 * reintento de red no saquen el dinero dos veces.
 */
function nuevoIdEnvio(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatearHora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RetiroCaja({ usuario }: Props) {
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState<CategoriaRetiro>("insumos");
  const [beneficiarioId, setBeneficiarioId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [idEnvio, setIdEnvio] = useState(nuevoIdEnvio);

  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [recargas, setRecargas] = useState(0);
  const [usuarios, setUsuarios] = useState<UsuarioSimple[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const esAdelanto = categoria === CATEGORIA_ADELANTO;

  // Se recarga al montar y cada vez que se registra un retiro nuevo.
  useEffect(() => {
    let vigente = true;
    const fecha = obtenerFechaEcuador();

    // El servidor acota al usuario de la sesion: un mesero solo ve los suyos.
    fetch(`/api/retiros?fecha=${fecha}`)
      .then((res) => res.json())
      .then((data) => {
        // Una respuesta que llega tarde no puede pisar a una mas reciente.
        if (vigente) setRetiros(data.retiros ?? []);
      })
      .catch((err) => console.error("Error al cargar retiros:", err));

    return () => {
      vigente = false;
    };
  }, [usuario.id, recargas]);

  useEffect(() => {
    if (!esAdelanto || usuarios.length > 0) return;

    fetch("/api/usuarios")
      .then((res) => res.json())
      .then((data) => setUsuarios(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error al cargar usuarios:", err));
  }, [esAdelanto, usuarios.length]);

  const registrarRetiro = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError("");
    setConfirmacion("");
    setGuardando(true);

    try {
      const res = await fetch("/api/retiros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria,
          motivo,
          monto: Number(monto),
          beneficiarioId: esAdelanto ? beneficiarioId : null,
          clientRequestId: idEnvio,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al registrar el retiro");
      }

      setConfirmacion(
        `Retiro de $${Number(data.monto).toFixed(2)} registrado. Sale del efectivo de la caja.`,
      );
      setMonto("");
      setMotivo("");
      setBeneficiarioId("");
      setCategoria("insumos");
      // Identificador nuevo: el siguiente retiro es otra salida de dinero.
      setIdEnvio(nuevoIdEnvio());
      setRecargas((valor) => valor + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el retiro");
    } finally {
      setGuardando(false);
    }
  };

  const totalDelDia = retiros
    .filter((retiro) => retiro.estado !== ESTADO_RETIRO_ANULADO)
    .reduce((total, retiro) => total + Number(retiro.monto), 0);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            💸 Retiro de caja
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Registra el dinero que sacas del efectivo de la caja para un gasto
            del local. Queda a tu nombre y no se puede editar ni borrar: si te
            equivocas, un administrador lo anula.
          </p>

          <form onSubmit={registrarRetiro}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-800">
                  Monto ($) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                  className="w-full border rounded-lg px-4 py-2 text-black"
                  placeholder="Ej: 12.50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-800">
                  Categoría <span className="text-red-600">*</span>
                </label>
                <select
                  value={categoria}
                  onChange={(e) => {
                    setCategoria(e.target.value as CategoriaRetiro);
                    setBeneficiarioId("");
                  }}
                  className="w-full border rounded-lg px-4 py-2 text-black bg-white"
                >
                  {CATEGORIAS_RETIRO.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {esAdelanto && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-800">
                  ¿A quién se le entrega? <span className="text-red-600">*</span>
                </label>
                <select
                  value={beneficiarioId}
                  onChange={(e) => setBeneficiarioId(e.target.value)}
                  required
                  className="w-full border rounded-lg px-4 py-2 text-black bg-white"
                >
                  <option value="">Selecciona un empleado</option>
                  {usuarios.map((empleado) => (
                    <option key={empleado.id} value={empleado.id}>
                      {empleado.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-800">
                Motivo <span className="text-red-600">*</span>
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
                rows={3}
                className="w-full border rounded-lg px-4 py-2 text-black"
                placeholder="Ej: Compra de fundas y guantes en la tienda de la esquina"
              />
            </div>

            {error && (
              <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {confirmacion && (
              <p className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
                {confirmacion}
              </p>
            )}

            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-amber-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-amber-700 disabled:bg-gray-400"
            >
              {guardando ? "Registrando..." : "Registrar retiro"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              Mis retiros de hoy
            </h3>
            <p className="text-sm text-gray-600">
              Total vigente:{" "}
              <span className="font-bold text-amber-700">
                ${totalDelDia.toFixed(2)}
              </span>
            </p>
          </div>

          {retiros.length === 0 ? (
            <p className="text-sm text-gray-500">
              Todavía no registraste retiros hoy.
            </p>
          ) : (
            <ul className="space-y-3">
              {retiros.map((retiro) => {
                const anulado = retiro.estado === ESTADO_RETIRO_ANULADO;
                return (
                  <li
                    key={retiro.id}
                    className={`rounded-lg border p-4 ${
                      anulado
                        ? "border-gray-200 bg-gray-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p
                          className={`font-semibold text-gray-800 ${
                            anulado ? "line-through text-gray-500" : ""
                          }`}
                        >
                          {obtenerEtiquetaCategoriaRetiro(retiro.categoria)}
                          {retiro.beneficiarioNombre &&
                            ` · ${retiro.beneficiarioNombre}`}
                        </p>
                        <p className="text-sm text-gray-600">{retiro.motivo}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatearHora(retiro.createdAt)}
                        </p>
                      </div>
                      <p
                        className={`text-lg font-bold whitespace-nowrap ${
                          anulado ? "text-gray-400 line-through" : "text-amber-700"
                        }`}
                      >
                        -${Number(retiro.monto).toFixed(2)}
                      </p>
                    </div>

                    {anulado && (
                      <p className="mt-2 rounded bg-white border border-gray-200 px-3 py-2 text-xs text-gray-600">
                        Anulado
                        {retiro.anuladoPorNombre
                          ? ` por ${retiro.anuladoPorNombre}`
                          : ""}
                        {retiro.razonAnulacion
                          ? `: ${retiro.razonAnulacion}`
                          : ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
