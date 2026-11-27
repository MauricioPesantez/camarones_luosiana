const assert = require("node:assert/strict");
const { loader } = require("./por-cobrar.test-loader.cjs");
const { Prisma } = require("@prisma/client");

let actor = { id: "ana", nombre: "Ana", rol: "mesero" };
let rows = [];
let captured;
let countWhere;
const db = {
  orden: {
    fields: { montoPagado: "montoPagado" },
    count: async ({ where }) => {
      countWhere = where;
      return rows.length;
    },
    findMany: async (args) => {
      captured = args;
      return rows;
    },
    findFirst: async (args) => {
      captured = args;
      return rows[0] ?? null;
    },
  },
  sesionCaja: { findUnique: async () => ({ estado: "abierta" }) },
  $transaction: async (fn) => fn(db),
};
const load = loader(db, () => actor);
const { presentarCobro, previsualizarMixto } = load(
  "lib/presentacion-cobro.ts",
);
const { paymentBlockReason } = load("lib/payment-policy.ts");
const { alcancePorCobrar, leerCursor, listarPorCobrar } = load(
  "lib/ordenes-por-cobrar.ts",
);
const { obtenerFechaEcuador, obtenerRangoEcuador } = load("lib/fecha-ecuador.ts");
const base = {
  id: "o1",
  tipoOrden: "domicilio",
  total: new Prisma.Decimal(18),
  montoPagado: new Prisma.Decimal(0),
  costoEnvio: new Prisma.Decimal(2),
  anulada: false,
  tipoOperacion: "VENTA_CLIENTE",
  estado: "pendiente",
  printRevision: 2,
  creadorId: "digital",
  mesero: "Digital",
  empleadoId: null,
  cobrada: false,
  cobroUrl: null,
  createdAt: new Date("2026-11-23T22:00:00Z"),
  numeroDiario: 7,
  fechaNumeroDiario: "2026-11-23",
  nombreCliente: "Cliente",
  numeroMesa: null,
  telefonoCliente: null,
  items: [
    {
      cantidad: 1,
      subtotal: new Prisma.Decimal(16),
      nombreProducto: "Combo",
      producto: { nombre: "Anterior" },
    },
  ],
};

async function main() {
  assert.equal(presentarCobro(base).efectivo, 16);
  assert.equal(presentarCobro(base).saldo, 18);
  assert.equal(presentarCobro(base).subtotalProductos, 16);
  assert.deepEqual(previsualizarMixto(base, "6"), {
    efectivo: 6,
    transferencia: 10,
    partes: [
      { metodoPago: "efectivo", monto: 8 },
      { metodoPago: "transferencia", monto: 10 },
    ],
  });
  assert.equal(previsualizarMixto(base, "0").partes[0].monto, 2);
  const reabierta = { ...base, total: 23, montoPagado: 18, estado: "cobrada" };
  assert.equal(presentarCobro(reabierta).efectivo, 5);
  assert.equal(presentarCobro(reabierta).explicacionEfectivo, null);
  assert.deepEqual(previsualizarMixto(reabierta, "2").partes, [
    { metodoPago: "efectivo", monto: 2 },
    { metodoPago: "transferencia", monto: 3 },
  ]);
  for (const value of [
    "-1",
    "0.001",
    "",
    "NaN",
    "Infinity",
    1,
    null,
    "99999999",
  ])
    assert.throws(() => previsualizarMixto(base, value));
  assert.throws(() => previsualizarMixto(base, "16")); // mixto exige transferencia positiva
  assert.equal(paymentBlockReason(base, "lista"), null);
  assert.match(
    paymentBlockReason({ ...base, tipoOrden: "local" }, "lista"),
    /listas/,
  );
  assert.equal(paymentBlockReason({ ...base, tipoOrden: "local" }, "qr"), null);
  assert.equal(paymentBlockReason(reabierta, "lista"), null);
  for (const extra of [
    { anulada: true },
    { tipoOperacion: "CONSUMO_EMPLEADO" },
    { estado: "cancelada" },
    { estado: "pendiente_aprobacion_stock" },
    { montoPagado: 18 },
  ])
    assert.ok(paymentBlockReason({ ...base, ...extra }, "qr"));
  assert.equal(alcancePorCobrar(actor).total.gt, "montoPagado");
  assert.equal(alcancePorCobrar(actor).OR[1].metodoPagoPrevisto, "efectivo");
  assert.throws(() => leerCursor("invalid"));
  assert.throws(() =>
    leerCursor(
      Buffer.from(
        JSON.stringify({ id: "../../otro", createdAt: "bad" }),
      ).toString("base64url"),
    ),
  );
  rows = [base];
  const lista = await listarPorCobrar(actor, null);
  assert.equal(lista.ordenes[0].destinoCobro, "/ordenes/o1/cobrar");
  assert.equal(lista.ordenes[0].puedeEditar, false);
  assert.equal(lista.ordenes[0].importeEfectivo, 16);
  assert.equal(captured.take, 51);
  assert.equal("cobroTokenHash" in captured.select, false);
  const { inicio, fin } = obtenerRangoEcuador(
    obtenerFechaEcuador(new Date(lista.consultadoAt)),
  );
  assert.deepEqual(countWhere.createdAt, { gte: inicio, lt: fin });
  assert.deepEqual(captured.where.AND[0], countWhere);
  rows = Array.from({ length: 51 }, (_, i) => ({ ...base, id: `o${i}` }));
  const paginada = await listarPorCobrar(actor, null);
  assert.equal(paginada.ordenes.length, 50);
  assert.equal(paginada.totalPendientes, 51);
  assert.equal(leerCursor(paginada.siguienteCursor).id, "o49");
  const route = load("app/api/ordenes/por-cobrar/route.ts");
  actor = null;
  assert.equal((await route.GET(new Request("http://test/"))).status, 401);
  actor = { id: "c", nombre: "Cocina", rol: "cocina" };
  assert.equal((await route.GET(new Request("http://test/"))).status, 403);
  actor = { id: "ana", nombre: "Ana", rol: "mesero" };
  assert.equal(
    (await route.GET(new Request("http://test/?cursor=bad"))).status,
    400,
  );
  rows = [base];
  const { previewPayment } = load("lib/payment-preview.ts");
  const previewRequest = (body) =>
    new Request("http://test/", { method: "POST", body: JSON.stringify(body) });
  assert.equal(
    (
      await previewPayment(
        previewRequest({ efectivo: "6", expectedRevision: 1 }),
        { id: "o1" },
      )
    ).status,
    409,
  );
  const preview = await previewPayment(
    previewRequest({ efectivo: "6", expectedRevision: 2 }),
    { id: "o1" },
  );
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).transferencia, 10);
  assert.ok(captured.where.AND); // el acceso por ID conserva el alcance del mesero
  assert.equal(
    (
      await previewPayment(
        previewRequest({ efectivo: "-1", expectedRevision: 2 }),
        { id: "o1" },
      )
    ).status,
    400,
  );
  console.log(
    "por-cobrar: cálculos, permisos, proyección, cursor y previsualización OK",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
