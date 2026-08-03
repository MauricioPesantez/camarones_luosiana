import {
  CATEGORIA_ADELANTO,
  MONTO_MAXIMO_RETIRO,
  esCategoriaRetiro,
  type CategoriaRetiro,
} from '../types/retiro';
import type { ResultadoValidacion } from './admin-validaciones';

/**
 * Quien registra el retiro NO viaja en el cuerpo: sale de la sesion de servidor
 * (`getAuthenticatedUser`). Un body no puede elegir a nombre de quien sale el
 * dinero de la caja.
 */
export interface DatosRetiro {
  categoria: CategoriaRetiro;
  motivo: string;
  monto: number;
  /** Solo para la categoria "adelanto". En el resto siempre es null. */
  beneficiarioId: string | null;
  clientRequestId: string;
}

export interface DatosAnulacion {
  razon: string;
}

/** Error interno: lo atrapa `ejecutar` y lo convierte en { ok: false }. */
class ErrorValidacion extends Error {}

function objeto(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ErrorValidacion('El cuerpo de la peticion es invalido');
  }
  return body as Record<string, unknown>;
}

function texto(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorValidacion(`${campo} es obligatorio`);
  }
  return valor.trim();
}

/**
 * El monto sale de la caja: se exige un numero exacto en centavos.
 *
 * Un valor con tres decimales se truncaria en silencio al guardarse en
 * `Decimal(10, 2)` y el cuadre nunca cerraria por esa diferencia, asi que se
 * rechaza en vez de redondear.
 */
function monto(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    throw new ErrorValidacion('El monto debe ser un numero mayor que 0');
  }
  // Comparar contra una tolerancia y no con igualdad exacta: 18.35 * 100 da
  // 1834.9999999999998 en coma flotante y un `!==` lo rechazaria sin motivo.
  const centavos = numero * 100;
  if (Math.abs(centavos - Math.round(centavos)) > 1e-9) {
    throw new ErrorValidacion('El monto no puede tener mas de 2 decimales');
  }
  if (numero > MONTO_MAXIMO_RETIRO) {
    throw new ErrorValidacion(
      `El monto no puede superar $${MONTO_MAXIMO_RETIRO.toFixed(2)}`,
    );
  }

  return Math.round(centavos) / 100;
}

function categoriaValida(valor: unknown): CategoriaRetiro {
  if (!esCategoriaRetiro(valor)) {
    throw new ErrorValidacion('La categoria seleccionada no es valida');
  }
  return valor;
}

/**
 * El beneficiario solo tiene sentido en un adelanto. Fuera de esa categoria se
 * rechaza en vez de ignorarse: un dato que se descarta en silencio termina
 * siendo un adelanto que nadie puede rastrear.
 */
function beneficiario(valor: unknown, categoria: CategoriaRetiro): string | null {
  const vacio = valor === undefined || valor === null || valor === '';

  if (categoria === CATEGORIA_ADELANTO) {
    if (vacio) {
      throw new ErrorValidacion('Un adelanto necesita indicar a quien se le entrega');
    }
    return texto(valor, 'El beneficiario');
  }

  if (!vacio) {
    throw new ErrorValidacion(
      'Solo los adelantos pueden indicar un beneficiario',
    );
  }
  return null;
}

function ejecutar<T>(construir: () => T): ResultadoValidacion<T> {
  try {
    return { ok: true, data: construir() };
  } catch (error) {
    if (error instanceof ErrorValidacion) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export function validarRetiroNuevo(body: unknown): ResultadoValidacion<DatosRetiro> {
  return ejecutar(() => {
    const datos = objeto(body);
    const categoria = categoriaValida(datos.categoria);

    return {
      categoria,
      motivo: texto(datos.motivo, 'El motivo'),
      monto: monto(datos.monto),
      beneficiarioId: beneficiario(datos.beneficiarioId, categoria),
      clientRequestId: texto(datos.clientRequestId, 'El identificador del envio'),
    };
  });
}

export function validarAnulacion(body: unknown): ResultadoValidacion<DatosAnulacion> {
  return ejecutar(() => {
    const datos = objeto(body);
    return {
      razon: texto(datos.razon, 'La razon de la anulacion'),
    };
  });
}
