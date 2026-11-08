import { createHash } from 'node:crypto';

import { normalizarUbicacionUrl } from './delivery-location';
import {
  DescuentoSolicitado,
  NIVELES_PICANTE,
  NivelPicante,
  esCategoriaCombo,
  esDescuentoSolicitado,
} from '../types/orden';

const MAX_TEXTO = 4000;
const MAX_ITEMS = 30;
const MAX_CANTIDAD = 99;
const MAX_CLIENTE = 100;
const MAX_OBSERVACIONES = 500;
const MAX_ENVIO = 999.99;
const MAX_ESPERA_MOTO = 120;
const MAX_OPCIONES = 4;

export interface ItemPedido {
  /** Como lo escribió el operador; el catálogo decide producto y cantidad. */
  texto: string;
  cantidad: number | null;
  nivelPicante: NivelPicante | null;
  observaciones: string | null;
  /** Elegido por el operador al responder una duda; no forma parte del hash. */
  productoId?: string;
}

export interface PedidoWhatsapp {
  tipoOrden: 'domicilio' | 'para_llevar';
  cliente: string | null;
  telefono: string | null;
  pago: 'efectivo' | 'transferencia_confirmada' | null;
  envio: number | null;
  ubicacionUrl: string | null;
  /** Minutos para pedir la moto; `null` usa la espera normal. */
  esperaMotoMin: number | null;
  solicitarAprobacion: boolean;
  nuevoPedido: boolean;
  observaciones: string | null;
  /** `Descuento $2` o `Descuento 10%`; el servidor valida contra el subtotal. */
  descuento: DescuentoSolicitado | null;
  items: ItemPedido[];
}

export type ResultadoPedido =
  | { ok: true; pedido: PedidoWhatsapp }
  | { ok: false; errores: string[] };

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim();
}

const NIVEL_POR_TEXTO = new Map<string, NivelPicante>([
  ...NIVELES_PICANTE.map((nivel) => [normalizar(nivel.label), nivel.value] as const),
  ['picante leve', 'leve'],
  ['salsa natural', 'natural'],
]);

/** `natural`, `natural y picante 1`, `natural, leve / picante 1`: todas las partes deben ser picantes. */
function leerNiveles(texto: string): NivelPicante[] | null {
  const partes = normalizar(texto).split(/\s*(?:[,/]|\by\b)\s*/).filter(Boolean);
  const niveles = partes.map((parte) => NIVEL_POR_TEXTO.get(parte));
  return niveles.length > 0 && niveles.every(Boolean) ? (niveles as NivelPicante[]) : null;
}

const MONTO = '\\$?(\\d+(?:[.,]\\d{1,2})?)';
// El espacio antes del monto es opcional: `Envio$2` y `efectivo$2` se escriben así.
const PAGO = new RegExp(`^(efectivo|trans|transferencia)(?: confirmada)?(?: ?${MONTO})?$`);
const ENVIO = new RegExp(`^envio:? ?${MONTO}$`);
const MOTO = /^moto (\d+)(?: min(?:utos)?)?$/;
const PALABRA_DESCUENTO = '(?:descuento|desc|dscto|dcto)\\.?';
const NUMERO = '(\\d+(?:[.,]\\d{1,2})?)';
// `$2`, `2$`, `2 dolares`, `10%`, `10 por ciento`: sin unidad no se adivina si son dólares o porcentaje.
const VALOR_DESCUENTO = `(?:\\$ ?${NUMERO}|${NUMERO} ?(%|\\$|dolar(?:es)?|usd|por ?ciento))`;
const DESCUENTO = new RegExp(
  `^(?:${PALABRA_DESCUENTO}:? ?(?:de )?${VALOR_DESCUENTO}|${VALOR_DESCUENTO} (?:de )?${PALABRA_DESCUENTO})$`,
);

