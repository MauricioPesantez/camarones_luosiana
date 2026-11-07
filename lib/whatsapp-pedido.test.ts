import assert from 'node:assert/strict';
import { hashPedido, interpretarPedido, resolverProductos } from './whatsapp-pedido';

const TEL = '+593 99 000 0000';

function pedidoDe(texto: string) {
  const resultado = interpretarPedido(texto);
  assert.ok(resultado.ok, `${texto}\n${JSON.stringify(resultado)}`);
  return resultado.pedido;
}
function erroresDe(texto: string) {
  const resultado = interpretarPedido(texto);
  assert.equal(resultado.ok, false, texto);
  return resultado.ok ? '' : resultado.errores.join('\n');
}

const producto = (nombre: string, categoria = 'Extras', disponible = true) => ({
  id: nombre, nombre, categoria, disponible,
});
const catalogo = [
  ...['Combo Simple', 'Combo Duo', 'Combo Triple', 'Combo Mixto Small', 'Combo Mixto Duo', 'Combo Mixto Triple']
    .map((nombre) => producto(nombre, 'Combos')),
  ...['1/2 Libra Langostinos', 'Libra de Langostinos', '1/2 Libra Camarón', 'Libra de Camarón', '3 Cangrejos', 'Cangrejo', 'Arroz', 'Calamar 120 Gramos',
    'Papas Fritas', 'Patacones', 'Tentaculos 120 Gramos'].map((nombre) => producto(nombre)),
];
const resumen = (texto: string) => {
  const r = resolverProductos(pedidoDe(texto).items, catalogo);
  assert.ok(r.ok, `${texto}\n${JSON.stringify(r)}`);
  return r.items.map((i) => `${i.cantidad} ${i.productoId} ${i.nivelPicante ?? '-'}${i.observaciones ? ` (${i.observaciones})` : ''}`);
};
const fallaProducto = (texto: string) => {
  const r = resolverProductos(pedidoDe(texto).items, catalogo);
  assert.equal(r.ok, false, texto);
  return r.ok ? '' : r.errores.join('\n');
};

// Pedidos reales anonimizados, con el envío que ahora siempre se exige.
assert.deepEqual(pedidoDe(`Domiclio
Cliente Uno
${TEL}
Combo simple
Natural
efectivo $2`), {
  tipoOrden: 'domicilio', cliente: 'Cliente Uno', telefono: '+593990000000', pago: 'efectivo', envio: 2,
  ubicacionUrl: null, esperaMotoMin: null, solicitarAprobacion: false, nuevoPedido: false, observaciones: null,
  items: [{ texto: 'Combo simple', cantidad: 1, nivelPicante: 'natural', observaciones: null }],
});

assert.deepEqual(resumen(`Domicilio
Combo mixto small
${TEL}
1 cangrejo
1 patacones
120 gr calamar
Salsa Natural
Efectivo $2.50`), ['1 Combo Mixto Small natural', '1 Cangrejo -', '1 Patacones -', '1 Calamar 120 Gramos -']);

const transferencia = pedidoDe(`Domicilio
${TEL}
Combo mixto small / picante 1
1 tentáculos
1 calamar
Trans $3,25`);
assert.equal(transferencia.pago, 'transferencia_confirmada');
assert.equal(transferencia.envio, 3.25);
assert.equal(transferencia.items[0].nivelPicante, 'picante_1');

// El picante y el pago pueden ir en cualquier orden.
assert.deepEqual(resumen(`Domiclio\n${TEL}\ncombo mixto small\n2 cangrejos\ntrans $3.50\npicante 1`),
  ['1 Combo Mixto Small picante_1', '2 Cangrejo -']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\ncombo mixto small\ncangrejo 1\nextra de patacones\ntrans $2.75\nnatural`),
  ['1 Combo Mixto Small natural', '1 Cangrejo -', '1 Patacones -']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\ncombo simple\nporción extra de arroz\ntrans $3.75\npicante 1`),
  ['1 Combo Simple picante_1', '1 Arroz -']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\ncombo simple\npicante leve\nefectivo $2`), ['1 Combo Simple leve']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\ncombo mixto dúo\npicante 2\nefectivo $2`), ['1 Combo Mixto Duo picante_2']);

