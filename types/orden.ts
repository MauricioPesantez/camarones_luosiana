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

function aCentavosOrden(valor: number | string | null | undefined): number {
  return Math.round(Number(valor ?? 0) * 100);
}

export interface LiquidacionDomicilio {
  /** Efectivo que el local le entrega al motorizado. */
  entregaElLocal: number;
  /** Efectivo que el motorizado le entrega al local. */
  entregaElMotorizado: number;
}

/**
 * Liquidacion con el motorizado, regla unica:
 *
 *   El envio se descuenta del efectivo que el motorizado cobro al cliente.
 *   Si sobra, el motorizado entrega la diferencia al local.
 *   Si falta, el local le completa.
 *
 * Reproduce los dos casos que existian antes del multipago (transferencia pura
 * y efectivo puro) y ademas resuelve el mixto, donde el envio ya venia dentro
 * de una transferencia y el efectivo llego despues.
 *
 * `efectivoCobrado` es la suma del efectivo de TODOS los pagos de la orden, no
 * el de un pago suelto: el envio se liquida una sola vez.
 *
 * Devuelve `null` fuera de domicilio, donde no hay motorizado.
 */
export function calcularLiquidacionDomicilio(
  orden: { tipoOrden?: string | null; costoEnvio?: number | string | null },
  efectivoCobrado: number | string,
): LiquidacionDomicilio | null {
  if (orden.tipoOrden !== 'domicilio') return null;

  const envio = aCentavosOrden(obtenerCostoEnvio(orden));
  const efectivo = aCentavosOrden(efectivoCobrado);
  const diferencia = envio - efectivo;

  const entregaLocal = Math.max(0, diferencia);
  const entregaMotorizado = Math.max(0, -diferencia);
  return { entregaElLocal: entregaLocal / 100, entregaElMotorizado: entregaMotorizado / 100 };
}

/** Lo que falta por cobrar. Nunca negativo. */
export function calcularSaldo(orden: {
  total: number | string;
  montoPagado?: number | string | null;
}): number {
  const pendiente = aCentavosOrden(orden.total) - aCentavosOrden(orden.montoPagado);
  return pendiente > 0 ? pendiente / 100 : 0;
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
  montoPagado: number;
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
  /**
   * Formas de pago del acto. Una sola parte es un cobro simple; dos, un cobro
   * mixto. Deben sumar exactamente el saldo de la orden.
   */
  partes: {
    metodoPago: MetodoPago;
    monto: number;
    comprobanteTransferenciaKey?: string;
  }[];
  /** Evita cobrar un total que cambió mientras el modal estaba abierto. */
  expectedRevision: number;
  /** Permite reintentar la misma confirmación sin duplicar el movimiento. */
  idempotencyKey: string;
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
