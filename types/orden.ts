// Tipos relacionados con órdenes y aprobaciones sin stock

import { ItemSinStock } from './stock';

export type TipoOrden = 'local' | 'para_llevar' | 'domicilio';

export const RECARGO_RECIPIENTES = 1.25;

export function esCategoriaCombo(categoria: unknown): boolean {
  if (typeof categoria !== 'string') return false;
  const normalizada = categoria.trim().toLocaleLowerCase('es');
  return normalizada === 'combo' || normalizada === 'combos';
}

export function calcularRecargoEnvases(
  tipoOrden: TipoOrden,
  items: readonly { cantidad: number; categoria: string }[],
): number {
  if (tipoOrden === 'local') return 0;

  const cantidadCombos = items.reduce(
    (total, item) =>
      esCategoriaCombo(item.categoria) ? total + item.cantidad : total,
    0,
  );
  return cantidadCombos * RECARGO_RECIPIENTES;
}

export const NIVELES_PICANTE = [
  { value: 'natural', label: 'Natural' },
  { value: 'leve', label: 'Leve' },
  { value: 'picante_1', label: 'Picante 1' },
  { value: 'picante_2', label: 'Picante 2' },
  { value: 'picante_3', label: 'Picante 3' },
] as const;

export type NivelPicante = (typeof NIVELES_PICANTE)[number]['value'];

export function esNivelPicante(valor: unknown): valor is NivelPicante {
  return (
    typeof valor === 'string' &&
    NIVELES_PICANTE.some((nivel) => nivel.value === valor)
  );
}

export function obtenerEtiquetaNivelPicante(nivel: NivelPicante): string {
  return NIVELES_PICANTE.find((opcion) => opcion.value === nivel)?.label ?? nivel;
}

/**
 * Costo de envio contenido en el total de una orden.
 *
 * Ese dinero NUNCA es ingreso del local: en efectivo el motorizado se lo queda
 * al liquidar, y en transferencia entra al banco pero se le devuelve en
 * efectivo. Fuera de domicilio siempre es 0, sin importar lo que traiga el
 * campo. Unica fuente de esta regla: el cuadre y la interfaz la usan igual.
 */
export function obtenerCostoEnvio(orden: {
  tipoOrden?: string | null;
  costoEnvio?: number | string | null;
}): number {
  if (orden.tipoOrden !== 'domicilio') return 0;
  const costo = Number(orden.costoEnvio ?? 0);
  return Number.isFinite(costo) && costo > 0 ? costo : 0;
}

/** Parte del total que si le pertenece al local: todo menos el envio. */
export function calcularVentaPropia(orden: {
  tipoOrden?: string | null;
  total: number | string;
  costoEnvio?: number | string | null;
}): number {
  const centavos =
    Math.round(Number(orden.total ?? 0) * 100) -
    Math.round(obtenerCostoEnvio(orden) * 100);
  return centavos / 100;
}

export type MetodoPago = 'efectivo' | 'transferencia';

export const METODOS_PAGO: MetodoPago[] = ['efectivo', 'transferencia'];

export function esMetodoPago(valor: unknown): valor is MetodoPago {
  return typeof valor === 'string' && METODOS_PAGO.includes(valor as MetodoPago);
}

/**
 * Liquidación con el motorizado en órdenes a domicilio.
 *
 * - efectivo: el motorizado cobra el total al cliente y al retirar el pedido paga
 *   al local todo menos el envío, que es su ganancia. El local RECIBE `montoLocal`.
 * - transferencia: el cliente deposita el total al local, así que el local le
 *   ENTREGA el envío en efectivo al motorizado.
 *
 * Devuelve `null` para cualquier orden que no sea domicilio con modalidad acordada
 * (incluidas las órdenes anteriores a esta funcionalidad).
 */
