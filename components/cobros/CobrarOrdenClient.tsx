"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { comprimirImagen } from "@/lib/imagen-cliente";
import type { AuthenticatedUser } from "@/lib/session";
import { montoACobrarEnCaja } from "@/types/cobro";
import {
  obtenerEtiquetaNivelPicante,
  type MetodoPago,
  type NivelPicante,
} from "@/types/orden";

interface ParteDePago {
  metodoPago: MetodoPago;
  monto: number;
  comprobanteTransferenciaKey?: string;
}

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
  token,
  orden,
  usuario,
  successUrl,
  cerrarAlFinalizar,
  storageDisponible,
}: {
  token: string;
  orden: CobroOrder;
  usuario: AuthenticatedUser;
  successUrl: string;
  cerrarAlFinalizar: boolean;
  storageDisponible: boolean;
}) {
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
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
  const [modoActivo, setModoActivo] = useState<"transferencia" | "mixto" | null>(null);
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cobrado, setCobrado] = useState<string | null>(null);

  const subtotalProductos = orden.items.reduce(
    (total, item) => total + item.subtotal,
    0,
  );
  // El saldo es lo que falta por cobrar, no el total: una orden reabierta
  // (crecio despues de pagada) solo debe el resto.
  const saldoCentavos = Math.max(
    0,
    Math.round(orden.total * 100) - Math.round(orden.montoPagado * 100),
  );
  const saldo = saldoCentavos / 100;
  // El envio solo se neta la PRIMERA vez que se cobra la orden: para una
  // orden reabierta ya se liquido con el motorizado en el pago anterior, asi
  // que el saldo se muestra tal cual, sin volver a restarlo.
  const esPrimerPago = orden.montoPagado <= 0;
  const montoEfectivo = esPrimerPago
    ? montoACobrarEnCaja({
        tipoOrden: orden.tipoOrden,
        total: saldo,
        costoEnvio: orden.costoEnvio,
        metodoPago: "efectivo",
      })
    : saldo;
  const montoTransferencia = esPrimerPago
    ? montoACobrarEnCaja({
        tipoOrden: orden.tipoOrden,
        total: saldo,
        costoEnvio: orden.costoEnvio,
        metodoPago: "transferencia",
      })
    : saldo;
  const esDomicilio = orden.tipoOrden === "domicilio";

  const efectivoMixtoCentavos = Math.round(Number(montoEfectivoMixto || 0) * 100);
  const transferenciaMixtoCentavos = saldoCentavos - efectivoMixtoCentavos;
  const mixtoValido = efectivoMixtoCentavos > 0 && transferenciaMixtoCentavos > 0;

  // Que partes arma este acto de cobro segun el modo activo. `objectKey` es
  // el resultado (posiblemente null) de la subida a S3.
  const partesDelModo = (objectKey: string | null): ParteDePago[] =>
    modoActivo === "mixto"
      ? [
          { metodoPago: "efectivo", monto: efectivoMixtoCentavos / 100 },
          {
            metodoPago: "transferencia",
            monto: transferenciaMixtoCentavos / 100,
            ...(objectKey ? { comprobanteTransferenciaKey: objectKey } : {}),
          },
        ]
      : [
          {
            metodoPago: "transferencia",
            monto: saldo,
            ...(objectKey ? { comprobanteTransferenciaKey: objectKey } : {}),
          },
        ];

  const cobrar = async (
    partes: ParteDePago[],
    etiqueta: string,
  ): Promise<boolean> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/cobros/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partes,
          expectedRevision: orden.printRevision,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo registrar el cobro");
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
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "No se pudo registrar el cobro",
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
    const respuesta = await fetch(
      `/api/cobros/${encodeURIComponent(token)}/comprobante`,
      { method: "POST", body: formData },
    );
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
    if (!respuesta.ok) throw new Error(datos.error || "No se pudo subir el comprobante");
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
      const ok = await cobrar(partesDelModo(objectKey), modoActivo ?? "transferencia");
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
                ? saldo
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
            Cerrar y volver a mis órdenes
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
              <p>Cobra: <strong>{usuario.nombre}</strong></p>
              <p className="text-slate-400">Creada por {orden.mesero}</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Tipo</span><p className="font-semibold">{orden.tipoOrden.replaceAll("_", " ").toUpperCase()}</p></div>
            <div><span className="text-slate-500">Fecha</span><p className="font-semibold">{new Date(orden.createdAt).toLocaleString("es-EC")}</p></div>
            {orden.telefonoCliente && <div><span className="text-slate-500">Teléfono</span><p className="font-semibold">{orden.telefonoCliente}</p></div>}
            <div><span className="text-slate-500">Estado</span><p className="font-semibold">{orden.estado.replaceAll("_", " ")}</p></div>
          </div>

          <h2 className="mb-2 font-bold">Detalle de la orden</h2>
          <div className="divide-y">
            {orden.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">
                    {item.cantidad}x {item.producto.nombre}
                    {item.esCortesia && <span className="ml-2 text-amber-600">CORTESÍA</span>}
                  </p>
                  {item.nivelPicante && (
                    <p className="text-sm text-red-700">
                      Salsa: {obtenerEtiquetaNivelPicante(item.nivelPicante as NivelPicante)}
                    </p>
                  )}
                  {item.observaciones && <p className="text-sm text-slate-500">{item.observaciones}</p>}
                </div>
                <p className="font-semibold">${item.subtotal.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><span>Productos</span><span>${subtotalProductos.toFixed(2)}</span></div>
            {orden.recargo > 0 && <div className="flex justify-between"><span>Recipientes</span><span>${orden.recargo.toFixed(2)}</span></div>}
            {orden.costoEnvio > 0 && <div className="flex justify-between"><span>Envío del motorizado</span><span>${orden.costoEnvio.toFixed(2)}</span></div>}
            <div className={`flex justify-between border-t pt-2 ${esDomicilio ? "font-semibold" : "text-2xl font-bold"}`}>
              <span>{esDomicilio ? "Total que paga el cliente" : "Total cliente"}</span>
              <span className={esDomicilio ? "" : "text-emerald-700"}>${orden.total.toFixed(2)}</span>
            </div>
            {orden.montoPagado > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Ya pagado</span>
                <span>-${orden.montoPagado.toFixed(2)}</span>
              </div>
            )}
            {esDomicilio && (
              <div className="flex justify-between border-t pt-2 text-2xl font-bold">
                <span>{orden.montoPagado > 0 ? "Saldo a cobrar" : "Recibes en caja"}</span>
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

          {esDomicilio && (
            <div className="mt-4 rounded-xl bg-purple-50 p-4 text-sm text-purple-900">
              <p><strong>Si paga en efectivo:</strong> el motorizado te entrega ${montoEfectivo.toFixed(2)} y conserva ${orden.costoEnvio.toFixed(2)} del envío.</p>
              <p className="mt-1"><strong>Si paga por transferencia:</strong> el local recibe ${montoTransferencia.toFixed(2)} y entrega ${orden.costoEnvio.toFixed(2)} en efectivo al motorizado.</p>
            </div>
          )}
        </section>

        {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-3">
          <button
            onClick={() => { setModoActivo(null); setConfirmCash(true); }}
            disabled={loading || estadoTransferencia === "subiendo" || estadoTransferencia === "cobrando"}
            className="rounded-2xl bg-emerald-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-emerald-700 disabled:bg-slate-400"
          >
            💵 Efectivo
            <span className="block text-2xl">${montoEfectivo.toFixed(2)}</span>
          </button>
          <button
            onClick={() => { setConfirmCash(false); setModoActivo("transferencia"); }}
            disabled={loading || estadoTransferencia === "subiendo" || estadoTransferencia === "cobrando"}
            className="rounded-2xl bg-blue-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-blue-700 disabled:bg-slate-400"
          >
            🏦 Transferencia
            <span className="block text-2xl">${montoTransferencia.toFixed(2)}</span>
          </button>
          <button
            onClick={() => { setConfirmCash(false); setModoActivo("mixto"); }}
            disabled={loading || estadoTransferencia === "subiendo" || estadoTransferencia === "cobrando"}
            className="rounded-2xl bg-amber-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-amber-700 disabled:bg-slate-400"
          >
            🔀 Mixto
            <span className="block text-2xl">${saldo.toFixed(2)}</span>
          </button>
        </section>

        {modoActivo && (
          <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow">
            <h2 className="text-lg font-bold">
              {modoActivo === "mixto" ? "Cobro mixto" : "Comprobante de transferencia"}
            </h2>

            {modoActivo === "mixto" && (
              <>
                <p className="mt-1 text-sm text-slate-600">
                  Escribe cuánto paga en efectivo. El resto se cobra por transferencia.
                </p>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Monto en efectivo
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max={saldo}
                    value={montoEfectivoMixto}
                    onChange={(event) => setMontoEfectivoMixto(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-2xl font-bold"
                    placeholder="0.00"
                  />
                </label>
                <div className="mt-4 space-y-1 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between"><span>Efectivo</span><span className="font-semibold">${(efectivoMixtoCentavos / 100).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Transferencia</span><span className="font-semibold">${(transferenciaMixtoCentavos / 100).toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-bold"><span>Saldo</span><span>${saldo.toFixed(2)}</span></div>
                </div>
                {transferenciaMixtoCentavos <= 0 && efectivoMixtoCentavos > 0 && (
                  <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                    El efectivo cubre todo el saldo. Usa el botón de Efectivo.
                  </p>
                )}
                {esDomicilio && esPrimerPago && efectivoMixtoCentavos > 0 && (
                  <p className="mt-3 rounded-lg bg-purple-50 p-3 text-sm text-purple-900">
                    {efectivoMixtoCentavos >= Math.round(orden.costoEnvio * 100)
                      ? `El motorizado te entrega $${((efectivoMixtoCentavos - Math.round(orden.costoEnvio * 100)) / 100).toFixed(2)}.`
                      : `Le entregas $${((Math.round(orden.costoEnvio * 100) - efectivoMixtoCentavos) / 100).toFixed(2)} al motorizado.`}
                  </p>
                )}
              </>
            )}

            <p className="mt-4 text-sm text-slate-600">Toma una foto clara del comprobante mostrado por el cliente.</p>
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
                El almacenamiento de comprobantes no está configurado en este
                entorno. Puedes registrar el cobro, pero la foto no se guardará.
              </div>
            )}
            {estadoTransferencia === "fallo" ? (
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => void subirYCobrar()}
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => void cobrar(partesDelModo(null), modoActivo)}
                  disabled={loading}
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
                      ? `Confirmar $${saldo.toFixed(2)} mixto`
                      : "Confirmar transferencia"}
              </button>
            )}
          </section>
        )}
      </div>

      {confirmCash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Confirmar cobro</h2>
            <p className="mt-2 text-slate-600">¿Confirmas que recibiste <strong>${montoEfectivo.toFixed(2)}</strong> en efectivo?</p>
            {esDomicilio && orden.costoEnvio > 0 && (
              <p className="mt-2 text-sm text-slate-500">
                El cliente pagó ${saldo.toFixed(2)}; el motorizado conserva
                ${orden.costoEnvio.toFixed(2)} del envío.
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={() => void cobrar([{ metodoPago: "efectivo", monto: saldo }], "efectivo")} disabled={loading} className="flex-1 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:bg-slate-400">{loading ? "Procesando…" : "Aceptar"}</button>
              <button onClick={() => setConfirmCash(false)} disabled={loading} className="flex-1 rounded-xl bg-slate-200 py-3 font-bold text-slate-800">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
