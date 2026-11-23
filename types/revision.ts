import { aCentavos, resumirMetodoPago } from "./cobro";
import { esMetodoPago, type MetodoPago } from "./orden";

export type MarcaProducto =
  | { itemId: string; estado: "bien" }
  | { itemId: string; estado: "mal"; cantidadReal: number };
export type MarcaCobro = "bien" | "efectivo" | "transferencia" | "mixto" | null;
export type MarcaTotal =
  | { estado: "bien" }
  | { estado: "de_mas" | "de_menos"; diferencia: number }
  | null;
export interface MarcasRevision {
  productos: MarcaProducto[];
  faltantes: { productoId: string; cantidad: number }[];
  cobro: MarcaCobro;
  total: MarcaTotal;
  /** Claves de errores anteriores que el admin quitó. */
  quitados?: string[];
}
export interface OrdenRevisable {
  tipoOperacion?: string;
  empleadoId?: string | null;
  anulada: boolean;
  estado: string;
  total: number | string;
  items: {
    id: string;
    cantidad: number;
    nivelPicante?: string | null;
    precioUnitario: number | string;
    nombreProducto?: string | null;
    producto: { nombre: string };
  }[];
  pagos?: readonly { metodoPago: string; monto: number | string; estado?: string | null }[];
}
// Viene de un JSONB: el orden de las llaves no cuenta y productos/cobro/total
// pueden faltar mientras no se marquen.
export interface DetalleRevision {
  productos?: {
    itemId: string;
    nombre: string;
    cantidad: number;
    nivelPicante: string | null;
    precioUnitario: number;
    estado: "bien" | "mal";
    cantidadReal?: number;
  }[];
  faltantes: { productoId: string; nombre: string; cantidad: number; precio: number }[];
  cobro?: {
    sistema: { metodoPago: string; monto: number }[];
    estado: "bien" | "efectivo" | "transferencia" | "mixto";
  } | null;
  total?: {
    sistema: number;
    estado: "bien" | "de_mas" | "de_menos";
    diferencia?: number;
  } | null;
  /** Todos los items de la orden al guardar: distingue un item nuevo de uno sin marcar. */
  itemsVistos: string[];
  /** Errores anotados antes de que la orden cambiara: se conservan al volver a revisarla. */
  anteriores?: ErrorAnterior[];
  /** De quién es cada error, por clave: un cobro posterior no lo mueve a otra persona. */
  personas?: Record<string, string>;
}
export interface PersonasOrden {
  creador: string;
  cobrador: string | null;
}
export interface RevisionGuardada {
  ordenId: string;
  detalle: DetalleRevision;
  revisada: boolean;
  conErrores: boolean;
  version: number;
  revisadaPorNombre: string | null;
  revisadaAt: string | null;
}
export interface SolicitudRevision {
  marcas: MarcasRevision;
  revisada: boolean;
  version: number;
  huella: string;
}
export type TipoError = "falto" | "no_iba" | "cantidad" | "metodo" | "total";
export interface ErrorRevision {
  tipo: TipoError;
  texto: string;
  de: "creador" | "cobrador";
  /** Ausente si la revisión no guardó quién era. */
  persona?: string;
  anterior?: true;
}
export interface ErrorAnterior extends Omit<ErrorRevision, "anterior"> {
  clave: string;
}

const MAX_FALTANTES = 50;
const MAX_CANTIDAD = 99;
const MAX_DIFERENCIA = 9999.99;
const MAX_QUITADOS = 200;
const MAX_CLAVE = 500;

function pagosActivos(orden: OrdenRevisable) {
  return (orden.pagos ?? []).filter((p) => p.estado !== "REEMBOLSADO");
}

