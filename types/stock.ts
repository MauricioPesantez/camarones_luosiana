// Tipos relacionados con la gestión de stock

export interface ItemSinStock {
  productoId: string;
  productoNombre: string;
  cantidadSolicitada: number;
  stockDisponible: number;
}

export interface ValidacionStock {
  hayStock: boolean;
  itemsSinStock: ItemSinStock[];
  mensaje?: string;
}

export interface ActualizarStockRequest {
  productoId: string;
  cantidad: number;
  operacion: 'agregar' | 'establecer'; // agregar suma/resta, establecer reemplaza
}

export interface ProductoConStock {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  disponible: boolean;
  descripcion: string | null;
  tiempoPreparacion: number | null;
  stock: number;
  stockMinimo: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductoStockBajo {
  id: string;
  nombre: string;
  categoria: string;
  stock: number;
  stockMinimo: number;
}
