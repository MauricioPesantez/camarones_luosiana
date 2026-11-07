import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  clasificarMensaje, firmaValida, leerConfiguracion, leerCoordenadas, leerCuerpoLimitado, marcaDeTiempoMs,
} from './whatsapp-webhook';

const secreto = 's'.repeat(32);
const firmar = (cuerpo: Buffer | string) => `sha256=${createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;

// Firma sobre los bytes exactos.
const bytes = Buffer.from('{"a": 1}');
assert.equal(firmaValida(bytes, firmar(bytes), secreto), true);
assert.equal(firmaValida(Buffer.from('{"a":1}'), firmar(bytes), secreto), false);
assert.equal(firmaValida(bytes, firmar(bytes).toUpperCase(), secreto), false, 'Prefijo exacto');
for (const encabezado of [null, '', 'sha256=corta', firmar(bytes).replace('sha256=', '')]) {
  assert.equal(firmaValida(bytes, encabezado, secreto), false);
}

// Configuración: incompleta o débil nunca acepta eventos.
const entorno = {
  WHATSAPP_WEBHOOK_SECRET: secreto, WHATSAPP_SESSION_ID: 'sesion-1',
  WHATSAPP_OPERATOR_IDS: ' 593991234567@c.us, 123456789@lid ,', WHATSAPP_OPERATOR_USER_ID: 'usuario-digital',
  WHATSAPP_GROUP_CHAT_ID: 'grupo@g.us', WHATSAPP_MOTOS_CHAT_ID: 'motos@g.us',
};
const config = leerConfiguracion(entorno)!;
assert.deepEqual([...config.operadores], ['593991234567@c.us', '123456789@lid']);
assert.equal(config.habilitado, false, 'Apagado por defecto');
assert.equal(leerConfiguracion({ ...entorno, WHATSAPP_ENABLED: 'true' })!.habilitado, true);
assert.equal(leerConfiguracion({ ...entorno, WHATSAPP_ENABLED: '1' })!.habilitado, false);
for (const cambio of [
  { WHATSAPP_WEBHOOK_SECRET: 'corto' }, { WHATSAPP_SESSION_ID: ' ' },
  { WHATSAPP_OPERATOR_IDS: ' , ' }, { WHATSAPP_OPERATOR_USER_ID: undefined },
  { WHATSAPP_GROUP_CHAT_ID: '' }, { WHATSAPP_MOTOS_CHAT_ID: undefined },
]) {
  assert.equal(leerConfiguracion({ ...entorno, ...cambio }), null);
}

// Cuerpo limitado: corta sin leer todo.
const pedir = (cuerpo: string, headers = {}) => new Request('http://test.invalid', { method: 'POST', body: cuerpo, headers });
const pruebasCuerpo = async () => {
  assert.equal((await leerCuerpoLimitado(pedir('abc'), 3))?.toString(), 'abc');
  assert.equal(await leerCuerpoLimitado(pedir('abcd'), 3), null);
  assert.equal(await leerCuerpoLimitado(pedir('a', { 'content-length': '999' }), 3), null);
};

// Tiempo en segundos (motores actuales) o milisegundos.
assert.equal(marcaDeTiempoMs(1_800_000_000), 1_800_000_000_000);
assert.equal(marcaDeTiempoMs(1_800_000_000_000), 1_800_000_000_000);

// Coordenadas.
assert.deepEqual(leerCoordenadas({ latitude: -2.17, longitude: -79.92 }), { latitud: -2.17, longitud: -79.92 });
for (const invalida of [
  undefined, null, {}, { latitude: 0, longitude: 0 }, { latitude: -2.17, longitude: 0 }, { latitude: 0, longitude: -79.9 },
  { latitude: 91, longitude: 1 }, { latitude: 1, longitude: -181 }, { latitude: '1', longitude: '2' },
  { latitude: Number.NaN, longitude: 1 },
]) {
  assert.equal(leerCoordenadas(invalida), null, JSON.stringify(invalida));
}

// Clasificación del evento.
const data = {
  id: 'm1', from: '593991234567@c.us', to: 'ejecutor@c.us', chatId: '593991234567@c.us', body: 'PEDIDO\nTipo: domicilio',
  type: 'text', timestamp: 1_800_000_000, fromMe: false, isGroup: false,
};
const sobre = { event: 'message.received', sessionId: 'sesion-1', timestamp: '2027-01-15T08:00:00.000Z', idempotencyKey: 'k1', deliveryId: 'd1', data };

assert.deepEqual(clasificarMensaje(sobre, config), {
  relevante: true,
  mensaje: {
    tipo: 'PEDIDO', sessionId: 'sesion-1', messageId: 'm1', claveEntrega: 'k1', remitente: data.from, chatId: data.chatId,
    enviadoAt: new Date(1_800_000_000_000), texto: data.body, location: undefined,
  },
});
const pin = clasificarMensaje({ ...sobre, data: { ...data, type: 'location', body: 'miniatura', location: { latitude: -2.1, longitude: -79.9 } } }, config);
assert.ok(pin.relevante && pin.mensaje.tipo === 'UBICACION');
assert.equal(pin.relevante && pin.mensaje.texto, null, 'No guarda el cuerpo de un pin');
assert.deepEqual(pin.relevante && pin.mensaje.location, { latitude: -2.1, longitude: -79.9 });
assert.ok(clasificarMensaje({ ...sobre, data: { ...data, from: '123456789@lid', chatId: '123456789@lid' } }, config).relevante);

// Muestras reales anonimizadas de OpenWA 0.27.1 con whatsapp-web.js.
const lid = '138000000080@lid';
const real = leerConfiguracion({ ...entorno, WHATSAPP_SESSION_ID: 'ae20097a', WHATSAPP_OPERATOR_IDS: lid })!;
const sobreReal = (data: object) => ({
  event: 'message.received', timestamp: '2026-11-05T21:18:38.229Z', sessionId: 'ae20097a',
  idempotencyKey: `msg_ae20097a_false_${lid}_3AD614E103A145520E0F_4fb43c30`, deliveryId: 'dlv_41d63e08',
  data: {
    id: `false_${lid}_3AD614E103A145520E0F`, from: lid, to: '593000000049@c.us', chatId: lid, timestamp: 1793913517,
    fromMe: false, isGroup: false, kind: 'individual', isStatusBroadcast: false, isLidSender: true,
    contact: { pushName: '***', name: '***' }, ...data,
  },
});
const pinReal = clasificarMensaje(sobreReal({
  body: 'miniatura-en-base64', type: 'location',
  location: { latitude: -2.9052374362945557, longitude: -78.99651336669922 },
}), real);
assert.ok(pinReal.relevante);
assert.equal(pinReal.relevante && pinReal.mensaje.tipo, 'UBICACION');
assert.equal(pinReal.relevante && pinReal.mensaje.texto, null);
assert.equal(pinReal.relevante && pinReal.mensaje.chatId, lid);
assert.equal(pinReal.relevante && pinReal.mensaje.enviadoAt.toISOString(), '2026-11-05T21:18:37.000Z');
assert.deepEqual(pinReal.relevante && leerCoordenadas(pinReal.mensaje.location), {
  latitud: -2.9052374362945557, longitud: -78.99651336669922,
});
const textoReal = clasificarMensaje(sobreReal({ body: 'PEDIDO prueba', type: 'text' }), real);
assert.equal(textoReal.relevante && textoReal.mensaje.tipo, 'PEDIDO');

const irrelevantes: Array<[string, unknown]> = [
  ['evento', { ...sobre, event: 'message.edited' }],
  ['revocado', { ...sobre, event: 'message.revoked' }],
  ['estado de sesión', { ...sobre, event: 'session.status', data: { status: 'ready' } }],
  ['otra sesión', { ...sobre, sessionId: 'otra' }],
  ['propio', { ...sobre, data: { ...data, fromMe: true } }],
  ['grupo', { ...sobre, data: { ...data, isGroup: true } }],
  ['grupo por chat', { ...sobre, data: { ...data, chatId: '1@g.us' } }],
  ['estado', { ...sobre, data: { ...data, isStatusBroadcast: true } }],
  ['desconocido', { ...sobre, data: { ...data, from: '593000000000@c.us' } }],
  ['texto vacío', { ...sobre, data: { ...data, body: '  ' } }],
  ['imagen', { ...sobre, data: { ...data, type: 'image' } }],
  ['revocado por tipo', { ...sobre, data: { ...data, type: 'revoked' } }],
];
for (const [nombre, evento] of irrelevantes) {
  assert.equal(clasificarMensaje(evento, config).relevante, false, nombre);
}

const malformados: unknown[] = [
  null, 'texto', [], {}, { event: 1 }, { ...sobre, sessionId: undefined }, { ...sobre, data: null },
  { ...sobre, data: { ...data, id: '' } }, { ...sobre, data: { ...data, from: 7 } },
  { ...sobre, data: { ...data, timestamp: 'ayer' } }, { ...sobre, data: { ...data, timestamp: 0 } },
  { ...sobre, data: { ...data, body: undefined } }, { ...sobre, data: { ...data, fromMe: undefined } },
];
for (const evento of malformados) {
  assert.equal(clasificarMensaje(evento, config).relevante, false);
  assert.equal((clasificarMensaje(evento, config) as { malformado?: boolean }).malformado, true, JSON.stringify(evento));
}

pruebasCuerpo()
  .then(() => console.log('whatsapp-webhook tests: ok'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