export function calcularLiquidacionDomicilio(orden: {
  tipoOrden?: string | null;
  total: number;
  costoEnvio?: number | null;
  /** Modalidad acordada al crear. Si es null la orden es anterior a esta lógica. */
  metodoPagoPrevisto?: string | null;
  /** Modalidad con la que se cobró realmente. Manda sobre la acordada. */
  metodoPago?: string | null;
}): {
  metodo: MetodoPago;
  /** Lo que el local recibe en efectivo de manos del motorizado. */
  efectivoRecibido: number;
  /** Lo que el local entrega en efectivo al motorizado. */
  efectivoEntregado: number;
  /** Lo que ingresa por transferencia. */
  transferenciaRecibida: number;
} | null {
  if (orden.tipoOrden !== 'domicilio') return null;
  // Las órdenes creadas antes de esta funcionalidad no tienen modalidad acordada:
  // se liquidan como siempre para no alterar cuadres históricos.
  if (!esMetodoPago(orden.metodoPagoPrevisto)) return null;

  const metodo = esMetodoPago(orden.metodoPago)
    ? orden.metodoPago
    : orden.metodoPagoPrevisto;
  const costoEnvio = Number(orden.costoEnvio ?? 0);
  const total = Number(orden.total);

  return metodo === 'efectivo'
    ? {
        metodo,
        efectivoRecibido: total - costoEnvio,
        efectivoEntregado: 0,
        transferenciaRecibida: 0,
      }
    : {
        metodo,
        efectivoRecibido: 0,
        efectivoEntregado: costoEnvio,
        transferenciaRecibida: total,
      };
}

export type EstadoOrden =
  | 'pendiente_aprobacion_stock'
  | 'pendiente'
  | 'en_preparacion'
  | 'lista'
  | 'entregada'
  | 'cobrada'
  | 'cancelada';

export interface DesglosePrecio {
  subtotalProductos: number;
  cantidadEnvases: number;
  recargo: number;       // $1.25 por cada unidad de combo para llevar/domicilio
  costoEnvio: number;    // Solo para domicilio
  total: number;         // subtotalProductos + recargo + costoEnvio
}

export interface CrearOrdenRequest {
  tipoOrden: TipoOrden;
  // Solo local
  numeroMesa?: number;
  // Obligatorio para llevar; opcional para domicilio
  nombreCliente?: string;
  // Solo domicilio
  telefonoCliente?: string;
  costoEnvio?: number;
  metodoPagoPrevisto?: MetodoPago;
  /** Confirmación operativa de que el dinero ya ingresó al crear el domicilio. */
  transferenciaConfirmada?: boolean;
  // Comunes
  mesero: string;
  /** Usuario autenticado que crea la orden. */
  creadorId?: string;
  observaciones?: string;
  items: {
    productoId: string;
    cantidad: number;
    precioUnitario: number;
    observaciones?: string;
    nivelPicante?: NivelPicante;
  }[];
  solicitarAprobacion?: boolean;
}

export interface OrdenConStock {
  id: string;
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  tipoOrden: TipoOrden;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  recargo: number | null;
  costoEnvio: number | null;
  mesero: string;
  estado: EstadoOrden;
  observaciones: string | null;
  total: number;
  tiempoEstimado: number | null;
  modificada: boolean;
  sinStock: boolean;
  aprobadaPorId: string | null;
  razonAprobacion: string | null;
  itemsSinStock: ItemSinStock[] | null;
  metodoPago: MetodoPago | null;
  metodoPagoPrevisto: MetodoPago | null;
  cobrada: boolean;
  fechaCobro: Date | null;
  cobradaPor: string | null;
  cobradaPorId?: string | null;
  cobroUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  impresa: boolean;
}

export interface CobrarOrdenRequest {
  metodoPago: MetodoPago;
  /** Evita cobrar un total que cambió mientras el modal estaba abierto. */
  expectedRevision: number;
  /** Permite reintentar la misma confirmación sin duplicar el movimiento. */
  idempotencyKey: string;
  /** Se llenará cuando la integración S3 confirme el objeto. */
  comprobanteTransferenciaKey?: string;
}

export interface AprobarOrdenRequest {
  ordenId: string;
  adminId: string;
  razon?: string;
}

export interface RechazarOrdenRequest {
  ordenId: string;
  adminId: string;
  razon?: string;
}

export interface OrdenPendienteAprobacion {
  id: string;
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  tipoOrden: TipoOrden;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  mesero: string;
  total: number;
  itemsSinStock: ItemSinStock[];
  createdAt: Date;
  items: {
    id: string;
    cantidad: number;
    producto: {
      id: string;
      nombre: string;
      categoria: string;
    };
    precioUnitario: number;
    subtotal: number;
    observaciones: string | null;
    nivelPicante: NivelPicante | null;
  }[];
}
