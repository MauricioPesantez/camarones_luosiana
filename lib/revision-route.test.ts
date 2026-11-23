import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as revisionTypes from '../types/revision';
import type { MarcasRevision, OrdenRevisable } from '../types/revision';

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

type Fila = {
  ordenId: string; detalle: unknown; revisada: boolean; conErrores: boolean; version: number;
  revisadaPorId: string | null; revisadaPorNombre: string | null; revisadaAt: Date | null;
};
type Cuerpo = { error?: string; code?: string; revision?: Record<string, unknown> & { detalle: { productos: { estado: string }[]; faltantes: unknown[] } } };
type Consulta = { where?: unknown; select?: Record<string, unknown>; data?: Record<string, unknown> };

// JSONB no conserva el orden de las llaves: se simula invirtiéndolo.
const jsonb = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(jsonb)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, jsonb(x)]))
    : v;

async function run() {
  let actor: { id: string; nombre: string; rol: string } | null = null;
  let orden: (OrdenRevisable & { id: string }) | null = null;
  let guardada: Fila | null = null;
  let erroresCreate: unknown = null;
  let perderUpdate = false;
  let consultaOrden: Consulta | null = null;
  let consultaCatalogo: Consulta | null = null;
  const escrituras: string[] = [];

  const permitido = {
    orden: { findUnique: async (q: Consulta) => { consultaOrden = q; return structuredClone(orden); } },
    producto: {
      findMany: async (q: Consulta) => {
        consultaCatalogo = q;
        const ids = (q.where as { id: { in: string[] } }).id.in;
        return ids.filter((id) => id === 'p1').map((id) => ({ id, nombre: 'Cola', precio: '1.50' }));
      },
    },
    revisionOrden: {
      findUnique: async () => structuredClone(guardada),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (erroresCreate) throw erroresCreate;
        escrituras.push('create');
        guardada = { ...(data as unknown as Fila), detalle: jsonb(data.detalle) };
        return structuredClone(guardada);
      },
      updateMany: async ({ where, data }: { where: { ordenId: string; version: number }; data: Record<string, unknown> }) => {
        if (perderUpdate || !guardada || guardada.version !== where.version) return { count: 0 };
        escrituras.push('updateMany');
        guardada = { ...guardada, ...(data as object), detalle: jsonb(data.detalle) } as Fila;
        return { count: 1 };
      },
    },
  };
  // Cualquier otra tabla o método lanza: la bitácora solo escribe en RevisionOrden.
  const cerrar = <T extends object>(nombre: string, obj: T): T =>
    new Proxy(obj, { get: (t, k) => { if (k in t) return t[k as keyof T]; throw new Error(`Escritura no permitida: ${nombre}.${String(k)}`); } });
  const db = cerrar('prisma', {
    orden: cerrar('orden', permitido.orden),
    producto: cerrar('producto', permitido.producto),
    revisionOrden: cerrar('revisionOrden', permitido.revisionOrden),
  });

  const route = loadModule<{ PUT: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'app/api/admin/ordenes/[id]/revision/route.ts',
    {
      'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      'node:util': { isDeepStrictEqual },
      '@/lib/db': { prisma: db },
      '@/lib/session': { getAuthenticatedUser: async () => actor },
      '@/types/revision': revisionTypes,
    },
  );

  const base = (): OrdenRevisable & {
    id: string; mesero: string; creador: { nombre: string } | null; cobradaPor: string | null;
  } => ({
    id: 'o1', tipoOperacion: 'VENTA_CLIENTE', empleadoId: null, anulada: false, estado: 'cobrada',
    mesero: 'ana', creador: { nombre: 'Ana' }, cobradaPor: 'Luis',
    total: '21.00',
    items: [
      { id: 'i1', cantidad: 2, nivelPicante: 'leve', precioUnitario: '9.50', nombreProducto: null, producto: { nombre: 'Combo Simple' } },
      { id: 'i2', cantidad: 1, nivelPicante: null, precioUnitario: '2.00', nombreProducto: 'Cerveza', producto: { nombre: 'Cerveza' } },
    ],
    pagos: [{ metodoPago: 'transferencia', monto: '21.00', estado: 'CONFIRMADO' }],
  });
  const bien: MarcasRevision = {
    productos: [{ itemId: 'i1', estado: 'bien' }, { itemId: 'i2', estado: 'bien' }],
    faltantes: [], cobro: 'bien', total: { estado: 'bien' },
  };
  const reset = (rol = 'admin') => {
    actor = { id: 'a1', nombre: 'Admin Uno', rol };
    orden = base();
    guardada = null;
    erroresCreate = null;
    perderUpdate = false;
    consultaOrden = null;
    consultaCatalogo = null;
    escrituras.length = 0;
  };
  const put = async (extra: Record<string, unknown> = {}, crudo?: string) => {
    const cuerpo = { marcas: bien, revisada: false, version: 0, huella: revisionTypes.huellaOrden(orden ?? base()), ...extra };
    const res = await route.PUT(
      new Request('http://x', { method: 'PUT', body: crudo ?? JSON.stringify(cuerpo) }),
      { params: Promise.resolve({ id: 'o1' }) },
    );
    return { status: res.status, body: (await res.json()) as Cuerpo };
  };
  const rechaza = (r: { status: number; body: Cuerpo }, status: number, code?: string) => {
    assert.equal(r.status, status, JSON.stringify(r.body));
    assert.equal(typeof r.body.error, 'string');
    if (code) assert.equal(r.body.code, code);
    assert.equal(r.body.revision, undefined);
  };

  // Cada tipo de error se guarda y se marca revisada sin tocar otra tabla.
  reset();
  const conErrores: MarcasRevision = {
    productos: [{ itemId: 'i1', estado: 'mal', cantidadReal: 3 }, { itemId: 'i2', estado: 'mal', cantidadReal: 0 }],
    faltantes: [{ productoId: 'p1', cantidad: 2 }],
    cobro: 'efectivo',
    total: { estado: 'de_mas', diferencia: 3 },
  };
  let r = await put({ marcas: conErrores, revisada: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.revision!.conErrores, true);
  assert.equal(r.body.revision!.revisada, true);
  assert.deepEqual(r.body.revision!.detalle.faltantes, [{ productoId: 'p1', nombre: 'Cola', cantidad: 2, precio: 1.5 }]);
  assert.deepEqual(consultaCatalogo, { where: { id: { in: ['p1'] } }, select: { id: true, nombre: true, precio: true } });
  assert.deepEqual(Object.keys(consultaOrden!.select!).sort(), [
    'anulada', 'cobradaPor', 'creador', 'empleadoId', 'estado', 'items', 'mesero', 'pagos', 'tipoOperacion', 'total',
  ]);
  assert.deepEqual(escrituras, ['create']);

  // Sin errores: primera vez v1, siguiente v2; nombre y fecha del admin; al quitarla, null y marcas intactas.
  reset();
  r = await put({ revisada: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.revision!.version, 1);
  assert.equal(r.body.revision!.conErrores, false);
  assert.equal(r.body.revision!.ordenId, 'o1');
  assert.equal(r.body.revision!.revisadaPorNombre, 'Admin Uno');
  assert.equal(typeof r.body.revision!.revisadaAt, 'string');
  assert.equal(guardada!.revisadaPorId, 'a1');
  r = await put({ revisada: false, version: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.body.revision!.version, 2);
  assert.equal(r.body.revision!.revisada, false);
  assert.equal(r.body.revision!.revisadaPorNombre, null);
  assert.equal(r.body.revision!.revisadaAt, null);
  assert.equal(guardada!.revisadaPorId, null);
  assert.deepEqual(r.body.revision!.detalle.productos.map((p) => p.estado), ['bien', 'bien']);
  assert.deepEqual(escrituras, ['create', 'updateMany']);

  // Cada guardado con revisada true deja al admin de la sesión y la hora actual.
  reset();
  await put({ revisada: true });
  const fechaA = guardada!.revisadaAt;
  actor = { id: 'a2', nombre: 'Admin Dos', rol: 'admin' };
  const marcasB = { ...bien, cobro: 'efectivo' as const };
  r = await put({ revisada: true, version: 1, marcas: marcasB });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.revision!.version, 2);
  assert.equal(r.body.revision!.revisadaPorNombre, 'Admin Dos');
  assert.equal(guardada!.revisadaPorId, 'a2');
  assert.ok(guardada!.revisadaAt! >= fechaA!);
  // El reintento de B devuelve lo guardado sin escribir ni mover la fecha.
  const fechaB = guardada!.revisadaAt;
  const escritas = escrituras.length;
  r = await put({ revisada: true, version: 1, marcas: marcasB });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.revision!.version, 2);
  assert.equal(escrituras.length, escritas);
  assert.equal(guardada!.revisadaAt, fechaB);

  // Reintento de la primera vez: version 0 dos veces no escribe de nuevo.
  for (const revisada of [false, true]) {
    reset();
    await put({ revisada, version: 0 });
    assert.equal(guardada!.version, 1);
    r = await put({ revisada, version: 0 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.revision!.version, 1);
    assert.deepEqual(escrituras, ['create']);
  }

  // Permisos y rechazos: nada se escribe.
  reset();
  actor = null;
  rechaza(await put(), 401);
  for (const rol of ['mesero', 'digital', 'cocina']) {
    reset(rol);
    rechaza(await put(), 403);
  }
  reset();
  orden = null;
  rechaza(await put(), 404);
  reset();
  orden!.anulada = true;
  rechaza(await put(), 409, 'NO_SE_REVISA');
  reset();
  rechaza(await put({}, '{roto'), 400);
  reset();
  rechaza(await put({ revisada: true, marcas: { ...bien, productos: [bien.productos[0]] } }), 400);
  reset();
  rechaza(await put({ marcas: { ...bien, productos: [{ itemId: 'ajeno', estado: 'bien' }] } }), 400);
  reset();
  rechaza(await put({ marcas: { ...bien, faltantes: [{ productoId: 'no-existe', cantidad: 1 }] } }), 400);
  assert.deepEqual(escrituras, []);

  // Un producto mal queda a nombre de quien creó la orden (no del texto de mesero).
  reset();
  await put({ marcas: conErrores });
  assert.deepEqual(
    revisionTypes.erroresDe(guardada!.detalle as revisionTypes.DetalleRevision).map((e) => e.persona),
    ['Ana', 'Ana', 'Ana', 'Luis', 'Luis'],
  );

  // Incompleta sin revisada: se guarda.
  reset();
  r = await put({ marcas: { ...bien, productos: [bien.productos[0]], total: null } });
  assert.equal(r.status, 200);
  assert.equal(r.body.revision!.revisada, false);

  // Faltante no disponible: el catálogo no filtra por disponible.
  reset();
  r = await put({ marcas: { ...bien, faltantes: [{ productoId: 'p1', cantidad: 1 }] } });
  assert.equal(r.status, 200);
  assert.equal(JSON.stringify(consultaCatalogo).includes('disponible'), false);

  // Huella vieja.
  reset();
  rechaza(await put({ huella: 'vieja' }), 409, 'ORDEN_CAMBIO');
  assert.deepEqual(escrituras, []);

  // Versiones: vieja, sin fila con versión > 0, creación simultánea y carrera en updateMany.
  reset();
  await put();
  await put({ version: 1 });
  rechaza(await put({ version: 1, marcas: { ...bien, cobro: 'efectivo' } }), 409, 'REVISION_CAMBIO');
  rechaza(await put({ version: 0 }), 409, 'REVISION_CAMBIO');
  reset();
  rechaza(await put({ version: 3 }), 409, 'REVISION_CAMBIO');
  reset();
  erroresCreate = Object.assign(new Error('Unique'), { code: 'P2002' });
  rechaza(await put(), 409, 'REVISION_CAMBIO');
  reset();
  await put();
  perderUpdate = true;
  rechaza(await put({ version: 1 }), 409, 'REVISION_CAMBIO');

  // Reintento: la respuesta se perdió; misma solicitud con la versión anterior.
  for (const revisada of [true, false]) {
    reset();
    await put({ revisada: true });
    await put({ revisada, version: 1 }); // guardada pasa a v2 con las llaves del JSONB reordenadas
    const antes: number = escrituras.length;
    r = await put({ revisada, version: 1 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.revision!.version, 2);
    assert.equal(escrituras.length, antes);
  }
  // Otro admin o otras marcas no son un reintento.
  reset();
  await put({ revisada: true });
  await put({ revisada: true, version: 1 });
  actor = { id: 'a2', nombre: 'Admin Dos', rol: 'admin' };
  rechaza(await put({ revisada: true, version: 1 }), 409, 'REVISION_CAMBIO');
  actor = { id: 'a1', nombre: 'Admin Uno', rol: 'admin' };
  rechaza(await put({ revisada: true, version: 1, marcas: { ...bien, cobro: 'efectivo' } }), 409, 'REVISION_CAMBIO');
  rechaza(await put({ revisada: false, version: 1 }), 409, 'REVISION_CAMBIO');

  // La orden cambia después de anotar un error: al volver a revisarla el error se conserva.
  reset();
  await put({ marcas: { ...bien, cobro: 'efectivo' }, revisada: true });
  orden = { ...base(), cobradaPor: 'Admin Uno', pagos: [{ metodoPago: 'efectivo', monto: '21.00', estado: 'CONFIRMADO' }] } as ReturnType<typeof base>;
  r = await put({ revisada: true, version: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const conservados = () => revisionTypes.erroresDe(guardada!.detalle as revisionTypes.DetalleRevision);
  assert.deepEqual(conservados().map((e) => e.texto), ['Transferencia registrada, fue efectivo']);
  assert.equal(r.body.revision!.conErrores, true);
  // Queda a nombre de quien figuraba al anotarlo.
  assert.deepEqual(conservados().map((e) => e.persona), ['Luis']);
  // Su reintento no escribe otra vez.
  const conCambio: number = escrituras.length;
  r = await put({ revisada: true, version: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(escrituras.length, conCambio);
  // Y el admin puede quitarlo, también con reintento.
  const quitados = (guardada!.detalle as revisionTypes.DetalleRevision).anteriores!.map((e) => e.clave);
  for (let vez = 0; vez < 2; vez++) {
    r = await put({ revisada: true, version: 2, marcas: { ...bien, quitados } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.revision!.version, 3);
  }
  assert.deepEqual(conservados(), []);
  assert.equal(r.body.revision!.conErrores, false);

  console.log('revision-route: ok');
}

run().catch((e) => { console.error(e); process.exit(1); });
