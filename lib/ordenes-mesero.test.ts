import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as cajaTypes from '../types/caja';
import type { RetiroCaja } from '../types/retiro';
import * as ordenesMesero from './ordenes-mesero';
import { ordenesParaMesero, type OrdenParaMesero } from './ordenes-mesero';

const utc = (hora: string, dia = 23) => new Date(`2026-11-${dia}T${hora}:00Z`);
const item = (cantidad: number, nombreProducto: string, subtotal: number, extra = {}) => ({
  cantidad, nombreProducto, subtotal, esCortesia: false, observaciones: 'sin cebolla', nivelPicante: 'leve',
  producto: { nombre: 'nombre viejo' }, ...extra,
});
const pago = (metodoPago: string, monto: number, enRango = true) => ({ metodoPago, monto, enRango });
const orden = (extra: object = {}): OrdenParaMesero => {
  const cruda = {
    id: 'o', numeroDiario: 18, fechaNumeroDiario: '2026-11-23', tipoOrden: 'local', numeroMesa: 4,
    nombreCliente: 'María Cliente', telefonoCliente: '0999999999', referenciaEntrega: 'Casa azul',
    recargo: null, costoEnvio: null, descuento: 0, total: 12.5, montoPagado: 12.5, estado: 'cobrada',
    cobrada: true, anulada: false, razonAnulacion: 'secreta', empleadoId: null, empleadoNombre: 'Pedro Empleado',
    metodoPagoPrevisto: null, cobradaPor: 'Ana', creadorNombre: 'Luis', createdAt: utc('19:20'),
    items: [item(2, 'Combo clásico', 11), item(1, 'Cola', 1.5)], pagos: [pago('efectivo', 12.5)],
    ...extra,
  };
  return cruda;
};
const una = (extra: object = {}) =>
  ordenesParaMesero({ fecha: '2026-11-23', ordenes: [orden(extra)], retiros: [] }).ordenes[0];
const lineas = (extra: object) => una(extra).lineas.map((l) => [l.concepto, l.monto]);
const precios = (extra: object) => una(extra).items.map((i) => i.subtotal);

// Mesa en efectivo: productos con precio y lo cobrado.
assert.deepEqual(una(), {
  id: 'o', numero: '#18', titulo: 'Mesa 4', createdAt: utc('19:20').toISOString(), quien: 'cobró Ana',
  etiqueta: 'efectivo',
  items: [
    { cantidad: 2, nombre: 'Combo clásico', subtotal: 11, esCortesia: false },
    { cantidad: 1, nombre: 'Cola', subtotal: 1.5, esCortesia: false },
  ],
  extras: [], lineas: [{ concepto: 'Cobrado', monto: 12.5 }],
});

// Domicilio por transferencia: solo el envío; ni precios ni total salen del servidor.
const envio = { tipoOrden: 'domicilio', numeroMesa: null, costoEnvio: 2, recargo: 2.5, total: 17 };
const transferencia = una({ ...envio, pagos: [pago('transferencia', 17)], descuento: 1 });
assert.equal(transferencia.titulo, 'Domicilio');
assert.equal(transferencia.etiqueta, 'transferencia');
assert.deepEqual(transferencia.lineas, [{ concepto: 'Envío entregado al motorizado', monto: -2 }]);
assert.deepEqual(transferencia.items.map((i) => [i.cantidad, i.nombre, i.subtotal]),
  [[2, 'Combo clásico', null], [1, 'Cola', null]]);
assert.deepEqual(transferencia.extras, []);
assert.doesNotMatch(JSON.stringify(transferencia), /17|2\.5|12\.5/);

// Domicilio en efectivo: lo que entregó el motorizado, y los extras que explican la suma.
const domicilioEfectivo = { ...envio, total: 16, descuento: '1.00', pagos: [pago('efectivo', 16)] };
assert.deepEqual(lineas(domicilioEfectivo), [['Recibido del motorizado', 14]]);
assert.deepEqual(una(domicilioEfectivo).extras, [
  { concepto: 'Envases', monto: 2.5 }, { concepto: 'Descuento', monto: -1 },
]);
const suma = [...precios(domicilioEfectivo), ...una(domicilioEfectivo).extras.map((e) => e.monto)]
  .reduce<number>((total, valor) => total + Number(valor), 0);
assert.equal(suma, 14);

// Domicilio mixto: efectivo menos envío; si el efectivo no cubre el envío, el local completa.
assert.deepEqual(lineas({ ...envio, total: 17, pagos: [pago('efectivo', 7), pago('transferencia', 10)] }),
  [['Transferencia', 10], ['Recibido del motorizado', 5]]);
assert.deepEqual(lineas({ ...envio, total: 17, pagos: [pago('efectivo', 0.5), pago('transferencia', 16.5)] }),
  [['Transferencia', 16.5], ['Envío entregado al motorizado', -1.5]]);