function pagosEnCentavos(orden: OrdenRevisable): [string, number][] {
  return pagosActivos(orden)
    .map((p): [string, number] => [p.metodoPago, aCentavos(p.monto)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
}

export function sePuedeRevisar(orden: OrdenRevisable): boolean {
  return (
    !orden.anulada &&
    orden.estado !== "cancelada" &&
    orden.estado !== "pendiente_aprobacion_stock" &&
    orden.tipoOperacion !== "CONSUMO_EMPLEADO"
  );
}

export function llevaCobro(orden: OrdenRevisable): boolean {
  if (orden.empleadoId) return false;
  return aCentavos(orden.total) > 0 || pagosActivos(orden).length > 0;
}

export function metodoRegistrado(orden: OrdenRevisable): MetodoPago | "mixto" | null {
  return resumirMetodoPago(pagosActivos(orden));
}

export function huellaOrden(orden: OrdenRevisable): string {
  const items = orden.items
    .map((i) => [i.id, i.cantidad, i.nivelPicante ?? null, aCentavos(i.precioUnitario)])
    .sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : 0));
  return JSON.stringify({ items, pagos: pagosEnCentavos(orden), total: aCentavos(orden.total) });
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const esTexto = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const esEntero = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

export function validarSolicitud(
  raw: unknown,
): { ok: true; data: SolicitudRevision } | { ok: false; error: string } {
  const falla = (error: string) => ({ ok: false as const, error });
  if (!esObjeto(raw) || !esObjeto(raw.marcas)) return falla("Solicitud inválida");
  const { marcas, revisada, version, huella } = raw;
  if (typeof revisada !== "boolean") return falla("revisada debe ser verdadero o falso");
  if (!esEntero(version, 0, Number.MAX_SAFE_INTEGER)) return falla("Versión inválida");
  if (!esTexto(huella)) return falla("Huella inválida");

  if (!Array.isArray(marcas.productos)) return falla("Productos inválidos");
  const productos: MarcaProducto[] = [];
  const vistos = new Set<string>();
  for (const p of marcas.productos) {
    if (!esObjeto(p) || !esTexto(p.itemId) || vistos.has(p.itemId)) return falla("Producto inválido");
    vistos.add(p.itemId);
    if (p.estado === "bien") productos.push({ itemId: p.itemId, estado: "bien" });
    else if (p.estado === "mal" && esEntero(p.cantidadReal, 0, MAX_CANTIDAD))
      productos.push({ itemId: p.itemId, estado: "mal", cantidadReal: p.cantidadReal });
    else return falla("Cantidad real inválida");
  }

  if (!Array.isArray(marcas.faltantes) || marcas.faltantes.length > MAX_FALTANTES)
    return falla("Faltantes inválidos");
  const faltantes: MarcasRevision["faltantes"] = [];
  const productosFaltantes = new Set<string>();
  for (const f of marcas.faltantes) {
    if (
      !esObjeto(f) ||
      !esTexto(f.productoId) ||
      !esEntero(f.cantidad, 1, MAX_CANTIDAD) ||
      productosFaltantes.has(f.productoId)
    )
      return falla("Faltante inválido");
    productosFaltantes.add(f.productoId);
    faltantes.push({ productoId: f.productoId, cantidad: f.cantidad });
  }

  const cobro = marcas.cobro;
  if (cobro !== null && cobro !== "bien" && cobro !== "mixto" && !esMetodoPago(cobro))
    return falla("Cobro inválido");

  let total: MarcaTotal;
  const t = marcas.total;
  if (t === null) total = null;
  else if (esObjeto(t) && t.estado === "bien") total = { estado: "bien" };
  else if (esObjeto(t) && (t.estado === "de_mas" || t.estado === "de_menos")) {
    const d = t.diferencia;
    if (typeof d !== "number") return falla("Diferencia inválida");
    const c = Math.round(d * 100);
    if (!(c >= 1 && c <= MAX_DIFERENCIA * 100) || Math.abs(d * 100 - c) > 1e-6)
      return falla("Diferencia inválida");
    total = { estado: t.estado, diferencia: c / 100 };
  } else return falla("Total inválido");

  const quitados = marcas.quitados ?? [];
  if (
    !Array.isArray(quitados) ||
    quitados.length > MAX_QUITADOS ||
    !quitados.every((clave) => esTexto(clave) && clave.length <= MAX_CLAVE)
  )
    return falla("Errores quitados inválidos");

  return {
    ok: true,
    data: {
      marcas: { productos, faltantes, cobro: cobro as MarcaCobro, total, ...(quitados.length ? { quitados } : {}) },
      revisada,
      version,
      huella,
    },
  };
}

const nombreItem = (i: OrdenRevisable["items"][number]) => i.nombreProducto ?? i.producto.nombre;
const dinero = (n: number | string) => aCentavos(n) / 100;

export function construirDetalle(
  orden: OrdenRevisable,
  marcas: MarcasRevision,
  catalogo: ReadonlyMap<string, { nombre: string; precio: number | string }>,
  previo: DetalleRevision | null = null,
  personas?: PersonasOrden,
): { ok: true; detalle: DetalleRevision } | { ok: false; error: string } {
  const falla = (error: string) => ({ ok: false as const, error });
  if (!sePuedeRevisar(orden)) return falla("La orden no se puede revisar");

  const productos: NonNullable<DetalleRevision["productos"]> = [];
  for (const m of marcas.productos) {
    const item = orden.items.find((i) => i.id === m.itemId);
    if (!item) return falla("El producto no es de esta orden");
    if (m.estado === "mal" && m.cantidadReal === item.cantidad)
      return falla("La cantidad real es igual a la registrada");
    productos.push({
      itemId: item.id,
      nombre: nombreItem(item),
      cantidad: item.cantidad,
      nivelPicante: item.nivelPicante ?? null,
      precioUnitario: dinero(item.precioUnitario),
      estado: m.estado,
      ...(m.estado === "mal" ? { cantidadReal: m.cantidadReal } : {}),
    });
  }

  const faltantes: DetalleRevision["faltantes"] = [];
  for (const f of marcas.faltantes) {
    const prod = catalogo.get(f.productoId);
    if (!prod) return falla("El producto no existe en el catálogo");
    faltantes.push({
      productoId: f.productoId,
      nombre: prod.nombre,
      cantidad: f.cantidad,
      precio: dinero(prod.precio),
    });
  }

  let cobro: DetalleRevision["cobro"] = null;
  if (marcas.cobro !== null) {
    if (!llevaCobro(orden)) return falla("La orden no lleva cobro");
    // Sin pago registrado cualquier método real es válido.
    if (marcas.cobro !== "bien" && marcas.cobro === metodoRegistrado(orden))
      return falla("El método real es igual al registrado");
    cobro = {
      sistema: pagosActivos(orden).map((p) => ({ metodoPago: p.metodoPago, monto: dinero(p.monto) })),
      estado: marcas.cobro,
    };
  }

  const total: DetalleRevision["total"] = marcas.total
    ? {
        sistema: dinero(orden.total),
        estado: marcas.total.estado,
        ...(marcas.total.estado === "bien" ? {} : { diferencia: marcas.total.diferencia }),
      }
    : null;

  const quitados = new Set(marcas.quitados);
  const anteriores = anterioresDe(orden, previo).filter((e) => !quitados.has(e.clave));

  const detalle: DetalleRevision = {
    productos,
    faltantes,
    cobro,
    total,
    itemsVistos: orden.items.map((i) => i.id),
    ...(anteriores.length ? { anteriores } : {}),
  };
  const marcados = personas ? erroresMarcados(detalle) : [];
  if (personas && marcados.length > 0) {
    // Un error que ya estaba anotado conserva su persona.
    const antes = new Map(
      [...(previo ? erroresMarcados(previo) : []), ...(previo?.anteriores ?? [])].map((e) => [e.clave, e.persona]),
    );
    detalle.personas = Object.fromEntries(
      marcados.map((e) => [
        e.clave,
        antes.get(e.clave) ?? (e.de === "creador" ? personas.creador : personas.cobrador || personas.creador),
      ]),
    );
  }
  return { ok: true, detalle };
}

const MARCAS_VACIAS = (): MarcasRevision => ({ productos: [], faltantes: [], cobro: null, total: null });

export function marcasVigentes(
  orden: OrdenRevisable,
  detalle: DetalleRevision | null,
): { marcas: MarcasRevision; cambios: string[] } {
  const marcas = MARCAS_VACIAS();
  const cambios: string[] = [];
  if (!detalle) return { marcas, cambios };

  const productos = detalle.productos ?? [];
  for (const p of productos) {
    const item = orden.items.find((i) => i.id === p.itemId);
    if (!item) continue; // se avisa abajo, con los items quitados
    const igual =
      item.cantidad === p.cantidad &&
      (item.nivelPicante ?? null) === (p.nivelPicante ?? null) &&
      aCentavos(item.precioUnitario) === aCentavos(p.precioUnitario);
    if (!igual) cambios.push(`Cambió ${nombreItem(item)}`);
    else if (p.estado === "mal" && typeof p.cantidadReal === "number")
      marcas.productos.push({ itemId: p.itemId, estado: "mal", cantidadReal: p.cantidadReal });
    else marcas.productos.push({ itemId: p.itemId, estado: "bien" });
  }

  const vistos = new Set(detalle.itemsVistos);
  for (const i of orden.items) if (!vistos.has(i.id)) cambios.push(`Se agregó ${nombreItem(i)}`);
  const actuales = new Set(orden.items.map((i) => i.id));
  for (const id of detalle.itemsVistos) {
    if (actuales.has(id)) continue;
    const nombre = productos.find((p) => p.itemId === id)?.nombre;
    cambios.push(`Se quitó ${nombre ?? "un producto"}`);
  }

  marcas.faltantes = detalle.faltantes.map((f) => ({ productoId: f.productoId, cantidad: f.cantidad }));

  if (detalle.cobro) {
    const antes = JSON.stringify(
      detalle.cobro.sistema
        .map((p): [string, number] => [p.metodoPago, aCentavos(p.monto)])
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1])),
    );
    if (llevaCobro(orden) && antes === JSON.stringify(pagosEnCentavos(orden))) marcas.cobro = detalle.cobro.estado;
    else cambios.push("Cambió el cobro");
  }

  if (detalle.total) {
    if (aCentavos(detalle.total.sistema) === aCentavos(orden.total))
      marcas.total =
        detalle.total.estado === "bien"
          ? { estado: "bien" }
          : { estado: detalle.total.estado, diferencia: detalle.total.diferencia ?? 0 };
    else cambios.push("Cambió el total");
  }

  return { marcas, cambios };
}