// Todo en una línea.
const unaLinea = pedidoDe(`Para retirar Cliente\n${TEL}\ncombo simple natural efectivo`);
assert.equal(unaLinea.tipoOrden, 'para_llevar');
assert.equal(unaLinea.cliente, 'Cliente');
assert.equal(unaLinea.telefono, null, 'Para retirar no guarda teléfono');
assert.equal(unaLinea.pago, null, 'Efectivo se cobra al retirar');
assert.equal(unaLinea.envio, null);
const retiroPagado = pedidoDe(`Para retirar Cliente\ncombo simple natural\ntrans`);
assert.equal(retiroPagado.pago, 'transferencia_confirmada');
assert.equal(retiroPagado.envio, null, 'Retirar no paga envío');
assert.equal(pedidoDe(`Para retirar Cliente\ncombo simple natural\ntrans $2`).envio, null);
assert.equal(pedidoDe(`Para retirar Cliente\ncombo simple natural`).pago, null, 'Se puede pagar al llegar');
assert.equal(pedidoDe(`Para retirar Cliente\ncombo simple natural\nhttps://maps.app.goo.gl/AbC`).ubicacionUrl, null);
assert.equal(unaLinea.items[0].nivelPicante, 'natural');
assert.equal(pedidoDe(`Domicilio\n${TEL}\ncombo simple natural efectivo $2.50`).envio, 2.5);
assert.equal(pedidoDe(`Domicilio\n${TEL}\ncombo simple natural\nefectivo\nEnvío: 2`).envio, 2);

// Notas entre paréntesis: del producto anterior o del pedido.
assert.deepEqual(resumen(`Domiclio\n${TEL}\ncombo mixto triple\n(MANDAR 3 Langostinos )\npicante 1\nefectivo $3`),
  ['1 Combo Mixto Triple picante_1 (MANDAR 3 Langostinos)']);
assert.equal(pedidoDe(`Para retirar Cliente\ncombo mixto small\npicante 1\nefectivo\n(para las 6pm que esté listo)`).observaciones,
  'para las 6pm que esté listo');
assert.deepEqual(resumen(`Domiclio\n${TEL}\ncombo simple natural (sin cebolla)\nefectivo $2`),
  ['1 Combo Simple natural (sin cebolla)']);

