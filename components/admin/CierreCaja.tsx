"use client";

import { useState, type ReactNode } from "react";
import type { SesionCaja } from "@/types/caja";
import type { ResumenCuadre } from "@/types/cuadre";
import {
  ESTADO_RETIRO_ANULADO,
  obtenerEtiquetaCategoriaRetiro,
  type RetiroCaja,
} from "@/types/retiro";
import { obtenerEtiquetaRol } from "@/types/usuario";
import {
  dolares,
  horaCorta,
  type ConsumoDelDia,
  type FiltroCobro,
} from "./orden-admin";

interface Props {
  fecha: string;
  caja: SesionCaja | null;
  resumen: ResumenCuadre;
  porCobrar: { cantidad: number; monto: number };
  retiros: RetiroCaja[];
  consumos: ConsumoDelDia[];
  onCajaCerrada: (caja: SesionCaja) => void;
  onCambio: () => Promise<void>;
  onVerOrdenes: (filtro: FiltroCobro) => void;
}

const tarjeta = "rounded-xl border border-slate-200 bg-white p-5 sm:p-6";

function explicarDiferencia(diferencia: number): string {
  if (diferencia === 0) return "La caja cuadra exacto.";
  return diferencia > 0
    ? `Sobran ${dolares(diferencia)}.`
    : `Faltan ${dolares(-diferencia)}.`;
}

function Renglon({
  signo,
  titulo,
  detalle,
  monto,
}: {
  signo?: "+" | "−";
  titulo: string;
  detalle?: ReactNode;
  monto: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt>
        {titulo}
        {detalle && (
          <span className="block text-sm text-slate-600">{detalle}</span>
        )}
      </dt>
      <dd className="shrink-0 font-semibold tabular-nums">
        {signo && `${signo} `}
        {dolares(monto)}
      </dd>
    </div>
  );
}

function Total({ titulo, monto }: { titulo: string; monto: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t-2 border-slate-900 pt-3">
      <dt className="font-bold">{titulo}</dt>
      <dd
        className={`shrink-0 text-2xl font-bold tabular-nums ${monto < 0 ? "text-red-700" : ""}`}
      >
        {dolares(monto)}
      </dd>
    </div>
  );
}