export function pendientes(
  orden: OrdenRevisable,
  marcas: MarcasRevision,
): { productos: string[]; cobro: boolean; total: boolean; cuantos: number } {
  const marcados = new Set(marcas.productos.map((p) => p.itemId));
  const productos = orden.items.filter((i) => !marcados.has(i.id)).map((i) => i.id);
  const cobro = llevaCobro(orden) && marcas.cobro === null;
  const total = marcas.total === null;
  return { productos, cobro, total, cuantos: productos.length + (cobro ? 1 : 0) + (total ? 1 : 0) };
}

const REGISTRADO: Record<string, string> = {
  efectivo: "Efectivo registrado",
  transferencia: "Transferencia registrada",
  mixto: "Mixto registrado",
};

/** Los de las marcas actuales, cada uno con una clave que no cambia entre guardados. */
function erroresMarcados(detalle: DetalleRevision): ErrorAnterior[] {
  const errores: ErrorAnterior[] = [];
  const anotar = (error: ErrorRevision, donde = "") => {
    const clave = `${error.tipo}:${donde}:${error.texto}`;
    const persona = detalle.personas?.[clave];
    errores.push({ ...error, clave, ...(persona && { persona }) });
  };
  for (const p of detalle.productos ?? []) {
    if (p.estado !== "mal") continue;
    if (p.cantidadReal === 0)
      anotar({ tipo: "no_iba", texto: `No iba: ${p.cantidad}× ${p.nombre}`, de: "creador" }, p.itemId);
    else
      anotar(
        {
          tipo: "cantidad",
          texto: `${p.nombre}: registrado ${p.cantidad}, real ${p.cantidadReal}`,
          de: "creador",
        },
        p.itemId,
      );
  }
  for (const f of detalle.faltantes)
    anotar({ tipo: "falto", texto: `Faltó ${f.cantidad}× ${f.nombre}`, de: "creador" });

  const cobro = detalle.cobro;
  if (cobro && cobro.estado !== "bien") {
    const registrado = resumirMetodoPago(cobro.sistema.filter((p) => esMetodoPago(p.metodoPago)));
    anotar({
      tipo: "metodo",
      texto: registrado
        ? `${REGISTRADO[registrado]}, fue ${cobro.estado}`
        : cobro.estado === "mixto"
          ? "Sin cobrar, pero el cobro fue mixto"
          : `Sin cobrar, pero se cobró en ${cobro.estado}`,
      de: "cobrador",
    });
  }

  const total = detalle.total;
  if (total && total.estado !== "bien")
    anotar({
      tipo: "total",
      texto: `Cobró $${(total.diferencia ?? 0).toFixed(2)} ${total.estado === "de_mas" ? "de más" : "de menos"}`,
      de: "cobrador",
    });
  return errores;
}

