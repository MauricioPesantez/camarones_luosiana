import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ciclo, clasificarEnvio, dentroDeHorario, leerConfig } from './agente.mjs';
import { ejecutar } from './openwa.mjs';

const secreto = 'secreto-de-prueba-largo';

test('webhook apunta al POS, reemplaza el registro anterior y aplica filtros', async () => {
  const llamadas = [];
  const solicitar = async (url, opciones) => {
    llamadas.push({ url, ...opciones });
    const cuerpo = opciones.method ? {} : [{ id: 'anterior' }];
    return new Response(JSON.stringify(cuerpo), { status: 200 });
  };
  await ejecutar(
    ['webhook', 'sesion-1'],
    { OPENWA_URL: 'http://api', OPENWA_API_KEY: 'clave', WEBHOOK_SECRET: secreto, POS_URL: 'https://pos.test/' },
    solicitar,
  );

  assert.equal(llamadas[1].method, 'DELETE');
  assert.equal(llamadas[1].url, 'http://api/sessions/sesion-1/webhooks/anterior');
  const registro = JSON.parse(llamadas[2].body);
  assert.equal(registro.url, 'https://pos.test/api/integraciones/whatsapp/webhook');
  assert.equal(registro.retryCount, 5);
  assert.equal(registro.secret, secreto);
  assert.deepEqual(registro.filters.conditions, [
    { field: 'fromMe', operator: 'is', value: false },
    { field: 'isGroup', operator: 'is', value: false },
    { field: 'type', operator: 'is', value: ['text', 'location'] },
  ]);
  assert.equal(llamadas[2].headers['X-API-Key'], 'clave');
});

test('webhook sin POS_URL no toca el registro existente', async () => {
  let llamadas = 0;
  const solicitar = async () => { llamadas += 1; return new Response('[]'); };
  await assert.rejects(ejecutar(['webhook', 's'], { WEBHOOK_SECRET: secreto }, solicitar), /POS_URL/);
  assert.equal(llamadas, 0);
});

test('grupos devuelve ID y nombre', async () => {
  const solicitar = async (url) => {
    assert.equal(url, 'http://api/sessions/sesion-1/groups');
    return Response.json([{ id: '1@g.us', name: 'Motos', linkedParentJID: null }]);
  };
  assert.deepEqual(await ejecutar(['grupos', 'sesion-1'], { OPENWA_URL: 'http://api' }, solicitar), ['1@g.us Motos']);
});

test('enviar conserva la clave idempotente', async () => {
  let llamada;
  const solicitar = async (url, opciones) => {
    llamada = { url, ...opciones };
    return new Response('{"messageId":"m"}', { status: 201 });
  };
  await ejecutar(
    ['enviar', 'sesion-1', '593@c.us', 'Hola', 'clave-1'],
    { OPENWA_URL: 'http://api' },
    solicitar,
  );

  assert.equal(llamada.url, 'http://api/sessions/sesion-1/messages/send-text');
  assert.equal(llamada.headers['Idempotency-Key'], 'clave-1');
  assert.deepEqual(JSON.parse(llamada.body), { chatId: '593@c.us', text: 'Hola' });
});

test('un error de OpenWA se reporta con su estado', async () => {
  const solicitar = async () => new Response('{"code":"X"}', { status: 409 });
  await assert.rejects(
    ejecutar(['fallos', 'sesion-1'], { OPENWA_URL: 'http://api' }, solicitar),
    /409/,
  );
});

const configAgente = leerConfig({
  POS_URL: 'https://pos.test/', WHATSAPP_AGENT_TOKEN: 'token', WHATSAPP_SESSION_ID: 'sesion', OPENWA_API_KEY: 'clave',
  OPENWA_URL: 'http://openwa/api',
});
const salidaDePrueba = { id: 's1', destino: '123@lid', texto: 'Hola', clave: 'respuesta:s1', reservaToken: 'reserva' };

/** Simula OpenWA y POS; `envio` decide el resultado de send-text. */
function simulador({ estado = 'ready', salida = salidaDePrueba, envio = () => new Response('{"messageId":"m1"}', { status: 201 }), cierre } = {}) {
  const llamadas = [];
  const solicitar = async (url, opciones = {}) => {
    llamadas.push({ url, ...opciones });
    if (url.endsWith('/sessions/sesion')) return Response.json({ status: estado });
    if (url.endsWith('/tick')) return Response.json({ salida });
    if (url.endsWith('/send-text')) return envio();
    if (cierre) return cierre();
    return Response.json({ ok: true });
  };
  return { llamadas, solicitar };
}
const cuerpoDe = (llamadas, fin) => JSON.parse(llamadas.find((l) => l.url.endsWith(fin)).body);

