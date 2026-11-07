import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as mensajes from './whatsapp-mensajes';
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
const operador = '13000000000000@lid';
const CONFIG = {
  WHATSAPP_WEBHOOK_SECRET: secreto, WHATSAPP_SESSION_ID: 'sesion-1', WHATSAPP_OPERATOR_IDS: operador,
  WHATSAPP_OPERATOR_USER_ID: 'digital-1', WHATSAPP_ENABLED: 'true',
  WHATSAPP_GROUP_CHAT_ID: 'grupo@g.us', WHATSAPP_MOTOS_CHAT_ID: 'motos@g.us',
};

// La creación y el pin completos se prueban en PostgreSQL; aquí, la decisión y sus respuestas.
async function run() {
  let entradas: Fila[] = [];
  let salidas: Fila[] = [];
  let usuario: Fila | null = { id: 'digital-1', rol: 'digital', activo: true };
  let falloTransitorio = false;
  let bloqueos = 0;
  let ordenesCreadas = 0;
  let stockInsuficiente = false;
  let ordenDelCliente: Fila | null = null;
  Object.assign(process.env, CONFIG);

  const tx = {
    $executeRaw: async () => { bloqueos++; return 0; },
    usuario: { findUnique: async () => usuario && { nombre: 'Digital', ...usuario } },
    orden: { findFirst: async () => ordenDelCliente },
    producto: {
      findMany: async () => [{ id: 'c1', nombre: 'Combo Mixto Small', categoria: 'Combos', disponible: true }],
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
      findUnique: async ({ where }: { where: { sessionId_messageId: { messageId: string } } }) => (
        entradas.find((e) => e.messageId === where.sessionId_messageId.messageId) ?? null
      ),
      findFirst: async ({ where }: { where: { requestHash: string } }) => (
        entradas.some((e) => e.requestHash === where.requestHash && e.ordenId) ? { orden: ordenGuardada } : null
      ),
      findMany: async () => [],
    },
    whatsappSalida: { createMany: async ({ data }: { data: Fila[] }) => { salidas.push(...data); } },
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
  class OrdenInvalidaError extends Error {}
  class StockInsuficienteError extends Error {}
  const ordenGuardada = {
    id: 'orden-1', numeroDiario: 7, fechaNumeroDiario: '2026-11-04', tipoOrden: 'domicilio', estado: 'pendiente',
    anulada: false, nombreCliente: 'Ana', telefonoCliente: '+593990000000', ubicacionUrl: null, referenciaEntrega: null,
    observaciones: null, total: 10, metodoPagoPrevisto: 'efectivo', cobrada: false, mesero: 'Digital', items: [],
  };
  const dependencias = {
    '@/lib/order-creation': {
      OrdenInvalidaError, StockInsuficienteError,
      notificarNuevaOrden: () => { throw new Error('sse caido'); },
      prepararOrden: async () => {
        if (stockInsuficiente) throw new StockInsuficienteError('Stock insuficiente: Combo Mixto Small (pedido 1, disponible 0)');
        return {};
      },
      registrarOrden: async () => { ordenesCreadas++; return { orden: ordenGuardada, printJobQueued: true }; },
    },
    '@/lib/whatsapp-mensajes': mensajes,
    '@/lib/whatsapp-salidas': {
      avisoDeDelivery: () => null,
      salidasDeOrdenAceptada: (orden: { id: string }) => [{ tipo: 'PUBLICACION_GRUPO', clave: `publicacion:${orden.id}` }],
    },
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

  const valido = 'Domiclio\n+593 99 000 0000\ncombo mixto small\npicante 1\nefectivo $2';

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
  assert.equal((await texto(valido, { from: '593000000000@c.us', chatId: '593000000000@c.us' })).status, 200);
  assert.equal((await texto(valido, { fromMe: true })).status, 200);
  assert.equal((await texto(valido, { isGroup: true, chatId: '1@g.us' })).status, 200);
  assert.deepEqual([entradas.length, salidas.length], [0, 0]);

  // Pedido inválido: no crea nada y responde qué corregir, sin reintento HTTP.
  assert.equal((await texto('Domiclio\ncombo mixto small')).status, 200);
  assert.equal(ultima().estado, 'INVALIDA');
  assert.equal(ultima().usuarioId, 'digital-1');
  assert.match(respuesta(), /^Pedido no registrado\. Corrige:/);
  assert.match(respuesta(), /Teléfono/);
  assert.equal(salidas.at(-1)?.tipo, 'RESPUESTA_EMPLEADO');
  assert.equal(salidas.at(-1)?.destino, operador);
  assert.equal(salidas.at(-1)?.entradaId, ultima().id);
  assert.equal(salidas.at(-1)?.clave, `respuesta:${ultima().id}`);
  assert.equal(salidas.at(-1)?.sessionId, 'sesion-1');
  await texto(`${valido}\nPizza`);
  assert.equal(ultima().estado, 'INVALIDA');
  assert.match(respuesta(), /no encontrado.*Pizza/i);
  await texto('hola');
  assert.match(respuesta(), /primera línea/);
  await texto(valido.replace('picante 1\n', ''));
  assert.match(respuesta(), /Falta picante/);
  assert.equal(ordenesCreadas, 0);

  // Pedido válido: crea, enlaza la entrada y guarda sus salidas.
  limpiar();
  await texto(valido);
  assert.equal(ultima().estado, 'CREADA');
  assert.equal(ultima().ordenId, 'orden-1');
  assert.equal(ordenesCreadas, 1);
  assert.deepEqual(salidas.map((s) => s.tipo), ['PUBLICACION_GRUPO', 'RESPUESTA_EMPLEADO']);
  assert.equal(salidas[0].entradaId, ultima().id);
  const interpretado = pedido.interpretarPedido(valido) as { pedido: pedido.PedidoWhatsapp };
  assert.equal(ultima().requestHash, pedido.hashPedido(interpretado.pedido));
  assert.equal(ultima().texto, valido);
  assert.equal(ultima().claveEntrega, `k-m${siguiente}`);
  assert.deepEqual((ultima().datosNormalizados as { items: Fila[] }).items.map((i) => i.productoId), ['c1']);
  assert.match(respuesta(), /Orden #7 registrada/);
  assert.equal(bloqueos > 0, true, 'Serializa por operador');

  // El mismo contenido en otro mensaje devuelve la orden existente, sin crear otra.
  await texto(valido);
  assert.equal(ordenesCreadas, 1);
  assert.equal(ultima().estado, 'IGNORADA');
  assert.equal(ultima().error, 'REENVIO');
  assert.match(respuesta(), /ya está registrado/);

  // Otro contenido del mismo cliente: conflicto visible hasta confirmar.
  limpiar();
  ordenDelCliente = { numeroDiario: 7, fechaNumeroDiario: '2026-11-04' };
  await texto(valido);
  assert.equal(ultima().error, 'CONFLICTO_CLIENTE');
  assert.equal(ordenesCreadas, 1);
  assert.match(respuesta(), /Nuevo pedido/);
  await texto(`${valido}\nNuevo pedido`);
  assert.equal(ultima().estado, 'CREADA');
  ordenDelCliente = null;

  // Falta de stock: rechazo definitivo, no error reintentable.
  limpiar();
  stockInsuficiente = true;
  assert.equal((await texto(valido)).status, 200);
  assert.equal(ultima().estado, 'INVALIDA');
  assert.match(respuesta(), /Combo Mixto Small/);
  stockInsuficiente = false;

  // Mismo mensaje entregado otra vez: sin efectos nuevos.
  const repetido = mensaje({ body: valido });
  limpiar();
  await enviar(repetido);
  assert.equal((await enviar(repetido)).status, 200);
  assert.deepEqual([entradas.length, salidas.length], [1, 2]);

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
  assert.match(respuesta(), /POS/);

  // Pin: no guarda el cuerpo y explica por qué no se usó.
  limpiar();
  await pin();
  assert.equal(ultima().estado, 'IGNORADA');
  assert.equal(ultima().error, 'SIN_ORDEN_PENDIENTE');
  assert.equal(ultima().texto, null);
  assert.match(respuesta(), /después del pedido/);
  await pin({ location: { latitude: 0, longitude: 0 } });
  assert.equal(ultima().estado, 'INVALIDA');
  assert.equal(ultima().error, 'COORDENADAS_INVALIDAS');
  assert.match(respuesta(), /Reenvía el pin/);

  console.log('whatsapp-ingreso tests: ok');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
