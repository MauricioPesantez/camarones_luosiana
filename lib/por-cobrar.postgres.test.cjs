const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { loader } = require("./por-cobrar.test-loader.cjs");

const configured =
  process.env.EMPLOYEE_TEST_DATABASE_URL ||
  readFileSync(".env.test.local", "utf8").match(
    /^EMPLOYEE_TEST_DATABASE_URL=(.+)$/m,
  )?.[1];
assert.ok(configured, "Falta EMPLOYEE_TEST_DATABASE_URL");
const url = new URL(configured);
assert.ok(
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
    /test/i.test(url.pathname),
  "Solo se permite PostgreSQL local de pruebas",
);
const schema = `por_cobrar_${randomUUID().replaceAll("-", "")}`;
url.searchParams.set("schema", schema);
const prisma = new PrismaClient({
  datasources: { db: { url: url.toString() } },
});
const ana = { id: "ana", nombre: "Ana", rol: "mesero" };
let actor = ana;
const load = loader(prisma, () => actor);
const { listarPorCobrar, leerCursor } = load(
  "lib/ordenes-por-cobrar.ts",
);
const { collectOrderPayment } = load("lib/order-payment.ts");
const { obtenerFechaEcuador, obtenerRangoEcuador } = load("lib/fecha-ecuador.ts");
const { presentarCobro, previsualizarMixto } = load(
  "lib/presentacion-cobro.ts",
);
const { hashPaymentToken } = load("lib/payment-link.ts");

