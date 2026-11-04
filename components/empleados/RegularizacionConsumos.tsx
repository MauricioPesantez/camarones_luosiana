"use client";
import { useState } from "react";
import { boton, campo, tarjeta, dinero, leer, ErrorVisible } from "./ui";

type Candidato = { ordenId: string; expectedRevision: number; fingerprint: string; estado: string; empleadoId: string | null; importeHistorico: number; cargoExistente: boolean; cargoFaltante: number; incidencias: string[] };
type Analisis = { corte: string; candidatos: Candidato[]; siguienteCursor: string | null; resumen: { elegibles: number; descartados: number; cargosExistentes: number; cargosFaltantes: number; totalCargoFaltante: number } };
type Resultado = { ordenId: string; estado: "regularizado" | "ya_regularizado" | "excluido" | "conflicto"; motivo?: string; cargoAgregado: number };
type Lote = { resultados: Resultado[]; totalCargosAgregados: number; pendientes: number };
const ruta = "/api/admin/consumos-empleados/regularizacion";

export default function RegularizacionConsumos({ actualizar }: { actualizar: () => Promise<void> }) {
  const [dia, setDia] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" }));
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [ultimoLote, setUltimoLote] = useState<Lote | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [solicitud, setSolicitud] = useState<Record<string, unknown> | null>(null);
  const sinConfirmar = solicitud !== null;
  const analizar = async (siguiente = false) => {
    setOcupado(true); setError("");
    try {
      const nuevoCursor = siguiente ? analisis?.siguienteCursor ?? null : cursor;
      const params = new URLSearchParams({ corte: analisis?.corte ?? `${dia}T23:59:59.999-05:00` });
      if (nuevoCursor) params.set("cursor", nuevoCursor);
      const datos = await leer<Analisis>(`${ruta}?${params}`);
      setAnalisis(datos); setCursor(nuevoCursor); setUltimoLote(null);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo analizar el lote."); }
    finally { setOcupado(false); }
  };
  const regularizar = async () => {
    if (!analisis || !analisis.candidatos.length || analisis.candidatos.length > 50) return;
    setOcupado(true); setError("");
    try {
      const cuerpo = solicitud ?? { clientRequestId: crypto.randomUUID(), motivo, corte: analisis.corte, candidatos: analisis.candidatos.map(({ ordenId, expectedRevision, fingerprint }) => ({ ordenId, expectedRevision, fingerprint })) };
      setSolicitud(cuerpo);
      const respuesta = await fetch(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const datos = await respuesta.json();
      if (respuesta.ok || respuesta.status < 500) setSolicitud(null);
      if (!respuesta.ok) throw new Error(datos.error || "No se confirmó el lote. Reintente la misma solicitud.");
      const lote = datos as Lote;
      setUltimoLote(lote);
      setResultados(previos => [...previos.filter(r => !lote.resultados.some(n => n.ordenId === r.ordenId)), ...lote.resultados]);
      await actualizar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se confirmó el lote. Reintente la misma solicitud para recuperar su resultado."); }
    finally { setOcupado(false); }
  };
  return <details className={tarjeta}><summary className="font-bold">Regularización de consumos anteriores (administración)</summary>
    <p>Los consumos anteriores válidos se consideran entregados. Se registran solamente los cargos históricos faltantes, conservando existencias, precios y cierres anteriores. Analizar no modifica datos.</p>
    <ErrorVisible texto={error} />
    <label className="block">Hasta el final de este día (hora de Ecuador)<input type="date" required className={campo} value={dia} disabled={ocupado || sinConfirmar} onChange={e => { setDia(e.target.value); setAnalisis(null); setCursor(null); setUltimoLote(null); }} /></label>
    <button type="button" className={boton} disabled={ocupado || sinConfirmar || !dia} onClick={() => analizar()}>Analizar {analisis ? "de nuevo este lote" : "consumos anteriores"}</button>
    {analisis && <><p>Corte revisado: {new Date(analisis.corte).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</p>
      <p>Este lote: {analisis.resumen.elegibles} elegibles · {analisis.resumen.descartados} descartados · {analisis.resumen.cargosExistentes} cargos existentes · {analisis.resumen.cargosFaltantes} cargos faltantes · Importe faltante: {dinero(analisis.resumen.totalCargoFaltante)}</p>
      {analisis.candidatos.map(c => <div key={c.ordenId} className="border-t py-2 break-words"><p>Ref. {c.ordenId} · Beneficiario: {c.empleadoId ?? "Sin identificar"} · Importe histórico: {dinero(c.importeHistorico)} · Cargo faltante: {dinero(c.cargoFaltante)}</p>{c.incidencias.map((incidencia, i) => <p key={i} className="text-amber-900">Requiere revisión: {incidencia}</p>)}</div>)}
      <label className="block">Motivo de regularización<textarea required minLength={3} className={campo} value={motivo} disabled={ocupado || sinConfirmar} onChange={e => setMotivo(e.target.value)} /></label>
      <button type="button" className={boton} disabled={ocupado || !!ultimoLote || motivo.trim().length < 3 || !analisis.candidatos.length || analisis.candidatos.length > 50} onClick={regularizar}>{sinConfirmar ? "Reintentar el mismo lote" : "Regularizar este lote"}</button>
      {sinConfirmar && <p role="status">El resultado del envío no está confirmado. Reintente este mismo lote antes de modificar el motivo o analizar otro.</p>}
      {ultimoLote && <p role="status">Cargos añadidos: {dinero(ultimoLote.totalCargosAgregados)} · Documentos aún pendientes: {ultimoLote.pendientes}. {ultimoLote.resultados.some(r => r.estado === "conflicto") ? "Hay conflictos sin resolver: revise sus motivos y vuelva a analizar." : "Revise el resultado de cada documento."}</p>}
      {analisis.siguienteCursor && <button type="button" className={boton} disabled={ocupado || sinConfirmar} onClick={() => analizar(true)}>Analizar siguiente lote (máximo 50)</button>}
      {!analisis.candidatos.length && <p>No hay documentos en este lote.</p>}
    </>}
    {!!resultados.length && <section aria-label="Resultados de regularización" className="space-y-2"><h3 className="font-bold">Constancia de resultados de esta sesión</h3>{resultados.map(r => <p key={r.ordenId} className={r.estado === "conflicto" ? "rounded bg-amber-50 p-2 text-amber-900 break-words" : "border-t py-2 break-words"}>Ref. {r.ordenId} · {r.estado.replaceAll("_", " ")} · Cargo añadido: {dinero(r.cargoAgregado)}{r.motivo ? ` · ${r.motivo}` : ""}</p>)}</section>}
  </details>;
}
