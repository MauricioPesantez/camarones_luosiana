import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import type { CorteTurno } from '../types/caja';
import { calcularResumenCuadre } from '../types/cuadre';
import type { RetiroCaja } from '../types/retiro';
import { MAX_CARACTERES, textosResumenCierre, type DatosResumenCierre, type OrdenResumen } from './resumen-cierre';

const utc = (hora: string, dia = 22) => new Date(`2026-11-${dia}T${hora}:00Z`);
const corte = (extra: Partial<CorteTurno>): CorteTurno => ({
  id: 'k', numero: 1, usuarioId: 'ana', usuarioNombre: 'Ana', fondoInicial: 50, montoEsperado: 150,
  montoContado: 130, diferencia: -20, anuladoPorNombre: null, razonAnulacion: null, anuladoAt: null,
  createdAt: utc('20:00').toISOString(), ...extra,
});
const orden = (extra: Partial<OrdenResumen>): OrdenResumen => ({
  numeroDiario: 1, fechaNumeroDiario: '2026-11-22', tipoOrden: 'local', numeroMesa: 3, creadorNombre: 'Ana',
  total: 100, montoPagado: 100, estado: 'entregada', cobrada: true, anulada: false, empleadoId: null,
  metodoPago: 'efectivo', pagos: [{ metodoPago: 'efectivo', monto: 100 }], createdAt: utc('17:05'),
  items: [{ cantidad: 2, nombreProducto: 'Alitas', esCortesia: false, producto: { nombre: 'Alitas viejo' } }],
  ...extra,
});
const retiro = (extra: Partial<RetiroCaja>): RetiroCaja => ({
  id: 'r', monto: 20, categoria: 'adelanto', motivo: 'quincena', usuarioId: 'ana', usuarioNombre: 'Ana',
  usuarioRol: 'mesero', beneficiarioId: 'p', beneficiarioNombre: 'Pedro', estado: 'registrado',
  anuladoPorNombre: null, razonAnulacion: null, anuladoAt: null, createdAt: utc('18:15').toISOString(), ...extra,
});
const base = (extra: Partial<DatosResumenCierre> = {}): DatosResumenCierre => ({
  fecha: '2026-11-22',
  caja: {
    id: 'c', fecha: '2026-11-22', estado: 'cerrada', montoInicial: 50, abiertaPorId: 'ana', abiertaPorNombre: 'Ana',
    abiertaPorRol: 'mesero', abiertaAt: utc('15:02').toISOString(), montoEsperadoCierre: 250, montoCierre: 247,
    diferenciaCierre: -3, cerradaPorId: 'adm', cerradaPorNombre: 'Admin', cerradaAt: utc('03:10', 23).toISOString(),
    ordenesHabilitadasAt: null, ordenesHabilitadasPorNombre: null, cortes: [],
  },
  resumen: calcularResumenCuadre([], [], 50),
  ventaPorCobrar: 0, retiros: [], consumos: [], ordenes: [], novedades: [],
  ...extra,
});

// Día sin movimientos: solo el cierre, con la hora de Ecuador y la diferencia guardada.
const vacio = textosResumenCierre(base());
assert.equal(vacio.length, 1);
assert.match(vacio[0], /^\*CIERRE DE CAJA\* · 22\/11\/2026 · 1\/1/);
assert.match(vacio[0], /Abrió: Ana 10:02\nCerró: Admin 22:10/);
assert.match(vacio[0], /Debía haber: \$250\.00\nContado: \$247\.00\n\*Faltan \$3\.00\*/);

