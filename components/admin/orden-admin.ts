import type { NivelPicante } from "@/types/orden";

/** Orden tal como la entrega /api/admin/cuadre. */
export interface OrdenAdmin {
  id: string;
  cobroUrl: string | null;
  printRevision: number;
  tipoOrden: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  recargo: number | null;
  costoEnvio: number | null;
  mesero: string;
  creadorNombre: string;
  creadorRol: string;
  estado: string;
  total: number;
  montoPagado: number;
  tiempoEstimado: number;
  modificada: boolean;
  cobrada: boolean;
  empleadoId?: string | null;
  empleadoNombre?: string | null;
  metodoPago: string | null;
  metodoPagoPrevisto: string | null;
  comprobanteTransferenciaKey?: string | null;
  pagos?: {
    id: string;
    metodoPago: string;
    monto: number;
    comprobanteTransferenciaKey: string | null;
    origen: string;
    /** "CONFIRMADO" | "REEMBOLSO_PENDIENTE". La API ya excluye "REEMBOLSADO". */
    estado?: string | null;
    /** La API la incluye para el calculo del cuadre (Task 9); la UI no la usa. */
    enRango: boolean;
  }[];
  origenCobro?: string | null;
  fechaCobro: string | null;
  cobradaPor: string | null;
  anulada: boolean;
  anuladaPorNombre: string | null;
  razonAnulacion: string | null;
  anuladaAt: string | null;
  createdAt: string;
  updatedAt: string;
  observaciones?: string;
  items: {
    cantidad: number;
    producto: {
      nombre: string;
      categoria: string;
    };
    precioUnitario: number;
    subtotal: number;
    observaciones?: string;
    nivelPicante?: NivelPicante | null;
  }[];
}

export interface ConsumoDelDia {
  id: string;
  empleadoNombre: string;
  estado: string;
  total: number;
  anulada: boolean;
}

export type FiltroCobro =
  | "todas"
  | "sin_cobrar"
  | "con_abono"
  | "cobradas"
  | "anuladas";

export function tituloOrden(orden: {
  tipoOrden?: string | null;
  numeroMesa: number | null;
  nombreCliente: string | null;
  telefonoCliente?: string | null;
}): string {
  if (!orden.tipoOrden || orden.tipoOrden === "local") {
    return `Mesa ${orden.numeroMesa}`;
  }

  return orden.nombreCliente ?? orden.telefonoCliente ?? "Cliente";
}

export const dolares = (valor: number): string =>
  `${valor < 0 ? "−" : ""}$${Math.abs(valor).toFixed(2)}`;

export const horaCorta = (fecha: string): string =>
  new Date(fecha).toLocaleTimeString("es-EC", { timeStyle: "short" });
