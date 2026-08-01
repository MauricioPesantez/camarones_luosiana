// Tipos relacionados con órdenes y aprobaciones sin stock

import { ItemSinStock } from './stock';

export type TipoOrden = 'local' | 'para_llevar' | 'domicilio';

export const RECARGO_RECIPIENTES = 1.25;

export const NIVELES_PICANTE = [
  { value: 'natural', label: 'Natural' },
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

export type MetodoPago = 'efectivo' | 'transferencia';

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
  recargo: number;       // $1.25 por recipientes para para_llevar y domicilio
  costoEnvio: number;    // Solo para domicilio
  total: number;         // subtotalProductos + recargo + costoEnvio
}

export interface CrearOrdenRequest {
  tipoOrden: TipoOrden;
  nivelPicante: NivelPicante;
  // Solo local
  numeroMesa?: number;
  // Obligatorio para llevar; opcional para domicilio
  nombreCliente?: string;
  // Solo domicilio
  telefonoCliente?: string;
  costoEnvio?: number;
  // Comunes
  mesero: string;
  observaciones?: string;
  items: {
    productoId: string;
    cantidad: number;
    precioUnitario: number;
    observaciones?: string;
  }[];
  solicitarAprobacion?: boolean;
}

export interface OrdenConStock {
  id: string;
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  tipoOrden: TipoOrden;
  nivelPicante: NivelPicante;
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
  cobrada: boolean;
  fechaCobro: Date | null;
  cobradaPor: string | null;
  createdAt: Date;
  updatedAt: Date;
  impresa: boolean;
}

export interface CobrarOrdenRequest {
  metodoPago: MetodoPago;
  cobradaPor: string;
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
  nivelPicante: NivelPicante;
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
  }[];
}
