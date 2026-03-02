// Tipos relacionados con órdenes y aprobaciones sin stock

import { ItemSinStock } from './stock';

export type TipoOrden = 'local' | 'para_llevar' | 'domicilio';

export type EstadoOrden =
  | 'pendiente_aprobacion_stock'
  | 'pendiente'
  | 'en_preparacion'
  | 'lista'
  | 'entregada'
  | 'cancelada';

export interface DesglosePrecio {
  subtotalProductos: number;
  recargo: number;       // $0.50 para para_llevar y domicilio
  costoEnvio: number;    // Solo para domicilio
  total: number;         // subtotalProductos + recargo + costoEnvio
}

export interface CrearOrdenRequest {
  tipoOrden: TipoOrden;
  // Solo local
  numeroMesa?: number;
  // Para llevar y domicilio
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
  createdAt: Date;
  updatedAt: Date;
  impresa: boolean;
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
  tipoOrden: TipoOrden;
  numeroMesa: number | null;
  nombreCliente: string | null;
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
