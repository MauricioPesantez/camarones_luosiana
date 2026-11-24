"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { comprimirImagen } from "@/lib/imagen-cliente";
import type { AuthenticatedUser } from "@/lib/session";
import type { PartePago } from "@/types/cobro";
import type {
  PresentacionCobro,
  PrevisualizacionMixto,
} from "@/types/por-cobrar";
import { obtenerEtiquetaNivelPicante, type NivelPicante } from "@/types/orden";

interface CobroOrder {
  id: string;
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  mesero: string;
  estado: string;
  printRevision: number;
  recargo: number;
  costoEnvio: number;
  descuento: number;
  total: number;
  montoPagado: number;
  metodoPagoPrevisto: string | null;
  createdAt: string;
  observaciones: string | null;
  items: Array<{
    id: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    observaciones: string | null;
    nivelPicante: string | null;
    esCortesia: boolean;
    producto: { nombre: string };
  }>;
}

function orderTitle(order: CobroOrder): string {
  if (!order.tipoOrden || order.tipoOrden === "local") {
    return `Mesa ${order.numeroMesa ?? "-"}`;
  }
  return order.nombreCliente || order.telefonoCliente || "Cliente";
}

export default function CobrarOrdenClient({
  endpoints,
  presentacion,
  orden,
  usuario,
  successUrl,
  cerrarAlFinalizar,
  storageDisponible,
}: {
  endpoints: {
    confirmar: string;
    previsualizar: string;
    comprobante: string | null;
  };
  presentacion: PresentacionCobro;
  orden: CobroOrder;
  usuario: AuthenticatedUser;
  successUrl: string;
  cerrarAlFinalizar: boolean;
  storageDisponible: boolean;
}) {
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const dialogo = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<PrevisualizacionMixto | null>(null);
  const previewRequest = useRef(0);
  const [revisando, setRevisando] = useState(false);
  const [confirmCash, setConfirmCash] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  // Un solo estado para toda la fila de transferencia (en vez de dos booleanos
  // independientes) para que un fallo en CUALQUIER tramo -subida o cobro- lleve
  // siempre al mismo "fallo" y muestre el botón de reintentar/registrar sin
  // comprobante. Con dos booleanos separados, un cobro fallido después de una
  // subida exitosa no marcaba nada: el botón de "Registrar sin comprobante"
  // quedaba inalcanzable.
  const [estadoTransferencia, setEstadoTransferencia] = useState<
    "idle" | "subiendo" | "cobrando" | "fallo"
  >("idle");
  const [modoActivo, setModoActivo] = useState<
    "transferencia" | "mixto" | null
  >(null);
  const seccionModo = useRef<HTMLElement>(null);
  // En el celular el recuadro aparece fuera de pantalla y el botón parece no hacer nada.
  useEffect(() => {
    if (modoActivo)
      seccionModo.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, [modoActivo]);
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiereRecarga, setRequiereRecarga] = useState(false);
  const [error, setError] = useState("");
  const [cobrado, setCobrado] = useState<string | null>(null);

  const {
    subtotalProductos,
    saldo,
    efectivo: montoEfectivo,
    transferencia: montoTransferencia,
    mixto: montoMixto,
  } = presentacion;
  const esDomicilio = orden.tipoOrden === "domicilio";
  const mixtoValido = preview !== null;
  const envioRepuesto = presentacion.envioPendiente > 0;

  useEffect(() => {
    if (confirmCash) dialogo.current?.showModal();
    else dialogo.current?.close();
  }, [confirmCash]);

  const revisarMixto = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const revision = ++previewRequest.current;
    setRevisando(true);
    setPreview(null);
    setError("");
    try {
      const response = await fetch(endpoints.previsualizar, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          efectivo: montoEfectivoMixto,
          expectedRevision: orden.printRevision,
        }),
      });
      const data = await response.json();
      if (response.status === 409) setRequiereRecarga(true);
      if (!response.ok)
        throw new Error(data.error || "No se pudo revisar el reparto");
      if (revision === previewRequest.current) setPreview(data);
    } catch (error) {
      if (revision === previewRequest.current)
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo revisar el reparto",
        );
    } finally {
      if (revision === previewRequest.current) setRevisando(false);
    }
  };

  const partesDelModo = (objectKey: string | null): PartePago[] => {
    const partes =
      modoActivo === "mixto"
        ? preview?.partes
        : presentacion.partesTransferencia;
    if (!partes) throw new Error("Revisa el reparto antes de confirmar");
    return partes.map((parte) =>
      parte.metodoPago === "transferencia" && objectKey
        ? { ...parte, comprobanteTransferenciaKey: objectKey }
        : parte,
    );
  };

  const cobrar = async (
    partes: PartePago[],
    etiqueta: string,
  ): Promise<boolean> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoints.confirmar, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partes,
          expectedRevision: orden.printRevision,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = await response.json();
      if (response.status === 409) setRequiereRecarga(true);
      if (!response.ok)
        throw new Error(data.error || "No se pudo registrar el cobro");
      setConfirmCash(false);
      if (!cerrarAlFinalizar) {
        router.replace(successUrl);
        router.refresh();
        return true;
      }
      // El cobro llegó desde el enlace/QR, en una pestaña dedicada. Se muestra la
      // confirmación y se pide cerrarla. El navegador solo permite `close()` si la
      // pestaña la abrió un script o si no acumuló historial (p. ej. no pasó por el
      // login): cuando lo bloquea, esta misma pantalla queda como salida manual.
      setCobrado(etiqueta);
      window.close();
      return true;
    } catch (paymentError) {
      setConfirmCash(false);
      setError(
        paymentError instanceof TypeError
          ? "No se pudo confirmar el resultado. Reintenta el mismo cobro para comprobarlo sin duplicarlo."
          : paymentError instanceof Error
            ? paymentError.message
            : "No se pudo confirmar el resultado. Reintenta el mismo cobro para comprobarlo sin duplicarlo.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  const subirComprobante = async (): Promise<string | null> => {
    const comprimida = await comprimirImagen(photo!);
    const formData = new FormData();
    formData.append(
      "archivo",
      new File([comprimida], "comprobante.jpg", { type: "image/jpeg" }),
    );
    const respuesta = await fetch(endpoints.comprobante!, {
      method: "POST",
      body: formData,
    });
    let datos: { error?: string; objectKey?: string };
    try {
      datos = await respuesta.json();
    } catch {
      // Un proxy o gateway puede responder con HTML (o nada) en vez de JSON, por
      // ejemplo un 413 que corta la subida antes de que la app la vea: sin esto el
      // error mostrado sería "Unexpected token '<'" en vez de un texto legible.
      datos = {
        error:
          respuesta.status === 413
            ? "La foto es muy pesada, repítela"
            : "No se pudo subir el comprobante",
      };
    }
    if (!respuesta.ok)
      throw new Error(datos.error || "No se pudo subir el comprobante");
    return datos.objectKey ?? null;
  };

  // Sube primero y cobra despues, con la key ya validada. Si el storage falla, el
  // cobro no se bloquea: la pantalla ofrece reintentar o registrar sin
  // comprobante, y el cuadre marca despues esa transferencia. El estado de fallo
  // se activa tanto si falla la subida como si falla el cobro posterior. Sirve
  // tanto para transferencia pura como para la parte de transferencia de un
  // mixto: la diferencia esta en `partesDelModo`.
  const subirYCobrar = async () => {
    if (!photo) return;
    setEstadoTransferencia("subiendo");
    setError("");
    try {
      const objectKey = await subirComprobante();
      setEstadoTransferencia("cobrando");
      const ok = await cobrar(
        partesDelModo(objectKey),
        modoActivo ?? "transferencia",
      );
      setEstadoTransferencia(ok ? "idle" : "fallo");
    } catch (subidaError) {
      setEstadoTransferencia("fallo");
      setError(
        subidaError instanceof Error
          ? subidaError.message
          : "No se pudo subir el comprobante",
      );
    }
  };

  if (cobrado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-6 text-slate-900">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
          <p className="text-5xl">✅</p>
          <h1 className="mt-3 text-2xl font-bold">Cobro registrado</h1>
          <p className="mt-1 text-slate-600">
            Orden #{orden.numeroDiario ?? orden.id.slice(-6)} ·{" "}
            <strong>
              $
              {(cobrado === "mixto"
                ? montoMixto
                : cobrado === "efectivo"
                  ? montoEfectivo
                  : montoTransferencia
              ).toFixed(2)}
            </strong>{" "}
            en {cobrado}.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Ya puedes cerrar esta pestaña.
          </p>
          <button
            onClick={() => {
              window.close();
              router.replace(successUrl);
            }}
            className="mt-5 w-full rounded-xl bg-slate-900 py-3 font-bold text-white hover:bg-slate-800"
          >
            Cerrar y volver a órdenes
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg">
          <p className="text-sm text-slate-300">Cobro autenticado</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                Orden #{orden.numeroDiario ?? orden.id.slice(-6)}
              </h1>
              <p className="text-slate-300">{orderTitle(orden)}</p>
            </div>
            <div className="text-right text-sm">
              <p>
                Cobra: <strong>{usuario.nombre}</strong>
              </p>
              <p className="text-slate-400">Creada por {orden.mesero}</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Tipo</span>
              <p className="font-semibold">
                {orden.tipoOrden.replaceAll("_", " ").toUpperCase()}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Fecha</span>
              <p className="font-semibold">
                {new Date(orden.createdAt).toLocaleString("es-EC", {
                  timeZone: "America/Guayaquil",
                })}
              </p>
            </div>
            {orden.telefonoCliente && (
              <div>
                <span className="text-slate-500">Teléfono</span>
                <p className="font-semibold">{orden.telefonoCliente}</p>
              </div>
            )}
            <div>
              <span className="text-slate-500">Estado</span>
              <p className="font-semibold">
                {orden.estado.replaceAll("_", " ")}
              </p>
            </div>
          </div>

          <h2 className="mb-2 font-bold">Detalle de la orden</h2>
          <div className="divide-y">
            {orden.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">
                    {item.cantidad}x {item.producto.nombre}
                    {item.esCortesia && (
                      <span className="ml-2 text-amber-600">CORTESÍA</span>
                    )}
                  </p>
                  {item.nivelPicante && (
                    <p className="text-sm text-red-700">
                      Salsa:{" "}
                      {obtenerEtiquetaNivelPicante(
                        item.nivelPicante as NivelPicante,
                      )}
                    </p>
                  )}
                  {item.observaciones && (
                    <p className="text-sm text-slate-500">
                      {item.observaciones}
                    </p>
                  )}
                </div>
                <p className="font-semibold">${item.subtotal.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span>Productos</span>
              <span>${subtotalProductos.toFixed(2)}</span>
            </div>
            {orden.descuento > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Descuento</span>
                <span>-${orden.descuento.toFixed(2)}</span>
              </div>
            )}
            {orden.recargo > 0 && (
              <div className="flex justify-between">
                <span>Recipientes</span>
                <span>${orden.recargo.toFixed(2)}</span>
              </div>
            )}
            {orden.costoEnvio > 0 && (
              <div className="flex justify-between">
                <span>Envío del motorizado</span>
                <span>${orden.costoEnvio.toFixed(2)}</span>
              </div>
            )}
            <div
              className={`flex justify-between border-t pt-2 ${esDomicilio ? "font-semibold" : "text-2xl font-bold"}`}
            >
              <span>
                {esDomicilio ? "Total que paga el cliente" : "Total cliente"}
              </span>
              <span className={esDomicilio ? "" : "text-emerald-700"}>
                ${orden.total.toFixed(2)}
              </span>
            </div>
            {orden.montoPagado > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Ya pagado</span>
                <span>-${orden.montoPagado.toFixed(2)}</span>
              </div>
            )}
            {esDomicilio && (
              <div className="flex justify-between border-t pt-2 text-2xl font-bold">
                <span>
                  {orden.montoPagado > 0 ? "Saldo a cobrar" : "Recibes en caja"}
                </span>
                <span className="text-emerald-700">
                  ${montoEfectivo.toFixed(2)}
                  {montoTransferencia !== montoEfectivo && (
                    <span className="block text-right text-sm font-semibold text-slate-500">
                      o ${montoTransferencia.toFixed(2)} por transferencia
                    </span>
                  )}
                </span>
              </div>
            )}
            {!esDomicilio && orden.montoPagado > 0 && (
              <div className="flex justify-between border-t pt-2 text-2xl font-bold">
                <span>Saldo a cobrar</span>
                <span className="text-emerald-700">${saldo.toFixed(2)}</span>
              </div>
            )}
          </div>

          {presentacion.explicacionEfectivo && (
            <div className="mt-4 rounded-xl bg-purple-50 p-4 text-sm text-purple-900">
              {presentacion.explicacionEfectivo && (
                <p>{presentacion.explicacionEfectivo}</p>
              )}
              {presentacion.explicacionTransferencia && (
                <p className="mt-1">{presentacion.explicacionTransferencia}</p>
              )}
            </div>
          )}
        </section>

        {requiereRecarga && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-12 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white"
          >
            Actualizar orden antes de cobrar
          </button>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800"
          >
            {error}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <button
            onClick={() => {
              setModoActivo(null);
              setConfirmCash(true);
            }}
            disabled={
              requiereRecarga ||
              loading ||
              estadoTransferencia === "subiendo" ||
              estadoTransferencia === "cobrando"
            }
            className="rounded-2xl bg-emerald-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-emerald-700 disabled:bg-slate-400"
          >
            💵 Efectivo
            <span className="block text-2xl">${montoEfectivo.toFixed(2)}</span>
          </button>
          <button
            onClick={() => {
              setConfirmCash(false);
              setModoActivo("transferencia");
            }}
            disabled={
              requiereRecarga ||
              loading ||
              estadoTransferencia === "subiendo" ||
              estadoTransferencia === "cobrando"
            }
            className="rounded-2xl bg-blue-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-blue-700 disabled:bg-slate-400"
          >
            🏦 Transferencia
            <span className="block text-2xl">
              ${montoTransferencia.toFixed(2)}
            </span>
          </button>
          <button
            onClick={() => {
              setConfirmCash(false);
              setModoActivo("mixto");
              setPreview(null);
              previewRequest.current++;
              idempotencyKey.current = crypto.randomUUID();
            }}
            disabled={
              requiereRecarga ||
              loading ||
              estadoTransferencia === "subiendo" ||
              estadoTransferencia === "cobrando"
            }
            className="rounded-2xl bg-amber-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-amber-700 disabled:bg-slate-400"
          >
            🔀 Mixto
            <span className="block text-2xl">${montoMixto.toFixed(2)}</span>
          </button>
        </section>

        {modoActivo && (
          <section
            ref={seccionModo}
            className="scroll-mt-4 rounded-2xl border border-blue-200 bg-white p-5 shadow"
          >
            <h2 className="text-lg font-bold">
              {modoActivo === "mixto"
                ? "Cobro mixto"
                : "Comprobante de transferencia"}
            </h2>

            {modoActivo === "mixto" && (
              <>
                <p className="mt-1 text-sm text-slate-600">
                  {envioRepuesto
                    ? `Se reparten $${montoMixto.toFixed(2)}: el envío de $${orden.costoEnvio.toFixed(2)} ya se lo quedó el motorizado y no se cobra aquí.`
                    : "Escribe cuánto entra en efectivo. El resto se cobra por transferencia."}
                </p>
                <form onSubmit={revisarMixto} className="mt-4">
                  <label
                    htmlFor="efectivo-mixto"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    {envioRepuesto
                      ? "Efectivo que te entrega el motorizado"
                      : "Monto en efectivo"}
                  </label>
                  <input
                    id="efectivo-mixto"
                    name="efectivo"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max={montoMixto}
                    required
                    disabled={
                      requiereRecarga ||
                      loading ||
                      estadoTransferencia === "subiendo" ||
                      estadoTransferencia === "cobrando"
                    }
                    value={montoEfectivoMixto}
                    onChange={(event) => {
                      setMontoEfectivoMixto(event.target.value);
                      setPreview(null);
                      setError("");
                      previewRequest.current++;
                      setRevisando(false);
                      idempotencyKey.current = crypto.randomUUID();
                    }}
                    className="mt-1 min-h-12 w-full rounded-xl border border-slate-400 px-4 py-3 text-xl"
                  />
                  <button
                    type="submit"
                    disabled={revisando || loading || requiereRecarga}
                    className="mt-3 min-h-12 rounded-xl bg-slate-900 px-4 font-bold text-white disabled:opacity-50"
                  >
                    {revisando ? "Revisando…" : "Revisar reparto"}
                  </button>
                </form>
                {preview && (
                  <div
                    role="status"
                    className="mt-4 space-y-1 rounded-xl bg-slate-50 p-4 text-sm"
                  >
                    <div className="flex justify-between">
                      <span>Efectivo en caja</span>
                      <strong>${preview.efectivo.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Transferencia</span>
                      <strong>${preview.transferencia.toFixed(2)}</strong>
                    </div>
                  </div>
                )}
                {envioRepuesto && (
                  <p className="mt-3 rounded-lg bg-purple-50 p-3 text-sm text-purple-900">
                    El cliente pagó ${saldo.toFixed(2)} y el motorizado conserva
                    ${orden.costoEnvio.toFixed(2)} del envío: no le pidas ese
                    valor ni se lo devuelvas después.
                  </p>
                )}
              </>
            )}

            <p className="mt-4 text-sm text-slate-600">
              Toma una foto clara del comprobante mostrado por el cliente.
            </p>
            <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-blue-400 p-5 text-center font-bold text-blue-700 hover:bg-blue-50">
              📷 Tomar foto
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              />
            </label>
            {photo && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Foto seleccionada: <strong>{photo.name}</strong>
              </div>
            )}
            {!storageDisponible && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                No se puede guardar la foto del comprobante. Puedes registrar el
                cobro sin foto.
              </div>
            )}
            {estadoTransferencia === "fallo" ? (
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => void subirYCobrar()}
                  disabled={
                    loading ||
                    requiereRecarga ||
                    (modoActivo === "mixto" && !mixtoValido)
                  }
                  className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => void cobrar(partesDelModo(null), modoActivo)}
                  disabled={
                    loading ||
                    requiereRecarga ||
                    (modoActivo === "mixto" && !mixtoValido)
                  }
                  className="w-full rounded-xl border border-amber-400 bg-amber-50 py-3 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {loading ? "Registrando…" : "Registrar sin comprobante"}
                </button>
              </div>
            ) : (
              <button
                onClick={() =>
                  storageDisponible
                    ? void subirYCobrar()
                    : void cobrar(partesDelModo(null), modoActivo)
                }
                disabled={
                  requiereRecarga ||
                  loading ||
                  estadoTransferencia === "subiendo" ||
                  estadoTransferencia === "cobrando" ||
                  (storageDisponible && !photo) ||
                  (modoActivo === "mixto" && !mixtoValido)
                }
                className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {estadoTransferencia === "subiendo"
                  ? "Subiendo comprobante…"
                  : loading
                    ? "Registrando…"
                    : modoActivo === "mixto"
                      ? `Confirmar $${montoMixto.toFixed(2)} mixto`
                      : "Confirmar transferencia"}
              </button>
            )}
          </section>
        )}
      </div>

      <dialog
        ref={dialogo}
        onCancel={(event) => {
          if (loading) event.preventDefault();
          else setConfirmCash(false);
        }}
        aria-labelledby="confirmar-cobro"
        className="m-auto w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-black/60"
      >
        <h2 id="confirmar-cobro" className="text-xl font-bold">
          Confirmar cobro
        </h2>
        <p className="mt-2 text-slate-600">
          ¿Confirmas que recibiste <strong>${montoEfectivo.toFixed(2)}</strong>{" "}
          en efectivo?
        </p>
        {presentacion.explicacionEfectivo && (
          <p className="mt-2 text-sm text-slate-500">
            {presentacion.explicacionEfectivo}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => void cobrar(presentacion.partesEfectivo, "efectivo")}
            disabled={loading || requiereRecarga}
            className="flex-1 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:bg-slate-400"
          >
            {loading ? "Procesando…" : "Aceptar"}
          </button>
          <button
            onClick={() => setConfirmCash(false)}
            disabled={loading || requiereRecarga}
            className="flex-1 rounded-xl bg-slate-200 py-3 font-bold text-slate-800"
          >
            Cancelar
          </button>
        </div>
      </dialog>
    </main>
  );
}