/** Línea de descuento ya normalizada → descuento, o `null` si es otra cosa. Inválido → `'invalido'`. */
function leerDescuento(normal: string): DescuentoSolicitado | 'invalido' | null {
  const encontrado = normal.match(DESCUENTO);
  if (!encontrado) return new RegExp(`^${PALABRA_DESCUENTO}\\b`).test(normal) ? 'invalido' : null;
  const [, dolarAntes, numero, unidad, dolarDespues, numeroDespues, unidadDespues] = encontrado;
  const valor = Number((dolarAntes ?? numero ?? dolarDespues ?? numeroDespues).replace(',', '.'));
  const porcentaje = /%|ciento/.test(unidad ?? unidadDespues ?? '');
  const descuento = { tipo: porcentaje ? 'porcentaje' : 'monto', valor } as const;
  return esDescuentoSolicitado(descuento) ? descuento : 'invalido';
}

/** Separa del final de la línea las palabras que cumplan `coincide`. */
function quitarCola<T>(
  linea: string,
  coincide: (cola: string) => T | undefined,
): { resto: string; valor: T } | null {
  const palabras = linea.split(/\s+/);
  for (let cantidad = Math.min(3, palabras.length - 1); cantidad >= 1; cantidad--) {
    const valor = coincide(normalizar(palabras.slice(-cantidad).join(' ')));
    if (valor !== undefined) return { resto: palabras.slice(0, -cantidad).join(' '), valor };
  }
  return null;
}

function leerTelefono(valor: string): string | null {
  const limpio = valor.replace(/[\s().-]/g, '');
  // "+593 099..." es frecuente: el 0 nacional sobra tras el código de país.
  const digitos = limpio.match(/^\+?5930?(\d{8,9})$/)?.[1] ?? limpio.match(/^0(\d{8,9})$/)?.[1];
  return digitos ? `+593${digitos}` : null;
}

function leerTipo(linea: string, errores: string[]) {
  const texto = normalizar(linea);
  if (texto === 'domicilio' || texto === 'domiclio') {
    return { tipoOrden: 'domicilio' as const, cliente: null };
  }
  const retiro = linea.trim().match(/^para retirar\b\s*(.*)$/i);
  if (retiro) return { tipoOrden: 'para_llevar' as const, cliente: retiro[1].trim() || null };

  errores.push(
    texto.startsWith('para servirse')
      ? 'Para servirse: regístralo en el POS'
      : 'La primera línea debe ser Domicilio o Para retirar y el nombre',
  );
  return null;
}

