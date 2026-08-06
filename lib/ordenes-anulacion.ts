import { Prisma } from '@prisma/client';

// La razon de anulacion se valida igual sin importar lo que se anule: mismo
// campo obligatorio, mismo mensaje de "cuerpo invalido". Reusar los helpers de
// retiros evita mantener dos copias de esa validacion.
import { validarAnulacion, type DatosAnulacion } from './retiros-validaciones';

/**
 * Filtro unico de "orden que existe para el negocio".
 *
 * Toda lectura operativa (cocina, mesero) y todo reporte que cuente ordenes lo
 * usa, para que la anulacion no dependa de que cada consulta se acuerde de
 * escribir `anulada: false` por su cuenta.
 *
 * El cuadre es la excepcion deliberada: si trae las anuladas para mostrarlas
 * tachadas, y es `calcularResumenCuadre` quien las saca de las cifras.
 */
export const ORDENES_VIGENTES = {
  anulada: false,
} satisfies Prisma.OrdenWhereInput;

export type DatosAnulacionOrden = DatosAnulacion;

/**
 * La razon es obligatoria: una venta que desaparece del cuadre sin explicacion
 * es indistinguible de un descuadre. Es el mismo criterio que ya se aplica al
 * anular un retiro de caja, y de hecho es la misma validacion.
 */
export const validarAnulacionOrden = validarAnulacion;
