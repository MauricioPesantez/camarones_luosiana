import assert from "node:assert/strict";
import {
  agregarProducto,
  bloqueoDeOrden,
  cambiosParaEnviar,
  crearLineas,
  describirCambios,
  motivoItemProtegido,
  ponerCantidad,
  sePuedeEditar,
  stockRestante,
  totalDeLineas,
  type ProductoEdicion,
} from "./edicion-orden";
import { RECARGO_RECIPIENTES } from "../types/orden";

const producto = (
  id: string,
  categoria = "Extras",
  precio: number | string = 2,
  stock = 10,
): ProductoEdicion => ({ id, nombre: id, categoria, precio, stock, disponible: true });

const combo = producto("combo", "Combos", "10.00");
const papas = producto("papas");
const limonada = producto("limonada", "Bebidas", 1.5);

const items = [
  { id: "i1", cantidad: 2, producto: combo, precioUnitario: "10.00", nivelPicante: "leve" as const },
  { id: "i2", cantidad: 3, producto: limonada, precioUnitario: 1.5 },
  { id: "i3", cantidad: 1, producto: papas, precioUnitario: 0, esCortesia: true },
];
const base = crearLineas(items);

// Sin tocar nada no hay cambios.
assert.deepEqual(cambiosParaEnviar(base), []);
assert.deepEqual(describirCambios(base), []);

// Subir, bajar y quitar.
assert.deepEqual(cambiosParaEnviar(ponerCantidad(base, "i2", 4)), [
  { accion: "modificar", itemId: "i2", cantidad: 4 },
]);
assert.deepEqual(cambiosParaEnviar(ponerCantidad(base, "i2", 0)), [
  { accion: "eliminar", itemId: "i2" },
]);
// Lo quitado sigue en pantalla para poder deshacerlo.
assert.equal(ponerCantidad(base, "i2", 0).length, 3);
assert.deepEqual(cambiosParaEnviar(ponerCantidad(ponerCantidad(base, "i2", 0), "i2", 3)), []);

// Agregar un producto vendido nunca amplia una cortesia: saldria gratis.
const conPapas = agregarProducto(base, papas, null);
assert.deepEqual(cambiosParaEnviar(conPapas), [
  { accion: "agregar", productoId: "papas", cantidad: 1 },
]);
// La segunda vez se suma a la linea nueva, y bajarla a cero la descarta.
const dosPapas = agregarProducto(conPapas, papas, null);
assert.deepEqual(cambiosParaEnviar(dosPapas), [
  { accion: "agregar", productoId: "papas", cantidad: 2 },
]);
assert.equal(ponerCantidad(conPapas, conPapas[3].id, 0).length, 3);

// Un combo solo se junta con otro del mismo picante.
assert.deepEqual(cambiosParaEnviar(agregarProducto(base, combo, "leve")), [
  { accion: "modificar", itemId: "i1", cantidad: 3 },
]);
assert.deepEqual(cambiosParaEnviar(agregarProducto(base, combo, "picante_1")), [
  { accion: "agregar", productoId: "combo", cantidad: 1, nivelPicante: "picante_1" },
]);

// Volver a agregar lo quitado lo restaura en vez de duplicar la comanda.
assert.deepEqual(
  cambiosParaEnviar(agregarProducto(ponerCantidad(base, "i2", 0), limonada, null)),
  [{ accion: "modificar", itemId: "i2", cantidad: 1 }],
);

// Una linea con nota propia no se junta con una sin nota.
const conNota = conPapas.map((l) => (l.original === 0 ? { ...l, observaciones: " sin sal " } : l));
assert.deepEqual(cambiosParaEnviar(agregarProducto(conNota, papas, null)), [
  { accion: "agregar", productoId: "papas", cantidad: 1, observaciones: "sin sal" },
  { accion: "agregar", productoId: "papas", cantidad: 1 },
]);

// Cambiar solo el picante, o junto con la cantidad.
const picante = base.map((l) => (l.id === "i1" ? { ...l, nivelPicante: "natural" as const } : l));
assert.deepEqual(cambiosParaEnviar(picante), [
  { accion: "modificar", itemId: "i1", cantidad: 2, nivelPicante: "natural" },
]);
assert.deepEqual(describirCambios(picante), [
  { tipo: "cambia", texto: "combo: Leve pasa a Natural", monto: 0 },
]);

