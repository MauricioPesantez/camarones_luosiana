import assert from "node:assert/strict";
import type { RevisionGuardada } from "../../../types/revision";
import { crearColaGuardado, crearEnvioRevision, type EstadoGuardado } from "./cola-guardado";

type Resultado = "ok" | "error" | "conflicto";

/** Envíos que se resuelven a mano, para controlar el orden. */
function prepararCola() {
  const enviados: string[] = [];
  const estados: EstadoGuardado[] = [];
  const abiertos: { resolver: (r: Resultado) => void; fallar: (e: Error) => void }[] = [];
  let enCurso = 0;
  let maximo = 0;
  const cola = crearColaGuardado<string>({
    enviar: (valor) => {
      enviados.push(valor);
      maximo = Math.max(maximo, ++enCurso);
      return new Promise<Resultado>((resolver, fallar) => abiertos.push({ resolver, fallar }))
        .finally(() => enCurso--);
    },
    alCambiar: (estado) => estados.push(estado),
  });
  const responder = async (r: Resultado) => {
    abiertos.shift()!.resolver(r);
    await new Promise((listo) => setImmediate(listo));
  };
  return { cola, enviados, estados, abiertos, responder, maximo: () => maximo };
}

async function pruebasCola() {
  {
    const t = prepararCola();
    assert.equal(await t.cola.vaciar(), true, "Sin nada que guardar ya está vacía");
    t.cola.poner("a");
    t.cola.poner("b");
    t.cola.poner("c");
    const vacia = t.cola.vaciar();
    assert.deepEqual(t.enviados, ["a"], "El segundo espera al primero");
    await t.responder("ok");
    assert.deepEqual(t.enviados, ["a", "c"], "Solo se envía el último valor");
    await t.responder("ok");
    assert.equal(await vacia, true);
    assert.equal(t.maximo(), 1, "Nunca hay dos envíos a la vez");
    assert.deepEqual(t.estados, ["guardando", "guardado"]);
    t.cola.reintentar();
    assert.equal(t.enviados.length, 2, "Sin error no hay nada que reintentar");
    t.cola.poner("d");
    await t.responder("ok");
    assert.deepEqual(t.enviados, ["a", "c", "d"], "Después de vaciarse sigue funcionando");
  }
  {
    const t = prepararCola();
    t.cola.poner("a");
    const vacia = t.cola.vaciar();
    await t.responder("error");
    assert.equal(await vacia, false);
    assert.equal(await t.cola.vaciar(), false, "Sigue sin guardar");
    t.cola.poner("b");
    t.cola.poner("c");
    assert.deepEqual(t.enviados, ["a"], "Tras un error no envía hasta reintentar");
    t.cola.reintentar();
    t.cola.reintentar();
    assert.deepEqual(t.enviados, ["a", "c"], "Reintenta una vez, con el último valor");
    await t.responder("ok");
    assert.equal(await t.cola.vaciar(), true);
    assert.deepEqual(t.estados, ["guardando", "error", "guardando", "guardado"]);
  }
  {
    const t = prepararCola();
    t.cola.poner("a");
    await t.responder("error");
    t.cola.reintentar();
    assert.deepEqual(t.enviados, ["a", "a"], "Sin valor nuevo reenvía el que falló");
    t.cola.poner("b");
    await t.responder("error");
    t.cola.reintentar();
    assert.deepEqual(t.enviados, ["a", "a", "b"], "El valor nuevo reemplaza al que falló");
    await t.responder("ok");
  }
  {
    const t = prepararCola();
    t.cola.poner("a");
    const vacia = t.cola.vaciar();
    t.abiertos.shift()!.fallar(new Error("red"));
    assert.equal(await vacia, false, "Un envío que lanza cuenta como error");
    assert.deepEqual(t.estados, ["guardando", "error"]);
  }
  {
    const t = prepararCola();
    t.cola.poner("a");
    const vacia = t.cola.vaciar();
    await t.responder("conflicto");
    assert.equal(await vacia, false);
    t.cola.reintentar();
    t.cola.poner("b");
    t.cola.reintentar();
    assert.deepEqual(t.enviados, ["a"], "Tras un conflicto no se envía nada más");
    assert.equal(await t.cola.vaciar(), false);
    assert.deepEqual(t.estados, ["guardando", "conflicto"]);
  }
}

const revision = (version: number): RevisionGuardada => ({
  ordenId: "o1", detalle: { faltantes: [], itemsVistos: [] }, revisada: false,
  conErrores: false, version, revisadaPorNombre: null, revisadaAt: null,
});