/** Convierte el mensaje en un pedido o en la lista completa de correcciones. No consulta el catálogo. */
export function interpretarPedido(texto: string): ResultadoPedido {
  if (texto.length > MAX_TEXTO) {
    return { ok: false, errores: [`Mensaje demasiado largo: máximo ${MAX_TEXTO} caracteres`] };
  }

  const errores: string[] = [];
  // Teclados y copias de WhatsApp meten caracteres invisibles (marcas de dirección, espacio
  // de ancho cero, guion suave) y saltos \r o U+2028. Se conserva U+200D: une emojis.
  const lineas = texto
    .split(/\r\n|[\r\n\u2028\u2029]/)
    .map((linea) => linea.replace(/(?!\u200d)\p{Cf}/gu, '').trim())
    .filter(Boolean);
  const tipo = leerTipo(lineas[0] ?? '', errores);
  if (!tipo) return { ok: false, errores };

  const { tipoOrden } = tipo;
  const domicilio = tipoOrden === 'domicilio';
  let cliente = tipo.cliente;
  let telefono: string | null = null;
  let telefonoEscrito = false;
  let metodo: string | null = null;
  let envio: number | null = null;
  let ubicacionUrl: string | null = null;
  let esperaMotoMin: number | null = null;
  let solicitarAprobacion = false;
  let nuevoPedido = false;
  let descuento: DescuentoSolicitado | null = null;
  const notas: string[] = [];
  const items: ItemPedido[] = [];
  const nivelesSueltos: NivelPicante[] = [];
  let ultimoEsProducto = false;

  // Dinero escrito dos veces con valores distintos no se resuelve eligiendo uno.
  const anotarEnvio = (monto: string) => {
    const valor = Number(monto.replace(',', '.'));
    if (envio !== null && envio !== valor) errores.push('Envío repetido con valores distintos');
    envio = valor;
  };

  const anotarPago = (palabra: string, monto: string | undefined) => {
    const leido = palabra === 'efectivo' ? 'efectivo' : 'transferencia';
    if (metodo && metodo !== leido) errores.push('Pago repetido con valores distintos');
    metodo = leido;
    if (monto) anotarEnvio(monto);
  };

  const agregarProducto = (linea: string, nota: string | null) => {
    const combo = linea.match(/^(?:(\d+)\s+)?(combo\b.*)$/i);
    if (!combo) {
      items.push({ texto: linea, cantidad: null, nivelPicante: null, observaciones: nota });
      return;
    }
    const cantidad = Number(combo[1] ?? 1);
    // La cola más larga que sea solo picantes: `2 combo simple natural y picante 1`.
    const palabras = combo[2].replace(/\s*([,/])\s*/g, ' $1 ').split(/\s+/);
    let resto = palabras.join(' ');
    let niveles: NivelPicante[] = [];
    for (let largo = palabras.length - 1; largo >= 1; largo--) {
      const leidos = leerNiveles(palabras.slice(-largo).join(' '));
      if (leidos) {
        resto = palabras.slice(0, -largo).join(' ');
        niveles = leidos;
        break;
      }
    }
    resto = resto.replace(/[\s,/]+$/, '').replace(/\s+\/\s+/g, ' ');
    if (niveles.length <= 1) {
      items.push({ texto: resto, cantidad, nivelPicante: niveles[0] ?? null, observaciones: nota });
    } else if (niveles.length === cantidad) {
      for (const nivelPicante of niveles) items.push({ texto: resto, cantidad: 1, nivelPicante, observaciones: nota });
    } else {
      errores.push(`${linea}: ${niveles.length} picantes para ${cantidad} combo(s); escribe uno por combo`);
    }
  };

  for (const [indice, linea] of lineas.entries()) {
    if (indice === 0) continue;
    const normal = normalizar(linea);

    if (/^\+?[\d\s().-]{7,}$/.test(linea)) {
      telefonoEscrito = true;
      telefono = leerTelefono(linea);
      ultimoEsProducto = false;
      continue;
    }
    if (/^https?:/i.test(linea)) {
      ubicacionUrl = normalizarUbicacionUrl(linea);
      if (!ubicacionUrl) errores.push('Ubicación: el enlace debe ser HTTPS de Google Maps');
      ultimoEsProducto = false;
      continue;
    }
    if (normal === 'nuevo pedido' || normal === 'nuevo pedido: si') {
      nuevoPedido = true;
      continue;
    }
    if (normal === 'solicitar aprobacion' || normal === 'solicitar aprobacion de stock') {
      solicitarAprobacion = true;
      continue;
    }
    const conEtiqueta = linea.match(/^cliente:\s*(.+)$/i);
    if (conEtiqueta) {
      cliente = conEtiqueta[1].trim();
      continue;
    }

    const nota = linea.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const principal = nota ? nota[1] : linea;
    const textoNota = nota?.[2].trim() || null;
    if (!principal) {
      if (textoNota && ultimoEsProducto) {
        const anterior = items[items.length - 1];
        anterior.observaciones = [anterior.observaciones, textoNota].filter(Boolean).join('; ');
      } else if (textoNota) {
        notas.push(textoNota);
      }
      continue;
    }

    const normalPrincipal = normalizar(principal);
    const descuentoLinea = leerDescuento(normalPrincipal);
    if (descuentoLinea === 'invalido') {
      errores.push(`Descuento no válido: "${principal}". Escribe Descuento $2 o Descuento 10%`);
      ultimoEsProducto = false;
      continue;
    }
    if (descuentoLinea) {
      // Dinero escrito dos veces con valores distintos no se resuelve eligiendo uno.
      if (descuento && JSON.stringify(descuento) !== JSON.stringify(descuentoLinea)) {
        errores.push('Descuento repetido con valores distintos');
      }
      descuento = descuentoLinea;
      ultimoEsProducto = false;
      continue;
    }

    const envioLinea = normalPrincipal.match(ENVIO);
    if (envioLinea) {
      anotarEnvio(envioLinea[1]);
      ultimoEsProducto = false;
      continue;
    }

    const motoLinea = normalPrincipal.match(MOTO);
    if (motoLinea) {
      esperaMotoMin = Number(motoLinea[1]);
      if (esperaMotoMin > MAX_ESPERA_MOTO) errores.push(`Moto: máximo ${MAX_ESPERA_MOTO} minutos`);
      ultimoEsProducto = false;
      continue;
    }

    const pagoLinea = normalPrincipal.match(PAGO);
    if (pagoLinea) {
      anotarPago(pagoLinea[1], pagoLinea[2]);
      ultimoEsProducto = false;
      continue;
    }
    const nivelesLinea = leerNiveles(principal);
    if (nivelesLinea) {
      nivelesSueltos.push(...nivelesLinea);
      continue;
    }

    // `combo simple natural efectivo $2`: el pago también puede cerrar la línea.
    const pagoAlFinal = quitarCola(principal, (cola) => cola.match(PAGO) ?? undefined);
    if (pagoAlFinal) anotarPago(pagoAlFinal.valor[1], pagoAlFinal.valor[2]);
    agregarProducto(pagoAlFinal?.resto ?? principal, textoNota);
    ultimoEsProducto = true;
  }

  // Línea entre el tipo y el teléfono: es el nombre del cliente, no un producto.
  const candidato = lineas[1];
  if (
    domicilio && !cliente && candidato && lineas[2] && /^\+?[\d\s()-]{7,}$/.test(lineas[2]) &&
    /^[\p{L} .'-]+$/u.test(candidato) && !/^combo\b/i.test(candidato)
  ) {
    const posicion = items.findIndex((item) => item.texto === candidato);
    if (posicion >= 0) {
      items.splice(posicion, 1);
      cliente = candidato;
    }
  }

  // El nivel suelto corresponde a los combos que aún no lo tienen, en orden.
  const expandidos: ItemPedido[] = [];
  for (const item of items) {
    const esCombo = /^combo\b/i.test(item.texto);
    if (!esCombo || item.nivelPicante || nivelesSueltos.length === 0) {
      expandidos.push(item);
    } else if ((item.cantidad ?? 1) > 1 && nivelesSueltos.length >= (item.cantidad ?? 1)) {
      for (let unidad = 0; unidad < (item.cantidad ?? 1); unidad++) {
        expandidos.push({ ...item, cantidad: 1, nivelPicante: nivelesSueltos.shift()! });
      }
    } else {
      expandidos.push({ ...item, nivelPicante: nivelesSueltos.shift()! });
    }
  }
  if (nivelesSueltos.length > 0) errores.push('Hay un picante sin combo: revisa las líneas de picante');

  if (domicilio) {
    if (!telefono) {
      errores.push(telefonoEscrito ? 'Teléfono no válido: usa +593XXXXXXXXX o 09XXXXXXXX' : 'Teléfono es requerido en domicilio');
    }
    if (!metodo) errores.push('Pago es requerido: efectivo $2.50 o trans $2.50');
    else if (envio === null) errores.push('Falta el valor del envío: escribe efectivo $2.50, trans $2.50 o Envío $2.50');
    else if (envio > MAX_ENVIO) errores.push('El valor del envío es demasiado alto');
  } else {
    if (!cliente) errores.push('Para retirar requiere el nombre del cliente');
  }

  if (cliente && cliente.length > MAX_CLIENTE) errores.push('Cliente demasiado largo');
  const observaciones = notas.join('; ') || null;
  if (observaciones && observaciones.length > MAX_OBSERVACIONES) errores.push('Notas demasiado largas');
  if (expandidos.length === 0) errores.push('Falta al menos un producto');
  if (expandidos.length > MAX_ITEMS) errores.push(`Máximo ${MAX_ITEMS} líneas de producto`);

  if (errores.length > 0) return { ok: false, errores };
  return {
    ok: true,
    pedido: {
      tipoOrden,
      cliente,
      telefono: domicilio ? telefono : null,
      // Para retirar sin transferencia se cobra al llegar; no paga envío ni usa ubicación.
      pago: metodo === 'transferencia' ? 'transferencia_confirmada' : domicilio ? 'efectivo' : null,
      envio: domicilio ? envio : null,
      ubicacionUrl: domicilio ? ubicacionUrl : null,
      esperaMotoMin: domicilio ? esperaMotoMin : null,
      solicitarAprobacion,
      nuevoPedido,
      observaciones,
      descuento,
      items: expandidos,
    },
  };
}

interface ProductoCatalogo {
  id: string;
  nombre: string;
  categoria: string;
  disponible: boolean;
}

export type ItemResuelto = Omit<ItemPedido, 'cantidad'> & { cantidad: number; productoId: string };

/** Línea sin un único producto, con los candidatos que el operador puede elegir por número. */
export interface DudaProducto {
  indice: number;
  texto: string;
  cantidad: number;
  opciones: Array<{ id: string; nombre: string }>;
}

export type ResultadoProductos =
  | { ok: true; items: ItemResuelto[] }
  /** `dudas` solo trae algo cuando elegir resuelve todos los errores. */
  | { ok: false; errores: string[]; dudas: DudaProducto[] };

/** Solo formas confirmadas con pedidos reales. Un nombre nuevo se agrega aquí o en el catálogo. */
const ALIAS_PRODUCTOS = new Map<string, string>([
  ['calamar', 'Calamar 120 Gramos'],
  ['120 gramos calamar', 'Calamar 120 Gramos'],
  ['tentaculos', 'Tentaculos 120 Gramos'],
]);

function limpiarNombre(texto: string): string {
  return normalizar(texto)
    .replace(/^\+\s*/, '')
    .replace(/(\d)(lb|gr)\b/g, '$1 $2')
    .replace(/\b(extra|porcion|de)\b/g, ' ')
    .replace(/\b(lb|libras)\b/g, 'libra')
    .replace(/\bgr\b/g, 'gramos')
    .replace(/\s+/g, ' ')
    .trim()
    // `1/2 camarón` y `1 lb de camarón` se comparan como `1/2 libra camaron` y `libra camaron`.
    .replace(/^1\/2 (?!libra\b)/, '1/2 libra ')
    .replace(/^1 libra /, 'libra ');
}

function buscarProducto(texto: string, catalogo: ProductoCatalogo[]): ProductoCatalogo[] {
  const exacto = normalizar(texto);
  const limpio = limpiarNombre(texto);
  const alias = ALIAS_PRODUCTOS.get(limpio);
  const iguales = (buscado: string) => catalogo.filter((p) => normalizar(p.nombre) === buscado);
  const limpios = (buscado: string) => catalogo.filter((p) => limpiarNombre(p.nombre) === buscado);

  for (const encontrados of [
    iguales(exacto),
    alias ? iguales(normalizar(alias)) : [],
    limpios(limpio),
    limpios(limpio.replace(/s$/, '')),
    limpios(limpio.replace(/es$/, '')),
  ]) {
    if (encontrados.length > 0) return encontrados;
  }
  return [];
}

/** El nombre completo manda: `3 cangrejos` es ese producto si existe; si no, 3 de `cangrejo`. */
function identificarLinea(item: ItemPedido, catalogo: ProductoCatalogo[]) {
  const linea = (cantidad: number, nombre: string) => ({ cantidad, nombre, encontrados: buscarProducto(nombre, catalogo) });
  if (item.productoId) {
    return { cantidad: item.cantidad ?? 1, nombre: item.texto, encontrados: catalogo.filter((p) => p.id === item.productoId) };
  }
  if (item.cantidad !== null) return linea(item.cantidad, item.texto);

  const completos = linea(1, item.texto);
  if (completos.encontrados.length > 0) return completos;

  const antes = item.texto.match(/^(\d+)(?:\s*x)?\s+(.+)$/i);
  if (antes) return linea(Number(antes[1]), antes[2]);
  const despues = item.texto.match(/^(.+?)\s+(\d+)$/);
  if (despues) return linea(Number(despues[2]), despues[1]);
  return completos;
}

/** Iguales, una empieza a la otra o difieren en una letra (`smal`, `camarones`). */
function palabrasParecidas(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
}

const palabrasDe = (texto: string) => limpiarNombre(texto).split(' ').filter((p) => p.length >= 3 && /\p{L}/u.test(p));

/** Disponibles con más palabras parecidas; si empatan demasiados, no sugiere nada. */
function sugerirProductos(texto: string, catalogo: ProductoCatalogo[]): ProductoCatalogo[] {
  const buscadas = palabrasDe(texto);
  const puntuados = catalogo
    .filter((p) => p.disponible)
    .map((p) => {
      const propias = palabrasDe(p.nombre);
      return { p, puntos: buscadas.filter((b) => propias.some((q) => palabrasParecidas(b, q))).length };
    });
  const mejor = Math.max(0, ...puntuados.map((x) => x.puntos));
  const elegidos = puntuados.filter((x) => mejor > 0 && x.puntos === mejor).map((x) => x.p);
  return elegidos.length <= MAX_OPCIONES ? elegidos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) : [];
}

