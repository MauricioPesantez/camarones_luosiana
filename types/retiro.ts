// Tipos relacionados con los retiros de caja que registran los empleados.

export const CATEGORIAS_RETIRO = [
  { value: 'insumos', label: 'Insumos / mercaderia' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'adelanto', label: 'Adelanto a empleado' },
  { value: 'otro', label: 'Otro' },
] as const;

export type CategoriaRetiro = (typeof CATEGORIAS_RETIRO)[number]['value'];

/** Unica categoria que exige un beneficiario: el dinero se le entrega a alguien. */
export const CATEGORIA_ADELANTO: CategoriaRetiro = 'adelanto';

export function esCategoriaRetiro(valor: unknown): valor is CategoriaRetiro {
  return (
    typeof valor === 'string' &&
    CATEGORIAS_RETIRO.some((categoria) => categoria.value === valor)
  );
}

export function obtenerEtiquetaCategoriaRetiro(categoria: string): string {
  return (
    CATEGORIAS_RETIRO.find((opcion) => opcion.value === categoria)?.label ??
    categoria
  );
}

export type EstadoRetiro = 'registrado' | 'anulado';

export const ESTADO_RETIRO_REGISTRADO: EstadoRetiro = 'registrado';
/** Un retiro anulado sigue existiendo y se ve, pero deja de restar de la caja. */
export const ESTADO_RETIRO_ANULADO: EstadoRetiro = 'anulado';

/**
 * Techo de sanidad, no un tope de negocio. Es el maximo que entra en
 * `Decimal(10, 2)` y ataja el error de tipear 5000 en lugar de 50.00.
 */
export const MONTO_MAXIMO_RETIRO = 9999.99;

/** Rol que puede registrar un retiro. El admin solo anula. */
export const ROL_REGISTRA_RETIRO = 'mesero';

/** Forma con la que las pantallas leen un retiro. */
export interface RetiroCaja {
  id: string;
  monto: number;
  categoria: string;
  motivo: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioRol: string;
  beneficiarioId: string | null;
  beneficiarioNombre: string | null;
  estado: EstadoRetiro;
  anuladoPorNombre: string | null;
  razonAnulacion: string | null;
  anuladoAt: string | null;
  createdAt: string;
}

/** El autor sale de la sesion de servidor, nunca del cuerpo de la peticion. */
export interface CrearRetiroRequest {
  categoria: CategoriaRetiro;
  motivo: string;
  monto: number;
  beneficiarioId?: string | null;
  /** Evita que un reintento o un doble clic dupliquen la salida de dinero. */
  clientRequestId: string;
}

export interface AnularRetiroRequest {
  razon: string;
}
