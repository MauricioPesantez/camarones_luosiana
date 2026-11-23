import assert from "node:assert/strict";
import {
  anterioresDe, construirDetalle, erroresDe, estadoRevision, huellaOrden, llevaCobro, marcasVigentes,
  metodoRegistrado, pendientes, sePuedeRevisar, validarSolicitud,
  type DetalleRevision, type MarcasRevision, type OrdenRevisable, type RevisionGuardada,
} from "./revision";

const base: OrdenRevisable = {
  anulada: false,
  estado: "cobrada",
  total: 21,
  items: [
    { id: "i1", cantidad: 2, nivelPicante: "leve", precioUnitario: 9.5, producto: { nombre: "Combo Simple" } },
    { id: "i2", cantidad: 1, nivelPicante: null, precioUnitario: 2, producto: { nombre: "Cerveza" } },
  ],
  pagos: [{ metodoPago: "transferencia", monto: 21 }],
};
const o = (c: Partial<OrdenRevisable>): OrdenRevisable => ({ ...base, ...c });
const vacias: MarcasRevision = { productos: [], faltantes: [], cobro: null, total: null };
const todo: MarcasRevision = {
  productos: [{ itemId: "i1", estado: "bien" }, { itemId: "i2", estado: "bien" }],
  faltantes: [], cobro: "bien", total: { estado: "bien" },
};
const catalogo = new Map([["p1", { nombre: "Cola", precio: "1.50" }]]);

// sePuedeRevisar / llevaCobro / metodoRegistrado
assert.equal(sePuedeRevisar(base), true);
assert.equal(sePuedeRevisar(o({ anulada: true })), false);
assert.equal(sePuedeRevisar(o({ estado: "cancelada" })), false);
assert.equal(sePuedeRevisar(o({ estado: "pendiente_aprobacion_stock" })), false);
assert.equal(sePuedeRevisar(o({ tipoOperacion: "CONSUMO_EMPLEADO" })), false);
const porCobrar = o({ empleadoId: "e1", estado: "entregada", pagos: [] });
assert.equal(sePuedeRevisar(porCobrar), true);
assert.equal(llevaCobro(base), true);
assert.equal(llevaCobro(o({ empleadoId: "e1" })), false);
assert.equal(llevaCobro(o({ total: 0, pagos: [] })), false);
assert.equal(llevaCobro(o({ total: 14, pagos: [] })), true);
assert.equal(metodoRegistrado(base), "transferencia");
assert.equal(metodoRegistrado(o({ pagos: [{ metodoPago: "efectivo", monto: 1 }, { metodoPago: "transferencia", monto: 20 }] })), "mixto");
assert.equal(metodoRegistrado(o({ pagos: [] })), null);
assert.equal(metodoRegistrado(o({ pagos: [{ metodoPago: "efectivo", monto: 21, estado: "REEMBOLSADO" }] })), null);

// huella
const h = huellaOrden(base);
assert.equal(huellaOrden(o({ total: "21.00" })), h);
assert.equal(huellaOrden(o({ items: [...base.items].reverse() })), h);
const dos = [{ metodoPago: "efectivo", monto: 1 }, { metodoPago: "transferencia", monto: 20 }];
assert.equal(huellaOrden(o({ pagos: dos })), huellaOrden(o({ pagos: [...dos].reverse() })));
assert.equal(huellaOrden(o({ pagos: [...(base.pagos ?? []), { metodoPago: "efectivo", monto: 5, estado: "REEMBOLSADO" }] })), h);
assert.notEqual(huellaOrden(o({ items: [{ ...base.items[0], cantidad: 3 }, base.items[1]] })), h);
assert.notEqual(huellaOrden(o({ items: [{ ...base.items[0], nivelPicante: "natural" }, base.items[1]] })), h);
assert.notEqual(huellaOrden(o({ pagos: [{ metodoPago: "efectivo", monto: 21 }] })), h);
assert.notEqual(huellaOrden(o({ total: 23 })), h);

// pendientes
assert.equal(pendientes(base, vacias).cuantos, 4);
assert.equal(pendientes(base, todo).cuantos, 0);
assert.equal(pendientes(o({ empleadoId: "e1" }), vacias).cobro, false);

// validarSolicitud
const sol = (marcas: Partial<MarcasRevision> | null, extra: Record<string, unknown> = {}) =>
  ({ marcas: marcas && { ...vacias, ...marcas }, revisada: false, version: 0, huella: "h", ...extra });