// Varios combos.
assert.deepEqual(resumen(`Domiclio\n${TEL}\n2 combo mixto small\nNatural y picante 1\ncalamar\npatacones\nefectivo $2`),
  ['1 Combo Mixto Small natural', '1 Combo Mixto Small picante_1', '1 Calamar 120 Gramos -', '1 Patacones -']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\n2 combo mixto small\npicante 1\nefectivo $2`), ['2 Combo Mixto Small picante_1']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\ncombo simple natural\ncombo simple natural\ncombo simple picante 1\nefectivo $2`),
  ['1 Combo Simple natural', '1 Combo Simple natural', '1 Combo Simple picante_1']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\n3 Combo Simples natural\nefectivo $2`), ['3 Combo Simple natural']);

// Camarón y langostinos son productos distintos; el camarón exige tamaño.
assert.deepEqual(resumen(`Domiclio\n${TEL}\n1/2 camarones extra\n1 lb de camarón extra\nefectivo $2`),
  ['1 1/2 Libra Camarón -', '1 Libra de Camarón -']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\n1/2 de camaron\n1lb camarones\nefectivo $2`),
  ['1 1/2 Libra Camarón -', '1 Libra de Camarón -']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\n1/2 langostinos\n1 lb de langostinos\nefectivo $2`),
  ['1 1/2 Libra Langostinos -', '1 Libra de Langostinos -']);
assert.match(fallaProducto(`Domiclio\n${TEL}\nextra camarones\nefectivo $2`), /1\/2 o 1 lb/);
const sinCamaron = resolverProductos(pedidoDe(`Domiclio\n${TEL}\n1 lb de camarón extra\nefectivo $2`).items,
  [producto('Libra de Langostinos')]);
assert.match(sinCamaron.ok ? '' : sinCamaron.errores[0], /no encontrado/i, 'Nunca cae en Langostinos');

// Cangrejos: el nombre exacto del catálogo gana; otra cantidad usa la unidad.
assert.deepEqual(resumen(`Domiclio\n${TEL}\n3 cangrejos\nefectivo $2`), ['1 3 Cangrejos -']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\n4 cangrejos\nefectivo $2`), ['4 Cangrejo -']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\n3 papas fritas\nefectivo $2`), ['3 Papas Fritas -']);
assert.deepEqual(resumen(`Domiclio\n${TEL}\n2 x cangrejo\nefectivo $2`), ['2 Cangrejo -']);

// Enlace escrito en el pedido.
assert.equal(pedidoDe(`Domicilio\n${TEL}\ncombo simple natural\nefectivo $2\nhttps://maps.app.goo.gl/AbC`).ubicacionUrl,
  'https://maps.app.goo.gl/AbC');

// Enlace copiado de un pin y espera de la moto, al final del mensaje.
const conMoto = pedidoDe(`Domiclio\n${TEL}\ncombo simple natural\nefectivo $2\nhttps://maps.google.com/?q=-2.17,-79.92\nmoto 25`);
assert.equal(conMoto.ubicacionUrl, 'https://maps.google.com/?q=-2.17,-79.92');
assert.equal(conMoto.esperaMotoMin, 25);
assert.equal(pedidoDe(`Domiclio\n${TEL}\ncombo simple natural\nefectivo $2\nMoto 5 min`).esperaMotoMin, 5);
assert.equal(pedidoDe(`Domiclio\n${TEL}\ncombo simple natural\nefectivo $2\nmoto 0`).esperaMotoMin, 0, 'Cero es pedirla ya');
assert.equal(pedidoDe(`Para retirar Cliente\ncombo simple natural\nmoto 10`).esperaMotoMin, null);
assert.match(erroresDe(`Domiclio\n${TEL}\ncombo simple natural\nefectivo $2\nmoto 121`), /Moto: máximo 120 minutos/);

// Líneas de control.
assert.equal(pedidoDe(`Domicilio\n${TEL}\ncombo simple natural\nefectivo $2\nNuevo pedido`).nuevoPedido, true);
assert.equal(pedidoDe(`Domicilio\n${TEL}\ncombo simple natural\nefectivo $2\nSolicitar aprobación`).solicitarAprobacion, true);

// Rechazos concretos: nunca adivina dinero ni tipo.
const casos: Array<[string, RegExp]> = [
  ['hola', /Domicilio o Para retirar/],
  [`Para servirse en 15 minutos llegan\n${TEL}\ncombo mixto small\npicante 1`, /POS/],
  [`Domiclio\ncombo simple natural\nefectivo $2`, /Teléfono/],
  [`Domiclio\n12345\ncombo simple natural\nefectivo $2`, /Teléfono/],
  [`Domiclio\n${TEL}\ncombo simple natural`, /Pago/],
  [`Domiclio\n${TEL}\ncombo simple natural\nefectivo`, /envío/i],
  [`Domiclio\n${TEL}\ncombo simple natural\ntrans`, /envío/i],
  [`Domiclio\n${TEL}\ncombo simple natural\nefectivo $2.755`, /no reconocida|Pago/i],
  [`Domiclio\n${TEL}\nefectivo $2`, /producto/i],
  [`Domiclio\n${TEL}\ncombo simple\nnatural\npicante 1\nefectivo $2`, /picante/i],
  [`Domiclio\n${TEL}\n1 cangrejo\nnatural\nefectivo $2`, /picante/i],
  [`Domiclio\n${TEL}\ncombo simple natural\nefectivo $2\ntrans $3`, /Pago/],
  [`Domiclio\n${TEL}\ncombo simple natural\nefectivo $2\nhttp://evil.test`, /Google Maps/],
  [`Para retirar\ncombo simple natural`, /nombre/i],
  [`Domiclio\n${TEL}\n${'1 cangrejo\n'.repeat(31)}efectivo $2`, /líneas/i],
  [`Domiclio\n${TEL}\ncombo simple natural\nefectivo $2\n(${'a'.repeat(4000)})`, /largo/i],
];
for (const [texto, patron] of casos) assert.match(erroresDe(texto), patron, texto.slice(0, 60));

