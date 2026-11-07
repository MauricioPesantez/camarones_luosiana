"use client";

import { useState } from "react";
import { crearEnvioIdempotente } from "./envio";
export const campo = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900";
export const boton = "rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50";
export const tarjeta = "rounded-xl bg-white p-4 shadow-sm border border-gray-200 space-y-3";
export const dinero = (valor: number | string) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(valor));
export const fecha = (valor: string) => new Date(valor).toLocaleString("es-EC", { timeZone: "America/Guayaquil" });
export async function leer<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo consultar la información");
  return data;
}
export function useEnviar() {
  const [enviar] = useState(() => crearEnvioIdempotente());
  return enviar;
}
export function ErrorVisible({ texto }: { texto: string }) { return texto ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{texto}</p> : null; }