// Día completo.
const conDatosDeCliente = {
  ...orden({ numeroDiario: 2, tipoOrden: 'domicilio', numeroMesa: null, pagos: [{ metodoPago: 'efectivo', monto: 40 }, { metodoPago: 'transferencia', monto: 60 }] }),
  nombreCliente: 'María Cliente', telefonoCliente: '0999999999', referenciaEntrega: 'Casa azul', ubicacionUrl: 'https://maps.example/x',
};
const dia = base({
  ordenes: [
    conDatosDeCliente,
    orden({ createdAt: utc('16:00') }),
    orden({ numeroDiario: 9, fechaNumeroDiario: '2026-11-21', createdAt: utc('23:00', 21) }),
    orden({ numeroDiario: 3, cobrada: false, montoPagado: 0, total: 12, pagos: [], items: [] }),
    orden({ numeroDiario: 4, anulada: true, items: [{ cantidad: 9, nombreProducto: 'Costillas', esCortesia: false, producto: { nombre: 'x' } }] }),
    orden({ numeroDiario: 5, cobrada: false, estado: 'cancelada', pagos: [], items: [{ cantidad: 9, nombreProducto: 'Costillas', esCortesia: false, producto: { nombre: 'x' } }] }),
  ],
  resumen: { ...calcularResumenCuadre([], [], 50), ventasTotales: 212, ventaPorCobrar: 112, totalOrdenes: 5 },
  ventaPorCobrar: 12,
  retiros: [
    retiro({ id: 'r2', createdAt: utc('19:00').toISOString(), estado: 'anulado', anuladoPorNombre: 'Admin', razonAnulacion: 'duplicado' }),
    retiro({}),
  ],
  consumos: [{ empleadoNombre: 'Luis', estado: 'entregada', total: 4.5, anulada: false }],
  novedades: [
    { tipoAccion: 'orden_anulada', descripcion: 'Orden anulada por Admin', usuarioNombre: 'Admin', razon: 'error', createdAt: utc('18:30'), orden: { numeroDiario: 4, fechaNumeroDiario: '2026-11-22' } },
    { tipoAccion: 'item_eliminado', descripcion: 'Eliminado: 1x Cola', usuarioNombre: 'Ana', razon: null, createdAt: utc('18:40'), orden: { numeroDiario: 1, fechaNumeroDiario: '2026-11-22' } },
  ],
});
dia.caja.cortes = [
  corte({ anuladoAt: utc('20:10').toISOString(), anuladoPorNombre: 'Admin', razonAnulacion: 'adelanto sin registrar' }),
  corte({ id: 'k2', numero: 2, montoEsperado: 130, diferencia: 0 }),
  corte({ id: 'k3', numero: 3, usuarioNombre: 'Luis', fondoInicial: 130, montoEsperado: 190, montoContado: 188, diferencia: -2 }),
];
const textos = textosResumenCierre(dia);
const todo = textos.join('\n----\n');
assert.deepEqual(textos.map((t) => t.split(' · ')[0]),
  ['*CIERRE DE CAJA*', '*TURNOS*', '*SALIDAS DE DINERO*', '*NOVEDADES*', '*ÓRDENES*', '*PRODUCTOS VENDIDOS*']);
