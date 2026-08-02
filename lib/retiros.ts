import { Prisma } from '@prisma/client';
import {
  ESTADO_RETIRO_ANULADO,
  ESTADO_RETIRO_REGISTRADO,
  type RetiroCaja,
} from '../types/retiro';

export const ESTADO_REGISTRADO = ESTADO_RETIRO_REGISTRADO;
export const ESTADO_ANULADO = ESTADO_RETIRO_ANULADO;

export const RETIRO_SELECT = {
  id: true,
  monto: true,
  categoria: true,
  motivo: true,
  usuarioId: true,
  usuarioNombre: true,
  usuarioRol: true,
  beneficiarioId: true,
  beneficiarioNombre: true,
  estado: true,
  anuladoPorNombre: true,
  razonAnulacion: true,
  anuladoAt: true,
  createdAt: true,
} satisfies Prisma.RetiroCajaSelect;

type RetiroConsultado = Prisma.RetiroCajaGetPayload<{
  select: typeof RETIRO_SELECT;
}>;

/**
 * Forma estable para las pantallas: el monto viaja como numero y no como la
 * cadena en que Prisma serializa un `Decimal`, para que nadie termine sumando
 * texto en el cuadre.
 */
export function serializarRetiro(retiro: RetiroConsultado): RetiroCaja {
  return {
    id: retiro.id,
    monto: Number(retiro.monto),
    categoria: retiro.categoria,
    motivo: retiro.motivo,
    usuarioId: retiro.usuarioId,
    usuarioNombre: retiro.usuarioNombre,
    usuarioRol: retiro.usuarioRol,
    beneficiarioId: retiro.beneficiarioId,
    beneficiarioNombre: retiro.beneficiarioNombre,
    estado: retiro.estado === ESTADO_ANULADO ? ESTADO_ANULADO : ESTADO_REGISTRADO,
    anuladoPorNombre: retiro.anuladoPorNombre,
    razonAnulacion: retiro.razonAnulacion,
    anuladoAt: retiro.anuladoAt?.toISOString() ?? null,
    createdAt: retiro.createdAt.toISOString(),
  };
}