/** Errores ya anotados que la orden actual no respalda: los guardados y los recién superados. */
export function anterioresDe(orden: OrdenRevisable, detalle: DetalleRevision | null): ErrorAnterior[] {
  if (!detalle) return [];
  const { marcas } = marcasVigentes(orden, detalle);
  const vigentes = new Set(marcas.productos.map((p) => p.itemId));
  const superados = erroresMarcados({
    productos: (detalle.productos ?? []).filter((p) => !vigentes.has(p.itemId)),
    faltantes: [],
    cobro: marcas.cobro === null ? detalle.cobro : null,
    total: marcas.total === null ? detalle.total : null,
    itemsVistos: [],
    personas: detalle.personas,
  });
  return [...new Map([...(detalle.anteriores ?? []), ...superados].map((e) => [e.clave, e])).values()];
}

export function erroresDe(detalle: DetalleRevision): ErrorRevision[] {
  const marcados = erroresMarcados(detalle);
  // El mismo error vuelto a anotar no se cuenta dos veces.
  const claves = new Set(marcados.map((e) => e.clave));
  const sinClave = ({ tipo, texto, de, persona }: ErrorAnterior): ErrorRevision => ({
    tipo,
    texto,
    de,
    ...(persona && { persona }),
  });
  return [
    ...marcados.map(sinClave),
    ...(detalle.anteriores ?? [])
      .filter((e) => !claves.has(e.clave))
      .map((e) => ({ ...sinClave(e), anterior: true as const })),
  ];
}

export function estadoRevision(
  orden: OrdenRevisable,
  revision: RevisionGuardada | null,
): "sin_revisar" | "cambio" | "bien" | "con_errores" {
  if (!revision || !revision.revisada) return "sin_revisar";
  const vigentes = marcasVigentes(orden, revision.detalle);
  if (vigentes.cambios.length > 0) return "cambio";
  if (pendientes(orden, vigentes.marcas).cuantos > 0) return "sin_revisar";
  return revision.conErrores ? "con_errores" : "bien";
}