async function main() {
  const migration = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: url.toString() },
      encoding: "utf8",
    },
  );
  assert.equal(migration.status, 0, migration.stderr);
  await prisma.usuario.createMany({
    data: [
      ana,
      { id: "otra", nombre: "Ana", rol: "mesero" },
      { id: "digital", nombre: "Digital", rol: "digital" },
      { id: "empleado", nombre: "Empleado", rol: "cocina" },
    ],
  });
  await prisma.producto.create({
    data: {
      id: "p",
      nombre: "Combo de prueba",
      categoria: "combo",
      precio: 16,
      stock: 100,
    },
  });
  const fecha = obtenerFechaEcuador();
  const { inicio, fin } = obtenerRangoEcuador(fecha);
  await prisma.sesionCaja.create({
    data: {
      fecha,
      montoInicial: 0,
      abiertaPorId: "ana",
      abiertaPorNombre: "Ana",
      abiertaPorRol: "mesero",
    },
  });
  const crear = (id, extra = {}) =>
    prisma.orden.create({
      data: {
        id,
        creadorId: "digital",
        mesero: "Digital",
        tipoOrden: "domicilio",
        metodoPagoPrevisto: "efectivo",
        total: 18,
        costoEnvio: 2,
        estado: "pendiente",
        impresa: false,
        createdAt: inicio,
        items: {
          create: {
            productoId: "p",
            cantidad: 1,
            precioUnitario: 16,
            subtotal: 16,
          },
        },
        ...extra,
      },
    });
  const domicilio = await crear("domicilio");
  await crear("mesa", {
    creadorId: "ana",
    mesero: "nombre anterior",
    tipoOrden: "local",
    numeroMesa: 3,
    estado: "lista",
    total: 16,
    costoEnvio: null,
  });
  await crear("mesa-ajena", {
    creadorId: "otra",
    mesero: "Ana",
    tipoOrden: "local",
    estado: "lista",
  });
  await crear("mesa-antigua", {
    creadorId: null,
    mesero: "Ana",
    tipoOrden: "local",
    estado: "entregada",
  });
  await crear("llevar", { creadorId: "ana", tipoOrden: "para_llevar" });
  await crear("transferencia", { metodoPagoPrevisto: "transferencia" });
  await crear("anulada", { anulada: true });
  await crear("cancelada", { estado: "cancelada" });
  await crear("sin-aprobar", { estado: "pendiente_aprobacion_stock" });
  await crear("empleado", {
    tipoOperacion: "CONSUMO_EMPLEADO",
    empleadoId: "empleado",
    empleadoNombre: "Empleado",
    consumoRequestId: "consumo-test",
    tipoOrden: "para_llevar",
  });
  await crear("pagada", {
    total: 18,
    montoPagado: 18,
    cobrada: true,
    estado: "cobrada",
  });
  await crear("reabierta", {
    total: 23,
    montoPagado: 18,
    cobrada: false,
    estado: "cobrada",
  });
  await crear("desconocida", { metodoPagoPrevisto: null });
  await crear("pendiente-de-ayer", { createdAt: new Date(inicio.getTime() - 1) });
  await crear("pendiente-de-manana", { createdAt: fin });
  const lista = await listarPorCobrar(ana, null);
  assert.deepEqual(
    lista.ordenes.map((o) => o.id).sort(),
    ["domicilio", "llevar", "mesa", "mesa-antigua", "reabierta"].sort(),
  );
  assert.equal(lista.totalPendientes, 5);
  const tarjeta = lista.ordenes.find((o) => o.id === "domicilio");
  assert.equal(tarjeta.importeEfectivo, 16);
  assert.equal(tarjeta.destinoCobro, "/ordenes/domicilio/cobrar");
  assert.equal(tarjeta.puedeEditar, false);
  assert.equal(lista.ordenes.find((o) => o.id === "mesa").puedeEditar, true);
  assert.equal(
    lista.ordenes.find((o) => o.id === "reabierta").importeEfectivo,
    5,
  );
  const page = await load("lib/cobro-page.tsx").paginaCobro(
    { id: "domicilio" },
    true,
  );
  assert.equal(page.props.endpoints.confirmar, "/api/ordenes/domicilio/cobrar");
  assert.equal(page.props.presentacion.efectivo, 16);
  await assert.rejects(
    () => load("lib/cobro-page.tsx").paginaCobro({ id: "mesa-ajena" }, true),
    /REDIRECT/,
  );
  const detail = load("app/api/ordenes/[id]/route.ts");
  assert.equal(
    (
      await detail.GET(new Request("http://test"), {
        params: Promise.resolve({ id: "domicilio" }),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await detail.GET(new Request("http://test"), {
        params: Promise.resolve({ id: "mesa" }),
      })
    ).status,
    200,
  );

  const cobro = {
    orderId: domicilio.id,
    partes: presentarCobro(domicilio).partesEfectivo,
    expectedRevision: domicilio.printRevision,
    idempotencyKey: randomUUID(),
    origen: "lista",
    user: ana,
  };
  const resultados = await Promise.allSettled([
    collectOrderPayment(cobro),
    collectOrderPayment(cobro),
  ]);
  assert.ok(resultados.every((r) => r.status === "fulfilled"));
  assert.equal(
    await prisma.cobro.count({ where: { ordenId: domicilio.id } }),
    1,
  );
  assert.equal(
    (await prisma.orden.findUnique({ where: { id: domicilio.id } })).impresa,
    false,
  );
  assert.ok(
    !(await listarPorCobrar(ana, null)).ordenes.some(
      (o) => o.id === domicilio.id,
    ),
  );
  assert.equal(
    await prisma.historialOrden.count({
      where: { ordenId: domicilio.id, tipoAccion: "orden_cobrada" },
    }),
    1,
  );
  const race = await crear("carrera");
  const carrera = await Promise.allSettled(
    [randomUUID(), randomUUID()].map((idempotencyKey) =>
      collectOrderPayment({ ...cobro, orderId: race.id, idempotencyKey }),
    ),
  );
  assert.equal(carrera.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await prisma.cobro.count({ where: { ordenId: race.id } }), 1);
  await assert.rejects(
    () =>
      collectOrderPayment({
        ...cobro,
        orderId: "reabierta",
        partes: [{ metodoPago: "efectivo", monto: 0.01 }],
        idempotencyKey: randomUUID(),
      }),
    /sumar exactamente/,
  );
  const mixta = await prisma.orden.findUnique({ where: { id: "reabierta" } });
  const partes = previsualizarMixto(mixta, "2").partes;
  await collectOrderPayment({
    ...cobro,
    orderId: mixta.id,
    partes,
    idempotencyKey: randomUUID(),
  });
  assert.equal(await prisma.cobro.count({ where: { ordenId: mixta.id } }), 2);

  const token = "token_de_prueba_para_cobro_sin_papel";
  await crear("con-url", {
    cobroUrl: `https://test.invalid/ordenes/cobrar/${token}`,
    cobroTokenHash: hashPaymentToken(token),
  });
  const compartida = (await listarPorCobrar(ana, null)).ordenes.find(
    (o) => o.id === "con-url",
  );
  assert.equal(
    compartida.destinoCobro,
    `/ordenes/cobrar/${token}?origen=lista`,
  );
  const previewRoute = load("lib/payment-preview.ts");
  const request = () =>
    new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ efectivo: "6", expectedRevision: 0 }),
    });
  assert.equal(
    (await previewRoute.previewPayment(request(), { id: "mesa-ajena" })).status,
    404,
  );
  assert.equal(
    (await previewRoute.previewPayment(request(), { token })).status,
    200,
  );
  actor = { id: "empleado", nombre: "Empleado", rol: "cocina" };
  assert.equal(
    (await previewRoute.previewPayment(request(), { token })).status,
    403,
  );
  actor = ana;

  // Saldo, OR de autoría y cursor se ejecutan realmente en PostgreSQL.
  await prisma.orden.createMany({
    data: Array.from({ length: 130 }, (_, i) => ({
      id: `pendiente-${String(i).padStart(3, "0")}`,
      creadorId: "ana",
      mesero: "Ana",
      tipoOrden: "local",
      total: 10,
      estado: "lista",
      createdAt: new Date(inicio.getTime() + 1),
    })),
  });
  const ids = [];
  let cursor = null;
  do {
    const page = await listarPorCobrar(ana, leerCursor(cursor));
    assert.equal(page.totalPendientes, 134);
    ids.push(...page.ordenes.map((o) => o.id));
    cursor = page.siguienteCursor;
  } while (cursor);
  assert.equal(ids.length, 134);
  assert.equal(ids.length, new Set(ids).size);

  await prisma.orden.createMany({
    data: Array.from({ length: 5000 }, (_, i) => ({
      id: `historica-${i}`,
      creadorId: "digital",
      mesero: "Digital",
      tipoOrden: "domicilio",
      metodoPagoPrevisto: "efectivo",
      total: 18,
      montoPagado: 18,
      cobrada: true,
      estado: "cobrada",
      createdAt: new Date(inicio.getTime() - 1),
    })),
  });
  await prisma.$executeRawUnsafe(`ANALYZE "${schema}"."Orden"`);
  const plan = await prisma.$queryRawUnsafe(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM "${schema}"."Orden" WHERE NOT anulada AND "tipoOperacion"='VENTA_CLIENTE' AND "empleadoId" IS NULL AND total > "montoPagado" AND estado IN ('pendiente','en_preparacion','lista','entregada','cobrada') AND (("tipoOrden" IN ('local','para_llevar') AND ("creadorId"=$1 OR ("creadorId" IS NULL AND mesero=$2))) OR ("tipoOrden"='domicilio' AND "metodoPagoPrevisto"='efectivo')) AND "createdAt" >= $3 AND "createdAt" < $4 ORDER BY "createdAt",id LIMIT 51`,
    ana.id,
    ana.nombre,
    inicio,
    fin,
  );
  const explanation = plan[0]["QUERY PLAN"][0];
  console.log(
    `PostgreSQL: filtros, permisos, cobro sin impresión, idempotencia, carrera, mixto y paginación OK. Consulta: ${explanation["Execution Time"]} ms con 5000 órdenes históricas.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma
      .$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      .catch(() => {
        console.error(`No se pudo retirar el esquema de pruebas ${schema}`);
        process.exitCode = 1;
      });
    await prisma.$disconnect();
  });