// Primero lo que libera stock, despues lo que lo usa.
const mezcla = ponerCantidad(ponerCantidad(agregarProducto(base, papas, null), "i1", 3), "i2", 1);
assert.deepEqual(
  cambiosParaEnviar(mezcla).map((c) => c.accion + ("cantidad" in c ? c.cantidad : "")),
  ["modificar1", "modificar3", "agregar1"],
);
assert.deepEqual(
  describirCambios(mezcla).map((c) => [c.tipo, c.texto, c.monto]),
  [
    ["quita", "2 limonada", -3],
    ["agrega", "1 combo · Leve", 10],
    ["agrega", "1 papas", 2],
  ],
);

// El stock restante cuenta lo agregado y lo liberado del mismo producto.
assert.equal(stockRestante(base, limonada), 10);
assert.equal(stockRestante(ponerCantidad(base, "i2", 5), limonada), 8);
assert.equal(stockRestante(ponerCantidad(base, "i2", 1), limonada), 12);

// Total: igual que el servidor, con envases, descuento y envio.
assert.equal(totalDeLineas(base, { tipoOrden: "local" }), 24.5);
assert.equal(
  totalDeLineas(base, { tipoOrden: "domicilio", costoEnvio: "2.00", descuentoTipo: "porcentaje", descuentoValor: "10" }),
  Math.round((24.5 - 2.45 + 2 * RECARGO_RECIPIENTES + 2) * 100) / 100,
);

// Reglas de la orden.
assert.equal(bloqueoDeOrden({ estado: "en_preparacion", montoPagado: "0" }), null);
assert.equal(bloqueoDeOrden({ estado: "lista", montoPagado: "0" }), "lista");
assert.equal(bloqueoDeOrden({ estado: "pendiente", montoPagado: "5.00" }), "pagada");
assert.equal(sePuedeEditar({ estado: "lista", cobrada: false }), true);
assert.equal(sePuedeEditar({ estado: "pendiente_aprobacion_stock", cobrada: false }), false);
assert.equal(sePuedeEditar({ estado: "entregada", cobrada: false }), false);
assert.equal(sePuedeEditar({ estado: "pendiente", cobrada: true }), false);
assert.equal(sePuedeEditar({ estado: "pendiente", cobrada: false, empleadoId: "e" }), false);

// Lo que el servidor no acepta aunque la pantalla se lo mande.
const itemCombo = { esCortesia: false, producto: combo };
const libre = { estado: "pendiente", montoPagado: 0 };
assert.match(
  motivoItemProtegido({ accion: "modificar", itemId: "i3", cantidad: 2 }, { esCortesia: true, producto: papas }, libre, "mesero") ?? "",
  /cortes/i,
);
assert.match(
  motivoItemProtegido({ accion: "eliminar", itemId: "i3" }, { esCortesia: true, producto: papas }, libre, "digital") ?? "",
  /cortes/i,
);
assert.equal(
  motivoItemProtegido({ accion: "eliminar", itemId: "i3" }, { esCortesia: true, producto: papas }, libre, "admin"),
  null,
);
const aNatural = { accion: "modificar", itemId: "i1", cantidad: 2, nivelPicante: "natural" } as const;
assert.equal(motivoItemProtegido(aNatural, itemCombo, libre, "mesero"), null);
assert.match(motivoItemProtegido(aNatural, itemCombo, { estado: "lista", montoPagado: 0 }, "mesero") ?? "", /picante/i);
assert.match(motivoItemProtegido(aNatural, itemCombo, { estado: "pendiente", montoPagado: "1" }, "admin") ?? "", /picante/i);
assert.match(motivoItemProtegido(aNatural, { esCortesia: false, producto: papas }, libre, "mesero") ?? "", /picante/i);
assert.match(
  motivoItemProtegido({ ...aNatural, nivelPicante: "fuego" as never }, itemCombo, libre, "mesero") ?? "",
  /picante/i,
);
assert.equal(
  motivoItemProtegido({ accion: "modificar", itemId: "i1", cantidad: 3 }, itemCombo, { estado: "lista", montoPagado: 0 }, "mesero"),
  null,
);

console.log("edicion-orden tests passed");
