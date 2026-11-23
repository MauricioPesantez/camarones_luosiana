import assert from "node:assert/strict";
import {
  construirDetalle, type MarcasRevision, type OrdenRevisable, type RevisionGuardada,
} from "../../../types/revision";
import { borradorInicial, crearColasRevision, type Borrador } from "./useColasRevision";

type Orden = OrdenRevisable & { id: string };
const orden = (id: string): Orden => ({
  id, anulada: false, estado: "cobrada", total: 5, items: [], pagos: [],
});
const marcas = (cobro: MarcasRevision["cobro"]): MarcasRevision => ({
  productos: [], faltantes: [], cobro, total: null,
});
const borrador = (cobro: MarcasRevision["cobro"]): Borrador => ({
  marcas: marcas(cobro), revisada: false, cambios: [], anteriores: [], eraRevisada: false,
});
const turno = () => new Promise((listo) => setImmediate(listo));

type Cuerpo = { marcas: MarcasRevision; revisada: boolean; version: number };
/** Cada orden responde lo que le toque; "espera" queda en curso hasta soltarla. */
function preparar() {
  const respuestas = new Map<string, () => Promise<Response>>();
  const enviados: { id: string; cuerpo: Cuerpo }[] = [];
  const guardadas: RevisionGuardada[] = [];
  const soltar = new Map<string, (r: Response) => void>();
  const colas = crearColasRevision(
    (r) => guardadas.push(r),
    (async (url, opciones) => {
      const id = String(url).split("/")[4];
      enviados.push({ id, cuerpo: JSON.parse(String(opciones?.body)) });
      return respuestas.get(id)!();
    }) as typeof fetch,
  );
  const ok = (id: string) => async () => {
    const { version, revisada } = enviados.filter((e) => e.id === id).at(-1)!.cuerpo;
    return Response.json({
      revision: {
        ordenId: id, detalle: { faltantes: [], itemsVistos: [] }, revisada,
        conErrores: false, version: version + 1, revisadaPorNombre: null, revisadaAt: null,
      },
    });
  };
  const sinRed = async (): Promise<Response> => { throw new TypeError("Failed to fetch"); };
  const estado = (status: number, cuerpo: object = {}) => async () => Response.json(cuerpo, { status });
  const espera = (id: string) => () => new Promise<Response>((r) => soltar.set(id, r));
  const responde = (id: string, r: () => Promise<Response>) => respuestas.set(id, r);
  const versiones = (id: string) => enviados.filter((e) => e.id === id).map((e) => e.cuerpo.version);
  return { colas, enviados, guardadas, soltar, ok, sinRed, estado, espera, responde, versiones };
}

