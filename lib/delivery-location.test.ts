import assert from 'node:assert/strict';
import { MAX_REFERENCIA_ENTREGA, normalizarReferenciaEntrega, normalizarUbicacionUrl } from './delivery-location';

for (const valido of [
  'https://maps.app.goo.gl/AbC123',
  'https://www.google.com/maps?q=-2.17,-79.92',
  'https://www.google.com/maps/place/Guayaquil/@-2.1,-79.9,12z',
  'https://google.com/maps/@-2.1,-79.9,15z',
  'https://maps.google.com/?q=-2.17,-79.92',
  'https://www.google.com.ec/maps?q=-2.17,-79.92',
  'https://goo.gl/maps/AbC123',
]) {
  assert.equal(normalizarUbicacionUrl(`  ${valido} `), valido);
}

for (const invalido of [
  '',
  'no es enlace',
  'http://maps.app.goo.gl/AbC123',
  'javascript:alert(1)',
  'https://usuario:clave@maps.app.goo.gl/AbC123',
  'https://maps.app.goo.gl:8443/AbC123',
  'https://maps.app.goo.gl.evil.test/AbC123',
  'https://evil.test/www.google.com/maps',
  'https://www.google.com/search?q=maps',
  'https://www.google.com/mapsfalso',
  'https://goo.gl/AbC123',
  `https://maps.app.goo.gl/${'a'.repeat(2048)}`,
]) {
  assert.equal(normalizarUbicacionUrl(invalido), null, invalido);
}

assert.equal(normalizarReferenciaEntrega('  Casa azul '), 'Casa azul');
assert.equal(normalizarReferenciaEntrega('   '), null);
assert.equal(normalizarReferenciaEntrega(undefined), null);
assert.equal(normalizarReferenciaEntrega('a'.repeat(MAX_REFERENCIA_ENTREGA)), 'a'.repeat(MAX_REFERENCIA_ENTREGA));
assert.throws(() => normalizarReferenciaEntrega('a'.repeat(MAX_REFERENCIA_ENTREGA + 1)), /referencia/i);

console.log('delivery-location tests: ok');
