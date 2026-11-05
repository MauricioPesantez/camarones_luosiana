import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as pedido from './whatsapp-pedido';
import * as webhook from './whatsapp-webhook';

function loadModule<T>(file: string, dependencies: Record<string, unknown>): T {
  const js = transpileModule(readFileSync(resolve(file), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2017 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', js)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Dependencia no simulada: ${name}`);
    return dependencies[name];
  }, loaded, loaded.exports);
  return loaded.exports as T;
}

type Fila = Record<string, unknown>;
const secreto = 's'.repeat(32);
const operador = '593991234567@c.us';
const CONFIG = {
  WHATSAPP_WEBHOOK_SECRET: secreto, WHATSAPP_SESSION_ID: 'sesion-1', WHATSAPP_OPERATOR_IDS: operador,
  WHATSAPP_OPERATOR_USER_ID: 'digital-1', WHATSAPP_ENABLED: 'true',
};

async function run() {
  let entradas: Fila[] = [];
  let salidas: Fila[] = [];
  let usuario: Fila | null = { id: 'digital-1', rol: 'digital', activo: true };
  let falloTransitorio = false;
  let bloqueos = 0;
  Object.assign(process.env, CONFIG);

  // Sin orden, cobro ni escritura de producto: tocarlos fallaría la prueba.
  const tx = {
    $executeRaw: async () => { bloqueos++; return 0; },
    usuario: { findUnique: async () => usuario },
    producto: {
      findMany: async () => [{ id: 'c1', nombre: 'Combo Duo', categoria: 'Combos', disponible: true }],
    },
    whatsappEntrada: {
      create: async ({ data }: { data: Fila }) => {
        if (falloTransitorio) throw new Error('base caida');
        if (entradas.some((e) => e.sessionId === data.sessionId && e.messageId === data.messageId)) {
          throw new Prisma.PrismaClientKnownRequestError('duplicado', { code: 'P2002', clientVersion: 'test' });
        }
        const fila = { id: `e${entradas.length + 1}`, ...data };
        entradas.push(fila);
        return fila;
      },
      updateMany: async ({ where, data }: { where: Fila; data: Fila }) => {
        entradas = entradas.map((e) => (
          e.remitente === where.remitente && e.tipo === where.tipo && e.estado === where.estado ? { ...e, ...data } : e
        ));
        return { count: 1 };
      },
      findFirst: async ({ where }: { where: { remitente: string; tipo: string; estado: string; enviadoAt: { gte: Date } } }) => (
        entradas.filter((e) => e.remitente === where.remitente && e.tipo === where.tipo && e.estado === where.estado
          && (e.enviadoAt as Date) >= where.enviadoAt.gte).at(-1) ?? null
      ),
    },
    whatsappSalida: { create: async ({ data }: { data: Fila }) => { salidas.push(data); return data; } },
  };
  const prisma = {
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => {
      const antes = { entradas: [...entradas], salidas: [...salidas] };
      try {
        return await callback(tx);
      } catch (error) {
        entradas = antes.entradas;
        salidas = antes.salidas;
        throw error;
      }
    },
  };
  const dependencias = {
    'next/server': { NextResponse: { json: Response.json } },
    '@prisma/client': { Prisma }, '@/lib/db': { prisma },
    '@/lib/whatsapp-pedido': pedido, '@/lib/whatsapp-webhook': webhook,
  };
  const ingreso = loadModule('lib/whatsapp-ingreso.ts', dependencias);
  const { POST } = loadModule<{ POST: (request: Request) => Promise<Response> }>(
    'app/api/integraciones/whatsapp/webhook/route.ts',
    { ...dependencias, '@/lib/whatsapp-ingreso': ingreso },
  );

  let siguiente = 0;
  const mensaje = (cambios: Fila = {}) => ({
    id: `m${++siguiente}`, from: operador, to: 'ejecutor@c.us', chatId: operador, body: '', type: 'text',
    timestamp: Math.floor(Date.now() / 1000), fromMe: false, isGroup: false, ...cambios,
  });
  const sobre = (data: Fila) => ({
    event: 'message.received', sessionId: 'sesion-1', timestamp: new Date().toISOString(),
    idempotencyKey: `k-${data.id}`, deliveryId: 'd1', data,
  });
  const enviarCrudo = (cuerpo: string, firma?: string) => POST(new Request('http://test.invalid/webhook', {
    method: 'POST', body: cuerpo,
    headers: { 'x-openwa-signature': firma ?? `sha256=${createHmac('sha256', secreto).update(cuerpo).digest('hex')}` },
  }));
  const enviar = (data: Fila) => enviarCrudo(JSON.stringify(sobre(data)));
  const texto = (body: string, cambios: Fila = {}) => enviar(mensaje({ body, ...cambios }));
  const pin = (cambios: Fila = {}) => enviar(mensaje({
    type: 'location', body: 'miniatura', location: { latitude: -2.17, longitude: -79.92 }, ...cambios,
  }));
  const limpiar = () => { entradas = []; salidas = []; };
  const ultima = () => entradas.at(-1) as Fila;
  const respuesta = () => String(salidas.at(-1)?.texto);

  const valido = `PEDIDO
Tipo: domicilio
Cliente: Ana
Teléfono: 0991234567
Productos:
1 x Combo Duo | natural
Pago: efectivo
Envío: 2
Ubicación: pendiente`;
  const conPin = valido.replace('Ubicación: pendiente', 'Ubicación: pin');

  // Rechazos antes de confiar en la entrada.
  assert.equal((await enviarCrudo('{}', 'sha256=mala')).status, 401);
  assert.equal((await enviarCrudo('{')).status, 400);
  assert.equal((await enviarCrudo('{"event":1}')).status, 400);
  assert.equal((await enviarCrudo('x'.repeat(webhook.MAX_CUERPO_WEBHOOK + 1))).status, 413);
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
  assert.equal((await enviarCrudo('{}')).status, 503);
  process.env.WHATSAPP_WEBHOOK_SECRET = secreto;
  assert.equal(entradas.length, 0);

  // Irrelevantes: se reconocen sin guardar nada.
  assert.equal((await texto('hola')).status, 200);
  assert.equal((await texto(valido, { from: '593000000000@c.us', chatId: '593000000000@c.us' })).status, 200);
  assert.equal((await texto(valido, { fromMe: true })).status, 200);
  assert.equal((await texto(valido, { isGroup: true, chatId: '1@g.us' })).status, 200);
  assert.deepEqual([entradas.length, salidas.length], [0, 0]);

  // Pedido inválido: terminal, con correcciones, sin reintento HTTP.
  assert.equal((await texto('PEDIDO\nTipo: domicilio')).status, 200);
  assert.equal(ultima().estado, 'INVALIDA');
  assert.equal(ultima().usuarioId, 'digital-1');
  assert.match(respuesta(), /Teléfono/);
  assert.equal(salidas.at(-1)?.tipo, 'RESPUESTA_EMPLEADO');
  assert.equal(salidas.at(-1)?.destino, operador);
  assert.equal(salidas.at(-1)?.entradaId, ultima().id);
  assert.equal(salidas.at(-1)?.clave, `respuesta:${ultima().id}`);
  assert.equal(salidas.at(-1)?.sessionId, 'sesion-1');
  await texto(valido.replace('Combo Duo', 'Pizza'));
  assert.equal(ultima().estado, 'INVALIDA');
  assert.match(respuesta(), /no encontrado.*Pizza/i);

  // Pedido válido: queda en revisión; esta fase no crea órdenes.
  limpiar();
  await texto(valido);
  assert.equal(ultima().estado, 'REQUIERE_REVISION');
  assert.equal(ultima().error, 'CREACION_PENDIENTE');
  assert.equal(ultima().requestHash, pedido.hashPedido((pedido.interpretarPlantilla(valido) as { pedido: pedido.PedidoWhatsapp }).pedido));
  assert.equal(ultima().texto, valido);
  assert.equal(ultima().claveEntrega, `k-m${siguiente}`);
  assert.deepEqual((ultima().datosNormalizados as { items: Fila[] }).items.map((i) => i.productoId), ['c1']);
  assert.match(respuesta(), /POS/);
  assert.equal(bloqueos > 0, true, 'Serializa por operador');

  // Mismo mensaje entregado otra vez: sin efectos nuevos.
  const repetido = mensaje({ body: valido });
  limpiar();
  await enviar(repetido);
  const duplicado = await enviar(repetido);
  assert.equal(duplicado.status, 200);
  assert.deepEqual([entradas.length, salidas.length], [1, 1]);

  // Fallo transitorio: nada queda guardado y el gateway puede reintentar.
  limpiar();
  falloTransitorio = true;
  const reintentable = mensaje({ body: valido });
  assert.equal((await enviar(reintentable)).status, 500);
  assert.deepEqual([entradas.length, salidas.length], [0, 0]);
  falloTransitorio = false;
  assert.equal((await enviar(reintentable)).status, 200);
  assert.equal(entradas.length, 1);

  // Usuario desactivado o con otro rol: sin datos del negocio.
  for (const cambio of [{ activo: false }, { rol: 'mesero' }]) {
    limpiar();
    usuario = { id: 'digital-1', rol: 'digital', activo: true, ...cambio };
    await texto(valido);
    assert.equal(ultima().estado, 'IGNORADA');
    assert.equal(ultima().error, 'OPERADOR_NO_AUTORIZADO');
    assert.equal(ultima().usuarioId, null);
    assert.equal(salidas.length, 0);
  }
  limpiar();
  usuario = null;
  await texto(valido);
  assert.equal(ultima().estado, 'IGNORADA');
  usuario = { id: 'digital-1', rol: 'digital', activo: true };

  // Bandera apagada: reconoce de forma durable, sin responder.
  limpiar();
  process.env.WHATSAPP_ENABLED = 'false';
  assert.equal((await texto(valido)).status, 200);
  assert.equal(ultima().estado, 'REQUIERE_REVISION');
  assert.equal(ultima().error, 'SUSPENDIDO');
  await pin();
  assert.equal(ultima().estado, 'REQUIERE_REVISION');
  assert.equal(salidas.length, 0);
  process.env.WHATSAPP_ENABLED = 'true';

  // Entrada antigua tras una desconexión.
  limpiar();
  const antigua = Math.floor(Date.now() / 1000) - 16 * 60;
  await texto(valido, { timestamp: antigua });
  assert.equal(ultima().estado, 'REQUIERE_REVISION');
  assert.equal(ultima().error, 'ENTRADA_ANTIGUA');
  assert.match(respuesta(), /revisión/);
  await pin({ timestamp: antigua });
  assert.equal(ultima().estado, 'IGNORADA');
  assert.equal(ultima().error, 'ENTRADA_ANTIGUA');
  assert.match(respuesta(), /Reenvía/);

  // Pin: conserva coordenadas, no el cuerpo; gana el último.
  limpiar();
  await pin();
  assert.equal(ultima().estado, 'UBICACION_DISPONIBLE');
  assert.equal(ultima().texto, null);
  assert.deepEqual(ultima().datosNormalizados, { latitud: -2.17, longitud: -79.92 });
  assert.equal(respuesta(), 'Ubicación recibida. Se usará en el próximo PEDIDO.');
  await pin({ location: { latitude: -2.2, longitude: -79.9 } });
  assert.deepEqual(entradas.map((e) => e.estado), ['IGNORADA', 'UBICACION_DISPONIBLE']);
  await pin({ location: { latitude: 0, longitude: 0 } });
  assert.equal(ultima().estado, 'INVALIDA');
  assert.equal(ultima().error, 'COORDENADAS_INVALIDAS');
  assert.equal(entradas[1].estado, 'UBICACION_DISPONIBLE', 'Un pin malo no borra el bueno');

  // `Ubicación: pin` exige uno vigente; un pedido inválido no lo consume.
  await texto(`${conPin}\nCampo raro`);
  assert.equal(ultima().estado, 'INVALIDA');
  await texto(conPin);
  assert.equal(ultima().estado, 'REQUIERE_REVISION');
  assert.equal(entradas[1].estado, 'UBICACION_DISPONIBLE');
  limpiar();
  await texto(conPin);
  assert.equal(ultima().estado, 'INVALIDA');
  assert.equal(ultima().error, 'SIN_PIN_VIGENTE');
  assert.match(respuesta(), /pin/i);
  entradas.push({
    id: 'viejo', tipo: 'UBICACION', remitente: operador, estado: 'UBICACION_DISPONIBLE',
    enviadoAt: new Date(Date.now() - 16 * 60 * 1000),
  });
  await texto(conPin);
  assert.equal(ultima().error, 'SIN_PIN_VIGENTE', 'Un pin vencido no sirve');

  console.log('whatsapp-ingreso tests: ok');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
