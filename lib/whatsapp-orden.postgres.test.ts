/* Integration tests require an explicitly isolated PostgreSQL database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as dailyNumber from './daily-order-number';
import * as location from './delivery-location';
import * as printAgentAuth from './print-agent-auth';
import * as printAgentJobs from './print-agent-jobs';
import * as agente from './whatsapp-agente';
import * as mensajes from './whatsapp-mensajes';
import * as pedido from './whatsapp-pedido';
import * as printConfig from './print-config';
import * as printJobs from './print-jobs';
import * as productSelect from './product-select';
import * as webhook from './whatsapp-webhook';
import * as cajaTypes from '../types/caja';
import * as cobroTypes from '../types/cobro';
import * as ordenTypes from '../types/orden';

const testUrl = process.env.EMPLOYEE_TEST_DATABASE_URL;
if (!testUrl) throw new Error('Defina EMPLOYEE_TEST_DATABASE_URL para una base PostgreSQL de pruebas; no se usa DATABASE_URL.');
const url = new URL(testUrl);
if (!/^postgres(ql)?:$/.test(url.protocol) || !/test/i.test(url.pathname) || testUrl === process.env.DATABASE_URL) {
  throw new Error('EMPLOYEE_TEST_DATABASE_URL debe identificar una base de pruebas distinta de DATABASE_URL.');
}
const schema = `whatsapp_test_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('schema', schema);
url.searchParams.set('connection_limit', '10');
// Neon usa GMT; el SQL crudo compara columnas sin zona.
url.searchParams.set('options', '-c timezone=UTC');
const isolatedUrl = url.toString();
const prisma = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });

process.env.PRINT_QUEUE_ENABLED = 'true';
process.env.DIRECT_PRINT_ENABLED = 'false';
delete process.env.PRINT_CUTOVER_AT;
delete process.env.NEXT_PUBLIC_APP_URL;
process.env.WHATSAPP_WEBHOOK_SECRET = 's'.repeat(32);
process.env.WHATSAPP_SESSION_ID = 'sesion';
process.env.WHATSAPP_OPERATOR_IDS = 'operador@c.us';
process.env.WHATSAPP_OPERATOR_USER_ID = 'digital';
process.env.WHATSAPP_GROUP_CHAT_ID = 'grupo@g.us';
process.env.WHATSAPP_LOCAL_CHAT_ID = 'local@c.us';
process.env.WHATSAPP_ENABLED = 'true';
process.env.WHATSAPP_AGENT_TOKEN = 'w'.repeat(32);
process.env.PRINT_AGENT_TOKEN = 'p'.repeat(32);

const requireFromHere = createRequire(__filename);
function load<T>(file: string, dependencies: Record<string, unknown>): T {
  const source = transpileModule(readFileSync(resolve(file), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (name: string) => name in dependencies ? dependencies[name] : requireFromHere(name), loaded, loaded.exports,
  );
  return loaded.exports as T;
}

const eventos: string[] = [];
const deps: Record<string, unknown> = {
  'server-only': {}, '@prisma/client': { Prisma }, '@/lib/db': { prisma }, '@/lib/product-select': productSelect,
  '@/lib/printer': { PrinterService: class { constructor() { throw new Error('WhatsApp no imprime directo'); } } },
  '@/lib/sse': { notificarClientes: (evento: string) => { eventos.push(evento); } },
  '@/lib/print-jobs': printJobs, '@/lib/print-config': printConfig, '@/lib/daily-order-number': dailyNumber,
  '@/lib/payment-link': load('lib/payment-link.ts', {}), '@/lib/delivery-location': location,
  '@/lib/caja': { bloquearCajaAbierta: async () => {}, exigirCajaAbierta: async () => {} },
  '@/types/caja': cajaTypes, '@/types/cobro': cobroTypes, '@/types/orden': ordenTypes,
  '@/lib/whatsapp-mensajes': mensajes, '@/lib/whatsapp-pedido': pedido, '@/lib/whatsapp-webhook': webhook,
};
const creacion = load<typeof import('./order-creation')>('lib/order-creation.ts', deps);
deps['@/lib/order-creation'] = creacion;
const salidas = load<typeof import('./whatsapp-salidas')>('lib/whatsapp-salidas.ts', deps);
deps['@/lib/whatsapp-salidas'] = salidas;
const ingreso = load<typeof import('./whatsapp-ingreso')>('lib/whatsapp-ingreso.ts', deps);
const config = webhook.leerConfiguracion(process.env)!;
const admin = { id: 'admin', nombre: 'Admin', rol: 'admin' };
const rutasDeps = { ...deps, 'next/server': { NextResponse: { json: Response.json } },
  '@/lib/session': { getAuthenticatedUser: async () => admin } };
type RutaPost = { POST: (request: never) => Promise<Response> };
const aprobar = load<RutaPost>('app/api/ordenes/aprobacion/aprobar/route.ts', rutasDeps);
const rechazar = load<RutaPost>('app/api/ordenes/aprobacion/rechazar/route.ts', rutasDeps);
const pedirRuta = (ruta: RutaPost, body: object) => ruta.POST(new Request('http://test.invalid', {
  method: 'POST', body: JSON.stringify(body),
}) as never);

let secuencia = 0;
const mensaje = (texto: string | null, extra: Partial<webhook.MensajeEntrante> = {}): webhook.MensajeEntrante => ({
  tipo: texto === null ? 'UBICACION' : 'PEDIDO', sessionId: 'sesion', messageId: `m${++secuencia}`, claveEntrega: null,
  remitente: 'operador@c.us', chatId: 'operador@c.us', enviadoAt: new Date(), texto, location: undefined, ...extra,
});
const procesar = (m: webhook.MensajeEntrante, ahora?: Date) => ingreso.procesarMensaje(m, config, 'http://test.invalid/webhook', ahora);
const pinMensaje = (latitude = -2.17, longitude = -79.92) => mensaje(null, { location: { latitude, longitude } });

let nombreUnico = 0;
const plantilla = (cliente: string, cambios: string[] = [], producto = 'Combo Duo') => [
  'Domiclio', `Cliente: ${cliente}`, `09${String(++nombreUnico).padStart(8, '0')}`,
  `${producto} natural`, 'efectivo $2', ...cambios,
].join('\n');
const llevar = (cliente: string, cambios: string[] = []) => [
  `Para retirar ${cliente}`, 'Combo Duo leve', ...cambios,
].join('\n');

async function reiniciar(stock = 100) {
  await prisma.whatsappSalida.deleteMany();
  await prisma.whatsappEntrada.deleteMany();
  await prisma.cobro.deleteMany();
  await prisma.printJob.deleteMany();
  await prisma.orden.deleteMany();
  await prisma.producto.updateMany({ data: { stock } });
}
const stockActual = async () => (await prisma.producto.findFirstOrThrow({ where: { nombre: 'Combo Duo' } })).stock;
const salidasDe = (ordenId: string) => prisma.whatsappSalida.findMany({ where: { ordenId }, orderBy: { tipo: 'asc' } });

async function pruebas() {
  await prisma.usuario.createMany({ data: [
    { id: 'digital', nombre: 'Digital', rol: 'digital' }, { id: 'admin', nombre: 'Admin', rol: 'admin' },
  ] });
  await prisma.producto.create({ data: { nombre: 'Combo Duo', categoria: 'Combos', precio: '10', stock: 100 } });

  // Domicilio en efectivo: venta, stock, cola, aviso y publicación en una transacción.
  await reiniciar(10);
  const ahora = new Date();
  assert.equal(await procesar(mensaje(plantilla('Ana')), ahora), 'procesado');
  const efectivo = await prisma.orden.findFirstOrThrow({ include: { printJobs: true, whatsappEntradas: true } });
  assert.equal(efectivo.estado, 'pendiente');
  assert.equal(efectivo.creadorId, 'digital');
  assert.equal(efectivo.cobrada, false);
  assert.equal(Number(efectivo.total), 13.25);
  assert.equal(await stockActual(), 9);
  assert.equal(efectivo.printJobs.length, 1);
  assert.equal(efectivo.whatsappEntradas[0].estado, 'CREADA');
  assert.ok(efectivo.whatsappEntradas[0].requestHash);
  const [grupo, recordatorio, respuesta] = await salidasDe(efectivo.id);
  assert.deepEqual([grupo.tipo, grupo.destino], ['PUBLICACION_GRUPO', 'grupo@g.us']);
  assert.deepEqual([recordatorio.tipo, recordatorio.destino], ['RECORDATORIO_DELIVERY', 'local@c.us']);
  assert.equal(recordatorio.disponibleAt.getTime(), ahora.getTime() + 10 * 60 * 1000);
  assert.equal(recordatorio.venceAt?.getTime(), ahora.getTime() + 40 * 60 * 1000);

  // La línea moto define la espera del aviso; sin ella se usan diez minutos.
  await reiniciar(10);
  await procesar(mensaje(plantilla('Moto', ['moto 25'])), ahora);
  const conMoto = await prisma.orden.findFirstOrThrow();
  const avisoMoto = (await salidasDe(conMoto.id)).find((s) => s.tipo === 'RECORDATORIO_DELIVERY');
  assert.equal(avisoMoto?.disponibleAt.getTime(), ahora.getTime() + 25 * 60 * 1000);
  assert.equal(avisoMoto?.venceAt?.getTime(), ahora.getTime() + 55 * 60 * 1000);
  assert.deepEqual([respuesta.tipo, respuesta.destino], ['RESPUESTA_EMPLEADO', 'operador@c.us']);
  assert.match(grupo.texto, /Total: \$13\.25/);
  assert.match(respuesta.texto, /Impresión: en cola/);
  assert.deepEqual(eventos.at(-1), 'nueva-orden');

  // Transferencia confirmada: un cobro; sigue elegible para el recordatorio.
  await reiniciar();
  await procesar(mensaje(plantilla('Ana').replace('efectivo $2', 'trans $2')));
  const pagada = await prisma.orden.findFirstOrThrow({ include: { pagos: true } });
  assert.equal(pagada.cobrada, true);
  assert.equal(pagada.pagos.length, 1);
  assert.equal((await salidasDe(pagada.id)).length, 3);

  // Para llevar: sin recordatorio.
  await reiniciar();
  await procesar(mensaje(llevar('Luis')));
  const paraLlevar = await prisma.orden.findFirstOrThrow();
  assert.deepEqual((await salidasDe(paraLlevar.id)).map((s) => s.tipo), ['PUBLICACION_GRUPO', 'RESPUESTA_EMPLEADO']);
  assert.equal(paraLlevar.cobrada, false);

  // Para llevar ya pagado: cobro registrado, sin envío ni recordatorio.
  await reiniciar();
  await procesar(mensaje(llevar('Paga', ['trans'])));
  const retiroPagado = await prisma.orden.findFirstOrThrow({ include: { pagos: true } });
  assert.equal(retiroPagado.cobrada, true);
  assert.equal(retiroPagado.pagos.length, 1);
  assert.equal(retiroPagado.costoEnvio, null);
  assert.deepEqual((await salidasDe(retiroPagado.id)).map((s) => s.tipo), ['PUBLICACION_GRUPO', 'RESPUESTA_EMPLEADO']);

  // Pin como siguiente mensaje: completa la orden, avisa al grupo y actualiza el recordatorio.
  await reiniciar();
  await procesar(mensaje(plantilla('Pin')));
  const sinPin = await prisma.orden.findFirstOrThrow();
  assert.equal(sinPin.ubicacionUrl, null);
  assert.match((await prisma.whatsappSalida.findFirstOrThrow({ where: { tipo: 'RESPUESTA_EMPLEADO' } })).texto, /Complétala desde el POS/);
  await procesar(pinMensaje(-2.2, -79.8));
  const enlace = 'https://www.google.com/maps?q=-2.2,-79.8';
  assert.equal((await prisma.orden.findFirstOrThrow()).ubicacionUrl, enlace);
  const usada = await prisma.whatsappEntrada.findFirstOrThrow({ where: { tipo: 'UBICACION' } });
  assert.deepEqual([usada.estado, usada.ordenId], ['UBICACION_USADA', sinPin.id]);
  const auditoria = await prisma.historialOrden.findFirstOrThrow({ where: { tipoAccion: 'ubicacion_actualizada' } });
  assert.equal(auditoria.usuarioNombre, 'Digital');
  const avisos = await salidasDe(sinPin.id);
  assert.ok(avisos.some((s) => s.tipo === 'ACTUALIZACION_GRUPO' && s.destino === 'grupo@g.us' && s.texto.includes(enlace)));
  assert.ok(avisos.some((s) => s.tipo === 'RECORDATORIO_DELIVERY' && s.texto.includes(enlace)));
  assert.ok(avisos.some((s) => s.tipo === 'RESPUESTA_EMPLEADO' && /Ubicación guardada/.test(s.texto)));

  // Sin orden pendiente: no queda esperando al pedido siguiente.
  await procesar(pinMensaje());
  assert.equal((await prisma.orden.findFirstOrThrow()).ubicacionUrl, enlace);
  assert.equal(await prisma.whatsappEntrada.count({ where: { error: 'SIN_ORDEN_PENDIENTE' } }), 1);
  await procesar(mensaje(plantilla('Siguiente')));
  assert.equal((await prisma.orden.findFirstOrThrow({ where: { nombreCliente: 'Siguiente' } })).ubicacionUrl, null);

  // Dos órdenes sin ubicación: no adivina cuál es.
  await procesar(mensaje(plantilla('Otra')));
  await procesar(pinMensaje());
  assert.equal(await prisma.orden.count({ where: { ubicacionUrl: null } }), 2);
  assert.equal(await prisma.whatsappEntrada.count({ where: { error: 'ORDEN_AMBIGUA' } }), 1);

  // Mismo mensaje entregado cinco veces a la vez.
  await reiniciar();
  const repetido = mensaje(plantilla('Carrera'));
  const entregas = await Promise.all(Array.from({ length: 5 }, () => procesar(repetido)));
  assert.equal(entregas.filter((r) => r === 'procesado').length, 1);
  assert.equal(await prisma.orden.count(), 1);
  assert.equal(await stockActual(), 99);
  assert.equal(await prisma.whatsappEntrada.count(), 1);

  // Pérdida de respuesta: el gateway reintenta tras el commit.
  assert.equal(await procesar(repetido), 'duplicado');
  assert.equal(await prisma.orden.count(), 1);

  // Mismo contenido con mensajes distintos a la vez.
  await reiniciar();
  const texto = plantilla('Reenvio');
  await Promise.all(Array.from({ length: 5 }, () => procesar(mensaje(texto))));
  assert.equal(await prisma.orden.count(), 1);
  assert.equal(await stockActual(), 99);
  const reenvios = await prisma.whatsappEntrada.findMany({ where: { error: 'REENVIO' } });
  assert.equal(reenvios.length, 4);
  assert.ok(reenvios.every((e) => e.estado === 'IGNORADA' && e.ordenId));
  assert.match((await prisma.whatsappSalida.findFirstOrThrow({ where: { entradaId: reenvios[0].id } })).texto, /ya está registrado/);

  // El reenvío se reconoce aunque el catálogo y el stock hayan cambiado.
  await prisma.producto.updateMany({ data: { stock: 0, disponible: false } });
  await procesar(mensaje(texto));
  assert.equal(await prisma.orden.count(), 1);
  await prisma.producto.updateMany({ data: { disponible: true } });

  // Mismo cliente, otro contenido: conflicto hasta confirmar con `Nuevo pedido`.
  await reiniciar();
  await procesar(mensaje(llevar('Marta')));
  await procesar(mensaje(llevar('MARTA', ['(sin hielo)'])));
  assert.equal(await prisma.orden.count(), 1);
  assert.equal((await prisma.whatsappEntrada.findFirstOrThrow({ where: { error: { startsWith: 'CONFLICTO' } } })).estado, 'INVALIDA');
  const segundo = llevar('Marta', ['(sin hielo)', 'Nuevo pedido']);
  await procesar(mensaje(segundo));
  await procesar(mensaje(segundo));
  assert.equal(await prisma.orden.count(), 2, 'Reenviar el segundo no crea un tercero');

  // El teléfono de una orden manual coincide aunque esté en formato local.
  await reiniciar();
  await prisma.orden.create({ data: {
    tipoOrden: 'domicilio', telefonoCliente: '0991112222', mesero: 'Web', creadorId: 'digital', total: 5,
  } });
  await procesar(mensaje(plantilla('Web').replace(/09\d{8}/, '+593991112222')));
  assert.equal(await prisma.orden.count(), 1);

  // Última unidad entre WhatsApp y web: una venta, stock nunca negativo.
  await reiniciar(1);
  const actor = { id: 'digital', nombre: 'Digital', rol: 'digital' };
  const combo = await prisma.producto.findFirstOrThrow({ where: { nombre: 'Combo Duo' } });
  const web = creacion.crearOrden(actor, {
    tipoOrden: 'para_llevar', nombreCliente: 'Web', mesero: 'x',
    items: [{ productoId: combo.id, cantidad: 1, precioUnitario: 0, nivelPicante: 'natural' }],
  }, 'http://test.invalid/api');
  const carrera = await Promise.allSettled([web, procesar(mensaje(llevar('Whats')))]);
  assert.equal(await prisma.orden.count(), 1);
  assert.equal(await stockActual(), 0);
  const fallo = carrera.find((r) => r.status === 'rejected');
  if (fallo?.status === 'rejected') {
    assert.ok(fallo.reason instanceof creacion.StockConflictError || fallo.reason instanceof creacion.StockInsuficienteError);
  }

  // Sin stock: rechazo definitivo con el producto, sin reintento.
  await reiniciar(0);
  assert.equal(await procesar(mensaje(llevar('Sin stock'))), 'procesado');
  const sinStock = await prisma.whatsappEntrada.findFirstOrThrow();
  assert.equal(sinStock.estado, 'INVALIDA');
  assert.match((await prisma.whatsappSalida.findFirstOrThrow()).texto, /Combo Duo/);
  assert.equal(await prisma.orden.count(), 0);

  // Rollback: si falla una salida no queda orden, stock, cobro, número ni pin usado.
  await reiniciar(5);
  const contador = await prisma.contadorOrdenDiaria.findFirst();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION "${schema}".falla() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'salida rota'; END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER falla_salida BEFORE INSERT ON "${schema}"."WhatsappSalida" FOR EACH ROW EXECUTE FUNCTION "${schema}".falla()`);
  const roto = mensaje(plantilla('Rollback').replace('efectivo $2', 'trans $2'));
  await assert.rejects(procesar(roto), /salida rota/);
  await prisma.$executeRawUnsafe(`DROP TRIGGER falla_salida ON "${schema}"."WhatsappSalida"`);
  assert.equal(await prisma.orden.count(), 0);
  assert.equal(await prisma.cobro.count(), 0);
  assert.equal(await stockActual(), 5);
  assert.equal((await prisma.contadorOrdenDiaria.findFirst())?.ultimoNumero, contador?.ultimoNumero);
  assert.equal(await prisma.whatsappEntrada.count({ where: { tipo: 'PEDIDO' } }), 0);
  assert.equal(await procesar(roto), 'procesado', 'El reintento del gateway completa la venta');
  assert.equal(await prisma.orden.count(), 1);

  // Sin stock con aprobación: sin comanda ni aviso hasta aprobar, y una sola vez.
  await reiniciar(0);
  await procesar(mensaje(plantilla('Aprobar', ['Solicitar aprobacion', 'moto 25'])));
  const pendiente = await prisma.orden.findFirstOrThrow();
  assert.equal(pendiente.estado, 'pendiente_aprobacion_stock');
  assert.deepEqual((await salidasDe(pendiente.id)).map((s) => s.tipo), ['RESPUESTA_EMPLEADO']);
  assert.match((await salidasDe(pendiente.id))[0].texto, /pendiente de aprobación/);
  const inicio = Date.now();
  assert.equal((await pedirRuta(aprobar, { ordenId: pendiente.id })).status, 200);
  assert.equal((await pedirRuta(aprobar, { ordenId: pendiente.id })).status, 400, 'No se aprueba dos veces');
  const aprobadas = await salidasDe(pendiente.id);
  assert.deepEqual(aprobadas.map((s) => s.tipo), ['PUBLICACION_GRUPO', 'RECORDATORIO_DELIVERY', 'RESPUESTA_EMPLEADO', 'RESPUESTA_EMPLEADO']);
  assert.ok(aprobadas[1].disponibleAt.getTime() >= inicio + 25 * 60 * 1000 - 1000, 'La espera cuenta desde la aprobación');
  assert.match(aprobadas[0].texto, /ORDEN #/);

  // Rechazo: avisa al empleado y conserva el tratamiento financiero.
  await reiniciar(0);
  await procesar(mensaje(plantilla('Rechazar', ['Solicitar aprobacion']).replace('efectivo $2', 'trans $2')));
  const porRechazar = await prisma.orden.findFirstOrThrow();
  assert.equal((await pedirRuta(rechazar, { ordenId: porRechazar.id, razon: 'sin mariscos' })).status, 200);
  const rechazo = await salidasDe(porRechazar.id);
  assert.equal(rechazo.length, 2);
  assert.ok(rechazo.some((s) => /rechazada/.test(s.texto) && /sin mariscos/.test(s.texto)));
  assert.ok(rechazo.every((s) => s.tipo === 'RESPUESTA_EMPLEADO'));
  assert.equal((await prisma.cobro.findFirstOrThrow()).estado, 'REEMBOLSO_PENDIENTE');

  // Una orden manual aprobada no genera salidas de WhatsApp.
  await reiniciar(0);
  const manual = await creacion.crearOrden(actor, {
    tipoOrden: 'domicilio', telefonoCliente: '0990000000', costoEnvio: 1, metodoPagoPrevisto: 'efectivo',
    solicitarAprobacion: true, mesero: 'x',
    items: [{ productoId: combo.id, cantidad: 1, precioUnitario: 0, nivelPicante: 'natural' }],
  }, 'http://test.invalid/api');
  assert.equal((await pedirRuta(aprobar, { ordenId: manual.orden.id })).status, 200);
  assert.equal(await prisma.whatsappSalida.count(), 0);

  // Agente: reserva atómica, token por intento y recuperación.
  await reiniciar();
  const crearSalida = (clave: string, extra: Partial<Prisma.WhatsappSalidaUncheckedCreateInput> = {}) =>
    prisma.whatsappSalida.create({ data: {
      sessionId: 'sesion', tipo: 'RESPUESTA_EMPLEADO', destino: 'operador@c.us', texto: `texto ${clave}`, clave,
      disponibleAt: new Date(t0.getTime() - 1000), ...extra,
    } });
  const salidaDe = (id: string) => prisma.whatsappSalida.findUniqueOrThrow({ where: { id } });
  const cliente = prisma as unknown as PrismaClient;
  const t0 = new Date();

  const unica = await crearSalida('unica');
  const reservas = await Promise.all([1, 2, 3].map(() => agente.reservarSalida(cliente, 'sesion', t0)));
  assert.equal(reservas.filter(Boolean).length, 1, 'Solo un consumidor reserva la salida');
  assert.equal(await agente.reservarSalida(cliente, 'otra-sesion', t0), null);

  // Caída tras enviar: la reserva vence, repite clave y texto, y el token anterior ya no sirve.
  const primera = reservas.find(Boolean)!;
  const t1 = new Date(t0.getTime() + 61_000);
  const segunda = (await agente.reservarSalida(cliente, 'sesion', t1))!;
  assert.deepEqual([segunda.id, segunda.clave, segunda.texto], [unica.id, primera.clave, primera.texto]);
  assert.notEqual(segunda.reservaToken, primera.reservaToken);
  assert.equal(await agente.completarSalida(cliente, unica.id, primera.reservaToken!, 'viejo'), false);
  assert.equal(await agente.fallarSalida(cliente, unica.id, primera.reservaToken!, { codigo: 'X', reintentable: true }), false);
  assert.equal(await agente.completarSalida(cliente, unica.id, segunda.reservaToken!, 'm1'), true);
  assert.equal(await agente.completarSalida(cliente, unica.id, segunda.reservaToken!, 'm2'), false);
  const enviada = await salidaDe(unica.id);
  assert.deepEqual([enviada.estado, enviada.mensajeId, enviada.reservaToken, enviada.intentos], ['ENVIADA', 'm1', null, 2]);

  // Fallos: espera informada, duda a revisión e intentos agotados.
  await prisma.whatsappSalida.deleteMany();
  const limitada = await crearSalida('limitada');
  const tomada = (await agente.reservarSalida(cliente, 'sesion', t0))!;
  await agente.fallarSalida(cliente, limitada.id, tomada.reservaToken!, { codigo: 'rate limit', reintentable: true, esperaSeg: 90 }, t0);
  const enEspera = await salidaDe(limitada.id);
  assert.deepEqual([enEspera.estado, enEspera.ultimoError], ['REINTENTO', 'RATE_LIMIT']);
  assert.equal(enEspera.disponibleAt.getTime(), t0.getTime() + 90_000);
  assert.equal(await agente.reservarSalida(cliente, 'sesion', t0), null, 'Respeta la espera');
  const otraVez = (await agente.reservarSalida(cliente, 'sesion', new Date(t0.getTime() + 91_000)))!;
  await agente.fallarSalida(cliente, limitada.id, otraVez.reservaToken!, { codigo: 'IDEMPOTENCY_OUTCOME_UNKNOWN', reintentable: false }, t0);
  assert.equal((await salidaDe(limitada.id)).estado, 'REQUIERE_REVISION');
  assert.equal(await agente.reservarSalida(cliente, 'sesion', new Date(t0.getTime() + 600_000)), null, 'Una duda no se reintenta');

  const agotada = await crearSalida('agotada', { intentos: 6, estado: 'REINTENTO' });
  await agente.reservarSalida(cliente, 'sesion', t0);
  assert.deepEqual([(await salidaDe(agotada.id)).estado, (await salidaDe(agotada.id)).ultimoError], ['REQUIERE_REVISION', 'INTENTOS_AGOTADOS']);

  // Vencimiento: lo antiguo va a revisión; un recordatorio futuro sigue programado.
  await prisma.whatsappSalida.deleteMany();
  const antigua = await crearSalida('antigua', { createdAt: new Date(t0.getTime() - 31 * 60_000) });
  const recordatorioVencido = await crearSalida('rec-vencido', { tipo: 'RECORDATORIO_DELIVERY', venceAt: new Date(t0.getTime() - 1000) });
  const programado = await crearSalida('rec-futuro', {
    tipo: 'RECORDATORIO_DELIVERY', createdAt: new Date(t0.getTime() - 45 * 60_000),
    disponibleAt: new Date(t0.getTime() + 60_000), venceAt: new Date(t0.getTime() + 1_800_000),
  });
  assert.equal(await agente.reservarSalida(cliente, 'sesion', t0), null);
  assert.equal((await salidaDe(antigua.id)).ultimoError, 'VENCIDA');
  assert.equal((await salidaDe(recordatorioVencido.id)).estado, 'REQUIERE_REVISION');
  assert.equal((await salidaDe(programado.id)).estado, 'PENDIENTE');

  // Orden causal: la corrección espera su publicación, sin detener otra orden.
  await prisma.whatsappSalida.deleteMany();
  await procesar(mensaje(plantilla('Causal A')));
  const ordenA = await prisma.orden.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
  await prisma.whatsappSalida.deleteMany();
  const publicacion = await crearSalida('pub-a', { ordenId: ordenA.id, tipo: 'PUBLICACION_GRUPO', destino: 'grupo@g.us', disponibleAt: new Date(t0.getTime() + 60_000) });
  const correccion = await crearSalida('act-a', { ordenId: ordenA.id, tipo: 'ACTUALIZACION_GRUPO', destino: 'grupo@g.us', createdAt: new Date(publicacion.createdAt.getTime() + 1000), disponibleAt: new Date(t0.getTime() - 1000) });
  const libre = await crearSalida('libre', { disponibleAt: new Date(t0.getTime() - 500) });
  const reservaLibre = (await agente.reservarSalida(cliente, 'sesion', t0))!;
  assert.equal(reservaLibre.id, libre.id);
  await agente.completarSalida(cliente, libre.id, reservaLibre.reservaToken!, 'm');
  assert.equal(await agente.reservarSalida(cliente, 'sesion', t0), null, 'La corrección no adelanta a su publicación');
  const t2 = new Date(t0.getTime() + 61_000);
  const pub = (await agente.reservarSalida(cliente, 'sesion', t2))!;
  assert.equal(pub.id, publicacion.id);
  await agente.completarSalida(cliente, pub.id, pub.reservaToken!, 'm');
  assert.equal((await agente.reservarSalida(cliente, 'sesion', t2))?.id, correccion.id);

  // Fase 6: pedir delivery o anular cancela el aviso; reservar relee la elegibilidad.
  type RutaPatch = { PATCH: (request: never, contexto: never) => Promise<Response> };
  const parchear = (ruta: RutaPatch, id: string, body: object) => ruta.PATCH(
    new Request('http://test.invalid', { method: 'PATCH', body: JSON.stringify(body) }) as never,
    { params: Promise.resolve({ id }) } as never,
  );
  const delivery = load<RutaPatch>('app/api/ordenes/[id]/delivery/route.ts', rutasDeps);
  const anular = load<RutaPatch>('app/api/ordenes/[id]/anular/route.ts', {
    ...rutasDeps, '@/lib/ordenes-anulacion': requireFromHere('./ordenes-anulacion'),
  });
  const ubicacion = load<RutaPatch>('app/api/ordenes/[id]/ubicacion/route.ts', {
    ...rutasDeps, '@/lib/order-payment': { canUserModifyOrder: () => true },
  });
  const revisionRuta = load<RutaPost & { GET: () => Promise<Response> }>('app/api/admin/whatsapp/route.ts', rutasDeps);
  const ordenNueva = async (cliente: string) => {
    await procesar(mensaje(plantilla(cliente)));
    return prisma.orden.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
  };
  const deTipo = async (ordenId: string, tipo: string) => (await salidasDe(ordenId)).filter((s) => s.tipo === tipo);
  const publicar = (ordenId: string) => prisma.whatsappSalida.updateMany({
    where: { ordenId, tipo: 'PUBLICACION_GRUPO' }, data: { estado: 'ENVIADA', intentos: 1 },
  });

  await reiniciar();
  const conDelivery = await ordenNueva('Delivery');
  assert.equal((await parchear(delivery, conDelivery.id, { accion: 'solicitar' })).status, 200);
  assert.equal((await parchear(delivery, conDelivery.id, { accion: 'solicitar' })).status, 200, 'Repetir no falla');
  const [avisoCancelado] = await deTipo(conDelivery.id, 'RECORDATORIO_DELIVERY');
  assert.deepEqual([avisoCancelado.estado, avisoCancelado.ultimoError], ['CANCELADA', 'DELIVERY_SOLICITADO']);
  assert.equal(await prisma.historialOrden.count({ where: { ordenId: conDelivery.id, tipoAccion: 'delivery_solicitado' } }), 1);

  // Una marca hecha por otra vía también detiene el aviso al reservar.
  await reiniciar();
  const porFuera = await ordenNueva('Por fuera');
  await prisma.whatsappSalida.updateMany({ where: { tipo: { not: 'RECORDATORIO_DELIVERY' } }, data: { estado: 'ENVIADA' } });
  await prisma.whatsappSalida.updateMany({ data: { disponibleAt: new Date(t0.getTime() - 1000) } });
  await prisma.orden.update({ where: { id: porFuera.id }, data: { deliverySolicitadoAt: t0 } });
  assert.equal(await agente.reservarSalida(cliente, 'sesion', t0), null);
  const [noElegible] = await deTipo(porFuera.id, 'RECORDATORIO_DELIVERY');
  assert.deepEqual([noElegible.estado, noElegible.ultimoError], ['CANCELADA', 'NO_ELEGIBLE']);

  // Anular sin publicar: nadie la vio, no hay aviso de anulación.
  await reiniciar();
  const sinPublicar = await ordenNueva('Sin publicar');
  assert.equal((await parchear(anular, sinPublicar.id, { razon: 'Cliente canceló el pedido' })).status, 200);
  const trasAnular = await salidasDe(sinPublicar.id);
  assert.deepEqual(
    trasAnular.map((s) => [s.tipo, s.estado]),
    [['PUBLICACION_GRUPO', 'CANCELADA'], ['RECORDATORIO_DELIVERY', 'CANCELADA'], ['RESPUESTA_EMPLEADO', 'PENDIENTE']],
  );

  // Anular publicada: el grupo recibe la anulación y el aviso de moto se cancela.
  await reiniciar();
  const publicada = await ordenNueva('Publicada');
  await publicar(publicada.id);
  assert.equal((await parchear(anular, publicada.id, { razon: 'Cliente canceló el pedido' })).status, 200);
  const [anulacion] = await deTipo(publicada.id, 'ACTUALIZACION_GRUPO');
  assert.deepEqual([anulacion.clave, anulacion.destino], [`anulacion:${publicada.id}`, 'grupo@g.us']);
  assert.match(anulacion.texto, /^ANULADA orden #\d+/);
  assert.equal((await deTipo(publicada.id, 'RECORDATORIO_DELIVERY'))[0].ultimoError, 'ORDEN_ANULADA');

  // Ubicación editada en el POS: cambio al grupo y aviso de moto con el enlace nuevo.
  await reiniciar();
  const sinUbicacion = await ordenNueva('Ubicacion');
  await publicar(sinUbicacion.id);
  const enlaceNuevo = 'https://maps.google.com/?q=-2.88,-78.95';
  const editada = await parchear(ubicacion, sinUbicacion.id, { ubicacionUrl: enlaceNuevo, referenciaEntrega: 'Casa azul' });
  assert.equal(editada.status, 200);
  const [cambioUbicacion] = await deTipo(sinUbicacion.id, 'ACTUALIZACION_GRUPO');
  assert.match(cambioUbicacion.clave, /^ubicacion:/);
  assert.match(cambioUbicacion.texto, /Referencia: Casa azul/);
  assert.ok((await deTipo(sinUbicacion.id, 'RECORDATORIO_DELIVERY'))[0].texto.includes('-2.88,-78.95'));

  // Revisión: descartar deja autor y libera los cambios que esperaban esa publicación.
  await prisma.whatsappSalida.updateMany({ data: { estado: 'ENVIADA' } });
  await prisma.whatsappSalida.updateMany({
    where: { ordenId: sinUbicacion.id, tipo: 'PUBLICACION_GRUPO' }, data: { estado: 'REQUIERE_REVISION' },
  });
  await prisma.whatsappSalida.update({
    where: { id: cambioUbicacion.id }, data: { estado: 'PENDIENTE', disponibleAt: new Date(t0.getTime() - 1000) },
  });
  assert.equal(await agente.reservarSalida(cliente, 'sesion', t0), null, 'Espera la publicación en duda');
  const listado = await (await revisionRuta.GET()).json();
  assert.equal(listado.salidas.length, 1);
  const dudosa = listado.salidas[0];
  assert.equal((await pedirRuta(revisionRuta, { tipo: 'salida', id: dudosa.id })).status, 200);
  assert.equal((await pedirRuta(revisionRuta, { tipo: 'salida', id: dudosa.id })).status, 409);
  const descartada = await salidaDe(dudosa.id);
  assert.deepEqual([descartada.estado, descartada.revisadaPor], ['REQUIERE_REVISION', 'Admin']);
  assert.equal((await agente.reservarSalida(cliente, 'sesion', t0))?.id, cambioUbicacion.id);
  assert.equal((await (await revisionRuta.GET()).json()).salidas.length, 0);

  // Rutas: credencial propia, salud y sesión caída sin reservar.
  await prisma.whatsappSalida.deleteMany();
  await crearSalida('ruta');
  const rutaDeps = { ...rutasDeps, '@/lib/whatsapp-agente': load<typeof agente>('lib/whatsapp-agente.ts', {
    './print-agent-auth': printAgentAuth, './print-agent-jobs': printAgentJobs,
  }) };
  const tick = load<RutaPost>('app/api/whatsapp-agent/tick/route.ts', rutaDeps);
  const pedirTick = (token: string, body: object) => tick.POST(new Request('http://test.invalid', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  }) as never);
  const sinSesion = { sessionId: 'sesion', sesionLista: false };
  assert.equal((await pedirTick('p'.repeat(32), sinSesion)).status, 401, 'El token de impresión no sirve aquí');
  assert.deepEqual(await (await pedirTick('w'.repeat(32), sinSesion)).json(), { salida: null });
  const salud = await prisma.printAgent.findUniqueOrThrow({ where: { id: 'whatsapp-agent' } });
  assert.equal(salud.printerReachable, false);
  const reservada = await (await pedirTick('w'.repeat(32), { ...sinSesion, sesionLista: true })).json();
  assert.equal(reservada.salida.clave, 'ruta');
  const tokenWhatsapp = process.env.WHATSAPP_AGENT_TOKEN;
  delete process.env.WHATSAPP_AGENT_TOKEN;
  assert.equal((await pedirTick('p'.repeat(32), sinSesion)).status, 503, 'Sin token propio no cae en el de impresión');
  process.env.WHATSAPP_AGENT_TOKEN = tokenWhatsapp;

  console.log('whatsapp postgres tests: ok');
}

async function main() {
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: isolatedUrl }, encoding: 'utf8', timeout: 120000,
  });
  if (migration.status !== 0) throw new Error('No se pudo preparar el esquema aislado de pruebas con las migraciones existentes.');
  await pruebas();
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    // Only this randomly named schema, in the explicit test database, belongs to this run.
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {
      console.error(`No se pudo retirar el esquema aislado ${schema}; revisar la base de pruebas.`);
      process.exitCode = 1;
    });
    await prisma.$disconnect();
  });
