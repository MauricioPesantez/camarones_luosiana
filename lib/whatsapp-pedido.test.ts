import assert from 'node:assert/strict';
import { hashPedido, interpretarPlantilla, resolverProductos } from './whatsapp-pedido';

const domicilio = `PEDIDO
Tipo: domicilio
Cliente: Ana
Teléfono: +593 99 123 4567
Productos:
2 x Combo Duo | natural
1 x Combo Duo | picante 1 | sin cebolla
1 x 3 Cangrejos
Pago: transferencia confirmada
Envío: 2.75
Ubicación: pin
Referencia de entrega: portón negro; llamar al llegar
Solicitar aprobación de stock: no
Observaciones: entregar los cubiertos aparte`;

const paraLlevar = `PEDIDO
Tipo: para llevar
Cliente: Luis
Productos:
1 x Combo Duo | leve`;

function pedidoDe(texto: string) {
  const resultado = interpretarPlantilla(texto);
  assert.ok(resultado.ok, JSON.stringify(resultado));
  return resultado.pedido;
}
function erroresDe(texto: string) {
  const resultado = interpretarPlantilla(texto);
  assert.equal(resultado.ok, false, texto);
  return resultado.ok ? '' : resultado.errores.join('\n');
}
const cambiar = (texto: string, de: string, a: string) => {
  assert.ok(texto.includes(de), de);
  return texto.replace(de, a);
};

// Plantilla completa.
assert.deepEqual(pedidoDe(domicilio), {
  tipoOrden: 'domicilio',
  cliente: 'Ana',
  telefono: '+593991234567',
  pago: 'transferencia_confirmada',
  envio: 2.75,
  ubicacion: { tipo: 'pin' },
  referencia: 'portón negro; llamar al llegar',
  solicitarAprobacion: false,
  nuevoPedido: false,
  observaciones: 'entregar los cubiertos aparte',
  items: [
    { cantidad: 2, producto: 'Combo Duo', nivelPicante: 'natural', observaciones: null },
    { cantidad: 1, producto: 'Combo Duo', nivelPicante: 'picante_1', observaciones: 'sin cebolla' },
    { cantidad: 1, producto: '3 Cangrejos', nivelPicante: null, observaciones: null },
  ],
});
assert.deepEqual(pedidoDe(paraLlevar), {
  tipoOrden: 'para_llevar', cliente: 'Luis', telefono: null, pago: null, envio: null, ubicacion: null,
  referencia: null, solicitarAprobacion: false, nuevoPedido: false, observaciones: null,
  items: [{ cantidad: 1, producto: 'Combo Duo', nivelPicante: 'leve', observaciones: null }],
});

// Variaciones de etiquetas, espacios, mayúsculas y tildes.
const variado = pedidoDe(`  pedido
TIPO:   Domicilio
telefono: 0991234567
  PRODUCTOS :
1 X Combo Duo | Picante 2
pago: Efectivo
ENVIO: 1,50
UBICACIÓN: pendiente
Nuevo pedido: SÍ
Solicitar aprobacion de stock: si`);
assert.equal(variado.telefono, '+593991234567');
assert.equal(variado.pago, 'efectivo');
assert.equal(variado.envio, 1.5);
assert.deepEqual(variado.ubicacion, { tipo: 'pendiente' });
assert.equal(variado.nuevoPedido, true);
assert.equal(variado.solicitarAprobacion, true);
assert.equal(variado.items[0].nivelPicante, 'picante_2');
assert.deepEqual(pedidoDe(cambiar(domicilio, 'Ubicación: pin', 'Ubicación: https://maps.app.goo.gl/AbC')).ubicacion,
  { tipo: 'enlace', url: 'https://maps.app.goo.gl/AbC' });

