import { createHash } from 'node:crypto';

import { MAX_REFERENCIA_ENTREGA, normalizarUbicacionUrl } from './delivery-location';
import { NIVELES_PICANTE, NivelPicante, esCategoriaCombo } from '../types/orden';

const MAX_TEXTO = 4000;
const MAX_LINEAS = 30;
const MAX_CANTIDAD = 99;
const MAX_CLIENTE = 100;
const MAX_OBSERVACIONES = 500;
const MAX_ENVIO = 999.99;

export interface ItemPedido {
  cantidad: number;
  producto: string;
  nivelPicante: NivelPicante | null;
  observaciones: string | null;
}

export type UbicacionPedido =
  | { tipo: 'pin' }
  | { tipo: 'pendiente' }
  | { tipo: 'enlace'; url: string };

export interface PedidoWhatsapp {
  tipoOrden: 'domicilio' | 'para_llevar';
  cliente: string | null;
  telefono: string | null;
  pago: 'efectivo' | 'transferencia_confirmada' | null;
  envio: number | null;
  ubicacion: UbicacionPedido | null;
  referencia: string | null;
  solicitarAprobacion: boolean;
  nuevoPedido: boolean;
  observaciones: string | null;
  items: ItemPedido[];
}

export type ResultadoPlantilla =
  | { ok: true; pedido: PedidoWhatsapp }
  | { ok: false; errores: string[] };

const CAMPOS = {
  tipo: 'Tipo',
  cliente: 'Cliente',
  telefono: 'Teléfono',
  productos: 'Productos',
  pago: 'Pago',
  envio: 'Envío',
  ubicacion: 'Ubicación',
  'referencia de entrega': 'Referencia de entrega',
  'solicitar aprobacion de stock': 'Solicitar aprobación de stock',
  'nuevo pedido': 'Nuevo pedido',
  observaciones: 'Observaciones',
} as const;
type Campo = keyof typeof CAMPOS;

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim();
}

const NIVEL_POR_ETIQUETA = new Map<string, NivelPicante>(
  NIVELES_PICANTE.map((nivel) => [normalizar(nivel.label), nivel.value]),
);

function esCampo(etiqueta: string): etiqueta is Campo {
  return Object.hasOwn(CAMPOS, etiqueta);
}

function leerLineaProducto(linea: string, errores: string[]): ItemPedido | null {
  const formato = linea.match(/^(\d+)\s+x\s+(.+)$/i);
  const cantidad = formato ? Number(formato[1]) : 0;
  if (!formato || cantidad < 1) {
    errores.push(`Línea de producto inválida: "${linea}". Usa: 2 x Nombre del producto`);
    return null;
  }
  if (cantidad > MAX_CANTIDAD) {
    errores.push(`Cantidad máxima ${MAX_CANTIDAD} por línea: "${linea}"`);
    return null;
  }

  const [producto, ...extras] = formato[2].split('|').map((parte) => parte.trim());
  let nivelPicante: NivelPicante | null = null;
  const segundo = extras[0] ? normalizar(extras[0]) : '';
  if (NIVEL_POR_ETIQUETA.has(segundo)) {
    nivelPicante = NIVEL_POR_ETIQUETA.get(segundo)!;
    extras.shift();
  } else if (segundo.startsWith('picante')) {
    errores.push(`Picante no válido en "${linea}". Usa natural, leve, picante 1, picante 2 o picante 3`);
    return null;
  }
  if (!producto || extras.length > 1) {
    errores.push(`Línea de producto inválida: "${linea}". Usa: 1 x Nombre | picante 1 | observación`);
    return null;
  }

  return { cantidad, producto, nivelPicante, observaciones: extras[0] || null };
}

function leerTelefono(valor: string): string | null {
  const limpio = valor.replace(/[\s()-]/g, '');
  const digitos = limpio.match(/^\+?593(\d{8,9})$/)?.[1] ?? limpio.match(/^0(\d{8,9})$/)?.[1];
  return digitos ? `+593${digitos}` : null;
}

