// Reglas de la edicion de una orden. Sin React ni Prisma: las usan la pantalla y
// la ruta `/api/ordenes/[id]/items`, para que nunca digan cosas distintas.
import {
  calcularDescuento,
  calcularRecargoEnvases,
  descuentoDeOrden,
  esCategoriaCombo,
  esNivelPicante,
  obtenerEtiquetaNivelPicante,
  type NivelPicante,
} from "../types/orden";

export const ESTADOS_EDITABLES = [
  "pendiente",
  "en_preparacion",
  "lista",
  "cobrada",
];

export const MAX_OBSERVACIONES_ITEM = 200;

export interface ProductoEdicion {
  id: string;
  nombre: string;
  categoria: string;
  precio: number | string;
  stock: number;
  disponible: boolean;
}

export interface ItemDeOrden {
  id: string;
  cantidad: number;
  producto: ProductoEdicion;
  precioUnitario: number | string;
  nivelPicante?: NivelPicante | null;
  observaciones?: string | null;
  esCortesia?: boolean;
}

export interface Linea {
  id: string;
  producto: ProductoEdicion;
  precioUnitario: number;
  cantidad: number;
  /** Cantidad con la que llego; 0 en una linea agregada ahora. */
  original: number;
  nivelPicante: NivelPicante | null;
  nivelOriginal: NivelPicante | null;
  observaciones: string;
  esCortesia: boolean;
}

export type CambioItem =
  | { accion: "eliminar"; itemId: string }
  | {
      accion: "modificar";
      itemId: string;
      cantidad: number;
      nivelPicante?: NivelPicante;
    }
  | {
      accion: "agregar";
      productoId: string;
      cantidad: number;
      nivelPicante?: NivelPicante;
      observaciones?: string;
    };

export interface CambioDescrito {
  tipo: "agrega" | "quita" | "cambia";
  texto: string;
  monto: number;
}

export function sePuedeEditar(orden: {
  estado: string;
  cobrada: boolean;
  empleadoId?: string | null;
}): boolean {
  return (
    !orden.cobrada &&
    !orden.empleadoId &&
    ESTADOS_EDITABLES.includes(orden.estado)
  );
}

/** Por que no se puede quitar, bajar ni cambiar el picante. Agregar siempre se puede. */
export function bloqueoDeOrden(orden: {
  estado: string;
  montoPagado?: number | string | null;
}): "lista" | "pagada" | null {
  if (orden.estado === "lista") return "lista";
  return Number(orden.montoPagado ?? 0) > 0 ? "pagada" : null;
}

/** Guardia del servidor para cortesias y picante; null si el cambio pasa. */
export function motivoItemProtegido(
  cambio: Exclude<CambioItem, { accion: "agregar" }>,
  item: { esCortesia: boolean; producto: { nombre: string; categoria: string } },
  orden: { estado: string; montoPagado?: number | string | null },
  rol: string,
): string | null {
  // Una cortesia vale $0: subir su cantidad regala producto sin autorizacion.
  if (item.esCortesia && rol !== "admin") {
    return `Solo el administrador cambia una cortesía (${item.producto.nombre})`;
  }
  if (cambio.accion !== "modificar" || cambio.nivelPicante === undefined) {
    return null;
  }
  if (
    !esNivelPicante(cambio.nivelPicante) ||
    !esCategoriaCombo(item.producto.categoria)
  ) {
    return `Nivel de picante inválido para ${item.producto.nombre}`;
  }
  return bloqueoDeOrden(orden)
    ? "No se puede cambiar el picante de una orden lista o con un pago registrado"
    : null;
}

export function crearLineas(items: readonly ItemDeOrden[]): Linea[] {
  return items.map((item) => ({
    id: item.id,
    producto: item.producto,
    precioUnitario: Number(item.precioUnitario),
    cantidad: item.cantidad,
    original: item.cantidad,
    nivelPicante: item.nivelPicante ?? null,
    nivelOriginal: item.nivelPicante ?? null,
    observaciones: item.observaciones ?? "",
    esCortesia: item.esCortesia ?? false,
  }));
}

/** En 0, una linea original queda marcada para quitar; una nueva desaparece. */
export function ponerCantidad(
  lineas: readonly Linea[],
  id: string,
  cantidad: number,
): Linea[] {
  return lineas
    .map((linea) =>
      linea.id === id ? { ...linea, cantidad: Math.max(0, cantidad) } : linea,
    )
    .filter((linea) => linea.cantidad > 0 || linea.original > 0);
}

let siguienteNueva = 0;