assert.equal(una({ ...envio, pagos: [pago('efectivo', 7), pago('transferencia', 10)] }).etiqueta, 'mixto');

// Para llevar mixto.
assert.equal(una({ tipoOrden: 'para_llevar', numeroMesa: null }).titulo, 'Para llevar');
assert.deepEqual(lineas({ tipoOrden: 'para_llevar', pagos: [pago('transferencia', 7.5), pago('efectivo', 5)] }),
  [['Transferencia', 7.5], ['Efectivo', 5]]);

// Transferencia en el local: se muestra lo cobrado.
assert.deepEqual(lineas({ pagos: [pago('transferencia', 12.5)] }), [['Cobrado', 12.5]]);

// Sin cobrar.
const pendiente = { cobrada: false, montoPagado: 0, pagos: [], estado: 'lista' };
assert.equal(una(pendiente).etiqueta, 'sin_cobrar');
assert.equal(una(pendiente).quien, 'creó Luis');
assert.deepEqual(lineas(pendiente), [['Por cobrar', 12.5]]);
// El envío es del motorizado: no está por cobrar para la caja.
assert.deepEqual(lineas({ ...envio, ...pendiente, metodoPagoPrevisto: 'efectivo' }), [['Por cobrar', 15]]);
// Acordado por transferencia: tampoco muestra precios.
const porTransferir = { ...envio, ...pendiente, metodoPagoPrevisto: 'transferencia' };
assert.deepEqual(lineas(porTransferir), []);
assert.deepEqual(precios(porTransferir), [null, null]);

// Creció después de pagada: lo cobrado y lo que falta.
const crecio = { cobrada: false, total: 18, montoPagado: 12.5 };
assert.equal(una(crecio).etiqueta, 'sin_cobrar');
assert.deepEqual(lineas(crecio), [['Efectivo', 12.5], ['Por cobrar', 5.5]]);
assert.deepEqual(
  lineas({ ...envio, cobrada: false, total: 20, montoPagado: 17, pagos: [pago('transferencia', 17)] }),
  [['Por cobrar', 3]]);

// De ayer, pagada hoy: con su fecha, y solo lo que entró hoy.
const deAyer = { fechaNumeroDiario: '2026-11-22', numeroDiario: 9, pagos: [pago('efectivo', 4, false), pago('efectivo', 8.5)] };
assert.equal(una(deAyer).numero, '#9 del 2026-11-22');
assert.deepEqual(lineas(deAyer), [['Cobrado', 8.5]]);

// Cortesía; sin dinero para la caja: solo nombres.
assert.deepEqual(una({ items: [item(1, 'Salsa', 0, { esCortesia: true })] }).items,
  [{ cantidad: 1, nombre: 'Salsa', subtotal: 0, esCortesia: true }]);
assert.equal(una({ items: [item(1, '', 3, { nombreProducto: null })] }).items[0].nombre, 'nombre viejo');
for (const [extra, etiqueta] of [
  [{ anulada: true }, 'anulada'],
  [{ estado: 'cancelada', cobrada: false }, 'rechazada'],
  [{ estado: 'pendiente_aprobacion_stock', cobrada: false }, 'sin_aprobar'],
  [{ empleadoId: 'e1' }, 'cuenta_empleado'],
] as const) {
  const sinDinero = una(extra);
  assert.equal(sinDinero.etiqueta, etiqueta);
  assert.deepEqual([sinDinero.lineas, sinDinero.extras], [[], []]);
  assert.deepEqual(sinDinero.items.map((i) => i.subtotal), [null, null]);
}

// Orden del día y salidas vigentes, sin motivo ni beneficiario ni datos del cliente.
const retiro = (extra: Partial<RetiroCaja>): RetiroCaja => ({
  id: 'r', monto: 20, categoria: 'adelanto', motivo: 'quincena secreta', usuarioId: 'ana', usuarioNombre: 'Ana',
  usuarioRol: 'mesero', beneficiarioId: 'p', beneficiarioNombre: 'Pedro', estado: 'registrado',
  anuladoPorNombre: null, razonAnulacion: null, anuladoAt: null, createdAt: utc('21:00').toISOString(), ...extra,
});
const dia = ordenesParaMesero({
  fecha: '2026-11-23',
  ordenes: [orden({ id: 'b', createdAt: utc('20:00') }), orden({ id: 'a', createdAt: utc('17:00') })],
  retiros: [retiro({ id: 'r2', createdAt: utc('22:00').toISOString() }), retiro({}), retiro({ id: 'x', estado: 'anulado' })],
});
assert.deepEqual(dia.ordenes.map((o) => o.id), ['a', 'b']);
assert.deepEqual(dia.salidas.map((s) => s.id), ['r', 'r2']);
assert.deepEqual(Object.keys(dia.salidas[0]).sort(), ['categoria', 'createdAt', 'id', 'monto', 'usuarioNombre']);
assert.doesNotMatch(JSON.stringify(dia), /María|0999999999|Casa azul|Pedro|secreta|cebolla|leve/);