// Errores concretos; se devuelven todos juntos.
const casos: Array<[string, RegExp]> = [
  ['hola', /PEDIDO/],
  [cambiar(domicilio, 'Tipo: domicilio', 'Tipo: mesa'), /Tipo/],
  [cambiar(domicilio, 'Tipo: domicilio\n', ''), /Tipo/],
  [cambiar(domicilio, 'Teléfono: +593 99 123 4567\n', ''), /Teléfono/],
  [cambiar(domicilio, '+593 99 123 4567', '12345'), /Teléfono/],
  [cambiar(domicilio, 'Pago: transferencia confirmada\n', ''), /Pago/],
  [cambiar(domicilio, 'transferencia confirmada', 'transferencia pendiente'), /transferencia confirmada/],
  [cambiar(domicilio, 'transferencia confirmada', 'trans'), /transferencia confirmada/],
  [cambiar(domicilio, 'Envío: 2.75\n', ''), /Envío/],
  [cambiar(domicilio, 'Envío: 2.75', 'Envío: 2.755'), /Envío/],
  [cambiar(domicilio, 'Envío: 2.75', 'Envío: -1'), /Envío/],
  [cambiar(domicilio, 'Ubicación: pin\n', ''), /Ubicación/],
  [cambiar(domicilio, 'Ubicación: pin', 'Ubicación: http://evil.test'), /Ubicación/],
  [cambiar(domicilio, 'Solicitar aprobación de stock: no', 'Solicitar aprobación de stock: tal vez'), /aprobación/],
  [cambiar(domicilio, 'Productos:\n2 x Combo Duo | natural\n1 x Combo Duo | picante 1 | sin cebolla\n1 x 3 Cangrejos\n', 'Productos:\n'), /producto/i],
  [cambiar(domicilio, '2 x Combo Duo', '0 x Combo Duo'), /línea/i],
  [cambiar(domicilio, '2 x Combo Duo', '1.5 x Combo Duo'), /línea/i],
  [cambiar(domicilio, '2 x Combo Duo', '100 x Combo Duo'), /cantidad/i],
  [cambiar(domicilio, '1 x 3 Cangrejos', '3 Cangrejos'), /línea/i],
  [cambiar(domicilio, '| natural', '| picante'), /picante/i],
  [cambiar(domicilio, '| natural', '| picante 4'), /picante/i],
  [cambiar(domicilio, 'Cliente: Ana', 'Clienta: Ana'), /Clienta/],
  [`${domicilio}\nEnvío: 3`, /Envío.*repetid/i],
  [cambiar(paraLlevar, 'Cliente: Luis\n', ''), /Cliente/],
  [`${paraLlevar}\nEnvío: 2`, /para llevar/i],
  [`${paraLlevar}\nUbicación: pin`, /para llevar/i],
  [`${paraLlevar}\nPago: efectivo`, /para llevar/i],
  [`PEDIDO\nTipo: domicilio\nProductos:\n${'1 x Cola\n'.repeat(31)}`, /líneas/i],
  [`${domicilio}\nObservaciones: ${'a'.repeat(4000)}`, /largo/i],
];
for (const [texto, patron] of casos) assert.match(erroresDe(texto), patron, texto.slice(0, 60));
const varios = interpretarPlantilla('PEDIDO\nTipo: domicilio');
assert.equal(varios.ok, false);
assert.ok(!varios.ok && varios.errores.length >= 5, 'Lista todo lo que falta de una vez');

// Campo repetido sin contradicción: se acepta.
assert.equal(pedidoDe(`${domicilio}\nEnvío: 2.75`).envio, 2.75);

// Catálogo: coincidencia exacta normalizada, sin adivinar.
const catalogo = [
  { id: 'c1', nombre: 'Combo Dúo', categoria: 'Combos', disponible: true },
  { id: 'k1', nombre: '3 Cangrejos', categoria: 'Mariscos', disponible: true },
  { id: 'r1', nombre: 'Repetido', categoria: 'Mariscos', disponible: true },
  { id: 'r2', nombre: 'repetido', categoria: 'Mariscos', disponible: true },
  { id: 'n1', nombre: 'Agotado', categoria: 'Mariscos', disponible: false },
];
const resuelto = resolverProductos(pedidoDe(domicilio).items, catalogo);
assert.ok(resuelto.ok);
assert.deepEqual(resuelto.items.map((i) => i.productoId), ['c1', 'c1', 'k1']);
const conLineas = (...lineas: string[]) => pedidoDe(`PEDIDO\nTipo: para llevar\nCliente: A\nProductos:\n${lineas.join('\n')}`).items;
const fallo = (...lineas: string[]) => {
  const r = resolverProductos(conLineas(...lineas), catalogo);
  assert.equal(r.ok, false);
  return r.ok ? '' : r.errores.join('\n');
};
assert.match(fallo('1 x Comb Duo | natural'), /no encontrado.*Comb Duo/i);
assert.match(fallo('1 x Repetido'), /ambiguo.*Repetido/i);
assert.match(fallo('1 x Agotado'), /no está disponible.*Agotado/i);
assert.match(fallo('1 x Combo Duo'), /picante.*Combo Dúo/i);

// Hash: reconoce el reenvío aunque cambie el formato, no el contenido.
const hash = hashPedido(pedidoDe(domicilio));
assert.match(hash, /^[0-9a-f]{64}$/);
assert.equal(hashPedido(pedidoDe(domicilio.toUpperCase()
  .replace('MAPS', 'maps').replace('PIN', 'pin').replace('X COMBO', 'x combo').replace('X 3', 'x 3'))), hash);
assert.equal(hashPedido(pedidoDe(cambiar(domicilio, 'Teléfono: +593 99 123 4567', 'Teléfono: 0991234567'))), hash);
assert.equal(hashPedido(pedidoDe(cambiar(domicilio, '2 x Combo Duo | natural\n1 x Combo Duo | picante 1 | sin cebolla',
  '1 x Combo Duo | picante 1 | sin cebolla\n2 x Combo Duo | natural'))), hash);
for (const [de, a] of [
  ['2 x Combo Duo', '3 x Combo Duo'], ['| natural', '| leve'], ['Envío: 2.75', 'Envío: 3'],
  ['Ubicación: pin', 'Ubicación: pendiente'], ['transferencia confirmada', 'efectivo'],
  ['Observaciones: entregar', 'Observaciones: dejar'],
]) {
  assert.notEqual(hashPedido(pedidoDe(cambiar(domicilio, de, a))), hash, de);
}
assert.notEqual(hashPedido(pedidoDe(`${domicilio}\nNuevo pedido: sí`)), hash);

console.log('whatsapp-pedido tests: ok');