export function agregarProducto(
  lineas: readonly Linea[],
  producto: ProductoEdicion,
  nivelPicante: NivelPicante | null,
): Linea[] {
  const existente = lineas.find(
    (linea) =>
      linea.producto.id === producto.id &&
      !linea.esCortesia &&
      !linea.observaciones.trim() &&
      linea.nivelPicante === nivelPicante,
  );
  if (existente) {
    return ponerCantidad(lineas, existente.id, existente.cantidad + 1);
  }
  return [
    ...lineas,
    {
      id: `nueva-${siguienteNueva++}`,
      producto,
      precioUnitario: Number(producto.precio),
      cantidad: 1,
      original: 0,
      nivelPicante,
      nivelOriginal: nivelPicante,
      observaciones: "",
      esCortesia: false,
    },
  ];
}

// El servidor aplica los cambios en orden: primero lo que libera stock.
const prioridad = (linea: Linea) =>
  linea.original === 0 ? 2 : linea.cantidad <= linea.original ? 0 : 1;

function lineasCambiadas(lineas: readonly Linea[]): Linea[] {
  return lineas
    .filter(
      (linea) =>
        linea.cantidad !== linea.original ||
        linea.nivelPicante !== linea.nivelOriginal,
    )
    .sort((a, b) => prioridad(a) - prioridad(b));
}

export function cambiosParaEnviar(lineas: readonly Linea[]): CambioItem[] {
  return lineasCambiadas(lineas).map((linea): CambioItem => {
    if (linea.original === 0) {
      const observaciones = linea.observaciones.trim();
      return {
        accion: "agregar",
        productoId: linea.producto.id,
        cantidad: linea.cantidad,
        ...(linea.nivelPicante ? { nivelPicante: linea.nivelPicante } : {}),
        ...(observaciones ? { observaciones } : {}),
      };
    }
    if (linea.cantidad === 0) return { accion: "eliminar", itemId: linea.id };
    return {
      accion: "modificar",
      itemId: linea.id,
      cantidad: linea.cantidad,
      ...(linea.nivelPicante && linea.nivelPicante !== linea.nivelOriginal
        ? { nivelPicante: linea.nivelPicante }
        : {}),
    };
  });
}

export function describirCambios(lineas: readonly Linea[]): CambioDescrito[] {
  return lineasCambiadas(lineas).flatMap((linea) => {
    const descritos: CambioDescrito[] = [];
    const delta = linea.cantidad - linea.original;
    const nota = linea.original === 0 ? linea.observaciones.trim() : "";
    if (delta !== 0) {
      descritos.push({
        tipo: delta > 0 ? "agrega" : "quita",
        texto: [
          `${Math.abs(delta)} ${linea.producto.nombre}`,
          ...(linea.nivelPicante
            ? [obtenerEtiquetaNivelPicante(linea.nivelPicante)]
            : []),
          ...(nota ? [`“${nota}”`] : []),
        ].join(" · "),
        monto: Math.round(delta * linea.precioUnitario * 100) / 100,
      });
    }
    if (
      linea.cantidad > 0 &&
      linea.nivelPicante &&
      linea.nivelPicante !== linea.nivelOriginal
    ) {
      const antes = linea.nivelOriginal
        ? obtenerEtiquetaNivelPicante(linea.nivelOriginal)
        : "Sin picante";
      descritos.push({
        tipo: "cambia",
        texto: `${linea.producto.nombre}: ${antes} pasa a ${obtenerEtiquetaNivelPicante(linea.nivelPicante)}`,
        monto: 0,
      });
    }
    return descritos;
  });
}

/** Unidades que todavia se pueden agregar; lo quitado en esta edicion vuelve a contar. */
export function stockRestante(
  lineas: readonly Linea[],
  producto: ProductoEdicion,
): number {
  return lineas
    .filter((linea) => linea.producto.id === producto.id)
    .reduce(
      (stock, linea) => stock - (linea.cantidad - linea.original),
      producto.stock,
    );
}

/** Mismo calculo que hace el servidor al guardar. */
export function totalDeLineas(
  lineas: readonly Linea[],
  orden: {
    tipoOrden: string;
    costoEnvio?: number | string | null;
    descuentoTipo?: string | null;
    descuentoValor?: number | string | null;
  },
): number {
  const subtotal = lineas.reduce(
    (suma, linea) => suma + linea.cantidad * linea.precioUnitario,
    0,
  );
  const recargo = calcularRecargoEnvases(
    orden.tipoOrden === "domicilio" || orden.tipoOrden === "para_llevar"
      ? orden.tipoOrden
      : "local",
    lineas.map((linea) => ({
      cantidad: linea.cantidad,
      categoria: linea.producto.categoria,
    })),
  );
  const total =
    subtotal -
    calcularDescuento(descuentoDeOrden(orden), subtotal) +
    recargo +
    Number(orden.costoEnvio ?? 0);
  return Math.round(total * 100) / 100;
}
