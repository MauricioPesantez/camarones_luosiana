import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

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
  assert.equal(registro.filters.conditions.length, 2);
  assert.equal(llamadas[2].headers['X-API-Key'], 'clave');
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