test('agente envia con clave estable y confirma con el token de la reserva', async () => {
  const { llamadas, solicitar } = simulador();
  assert.equal(await ciclo(configAgente, solicitar), true);
  const envio = llamadas.find((l) => l.url.endsWith('/send-text'));
  assert.equal(envio.headers['Idempotency-Key'], 'respuesta:s1');
  assert.deepEqual(JSON.parse(envio.body), { chatId: '123@lid', text: 'Hola' });
  assert.deepEqual(cuerpoDe(llamadas, '/complete'), { token: 'reserva', mensajeId: 'm1' });
  assert.equal(llamadas.find((l) => l.url.endsWith('/tick')).headers.Authorization, 'Bearer token');
});

test('agente no reserva si la sesion no esta lista y lo informa al POS', async () => {
  const { llamadas, solicitar } = simulador({ estado: 'disconnected', salida: null });
  assert.equal(await ciclo(configAgente, solicitar), false);
  assert.equal(cuerpoDe(llamadas, '/tick').sesionLista, false);
  assert.equal(llamadas.some((l) => l.url.endsWith('/send-text')), false);
});

test('agente reporta caida antes del envio como reintentable', async () => {
  const { llamadas, solicitar } = simulador({ envio: () => { throw new Error('caida'); } });
  await ciclo(configAgente, solicitar);
  assert.deepEqual(cuerpoDe(llamadas, '/fail'), { token: 'reserva', codigo: 'SIN_RESPUESTA', reintentable: true });
});

test('caida despues de enviar deja la confirmacion al vencimiento de la reserva', async () => {
  const { solicitar } = simulador({ cierre: () => { throw new Error('POS caido'); } });
  await assert.rejects(ciclo(configAgente, solicitar), /POS caido/);
});

test('clasificarEnvio separa dudas, limites y exitos', () => {
  assert.deepEqual(clasificarEnvio(201, '{"messageId":"m"}', null), { ok: true, mensajeId: 'm' });
  const incierto = clasificarEnvio(409, '{"code":"IDEMPOTENCY_OUTCOME_UNKNOWN"}', null);
  assert.deepEqual([incierto.codigo, incierto.reintentable], ['IDEMPOTENCY_OUTCOME_UNKNOWN', false]);
  assert.equal(clasificarEnvio(422, '{"error":{"code":"IDEMPOTENCY_KEY_REUSED"}}', null).reintentable, false);
  assert.equal(clasificarEnvio(409, '{"code":"IDEMPOTENCY_KEY_IN_PROGRESS"}', null).reintentable, true);
  assert.equal(clasificarEnvio(429, '{}', '7').esperaSeg, 7);
  assert.equal(clasificarEnvio(429, '{"code":"SEND_PACING_LIMITED","retryAfterSeconds":9}', null).esperaSeg, 9);
  assert.deepEqual(clasificarEnvio(502, '<html>', null), {
    ok: false, codigo: 'HTTP_502', reintentable: true, esperaSeg: undefined,
  });
});

test('horario usa la hora de Ecuador y la configuracion exige HTTPS fuera de la red privada', () => {
  const mediodia = new Date('2026-11-06T17:00:00Z');
  assert.equal(dentroDeHorario(mediodia, { desde: 10, hasta: 22 }), true);
  assert.equal(dentroDeHorario(mediodia, { desde: 13, hasta: 22 }), false);
  assert.equal(dentroDeHorario(mediodia, null), true);
  const base = { WHATSAPP_AGENT_TOKEN: 't', WHATSAPP_SESSION_ID: 's', OPENWA_API_KEY: 'k' };
  assert.throws(() => leerConfig({ ...base, POS_URL: 'http://pos.example.com' }), /HTTPS/);
  assert.equal(leerConfig({ ...base, POS_URL: 'http://192.168.1.5:3000' }).posUrl, 'http://192.168.1.5:3000');
  assert.throws(() => leerConfig({ POS_URL: 'https://x.test' }), /WHATSAPP_AGENT_TOKEN/);
});