const ok = (s: unknown) => validarSolicitud(s).ok;
assert.equal(ok(sol({})), true);
const mal = (c: number) => sol({ productos: [{ itemId: "i1", estado: "mal", cantidadReal: c }] });
assert.equal(ok(mal(0)) && ok(mal(99)), true);
for (const c of [-1, 100, 1.5]) assert.equal(ok(mal(c)), false);
assert.equal(ok(sol({ productos: [{ itemId: "i1", estado: "bien" }, { itemId: "i1", estado: "bien" }] })), false);
assert.equal(ok(sol({ faltantes: Array.from({ length: 51 }, (_, i) => ({ productoId: `p${i}`, cantidad: 1 })) })), false);
assert.equal(ok(sol({ faltantes: [{ productoId: "p1", cantidad: 0 }] })), false);
assert.equal(ok(sol({ faltantes: [{ productoId: "p1", cantidad: 1 }, { productoId: "p1", cantidad: 2 }] })), false);
for (const d of [0, 10000, 1.001]) assert.equal(ok(sol({ total: { estado: "de_mas", diferencia: d } })), false);
assert.equal(ok(sol({ total: { estado: "de_menos", diferencia: 9999.99 } })), true);
assert.equal(ok(sol({ cobro: "tarjeta" as never })), false);
assert.equal(ok(sol({}, { version: -1 })), false);
assert.equal(ok(sol({}, { huella: "" })), false);
assert.equal(ok(sol({}, { revisada: "si" })), false);
assert.equal(ok(null), false);
assert.equal(ok(sol(null)), false);
const limpia = validarSolicitud({ ...sol({ productos: [{ itemId: "i1", estado: "bien", x: 1 } as never] }), extra: 1 });
assert.deepEqual(limpia.ok && limpia.data.marcas.productos, [{ itemId: "i1", estado: "bien" }]);
assert.equal(limpia.ok && "extra" in limpia.data, false);

// construirDetalle
const det = (orden: OrdenRevisable, m: Partial<MarcasRevision>) => construirDetalle(orden, { ...vacias, ...m }, catalogo);
assert.equal(det(base, { productos: [{ itemId: "zz", estado: "bien" }] }).ok, false);
assert.equal(det(base, { productos: [{ itemId: "i1", estado: "mal", cantidadReal: 2 }] }).ok, false);
assert.equal(det(base, { cobro: "transferencia" }).ok, false);
assert.equal(det(o({ pagos: dos }), { cobro: "mixto" }).ok, false);
assert.equal(det(o({ empleadoId: "e1" }), { cobro: "efectivo" }).ok, false);
assert.equal(det(base, { faltantes: [{ productoId: "nope", cantidad: 1 }] }).ok, false);
const r = det(base, {
  productos: [{ itemId: "i1", estado: "mal", cantidadReal: 1 }],
  faltantes: [{ productoId: "p1", cantidad: 1 }],
  cobro: "efectivo",
  total: { estado: "de_mas", diferencia: 3 },
});
assert.ok(r.ok);
const d = r.ok ? r.detalle : (null as never);
assert.deepEqual(d.faltantes, [{ productoId: "p1", nombre: "Cola", cantidad: 1, precio: 1.5 }]);
assert.equal(d.productos?.[0].nombre, "Combo Simple");
assert.equal(d.total?.sistema, 21);
assert.deepEqual(d.itemsVistos, ["i1", "i2"]);
assert.deepEqual(erroresDe(d).map((e) => [e.texto, e.de]), [
  ["Combo Simple: registrado 2, real 1", "creador"],
  ["Faltó 1× Cola", "creador"],
  ["Transferencia registrada, fue efectivo", "cobrador"],
  ["Cobró $3.00 de más", "cobrador"],
]);

