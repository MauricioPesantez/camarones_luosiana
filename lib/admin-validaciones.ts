import { esRol, type Rol } from '../types/usuario';

export type ResultadoValidacion<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface DatosProducto {
  nombre: string;
  categoria: string;
  precio: number;
  descripcion: string | null;
  tiempoPreparacion: number;
  stock: number;
  stockMinimo: number;
  disponible: boolean;
}

export interface DatosUsuario {
  nombre: string;
  rol: Rol;
  password: string | null;
  activo: boolean;
}

/**
 * Forma canonica de un nombre para comparar duplicados: sin tildes, en
 * minusculas y sin espacios en los bordes.
 *
 * Postgres con `mode: 'insensitive'` ignora mayusculas pero no acentos, asi que
 * "JUAN PEREZ" no chocaria con "Juan Perez" y terminarian siendo dos usuarios
 * distintos en la pantalla de login. La comparacion se hace en memoria: las
 * tablas de productos y usuarios son de decenas de filas.
 */
export function normalizarNombre(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

/** Texto que puede venir vacio: se normaliza a null. */
function textoOpcional(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') {
    throw new ErrorValidacion(`${campo} debe ser texto`);
  }
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

function precio(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new ErrorValidacion('El precio debe ser un numero mayor que 0');
  }
  // Decimal(10, 2) en la base: mas decimales se perderian en silencio.
  return Math.round(numero * 100) / 100;
}

function entero(valor: unknown, campo: string): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isInteger(numero) || numero < 0) {
    throw new ErrorValidacion(`${campo} debe ser un numero entero mayor o igual a 0`);
  }
  return numero;
}

function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== 'boolean') {
    throw new ErrorValidacion(`${campo} debe ser verdadero o falso`);
  }
  return valor;
}

function rolValido(valor: unknown): Rol {
  if (!esRol(valor)) {
    throw new ErrorValidacion('El rol seleccionado no es valido');
  }
  return valor;
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

function exigirCampos(parcial: object): void {
  if (Object.keys(parcial).length === 0) {
    throw new ErrorValidacion('No hay campos para actualizar');
  }
}

export function validarProductoNuevo(body: unknown): ResultadoValidacion<DatosProducto> {
  return ejecutar(() => {
    const datos = objeto(body);
    return {
      nombre: texto(datos.nombre, 'El nombre'),
      categoria: texto(datos.categoria, 'La categoria'),
      precio: precio(datos.precio),
      descripcion: textoOpcional(datos.descripcion, 'La descripcion'),
      tiempoPreparacion:
        datos.tiempoPreparacion === undefined
          ? 0
          : entero(datos.tiempoPreparacion, 'El tiempo de preparacion'),
      stock: datos.stock === undefined ? 0 : entero(datos.stock, 'El stock'),
      stockMinimo:
        datos.stockMinimo === undefined ? 5 : entero(datos.stockMinimo, 'El stock minimo'),
      disponible: datos.disponible === undefined ? true : booleano(datos.disponible, 'Disponible'),
    };
  });
}

export function validarProductoParcial(
  body: unknown,
): ResultadoValidacion<Partial<DatosProducto>> {
  return ejecutar(() => {
    const datos = objeto(body);
    const parcial: Partial<DatosProducto> = {};

    if ('nombre' in datos) parcial.nombre = texto(datos.nombre, 'El nombre');
    if ('categoria' in datos) parcial.categoria = texto(datos.categoria, 'La categoria');
    if ('precio' in datos) parcial.precio = precio(datos.precio);
    if ('descripcion' in datos) {
      parcial.descripcion = textoOpcional(datos.descripcion, 'La descripcion');
    }
    if ('tiempoPreparacion' in datos) {
      parcial.tiempoPreparacion = entero(datos.tiempoPreparacion, 'El tiempo de preparacion');
    }
    if ('stock' in datos) parcial.stock = entero(datos.stock, 'El stock');
    if ('stockMinimo' in datos) parcial.stockMinimo = entero(datos.stockMinimo, 'El stock minimo');
    if ('disponible' in datos) parcial.disponible = booleano(datos.disponible, 'Disponible');

    exigirCampos(parcial);
    return parcial;
  });
}

export function validarUsuarioNuevo(body: unknown): ResultadoValidacion<DatosUsuario> {
  return ejecutar(() => {
    const datos = objeto(body);
    return {
      nombre: texto(datos.nombre, 'El nombre'),
      rol: rolValido(datos.rol),
      password: textoOpcional(datos.password, 'La contrasena'),
      activo: datos.activo === undefined ? true : booleano(datos.activo, 'Activo'),
    };
  });
}

export function validarUsuarioParcial(
  body: unknown,
): ResultadoValidacion<Partial<DatosUsuario>> {
  return ejecutar(() => {
    const datos = objeto(body);
    const parcial: Partial<DatosUsuario> = {};

    if ('nombre' in datos) parcial.nombre = texto(datos.nombre, 'El nombre');
    if ('rol' in datos) parcial.rol = rolValido(datos.rol);
    // password ausente no se toca; null o cadena vacia borran la clave.
    if ('password' in datos) parcial.password = textoOpcional(datos.password, 'La contrasena');
    if ('activo' in datos) parcial.activo = booleano(datos.activo, 'Activo');

    exigirCampos(parcial);
    return parcial;
  });
}