function leerSiNo(valor: string): boolean | null {
  const texto = normalizar(valor);
  if (texto === 'si') return true;
  return texto === 'no' ? false : null;
}

function leerUbicacion(valor: string): UbicacionPedido | null {
  const texto = normalizar(valor);
  if (texto === 'pin' || texto === 'pendiente') return { tipo: texto };
  const url = normalizarUbicacionUrl(valor);
  return url ? { tipo: 'enlace', url } : null;
}

/** Convierte el texto en un pedido o en la lista completa de correcciones. No consulta el catálogo. */
export function interpretarPlantilla(texto: string): ResultadoPlantilla {
  if (texto.length > MAX_TEXTO) {
    return { ok: false, errores: [`Mensaje demasiado largo: máximo ${MAX_TEXTO} caracteres`] };
  }

  const lineas = texto.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
  if (normalizar(lineas[0] ?? '') !== 'pedido') {
    return { ok: false, errores: ['El mensaje debe empezar con la línea PEDIDO'] };
  }

  const errores: string[] = [];
  const valores = new Map<Campo, string>();
  const lineasProducto: string[] = [];
  let enProductos = false;

  for (const linea of lineas.slice(1)) {
    const separador = linea.indexOf(':');
    const etiqueta = separador > 0 ? normalizar(linea.slice(0, separador)) : '';
    const valor = separador > 0 ? linea.slice(separador + 1).trim() : '';

    if (esCampo(etiqueta)) {
      enProductos = etiqueta === 'productos';
      if (enProductos) {
        if (valor) lineasProducto.push(valor);
        continue;
      }
      const anterior = valores.get(etiqueta);
      if (anterior !== undefined && normalizar(anterior) !== normalizar(valor)) {
        errores.push(`${CAMPOS[etiqueta]} repetido con valores distintos`);
      }
      valores.set(etiqueta, valor);
    } else if (enProductos) {
      lineasProducto.push(linea);
    } else {
      errores.push(`Campo no reconocido: "${linea.slice(0, 60)}"`);
    }
  }

  const tipo = normalizar(valores.get('tipo') ?? '').replace('_', ' ');
  const tipoOrden = tipo === 'domicilio' ? 'domicilio' : tipo === 'para llevar' ? 'para_llevar' : null;
  if (!tipoOrden) errores.push('Tipo es requerido: domicilio o para llevar');

  const cliente = valores.get('cliente') || null;
  if (cliente && cliente.length > MAX_CLIENTE) errores.push('Cliente demasiado largo');
  if (tipoOrden === 'para_llevar' && !cliente) errores.push('Cliente es requerido para llevar');

  const referencia = valores.get('referencia de entrega') || null;
  if (referencia && referencia.length > MAX_REFERENCIA_ENTREGA) {
    errores.push('Referencia de entrega demasiado larga');
  }
  const observaciones = valores.get('observaciones') || null;
  if (observaciones && observaciones.length > MAX_OBSERVACIONES) {
    errores.push('Observaciones demasiado largas');
  }

  let telefono: string | null = null;
  let pago: PedidoWhatsapp['pago'] = null;
  let envio: number | null = null;
  let ubicacion: UbicacionPedido | null = null;

  if (tipoOrden === 'domicilio') {
    const valorTelefono = valores.get('telefono');
    telefono = valorTelefono ? leerTelefono(valorTelefono) : null;
    if (!telefono) errores.push('Teléfono es requerido con formato +593XXXXXXXXX o 09XXXXXXXX');

    const valorPago = normalizar(valores.get('pago') ?? '');
    if (valorPago === 'efectivo') pago = 'efectivo';
    else if (valorPago === 'transferencia confirmada') pago = 'transferencia_confirmada';
    else errores.push('Pago es requerido: efectivo o transferencia confirmada');

    const valorEnvio = valores.get('envio')?.replace(/^\$/, '').replace(',', '.') ?? '';
    if (/^\d+(\.\d{1,2})?$/.test(valorEnvio) && Number(valorEnvio) <= MAX_ENVIO) {
      envio = Number(valorEnvio);
    } else {
      errores.push('Envío es requerido, como 2.75');
    }

    ubicacion = leerUbicacion(valores.get('ubicacion') ?? '');
    if (!ubicacion) errores.push('Ubicación es requerida: pin, pendiente o enlace HTTPS de Google Maps');
  } else if (tipoOrden === 'para_llevar') {
    for (const campo of ['pago', 'envio', 'ubicacion', 'referencia de entrega'] as const) {
      if (valores.has(campo)) errores.push(`Para llevar no usa ${CAMPOS[campo]}`);
    }
  }

  const solicitarAprobacion = leerSiNo(valores.get('solicitar aprobacion de stock') ?? 'no');
  if (solicitarAprobacion === null) errores.push('Solicitar aprobación de stock admite sí o no');
  const nuevoPedido = leerSiNo(valores.get('nuevo pedido') ?? 'no');
  if (nuevoPedido === null) errores.push('Nuevo pedido admite sí o no');

  const items: ItemPedido[] = [];
  if (lineasProducto.length === 0) errores.push('Productos es requerido: al menos una línea');
  if (lineasProducto.length > MAX_LINEAS) {
    errores.push(`Máximo ${MAX_LINEAS} líneas de producto`);
  } else {
    for (const linea of lineasProducto) {
      const item = leerLineaProducto(linea, errores);
      if (item) items.push(item);
    }
  }

  if (errores.length > 0 || !tipoOrden) return { ok: false, errores };
  return {
    ok: true,
    pedido: {
      tipoOrden,
      cliente,
      telefono,
      pago,
      envio,
      ubicacion,
      referencia,
      solicitarAprobacion: solicitarAprobacion!,
      nuevoPedido: nuevoPedido!,
      observaciones,
      items,
    },
  };
}

