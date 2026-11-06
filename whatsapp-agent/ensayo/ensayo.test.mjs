import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { ciclo, clasificarEnvio, dentroDeHorario, leerConfig } from './agente.mjs';
import { ejecutar } from './ensayo.mjs';
import { crearReceptor, enmascarar, firmaValida } from './receptor.mjs';

const secreto = 'secreto-de-prueba-largo';
const firmar = (cuerpo) =>
  `sha256=${createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;

let servidor;
let base;
let directorio;

before(async () => {
  directorio = mkdtempSync(join(tmpdir(), 'receptor-'));
  servidor = crearReceptor({ secreto, directorio });
  await new Promise((listo) => servidor.listen(0, '127.0.0.1', listo));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => {
  servidor.close();
  rmSync(directorio, { recursive: true, force: true });
});

const entregar = (cuerpo, firma = firmar(cuerpo)) =>
  fetch(`${base}/webhook`, {
    method: 'POST',
    headers: { 'x-openwa-signature': firma },
    body: cuerpo,
  });

test('firmaValida acepta bytes exactos y rechaza alteraciones', () => {
  const cuerpo = Buffer.from('{"a":1}');
  assert.equal(firmaValida(cuerpo, firmar(cuerpo), secreto), true);
  assert.equal(firmaValida(Buffer.from('{"a": 1}'), firmar(cuerpo), secreto), false);
  assert.equal(firmaValida(cuerpo, undefined, secreto), false);
});

test('enmascarar oculta identidad y conserva el tipo de identificador', () => {
  const salida = enmascarar(
    '{"from":"593991234567@c.us","author":"123456789012@lid","phone":"593991234567","pushName":"Ana"}',
  );
  assert.match(salida, /593\*\*\*67@c\.us/);
  assert.match(salida, /@lid/);
  assert.doesNotMatch(salida, /593991234567|Ana/);
});

test('receptor guarda ubicacion firmada sin coordenadas alteradas', async () => {
  const cuerpo = JSON.stringify({
    event: 'message.received',
    data: { type: 'location', location: { latitude: -2.17, longitude: -79.92 } },
  });
  assert.equal((await entregar(cuerpo)).status, 200);
  const [archivo] = readdirSync(directorio);
  const guardado = JSON.parse(readFileSync(join(directorio, archivo), 'utf8'));
  assert.deepEqual(guardado.data.location, { latitude: -2.17, longitude: -79.92 });
});

test('receptor rechaza firma invalida y JSON malformado', async () => {
  assert.equal((await entregar('{}', 'sha256=mala')).status, 401);
  assert.equal((await entregar('{')).status, 400);
});

test('modo fallar responde 503 y modo normal vuelve a aceptar', async () => {
  await ejecutar(['fallar'], { RECEPTOR_URL: base });
  assert.equal((await entregar('{"event":"x"}')).status, 503);
  await ejecutar(['normal'], { RECEPTOR_URL: base });
  assert.equal((await entregar('{"event":"x"}')).status, 200);
});

test('webhook reemplaza el registro anterior y aplica filtros', async () => {
  const llamadas = [];
  const solicitar = async (url, opciones) => {
    llamadas.push({ url, ...opciones });
    const cuerpo = opciones.method ? {} : [{ id: 'anterior' }];
    return new Response(JSON.stringify(cuerpo), { status: 200 });
  };
  await ejecutar(
    ['webhook', 'sesion-1', '--filtros'],
    { OPENWA_URL: 'http://api', OPENWA_API_KEY: 'clave', WEBHOOK_SECRET: secreto },
    solicitar,
  );

  assert.equal(llamadas[1].method, 'DELETE');
  assert.equal(llamadas[1].url, 'http://api/sessions/sesion-1/webhooks/anterior');
  const registro = JSON.parse(llamadas[2].body);
  assert.equal(registro.retryCount, 5);
  assert.equal(registro.secret, secreto);
  assert.deepEqual(registro.filters.conditions, [
    { field: 'fromMe', operator: 'is', value: false },
    { field: 'isGroup', operator: 'is', value: false },
    { field: 'type', operator: 'is', value: ['text', 'location'] },
  ]);
  assert.equal(llamadas[2].headers['X-API-Key'], 'clave');
});

test('webhook puede apuntar al POS de desarrollo', async () => {
  const llamadas = [];
  const solicitar = async (url, opciones) => {
    llamadas.push(opciones);
    return new Response(opciones.method ? '{}' : '[]', { status: 200 });
  };
  await ejecutar(
    ['webhook', 'sesion-1', '--filtros', '--url', 'http://192.168.1.5:3000/api/integraciones/whatsapp/webhook'],
    { OPENWA_URL: 'http://api', WEBHOOK_SECRET: secreto },
    solicitar,
  );
  const registro = JSON.parse(llamadas.at(-1).body);
  assert.equal(registro.url, 'http://192.168.1.5:3000/api/integraciones/whatsapp/webhook');
  assert.equal(registro.filters.conditions.length, 3);
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