assert.match(textos[5], / · 6\/6\n/);
assert.match(todo, /Cobrado: \$100\.00\nFalta cobrar: \$12\.00 en 1 órdenes\nRechazadas o sin aprobar, incluidas en lo vendido: \$100\.00/);
// El anulado no es un turno y no entra en la suma: 0 - 2 - 1 = -3.
assert.match(textos[1], /Anulado · Ana .*Por Admin: adelanto sin registrar\nTurno 1 · Ana .*Cuadra exacto\*\nTurno 2 · Luis .*Faltan \$2\.00\*\nDesde el último corte hasta el cierre: \*Faltan \$1\.00\*/);
assert.match(textos[2], /13:15 · \$20\.00 · Adelanto a empleado para Pedro · quincena · Ana\nANULADA 14:00/);
assert.match(textos[2], /Luis: \$4\.50/);
assert.match(textos[3], /#4 · Orden anulada por Admin: error/);
assert.match(textos[3], /Eliminado: 1x Cola · Ana/);
assert.match(textos[3], /Sin cobrar al cierre:\n#3 · \$12\.00 · Ana/);
assert.match(textos[4], /#9 del 2026-11-21/);
assert.match(textos[4], /#2 · 12:05 · Domicilio · Ana · \$100\.00 · efectivo \$40\.00 \+ transferencia \$60\.00/);
assert.match(textos[4], /#4 .*ANULADA/);
// Ni lo de ayer, ni lo anulado, ni lo cancelado suma unidades.
assert.match(textos[5], /\n4 x Alitas$/);
assert.doesNotMatch(todo, /María|0999999999|Casa azul|maps\.example|Alitas viejo/);

// Mostrar las órdenes al mesero queda dicho; si no se mostraron, no se menciona.
assert.doesNotMatch(todo, /mostró las órdenes/);
dia.caja.ordenesHabilitadasAt = utc('02:40', 23).toISOString();
dia.caja.ordenesHabilitadasPorNombre = 'Admin';
assert.match(textosResumenCierre(dia)[0], /Admin mostró las órdenes del día a Luis 21:40/);

// Día muy largo: se parte por líneas, numerado y sin perder órdenes.
const muchas = Array.from({ length: 200 }, (_, i) => orden({ numeroDiario: i + 1 }));
const largo = textosResumenCierre(base({ ordenes: muchas }));
assert.ok(largo.every((t) => t.length <= MAX_CARACTERES));
for (let i = 1; i <= 200; i += 1) assert.ok(largo.some((t) => t.includes(`#${i} · `)), `falta #${i}`);
assert.match(largo.at(-1)!, new RegExp(` · ${largo.length}/${largo.length}\\n`));
const enorme = textosResumenCierre(base({ retiros: [retiro({ motivo: 'x'.repeat(9000) })] }));
assert.ok(enorme.every((t) => t.length <= MAX_CARACTERES));

// Cola: último remitente vigente, en orden, 24 horas; sin operador no encola.
async function cola() {
  const js = transpileModule(readFileSync(resolve('lib/whatsapp-salidas.ts'), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2017 },
  }).outputText;
  const modulo = { exports: {} as typeof import('./whatsapp-salidas') };
  let config: unknown = { sessionId: 's1', operadores: new Set(['1@lid', '1@c.us']) };
  new Function('require', 'module', 'exports', js)((nombre: string) => (
    { '@/lib/whatsapp-webhook': { leerConfiguracion: () => config } } as Record<string, unknown>
  )[nombre] ?? {}, modulo, modulo.exports);

  let consulta: unknown;
  let ultima: { remitente: string } | null = { remitente: '1@lid' };
  let filas: Array<{ destino: string; clave: string; texto: string; tipo: string; disponibleAt: Date; venceAt: Date }> = [];
  const db = {
    whatsappEntrada: { findFirst: async (q: unknown) => { consulta = q; return ultima; } },
    whatsappSalida: { createMany: async ({ data }: { data: typeof filas }) => { filas = data; } },
  };
  const ahora = utc('03:10', 23);
  const encolar = () => modulo.exports.registrarResumenCierre(db as never, '2026-11-22', ['a', 'b'], ahora);

  assert.equal(await encolar(), 'encolado');
  assert.deepEqual(consulta, {
    where: { sessionId: 's1', remitente: { in: ['1@lid', '1@c.us'] } },
    orderBy: { recibidaAt: 'desc' },
    select: { remitente: true },
  });
  assert.deepEqual(filas.map((f) => [f.destino, f.clave, f.texto, f.tipo]), [
    ['1@lid', 'cierre:2026-11-22:1', 'a', 'RESUMEN_CIERRE'],
    ['1@lid', 'cierre:2026-11-22:2', 'b', 'RESUMEN_CIERRE'],
  ]);
  assert.ok(filas[0].disponibleAt < filas[1].disponibleAt);
  assert.equal(filas[0].venceAt.getTime() - ahora.getTime(), 24 * 60 * 60 * 1000);

  filas = [];
  ultima = null;
  assert.equal(await encolar(), 'sin_operador');
  config = null;
  assert.equal(await encolar(), 'sin_configuracion');
  assert.equal(filas.length, 0);
}

cola().then(() => console.log('resumen-cierre: ok')).catch((error) => { console.error(error); process.exit(1); });