function loadModule<T>(file: string, dependencies: Record<string, unknown>): T {
  const js = transpileModule(readFileSync(resolve(file), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2017 },
  }).outputText;
  const routeModule = { exports: {} };
  new Function('require', 'module', 'exports', js)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Dependencia no simulada: ${name}`);
    return dependencies[name];
  }, routeModule, routeModule.exports);
  return routeModule.exports as T;
}

async function ruta() {
  let actor: { id: string; nombre: string; rol: string } | null = null;
  const caja = {
    id: 'c1', estado: 'abierta', ordenesHabilitadasAt: null as Date | null,
    ordenesHabilitadasPorNombre: null as string | null,
    cortes: [] as { usuarioId: string; usuarioNombre: string; anuladoAt: Date | null }[],
  };
  let hayCaja = true;
  class CajaNoDisponibleError extends Error {}
  const tx = {
    sesionCaja: {
      update: async ({ data }: { data: Partial<typeof caja> }) => Object.assign(caja, data),
    },
  };
  const obtenerCaja = async () => (hayCaja ? structuredClone(caja) : null);
  const route = loadModule<Record<'GET' | 'PATCH', (r?: Request) => Promise<Response>>>(
    'app/api/caja/ordenes/route.ts',
    {
      'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      '@/lib/db': { prisma: { ...tx, $transaction: async <T>(cb: (c: typeof tx) => Promise<T>) => cb(tx) } },
      '@/lib/caja': {
        CajaNoDisponibleError, obtenerCajaDeHoy: obtenerCaja,
        bloquearCajaAbierta: async () => {
          if (!hayCaja || caja.estado !== 'abierta') throw new CajaNoDisponibleError('La caja de hoy ya fue cerrada');
        },
      },
      '@/lib/cuadre-server': {
        obtenerDatosCuadre: async () => ({ fecha: '2026-11-23', ordenes: [orden()], retiros: [retiro({})] }),
      },
      '@/lib/fecha-ecuador': { obtenerFechaEcuador: () => '2026-11-23' },
      '@/lib/ordenes-mesero': ordenesMesero,
      '@/lib/session': { getAuthenticatedUser: async () => actor },
      '@/types/caja': cajaTypes,
    },
  );
  const habilitar = (fecha = '2026-11-23') =>
    route.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ fecha }) }));
  const ana = () => { actor = { id: 'ana', nombre: 'Ana', rol: 'mesero' }; };
  const admin = () => { actor = { id: 'adm', nombre: 'Admin', rol: 'admin' }; };

  // Sin sesión, sin rol, sin conteo, otro día, sin caja.
  assert.equal((await route.GET()).status, 401);
  assert.equal((await habilitar()).status, 401);
  ana();
  assert.equal((await habilitar()).status, 403);
  admin();
  assert.equal((await route.GET()).status, 403);
  assert.equal((await habilitar()).status, 409);
  caja.cortes.push({ usuarioId: 'ana', usuarioNombre: 'Ana', anuladoAt: new Date() });
  assert.equal((await habilitar()).status, 409); // el único conteo está anulado
  caja.cortes.push({ usuarioId: 'ana', usuarioNombre: 'Ana', anuladoAt: null });
  assert.equal((await habilitar('2026-11-22')).status, 409);
  hayCaja = false;
  assert.equal((await habilitar()).status, 409);
  hayCaja = true;
  ana();
  assert.equal((await route.GET()).status, 403); // todavía no habilitada

  // Habilitada: solo quien entregó, y repetir no cambia quién ni cuándo.
  admin();
  assert.equal((await habilitar()).status, 200);
  const cuando = caja.ordenesHabilitadasAt;
  assert.equal(caja.ordenesHabilitadasPorNombre, 'Admin');
  actor = { id: 'adm2', nombre: 'Otro', rol: 'admin' };
  assert.equal((await habilitar()).status, 200);
  assert.equal(caja.ordenesHabilitadasAt, cuando);
  assert.equal(caja.ordenesHabilitadasPorNombre, 'Admin');
  actor = { id: 'luis', nombre: 'Luis', rol: 'mesero' };
  assert.equal((await route.GET()).status, 403);
  ana();
  const res = await route.GET();
  assert.equal(res.status, 200);
  const cuerpo = await res.json();
  assert.equal(cuerpo.ordenes.length, 1);
  assert.doesNotMatch(JSON.stringify(cuerpo), /esperado|diferencia|motivo|beneficiario|María/i);

  // Al cerrar la caja termina, y ya no se habilita.
  caja.estado = 'cerrada';
  assert.equal((await route.GET()).status, 403);
  admin();
  assert.equal((await habilitar()).status, 409);

  console.log('ordenes-mesero: ok');
}

ruta().catch((error) => { console.error(error); process.exit(1); });