async function alCerrar() {
  const t = preparar();
  t.colas.abrir();
  t.responde("bien", t.ok("bien"));
  t.responde("red", t.sinRed);
  t.responde("choque", t.estado(409));
  t.responde("lenta", t.espera("lenta"));
  t.responde("lentaMal", t.espera("lentaMal"));
  for (const id of ["bien", "red", "choque", "lenta", "lentaMal"])
    t.colas.poner(orden(id), 7, borrador("bien"));
  await turno();
  assert.deepEqual(t.colas.leer().guardados, {
    bien: "guardado", red: "error", choque: "conflicto", lenta: "guardando", lentaMal: "guardando",
  });

  t.colas.cerrar();
  assert.deepEqual(
    Object.keys(t.colas.leer().borradores).sort(), ["choque", "lenta", "lentaMal", "red"],
    "Al cerrar solo se suelta lo ya guardado",
  );
  assert.equal(t.colas.leer().guardados.red, "error");
  assert.equal(t.colas.leer().guardados.choque, "conflicto");

  // Las que estaban en curso se deciden cuando terminan.
  t.soltar.get("lenta")!(await t.ok("lenta")());
  t.soltar.get("lentaMal")!(Response.json({}, { status: 500 }));
  await turno();
  assert.deepEqual(Object.keys(t.colas.leer().borradores).sort(), ["choque", "lentaMal", "red"]);
  assert.equal(t.colas.leer().guardados.lentaMal, "error");
  assert.deepEqual(t.guardadas.map((r) => r.ordenId).sort(), ["bien", "lenta"]);

  // Al reabrir: la misma cola, con su versión y sin mandar nada por su cuenta.
  t.colas.abrir();
  t.colas.poner(orden("red"), 3, borrador("efectivo"));
  await turno();
  assert.deepEqual(t.versiones("red"), [7], "Sigue en error: espera a Reintentar");
  t.responde("red", t.ok("red"));
  t.colas.reintentar("red");
  assert.equal(await t.colas.vaciar(["red"]), true);
  assert.deepEqual(t.versiones("red"), [7, 7, 8], "Repite lo incierto y sigue con su propia versión");
  assert.equal(t.enviados.at(-1)!.cuerpo.marcas.cobro, "efectivo");
  assert.equal(await t.colas.vaciar(["choque"]), false);
  assert.equal(await t.colas.vaciar(["desconocida", "red"]), true, "Sin cola no hay nada pendiente");

  // Una orden soltada parte otra vez de los datos frescos.
  t.colas.poner(orden("bien"), 9, borrador("bien"));
  await turno();
  assert.deepEqual(t.versiones("bien"), [7, 9]);
}

async function revisada() {
  const t = preparar();
  t.colas.abrir();
  t.responde("a", t.sinRed);
  t.colas.poner(orden("a"), 0, borrador("bien"), true);
  await turno();
  assert.equal(t.colas.leer().borradores.a.revisada, false, "Sin confirmar no queda revisada");
  t.responde("a", t.ok("a"));
  t.colas.reintentar("a");
  await t.colas.vaciar(["a"]);
  assert.equal(t.colas.leer().borradores.a.revisada, true);

  // La respuesta de un valor viejo no cambia lo último que hizo el admin.
  t.responde("a", t.espera("a"));
  t.colas.poner(orden("a"), 0, borrador("bien"), true);
  t.colas.poner(orden("a"), 0, borrador("mixto"));
  t.responde("a", t.ok("a"));
  t.soltar.get("a")!(await t.ok("a")());
  await t.colas.vaciar(["a"]);
  assert.equal(t.colas.leer().borradores.a.revisada, false);
  assert.equal(t.colas.leer().borradores.a.marcas.cobro, "mixto");
}

async function descartarYOlvidar() {
  const t = preparar();
  t.colas.abrir();
  t.responde("red", t.sinRed);
  t.responde("otra", t.sinRed);
  t.responde("lenta", t.espera("lenta"));
  for (const id of ["red", "otra", "lenta"]) t.colas.poner(orden(id), 0, borrador("bien"));
  await turno();
  t.colas.descartar(["red", "lenta"]);
  t.colas.cerrar();
  assert.deepEqual(Object.keys(t.colas.leer().borradores).sort(), ["lenta", "otra"]);
  t.soltar.get("lenta")!(Response.json({}, { status: 500 }));
  await turno();
  assert.deepEqual(t.colas.leer().guardados, { otra: "error" }, "Lo descartado se suelta aunque falle");

  // El envío en curso de una orden olvidada no la revive.
  t.colas.abrir();
  t.responde("z", t.espera("z"));
  t.colas.poner(orden("z"), 0, borrador("bien"));
  t.colas.olvidar(["z", "otra"]);
  t.soltar.get("z")!(await t.ok("z")());
  await turno();
  assert.deepEqual(t.colas.leer(), { borradores: {}, guardados: {}, rechazos: {} });
}

async function rechazo() {
  const t = preparar();
  t.colas.abrir();
  t.responde("a", t.estado(400, { error: "El producto no existe en el catálogo" }));
  t.colas.poner(orden("a"), 0, borrador("bien"));
  await turno();
  assert.equal(t.colas.leer().guardados.a, "error");
  assert.equal(t.colas.leer().rechazos.a, "El producto no existe en el catálogo");
  t.responde("a", t.sinRed);
  t.colas.reintentar("a");
  await turno();
  assert.equal(t.colas.leer().rechazos.a, null, "Un fallo de red ya no muestra el rechazo anterior");
}