async function pruebasEnvio() {
  const cuerpos: { revisada: boolean; version: number; huella: string }[] = [];
  const guardados: [number, boolean][] = [];
  const rechazos: (string | null)[] = [];
  let responder: () => Response = () => Response.json({});
  const enviar = crearEnvioRevision({
    ordenId: "o1",
    version: 0,
    huella: "h",
    alGuardar: (r, valor) => guardados.push([r.version, valor.revisada]),
    alRechazar: (error) => rechazos.push(error),
    transportar: (async (url, opciones) => {
      assert.equal(url, "/api/admin/ordenes/o1/revision");
      assert.equal(opciones?.method, "PUT");
      cuerpos.push(JSON.parse(String(opciones?.body)));
      return responder();
    }) as typeof fetch,
  });
  const marcas = { productos: [], faltantes: [], cobro: null, total: null };
  const no = { marcas, revisada: false };
  const si = { marcas, revisada: true };
  const ok = (version: number) => () => Response.json({ revision: revision(version) });
  const sinRed = () => { throw new TypeError("Failed to fetch"); };
  const ultimos = (n: number) => cuerpos.slice(-n).map((c) => [c.revisada, c.version]);

  responder = ok(1);
  assert.equal(await enviar(no), "ok");
  assert.deepEqual(cuerpos[0], { marcas, revisada: false, version: 0, huella: "h" });
  responder = ok(2);
  assert.equal(await enviar(no), "ok");
  assert.deepEqual(ultimos(1), [[false, 1]], "Usa la versión de la última respuesta");

  // La respuesta se pierde y luego hay otra marca: primero se repite lo que quizá sí se guardó.
  responder = sinRed;
  assert.equal(await enviar(no), "error");
  let version = 3;
  responder = () => Response.json({ revision: revision(version++) });
  assert.equal(await enviar(si), "ok");
  assert.deepEqual(ultimos(2), [[false, 2], [true, 3]]);

  // Reintentar el mismo valor no lo manda dos veces.
  responder = sinRed;
  assert.equal(await enviar(no), "error");
  const antes = cuerpos.length;
  responder = ok(5);
  assert.equal(await enviar(no), "ok");
  assert.equal(cuerpos.length, antes + 1);

  // Rechazado por el servidor: no se guardó, no hay nada que repetir.
  responder = () => Response.json({ error: "Cantidad real inválida" }, { status: 400 });
  assert.equal(await enviar(si), "error");
  assert.equal(rechazos.at(-1), "Cantidad real inválida");
  responder = ok(6);
  const previos = cuerpos.length;
  assert.equal(await enviar(no), "ok");
  assert.equal(cuerpos.length, previos + 1);
  assert.equal(rechazos.at(-1), null, "El siguiente envío borra el rechazo");
  responder = () => new Response("<html>", { status: 400 });
  assert.equal(await enviar(no), "error");
  assert.equal(rechazos.at(-1), null, "Un 400 sin JSON no trae texto");

  responder = () => new Response("<html>", { status: 200 });
  assert.equal(await enviar(no), "error", "JSON inválido");
  responder = () => Response.json({}, { status: 200 });
  assert.equal(await enviar(no), "error", "Respuesta sin revisión");
  responder = () => Response.json({ error: "x" }, { status: 401 });
  assert.equal(await enviar(no), "error", "Sin sesión");
  assert.equal(rechazos.at(-1), "x");
  for (const status of [401, 403, 404]) {
    responder = () => Response.json({ error: `Motivo ${status}` }, { status });
    assert.equal(await enviar(no), "error");
    assert.equal(rechazos.at(-1), `Motivo ${status}`);
  }
  responder = () => new Response("<html>", { status: 403 });
  assert.equal(await enviar(no), "error");
  assert.equal(rechazos.at(-1), null, "Un 403 sin JSON no trae texto");
  responder = () => Response.json({ error: "Error interno" }, { status: 500 });
  assert.equal(await enviar(no), "error");
  assert.equal(rechazos.at(-1), null, "Un 500 no es un rechazo");
  responder = () => Response.json({ error: "x" }, { status: 409 });
  assert.equal(await enviar(si), "conflicto");
  // El tercero es el repetido: alGuardar recibe su valor (false), no el nuevo (true).
  assert.deepEqual(guardados, [[1, false], [2, false], [3, false], [4, true], [5, false], [6, false]]);
}

async function run() {
  await pruebasCola();
  await pruebasEnvio();
  console.log("cola-guardado tests passed");
}
run().catch((error) => { console.error(error); process.exit(1); });
