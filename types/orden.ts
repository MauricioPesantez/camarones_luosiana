// Tipos relacionados con órdenes y aprobaciones sin stock

import { ItemSinStock } from './stock';

export type EstadoOrden =
  | 'pendiente_aprobacion_stock'
  | 'pendiente'
  | 'en_preparacion'
  | 'lista'
  | 'entregada'
  | 'cancelada';

export interface OrdenConStock {
  id: string;
  numeroMesa: number;
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
  numeroMesa: number;
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