interface ProductoCatalogo {
  id: string;
  nombre: string;
  categoria: string;
  disponible: boolean;
}

export type ItemResuelto = ItemPedido & { productoId: string };

export type ResultadoProductos =
  | { ok: true; items: ItemResuelto[] }
  | { ok: false; errores: string[] };

/** Coincidencia exacta normalizada: si no hay un único producto disponible, no adivina. */
export function resolverProductos(
  items: ItemPedido[],
  catalogo: ProductoCatalogo[],
): ResultadoProductos {
  const errores = new Set<string>();
  const resueltos: ItemResuelto[] = [];

  for (const item of items) {
    const buscado = normalizar(item.producto);
    const coincidencias = catalogo.filter((producto) => normalizar(producto.nombre) === buscado);
    const producto = coincidencias[0];
    if (!producto) {
      errores.add(`Producto no encontrado: ${item.producto}`);
    } else if (coincidencias.length > 1) {
      errores.add(`Producto ambiguo en el catálogo: ${item.producto}`);
    } else if (!producto.disponible) {
      errores.add(`Producto no está disponible: ${producto.nombre}`);
    } else if (esCategoriaCombo(producto.categoria) && !item.nivelPicante) {
      errores.add(`Falta picante para ${producto.nombre}`);
    } else {
      resueltos.push({ ...item, productoId: producto.id });
    }
  }

  return errores.size > 0 ? { ok: false, errores: [...errores] } : { ok: true, items: resueltos };
}

/** Identifica el contenido escrito; no depende del catálogo, de precios ni del mensaje. */
export function hashPedido(pedido: PedidoWhatsapp): string {
  const items = pedido.items
    .map((item) => [
      item.cantidad,
      normalizar(item.producto),
      item.nivelPicante,
      normalizar(item.observaciones ?? ''),
    ])
    .map((item) => JSON.stringify(item))
    .sort();
  const contenido = JSON.stringify([
    pedido.tipoOrden,
    normalizar(pedido.cliente ?? ''),
    pedido.telefono,
    pedido.pago,
    pedido.envio,
    pedido.ubicacion,
    normalizar(pedido.referencia ?? ''),
    pedido.solicitarAprobacion,
    pedido.nuevoPedido,
    normalizar(pedido.observaciones ?? ''),
    items,
  ]);
  return createHash('sha256').update(contenido, 'utf8').digest('hex');
}
