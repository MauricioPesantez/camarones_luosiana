import type { PartePago } from "./cobro";

export interface PresentacionCobro {
  saldo: number;
  subtotalProductos: number;
  efectivo: number;
  transferencia: number;
  mixto: number;
  envioPendiente: number;
  explicacionEfectivo: string | null;
  explicacionTransferencia: string | null;
  partesEfectivo: PartePago[];
  partesTransferencia: PartePago[];
}

export interface PrevisualizacionMixto {
  partes: PartePago[];
  efectivo: number;
  transferencia: number;
}

export interface OrdenPorCobrar {
  id: string;
  numero: string;
  titulo: string;
  tipoOrden: string;
  estado: string;
  creador: string;
  telefonoCliente: string | null;
  createdAt: string;
  saldoPendiente: number;
  importeEfectivo: number;
  explicacionEfectivo: string | null;
  motivoBloqueoCobro: string | null;
  destinoCobro: string | null;
  puedeEditar: boolean;
  items: { cantidad: number; nombre: string }[];
}

export interface OrdenesPorCobrar {
  ordenes: OrdenPorCobrar[];
  totalPendientes: number;
  siguienteCursor: string | null;
  consultadoAt: string;
}