async function avisos() {
  const t = preparar();
  let veces = 0;
  const dejar = t.colas.suscribir(() => veces++);
  t.responde("a", t.ok("a"));
  const antes = t.colas.leer();
  t.colas.poner(orden("a"), 0, borrador("bien"));
  assert.notEqual(t.colas.leer(), antes);
  assert.ok(veces > 0);
  await turno();
  dejar();
  const ya = veces;
  t.colas.poner(orden("a"), 0, borrador("bien"));
  assert.equal(veces, ya);
  await turno();
}

async function cambios() {
  const pagada = (metodoPago: string): Orden => ({ ...orden("a"), pagos: [{ metodoPago, monto: 5 }] });
  const guardada = (m: MarcasRevision, revisada: boolean): RevisionGuardada => {
    const hecho = construirDetalle(pagada("efectivo"), m, new Map());
    assert.ok(hecho.ok);
    return {
      ordenId: "a", detalle: hecho.detalle, revisada, conErrores: false, version: 1,
      revisadaPorNombre: null, revisadaAt: null,
    };
  };
  assert.deepEqual(borradorInicial(pagada("efectivo"), null), borrador(null));

  // Nunca marcada revisada: igual se explica por qué perdió la marca.
  const aMedias = guardada(marcas("bien"), false);
  const perdio = borradorInicial(pagada("transferencia"), aMedias);
  assert.deepEqual(perdio, { ...borrador(null), cambios: ["Cambió el cobro"] });
  assert.deepEqual(borradorInicial(pagada("efectivo"), aMedias), borrador("bien"), "Nada cambió");

  const completa = guardada({ ...marcas("bien"), total: { estado: "bien" } }, true);
  const antesRevisada = borradorInicial(pagada("transferencia"), completa);
  assert.deepEqual(
    [antesRevisada.cambios, antesRevisada.revisada, antesRevisada.eraRevisada],
    [["Cambió el cobro"], false, true],
  );
  const conError = guardada(marcas("transferencia"), true);
  assert.deepEqual(
    borradorInicial(pagada("transferencia"), conError).anteriores.map((e) => e.texto),
    ["Efectivo registrado, fue transferencia"],
    "El error anotado se conserva cuando la orden cambia",
  );
  const igual = borradorInicial(pagada("efectivo"), completa);
  assert.deepEqual([igual.cambios, igual.revisada, igual.eraRevisada], [[], true, false]);

  // El aviso sobrevive al autoguardado que rehace la foto, hasta quedar revisada.
  const t = preparar();
  t.colas.abrir();
  t.responde("a", t.ok("a"));
  t.colas.poner(pagada("transferencia"), 1, { ...perdio, marcas: marcas("bien") });
  assert.equal(await t.colas.vaciar(["a"]), true);
  assert.deepEqual(t.colas.leer().borradores.a.cambios, ["Cambió el cobro"]);
  // También si quedó revisada con "Reintentar" después de un fallo.
  t.responde("a", t.sinRed);
  t.colas.poner(pagada("transferencia"), 1, t.colas.leer().borradores.a, true);
  assert.equal(await t.colas.vaciar(["a"]), false);
  assert.deepEqual(t.colas.leer().borradores.a.cambios, ["Cambió el cobro"]);
  t.responde("a", t.ok("a"));
  t.colas.reintentar("a");
  assert.equal(await t.colas.vaciar(["a"]), true);
  assert.deepEqual(t.colas.leer().borradores.a.cambios, []);
}

async function run() {
  await cambios();
  await alCerrar();
  await revisada();
  await descartarYOlvidar();
  await rechazo();
  await avisos();
  console.log("colas-revision tests passed");
}
run().catch((error) => { console.error(error); process.exit(1); });