// marcasVigentes
const completo = construirDetalle(base, todo, catalogo);
assert.ok(completo.ok);
const dc: DetalleRevision = completo.ok ? completo.detalle : (null as never);
const vig = (orden: OrdenRevisable) => marcasVigentes(orden, dc);
assert.deepEqual(vig(base), { marcas: todo, cambios: [] });
assert.deepEqual(marcasVigentes(base, null), { marcas: vacias, cambios: [] });
const sinMarca = (orden: OrdenRevisable) => pendientes(orden, vig(orden).marcas);
const v = vig(o({ items: [base.items[0], { ...base.items[1], cantidad: 2 }] }));
assert.deepEqual(sinMarca(o({ items: [base.items[0], { ...base.items[1], cantidad: 2 }] })).productos, ["i2"]);
assert.match(v.cambios.join(), /Cerveza/);
assert.deepEqual(sinMarca(o({ items: [{ ...base.items[0], nivelPicante: "natural" }, base.items[1]] })).productos, ["i1"]);
const ef = o({ pagos: [{ metodoPago: "efectivo", monto: 21 }] });
assert.deepEqual([sinMarca(ef).productos, sinMarca(ef).cobro, sinMarca(ef).total], [[], true, false]);
const t23 = o({ total: 23 });
assert.deepEqual([sinMarca(t23).productos, sinMarca(t23).cobro, sinMarca(t23).total], [[], false, true]);
const nuevo = o({ items: [...base.items, { id: "i3", cantidad: 1, precioUnitario: 3, producto: { nombre: "Papas" } }] });
assert.deepEqual(sinMarca(nuevo).productos, ["i3"]);
assert.match(vig(nuevo).cambios.join(), /Papas/);
const conCero = o({ items: [...base.items, { id: "i4", cantidad: 1, precioUnitario: 0, producto: { nombre: "Salsa" } }] });
const dz = construirDetalle(conCero, { ...todo, productos: [...todo.productos, { itemId: "i4", estado: "bien" }] }, catalogo);
assert.match(marcasVigentes(base, dz.ok ? dz.detalle : null).cambios.join(), /Salsa/);
const invertirLlaves = (x: unknown): unknown =>
  Array.isArray(x) ? x.map(invertirLlaves)
  : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).reverse().map(([k, w]) => [k, invertirLlaves(w)]))
  : x;
// el JSONB puede devolver las llaves en otro orden
assert.deepEqual(marcasVigentes(base, invertirLlaves(dc) as DetalleRevision).cambios, []);
// primer borrador parcial: un item sin marcar no es un cambio
const parcial = construirDetalle(base, { ...vacias, productos: [{ itemId: "i1", estado: "bien" }] }, catalogo);
assert.deepEqual(marcasVigentes(base, parcial.ok ? parcial.detalle : null).cambios, []);
// vista de otro día: campos extra de cobro no cuentan
const otroDia = { ...base, cobrada: false, metodoPago: null } as OrdenRevisable;
assert.deepEqual(marcasVigentes(otroDia, dc).cambios, []);

// erroresDe
const sinCobro = construirDetalle(o({ pagos: [], total: 14 }), { ...vacias, cobro: "efectivo" }, catalogo);
assert.equal(sinCobro.ok && erroresDe(sinCobro.detalle)[0].texto, "Sin cobrar, pero se cobró en efectivo");
for (const [metodo, texto] of [
  ["transferencia", "Sin cobrar, pero se cobró en transferencia"],
  ["mixto", "Sin cobrar, pero el cobro fue mixto"],
] as const) {
  const sinPago = construirDetalle(o({ pagos: [], total: 14 }), { ...vacias, cobro: metodo }, catalogo);
  assert.equal(sinPago.ok && erroresDe(sinPago.detalle)[0].texto, texto);
}
const noIba = construirDetalle(base, { ...vacias, productos: [{ itemId: "i2", estado: "mal", cantidadReal: 0 }] }, catalogo);
assert.equal(noIba.ok && erroresDe(noIba.detalle)[0].texto, "No iba: 1× Cerveza");

// estadoRevision
const rev = (c: Partial<RevisionGuardada>): RevisionGuardada => ({
  ordenId: "o1", detalle: dc, revisada: true, conErrores: false, version: 1, revisadaPorNombre: null, revisadaAt: null, ...c,
});
assert.equal(estadoRevision(base, null), "sin_revisar");
assert.equal(estadoRevision(base, rev({ revisada: false })), "sin_revisar");
assert.equal(estadoRevision(base, rev({})), "bien");
assert.equal(estadoRevision(base, rev({ conErrores: true })), "con_errores");
assert.equal(estadoRevision(t23, rev({})), "cambio");

// revisada que queda incompleta vuelve a sin revisar; cambios gana
const cuentaEmpleado = o({ empleadoId: "e1" });
const dEmp = construirDetalle(cuentaEmpleado, { ...todo, cobro: null }, catalogo);
const revEmp = rev({ detalle: dEmp.ok ? dEmp.detalle : (null as never) });
assert.equal(estadoRevision(cuentaEmpleado, revEmp), "bien");
assert.equal(estadoRevision(o({ empleadoId: null }), revEmp), "sin_revisar");
assert.equal(estadoRevision(o({ items: [base.items[0]] }), rev({})), "cambio");
assert.equal(estadoRevision(nuevo, rev({})), "cambio");