// Catálogo: sin coincidencia exacta o alias confirmado, no adivina.
assert.match(fallaProducto(`Domiclio\n${TEL}\nCola de 1LT\nefectivo $2`), /no encontrado.*Cola de 1LT/i);
assert.match(fallaProducto(`Domiclio\n${TEL}\n1 michelada maracuya\nefectivo $2`), /no encontrado.*michelada/i);
assert.match(fallaProducto(`Domiclio\n${TEL}\nExtra salsa picante 2\nefectivo $2`), /no encontrado.*salsa picante 2/i);
assert.match(fallaProducto(`Domiclio\n${TEL}\ncombo mixto small\n4 cangrejos\ntrans $3.75`), /Falta picante.*Combo Mixto Small/);
assert.match(fallaProducto(`Domiclio\n${TEL}\n3 Combo Simples (2 en natural y el otro en picante 1)\nefectivo $2`), /Falta picante/);
assert.match(fallaProducto(`Domiclio\n${TEL}\n100 cangrejos\nefectivo $2`), /Cantidad máxima/);
const dobles = resolverProductos(pedidoDe(`Domiclio\n${TEL}\nRepetido\nefectivo $2`).items,
  [producto('Repetido'), { ...producto('repetido'), id: 'otro' }]);
assert.match(dobles.ok ? '' : dobles.errores[0], /ambiguo/i);
const agotado = resolverProductos(pedidoDe(`Domiclio\n${TEL}\nAgotado\nefectivo $2`).items, [producto('Agotado', 'Extras', false)]);
assert.match(agotado.ok ? '' : agotado.errores[0], /no está disponible/);
// Una salsa agregada al catálogo funciona sin cambiar código.
const conSalsa = resolverProductos(pedidoDe(`Domiclio\n${TEL}\nExtra salsa picante 2\nefectivo $2`).items, [producto('Salsa Picante 2')]);
assert.ok(conSalsa.ok);

// Hash: reconoce el reenvío aunque cambie el formato, no el contenido.
const base = `Domiclio\n${TEL}\ncombo simple natural\n1 cangrejo\nefectivo $2`;
const hash = hashPedido(pedidoDe(base));
assert.match(hash, /^[0-9a-f]{64}$/);
assert.equal(hashPedido(pedidoDe(base.toUpperCase().replace('X', 'x'))), hash);
assert.equal(hashPedido(pedidoDe(base.replace('+593 99 000 0000', '0990000000'))), hash);
assert.equal(hashPedido(pedidoDe(`Domicilio\n1 cangrejo\n${TEL}\nefectivo $2\ncombo simple natural`)), hash);
for (const [de, a] of [
  ['1 cangrejo', '2 cangrejos'], ['natural', 'leve'], ['efectivo $2', 'efectivo $3'], ['efectivo $2', 'trans $2'],
]) {
  assert.notEqual(hashPedido(pedidoDe(base.replace(de, a))), hash, de);
}
assert.notEqual(hashPedido(pedidoDe(`${base}\nNuevo pedido`)), hash);

console.log('whatsapp-pedido tests: ok');