export default function CierreCaja({
  fecha,
  caja,
  resumen,
  porCobrar,
  retiros,
  consumos,
  onCajaCerrada,
  onCambio,
  onVerOrdenes,
}: Props) {
  const [contado, setContado] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState("");
  const [retiroAAnular, setRetiroAAnular] = useState<RetiroCaja | null>(null);
  const [razonAnulacion, setRazonAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);

  const esperado = resumen.efectivoEnCaja;
  const diferencia =
    contado === "" ? null : Math.round((Number(contado) - esperado) * 100) / 100;
  const hayAbonos = resumen.ordenesConSaldoPendiente > 0;
  const ultimoCorte = caja?.cortes.at(-1);

  const cerrarCaja = async () => {
    if (!caja || diferencia === null) return;
    const confirmado = confirm(
      [
        `Cerrar la caja del ${fecha}`,
        `Debe haber: ${dolares(esperado)}`,
        `Contaste: ${dolares(Number(contado))}`,
        explicarDiferencia(diferencia),
        porCobrar.cantidad > 0 &&
          `Quedan órdenes sin cobrar: ${porCobrar.cantidad} por ${dolares(porCobrar.monto)}.`,
        "El cierre no se puede deshacer desde esta pantalla.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    if (!confirmado) return;

    setCerrando(true);
    setErrorCierre("");
    try {
      const res = await fetch("/api/caja", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, montoCierre: Number(contado) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al cerrar la caja");
      }
      onCajaCerrada(data.caja);
      setContado("");
      await onCambio();
    } catch (error) {
      setErrorCierre(
        error instanceof Error ? error.message : "Error al cerrar la caja",
      );
    } finally {
      setCerrando(false);
    }
  };

  const anularRetiro = async () => {
    if (!retiroAAnular) return;
    setAnulando(true);
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
      await onCambio();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Error al anular el retiro",
      );
    } finally {
      setAnulando(false);
    }
  };

  // Transferencias de domicilios que aun no cierran: ya estan en el banco, pero
  // no se sabe que parte es venta hasta liquidar con el motorizado.
  const abonosSinLiquidar =
    Math.round(
      (resumen.depositosRecibidos -
        resumen.transferenciasVentas -
        resumen.efectivoEntregadoMotorizados) *
        100,
    ) / 100;

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="debe-haber" className={tarjeta}>
          <h2 id="debe-haber" className="text-lg font-bold">
            1. Cuánto efectivo debe haber
          </h2>
          <dl className="mt-2 divide-y divide-slate-100">
            <Renglon
              titulo="Con cuánto abrió la caja"
              detalle={
                caja
                  ? `${caja.abiertaPorNombre}, ${horaCorta(caja.abiertaAt)}`
                  : "Sin iniciar"
              }
              monto={resumen.fondoInicial}
            />
            <Renglon
              signo="+"
              titulo="Cobrado en efectivo en el local"
              monto={resumen.efectivoVentasDirectas}
            />
            <Renglon
              signo="+"
              titulo="Recibido de los motorizados"
              detalle="Domicilios pagados en efectivo, sin el envío"
              monto={resumen.efectivoCobradoMotorizados}
            />
            <Renglon
              signo="−"
              titulo="Entregado a los motorizados"
              detalle="Su envío, en pedidos pagados por transferencia"
              monto={resumen.efectivoEntregadoMotorizados}
            />
            <Renglon
              signo="−"
              titulo="Retiros de caja"
              detalle={`${resumen.cantidadRetiros} en el día`}
              monto={resumen.retirosEfectivo}
            />
            <Total titulo="Debe haber en la caja" monto={esperado} />
          </dl>
        </section>

        <section aria-labelledby="contar" className={tarjeta}>
          <h2 id="contar" className="text-lg font-bold">
            2. Cuenta y cierra
          </h2>

          {!caja ? (
            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              La caja de este día no se ha iniciado. No se puede cobrar ni
              retirar hasta que un mesero la abra desde{" "}
              <strong>Caja y corte de turno</strong>.
            </p>
          ) : caja.estado === "cerrada" ? (
            <>
              <dl className="mt-2 divide-y divide-slate-100">
                <Renglon
                  titulo="Debía haber"
                  detalle={
                    Number(caja.montoEsperadoCierre) !== esperado
                      ? `El cálculo actual da ${dolares(esperado)}: hubo cambios después del cierre`
                      : undefined
                  }
                  monto={Number(caja.montoEsperadoCierre)}
                />
                <Renglon titulo="Se contó" monto={Number(caja.montoCierre)} />
              </dl>
              <p
                className={`mt-3 rounded-lg p-4 text-lg font-semibold ${
                  Number(caja.diferenciaCierre) === 0
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-red-50 text-red-800"
                }`}
              >
                {explicarDiferencia(Number(caja.diferenciaCierre))}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                {caja.cerradaAt && `${horaCorta(caja.cerradaAt)} · `}
                Cerrada por {caja.cerradaPorNombre ?? "administrador"}. Estos
                valores ya no cambian.
              </p>
            </>
          ) : (
            <>
              <label className="mt-4 block font-semibold">
                ¿Cuánto efectivo contaste?
                <span className="mt-2 flex items-center rounded-lg border border-slate-400 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900">
                  <span aria-hidden className="pl-4 text-xl text-slate-600">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="9999.99"
                    step="0.01"
                    value={contado}
                    onChange={(e) => setContado(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-xl font-bold outline-none"
                    placeholder="0.00"
                  />
                </span>
              </label>
              {ultimoCorte && (
                <button
                  type="button"
                  onClick={() =>
                    setContado(ultimoCorte.montoContado.toFixed(2))
                  }
                  className="min-h-11 text-left text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                >
                  Usar el último corte: {dolares(ultimoCorte.montoContado)} (
                  {ultimoCorte.usuarioNombre}, {horaCorta(ultimoCorte.createdAt)}
                  )
                </button>
              )}

              <p
                role="status"
                className={`mt-3 rounded-lg p-4 font-semibold ${
                  diferencia === null
                    ? "bg-slate-50 text-slate-600"
                    : diferencia === 0
                      ? "bg-emerald-50 text-emerald-900"
                      : "bg-red-50 text-red-800"
                }`}
              >
                {diferencia === null
                  ? "Escribe lo que contaste para ver si cuadra."
                  : explicarDiferencia(diferencia)}
              </p>

              {hayAbonos ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  Todavía no puedes cerrar. Órdenes pagadas a medias:{" "}
                  {resumen.ordenesConSaldoPendiente}, deben{" "}
                  {dolares(resumen.montoSaldoPendiente)}.{" "}
                  <button
                    type="button"
                    onClick={() => onVerOrdenes("con_abono")}
                    className="font-semibold underline underline-offset-2"
                  >
                    Ver cuáles son
                  </button>
                </p>
              ) : (
                porCobrar.cantidad > 0 && (
                  <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    Antes de cerrar, revisa las órdenes sin cobrar:{" "}
                    {porCobrar.cantidad} por {dolares(porCobrar.monto)}.{" "}
                    <button
                      type="button"
                      onClick={() => onVerOrdenes("sin_cobrar")}
                      className="font-semibold underline underline-offset-2"
                    >
                      Ver cuáles son
                    </button>
                  </p>
                )
              )}

              <button
                type="button"
                onClick={cerrarCaja}
                disabled={cerrando || diferencia === null || hayAbonos}
                className="mt-4 min-h-12 w-full rounded-lg bg-slate-900 px-5 font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
              >
                {cerrando ? "Cerrando..." : "Cerrar caja"}
              </button>
              {errorCierre && (
                <p
                  role="alert"
                  className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700"
                >
                  {errorCierre}
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {caja && caja.cortes.length > 0 && (
        <section aria-labelledby="cortes" className={tarjeta}>
          <h2 id="cortes" className="text-lg font-bold">
            Cambios de turno
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Cada turno recibe lo que contó el anterior. Una corrección hecha
            después de un corte aparece en el turno siguiente.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-2 font-medium">Turno</th>
                  <th className="font-medium">Mesero</th>
                  <th className="font-medium">Hora</th>
                  <th className="text-right font-medium">Recibió</th>
                  <th className="text-right font-medium">Debía haber</th>
                  <th className="text-right font-medium">Contó</th>
                  <th className="text-right font-medium">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {caja.cortes.map((corte) => (
                  <tr key={corte.id}>
                    <td className="py-2 font-semibold">{corte.numero}</td>
                    <td>{corte.usuarioNombre}</td>
                    <td>{horaCorta(corte.createdAt)}</td>
                    <td className="text-right">{dolares(corte.fondoInicial)}</td>
                    <td className="text-right">
                      {dolares(corte.montoEsperado)}
                    </td>
                    <td className="text-right">{dolares(corte.montoContado)}</td>
                    <td
                      className={`text-right font-semibold ${
                        corte.diferencia === 0
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {corte.diferencia > 0 && "+"}
                      {dolares(corte.diferencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="retiros" className={tarjeta}>
        <h2 id="retiros" className="text-lg font-bold">
          Retiros de caja
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Efectivo que los empleados sacaron para gastos del local.
        </p>
        {retiros.length === 0 ? (
          <p className="mt-3 text-slate-600">No hay retiros en esta fecha.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {retiros.map((retiro) => {
              const anulado = retiro.estado === ESTADO_RETIRO_ANULADO;
              return (
                <li
                  key={retiro.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                >
                  <span className="w-20 shrink-0 text-sm text-slate-600">
                    {horaCorta(retiro.createdAt)}
                  </span>
                  <span className="min-w-48 flex-1">
                    <span className="block">{retiro.motivo}</span>
                    <span className="block text-sm text-slate-600">
                      {obtenerEtiquetaCategoriaRetiro(retiro.categoria)}
                      {retiro.beneficiarioNombre &&
                        ` para ${retiro.beneficiarioNombre}`}{" "}
                      · {retiro.usuarioNombre} (
                      {obtenerEtiquetaRol(retiro.usuarioRol)})
                    </span>
                    {anulado && (
                      <span className="block text-sm font-semibold text-slate-600">
                        Anulado por {retiro.anuladoPorNombre}
                        {retiro.razonAnulacion && `: ${retiro.razonAnulacion}`}
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${anulado ? "text-slate-600 line-through" : ""}`}
                  >
                    − {dolares(Number(retiro.monto))}
                  </span>
                  {!anulado && (
                    <button
                      type="button"
                      onClick={() => {
                        setRetiroAAnular(retiro);
                        setRazonAnulacion("");
                      }}
                      className="min-h-11 rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      Anular
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="banco" className={tarjeta}>
          <h2 id="banco" className="text-lg font-bold">
            Qué debe constar en el banco
          </h2>
          <dl className="mt-2 divide-y divide-slate-100">
            <Renglon
              titulo="Ventas por transferencia"
              detalle="Dinero del local"
              monto={resumen.transferenciasVentas}
            />
            <Renglon
              signo="+"
              titulo="Envíos que se devuelven en efectivo"
              detalle="Dinero de los motorizados que llegó al banco"
              monto={resumen.efectivoEntregadoMotorizados}
            />
            {abonosSinLiquidar !== 0 && (
              <Renglon
                titulo="Domicilios a medio pagar"
                detalle="Se reparte cuando se termine de cobrar"
                monto={abonosSinLiquidar}
              />
            )}
            <Total
              titulo="Total en el banco"
              monto={resumen.depositosRecibidos}
            />
          </dl>
        </section>

        <section aria-labelledby="no-cuenta" className={tarjeta}>
          <h2 id="no-cuenta" className="text-lg font-bold">
            Lo que no cuenta como venta
          </h2>
          <dl className="mt-2 divide-y divide-slate-100">
            <Renglon
              titulo="Envíos de los motorizados"
              detalle="Es dinero de ellos"
              monto={resumen.enviosMotorizados}
            />
            <Renglon
              titulo="Órdenes anuladas"
              detalle={`${resumen.ordenesAnuladas} en el día`}
              monto={resumen.ventasAnuladas}
            />
            <Renglon
              titulo="Consumos de empleados"
              detalle={
                <>
                  {consumos.length === 0 ? (
                    <span className="block">Sin consumos en esta fecha</span>
                  ) : (
                    <details>
                      <summary className="cursor-pointer py-1">
                        Ver {consumos.length}
                      </summary>
                      <ul>
                        {consumos.map((c) => (
                          <li key={c.id}>
                            {c.empleadoNombre} ·{" "}
                            {c.anulada ? "Anulado" : c.estado} ·{" "}
                            {dolares(c.total)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <a
                    href="/admin/empleados"
                    className="inline-block py-1 font-semibold text-blue-700 underline underline-offset-2"
                  >
                    Ver cuentas de empleados
                  </a>
                </>
              }
              monto={consumos
                .filter((c) => !c.anulada)
                .reduce((suma, c) => suma + c.total, 0)}
            />
          </dl>
        </section>
      </div>

      {retiroAAnular && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Anular retiro
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {retiroAAnular.usuarioNombre} registró{" "}
              {dolares(Number(retiroAAnular.monto))} por{" "}
              {obtenerEtiquetaCategoriaRetiro(retiroAAnular.categoria)}. El
              retiro no se borra: queda visible como anulado y deja de restar de
              la caja.
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
                disabled={anulando || razonAnulacion.trim() === ""}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 font-semibold"
              >
                {anulando ? "Anulando..." : "Confirmar anulación"}
              </button>
              <button
                onClick={() => {
                  setRetiroAAnular(null);
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
    </div>
  );
}