/** Si no hay un único producto disponible, no adivina. */
export function resolverProductos(
  items: ItemPedido[],
  catalogo: ProductoCatalogo[],
): ResultadoProductos {
  const errores = new Set<string>();
  const resueltos: ItemResuelto[] = [];
  const dudas: DudaProducto[] = [];
  let otrosErrores = false;

  for (const [indice, item] of items.entries()) {
    const { cantidad, nombre, encontrados } = identificarLinea(item, catalogo);
    const producto = encontrados[0];
    const opciones = encontrados.length > 1
      ? encontrados.filter((p) => p.disponible)
      : !producto && !item.productoId ? sugerirProductos(nombre, catalogo) : [];
    if (opciones.length > 0 && cantidad >= 1 && cantidad <= MAX_CANTIDAD) {
      const inicio = encontrados.length > 1 ? 'Producto ambiguo en el catálogo' : 'Producto no encontrado';
      const lista = opciones.map((p) => p.nombre).join(' o ');
      errores.add(`${inicio}: ${item.texto}. ¿Quisiste decir ${lista}?`);
      dudas.push({ indice, texto: item.texto, cantidad, opciones: opciones.map(({ id, nombre }) => ({ id, nombre })) });
      continue;
    }
    if (producto && encontrados.length === 1 && producto.disponible && cantidad >= 1 && cantidad <= MAX_CANTIDAD &&
      !(esCategoriaCombo(producto.categoria) && !item.nivelPicante)) {
      resueltos.push({ ...item, cantidad, productoId: producto.id });
      continue;
    }
    otrosErrores = true;
    if (!producto) {
      errores.add(
        /camar/.test(normalizar(item.texto)) && !/1\/2|libra|lb/.test(limpiarNombre(item.texto))
          ? `Camarón: indica 1/2 o 1 lb en "${item.texto}"`
          : `Producto no encontrado: ${item.texto}`,
      );
    } else if (encontrados.length > 1) {
      errores.add(`Producto ambiguo en el catálogo: ${item.texto}`);
    } else if (!producto.disponible) {
      errores.add(`Producto no está disponible: ${producto.nombre}`);
    } else if (cantidad < 1 || cantidad > MAX_CANTIDAD) {
      errores.add(`Cantidad máxima ${MAX_CANTIDAD} por línea: ${item.texto}`);
    } else {
      errores.add(`Falta picante para ${producto.nombre}`);
    }
  }

  if (errores.size === 0) return { ok: true, items: resueltos };
  return { ok: false, errores: [...errores], dudas: otrosErrores ? [] : dudas };
}

/** Identifica el contenido escrito; no depende del catálogo, de precios ni del mensaje. */
export function hashPedido(pedido: PedidoWhatsapp): string {
  const items = pedido.items
    .map((item) => [
      item.cantidad,
      normalizar(item.texto),
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
    pedido.ubicacionUrl,
    pedido.esperaMotoMin,
    pedido.solicitarAprobacion,
    pedido.nuevoPedido,
    normalizar(pedido.observaciones ?? ''),
    items,
    // Solo si hay: los pedidos sin descuento conservan el hash que ya tenían.
    ...(pedido.descuento ? [pedido.descuento] : []),
  ]);
  return createHash('sha256').update(contenido, 'utf8').digest('hex');
}