// diferencia: mayor que 0, hasta 9999.99, normalizada a centavos
const dif = (d: number) => validarSolicitud(sol({ total: { estado: "de_mas", diferencia: d } }));
for (const d of [1e-9, 0.001]) assert.equal(dif(d).ok, false);
assert.equal(dif(0.01).ok, true);
assert.equal(dif(9999.99).ok, true);
const suma = dif(0.1 + 0.2);
assert.ok(suma.ok && suma.data.marcas.total?.estado === "de_mas" && suma.data.marcas.total.diferencia === 0.3);

// Errores anteriores: si la orden cambia, lo ya anotado se conserva aunque se vuelva a revisar.
const anotada = construirDetalle(base, {
  productos: [{ itemId: "i1", estado: "bien" }, { itemId: "i2", estado: "mal", cantidadReal: 0 }],
  faltantes: [{ productoId: "p1", cantidad: 1 }], cobro: "efectivo", total: { estado: "de_mas", diferencia: 3 },
}, catalogo);
assert.ok(anotada.ok);
const previo = anotada.detalle;
assert.deepEqual(anterioresDe(base, previo), []);
assert.deepEqual(anterioresDe(base, null), []);
// solo lo que cambió pasa a anterior; el faltante sigue vigente
assert.deepEqual(anterioresDe(ef, previo).map((e) => e.texto), ["Transferencia registrada, fue efectivo"]);
const sinCerveza = o({ items: [base.items[0]], total: 19 });
assert.deepEqual(anterioresDe(sinCerveza, previo).map((e) => e.texto), ["No iba: 1× Cerveza", "Cobró $3.00 de más"]);
const bienEf: MarcasRevision = { ...todo, faltantes: [{ productoId: "p1", cantidad: 1 }] };
const rehecha = construirDetalle(ef, bienEf, catalogo, previo);
assert.ok(rehecha.ok);
assert.deepEqual(erroresDe(rehecha.detalle).map((e) => [e.texto, e.anterior ?? false]), [
  ["Faltó 1× Cola", false], ["Transferencia registrada, fue efectivo", true],
]);
// sobrevive a otro guardado, a otro cambio y al desorden de llaves del JSONB, sin repetirse
const otra = construirDetalle(ef, bienEf, catalogo, invertirLlaves(rehecha.detalle) as DetalleRevision);
assert.ok(otra.ok);
assert.deepEqual(otra.detalle, rehecha.detalle);
assert.deepEqual(anterioresDe(o({ total: 30 }), rehecha.detalle).map((e) => e.texto), ["Transferencia registrada, fue efectivo"]);
// el admin puede quitar uno; quitar una marca vigente no la vuelve anterior
const [claveCobro] = anterioresDe(ef, previo).map((e) => e.clave);
const sinEse = construirDetalle(ef, { ...bienEf, quitados: [claveCobro] }, catalogo, previo);
assert.ok(sinEse.ok);
assert.equal(sinEse.detalle.anteriores, undefined);
const corregida = construirDetalle(base, todo, catalogo, previo);
assert.ok(corregida.ok);
assert.deepEqual(erroresDe(corregida.detalle), []);
// el mismo error anotado otra vez no se cuenta dos veces
const picante = o({ items: [base.items[0], { ...base.items[1], nivelPicante: "leve" }] });
const repetida = construirDetalle(picante, {
  ...todo, productos: [{ itemId: "i1", estado: "bien" }, { itemId: "i2", estado: "mal", cantidadReal: 0 }],
}, catalogo, previo);
assert.ok(repetida.ok);
assert.deepEqual(erroresDe(repetida.detalle).map((e) => e.texto), ["No iba: 1× Cerveza"]);
// ida, vuelta y otra ida: anotado dos veces, conservado una
const vuelta = construirDetalle(base, { ...bienEf, cobro: "efectivo" }, catalogo, rehecha.detalle);
assert.ok(vuelta.ok);
assert.deepEqual(anterioresDe(ef, vuelta.detalle).map((e) => e.texto), ["Transferencia registrada, fue efectivo"]);
// dos líneas del mismo producto son dos errores
const gemelas = o({ items: [base.items[1], { ...base.items[1], id: "i9" }] });
const dobles = construirDetalle(gemelas, { ...vacias, productos: ["i2", "i9"].map((itemId) => ({ itemId, estado: "mal" as const, cantidadReal: 0 })) }, catalogo);
assert.ok(dobles.ok);
assert.equal(anterioresDe(o({ items: [base.items[0]] }), dobles.detalle).length, 2);
// el error conserva a quién correspondía al anotarlo, aunque después cobre otra persona
const deLuis = construirDetalle(base, { ...todo, cobro: "efectivo" }, catalogo, null, { creador: "Ana", cobrador: "Luis" });
assert.ok(deLuis.ok);
const trasAdmin = construirDetalle(ef, todo, catalogo, deLuis.detalle, { creador: "Ana", cobrador: "Admin" });
assert.ok(trasAdmin.ok);
assert.deepEqual(erroresDe(trasAdmin.detalle).map((e) => e.persona), ["Luis"]);
// también si se vuelve a anotar cuando ya solo estaba como anterior
const otraVez = construirDetalle(base, { ...todo, cobro: "efectivo" }, catalogo, trasAdmin.detalle, { creador: "Ana", cobrador: "Admin" });
assert.ok(otraVez.ok);
assert.deepEqual(erroresDe(otraVez.detalle).map((e) => e.persona), ["Luis"]);
// sin cobrador al anotarlo, es de quien la creó
const sinCobrador = construirDetalle(o({ pagos: [] }), { ...vacias, cobro: "efectivo" }, catalogo, null, { creador: "Ana", cobrador: null });
assert.ok(sinCobrador.ok);
const yaCobrada = construirDetalle(ef, todo, catalogo, sinCobrador.detalle, { creador: "Ana", cobrador: "Admin" });
assert.ok(yaCobrada.ok);
assert.deepEqual(erroresDe(yaCobrada.detalle).map((e) => e.persona), ["Ana"]);
// B3: la marca sigue vigente aunque otra persona cobre (el total no cambió)
const porCobrarla = o({ pagos: [] });
const deMas: MarcasRevision = { ...todo, total: { estado: "de_mas", diferencia: 3 } };
const b3 = construirDetalle(porCobrarla, deMas, catalogo, null, { creador: "Ana", cobrador: null });
assert.ok(b3.ok);
const b3Cobrada = construirDetalle(base, deMas, catalogo, b3.detalle, { creador: "Ana", cobrador: "Admin" });
assert.ok(b3Cobrada.ok);
assert.deepEqual(erroresDe(b3Cobrada.detalle).map((e) => e.persona), ["Ana"]);
// C3b: el mismo error vuelto a anotar sigue siendo de quien era
const pagoDoble = o({ total: 26, pagos: [...base.pagos!, { metodoPago: "transferencia", monto: 5 }] });
const c3b = construirDetalle(pagoDoble, { ...todo, cobro: "efectivo" }, catalogo, deLuis.detalle, { creador: "Ana", cobrador: "Ana" });
assert.ok(c3b.ok);
assert.deepEqual(erroresDe(c3b.detalle).map((e) => [e.texto, e.persona]), [["Transferencia registrada, fue efectivo", "Luis"]]);
// un producto mal es de quien creó la orden, aunque otro cobrara
const prodMal = construirDetalle(base, { ...vacias, productos: [{ itemId: "i2", estado: "mal", cantidadReal: 0 }] }, catalogo, null, { creador: "Ana", cobrador: "Luis" });
assert.deepEqual(prodMal.ok && erroresDe(prodMal.detalle).map((e) => e.persona), ["Ana"]);
// el cliente no puede meter errores anteriores
const colada = validarSolicitud(sol({ anteriores: [{ clave: "x", tipo: "total", texto: "x", de: "creador" }] } as Partial<MarcasRevision>));
assert.ok(colada.ok && !("anteriores" in colada.data.marcas));
// la solicitud acepta claves a quitar y rechaza lo demás
const quit = (quitados: unknown) => validarSolicitud(sol({ quitados } as Partial<MarcasRevision>));
for (const malo of ["x", [1], [""], Array(201).fill("a"), ["a".repeat(501)]]) assert.equal(quit(malo).ok, false);
const buena = quit(["a"]);
assert.deepEqual(buena.ok && buena.data.marcas.quitados, ["a"]);
assert.equal(quit(undefined).ok, true);

console.log("revision: ok");
