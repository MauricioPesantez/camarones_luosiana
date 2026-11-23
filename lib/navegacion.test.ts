import assert from "node:assert/strict";
import {
  resolverNav,
  itemsBarraInferior,
  itemsTopBar,
  esItemActivo,
  ACENTO_POR_ROL,
} from "./navegacion";

const ctxSinPermiso = { permisoNotificaciones: "default" as const };
const ctxConPermiso = { permisoNotificaciones: "granted" as const };

// Un rol que no existe en el mapa no revienta: cae a un nav minimo con solo
// la seccion de sesion, para que el usuario al menos pueda salir.
const desconocido = resolverNav("contador", ctxSinPermiso);
assert.equal(desconocido.length, 1);
assert.equal(desconocido[0].titulo, "Sesión");
assert.deepEqual(
  desconocido[0].items.map((i) => i.id),
  ["logout"],
);

// Mesero: cuatro destinos en la barra inferior, en orden.
const mesero = resolverNav("mesero", ctxSinPermiso);
assert.deepEqual(
  itemsBarraInferior(mesero).map((i) => i.id),
  ["crear", "ordenes", "caja", "retiro"],
);

// Cocina tiene un solo destino, asi que la barra inferior no se rinde.
const cocina = resolverNav("cocina", ctxSinPermiso);
assert.deepEqual(itemsBarraInferior(cocina), []);

// El item de notificaciones solo aparece si el navegador aun no decidio.
const idsSinPermiso = cocina.flatMap((s) => s.items.map((i) => i.id));
assert.ok(idsSinPermiso.includes("notificaciones"));
const idsConPermiso = resolverNav("cocina", ctxConPermiso).flatMap((s) =>
  s.items.map((i) => i.id),
);
assert.ok(!idsConPermiso.includes("notificaciones"));

// Admin: cuatro destinos en la barra inferior, y los que tienen hijos apuntan
// a su primer sub-destino.
const admin = resolverNav("admin", ctxSinPermiso);
const inferioresAdmin = itemsBarraInferior(admin);
assert.deepEqual(
  inferioresAdmin.map((i) => i.id),
  ["cuadre", "productos", "reportes", "usuarios"],
);
assert.equal(
  inferioresAdmin.find((i) => i.id === "productos")?.href,
  "/admin/productos?tab=stock",
);
assert.equal(
  inferioresAdmin.find((i) => i.id === "reportes")?.href,
  "/admin/reportes?tab=modificaciones",
);

// Un padre queda activo cuando lo esta cualquiera de sus hijos: en
// /admin/productos?tab=menu la barra inferior lista "productos", no "menu".
const itemProductos = inferioresAdmin.find((i) => i.id === "productos")!;
assert.equal(esItemActivo(itemProductos, "menu"), true);
assert.equal(esItemActivo(itemProductos, "stock"), true);
assert.equal(esItemActivo(itemProductos, "productos"), true);
assert.equal(esItemActivo(itemProductos, "usuarios"), false);

const itemUsuarios = inferioresAdmin.find((i) => i.id === "usuarios")!;
assert.equal(esItemActivo(itemUsuarios, "usuarios"), true);
assert.equal(esItemActivo(itemUsuarios, "menu"), false);

// La barra inferior nunca pasa de cuatro, aunque el rol marque mas.
const inflado = [
  {
    titulo: "Operación",
    items: [1, 2, 3, 4, 5, 6].map((n) => ({
      id: `i${n}`,
      label: `Item ${n}`,
      emoji: "🔹",
      href: `/x${n}`,
      enBarraInferior: true,
    })),
  },
];
assert.equal(itemsBarraInferior(inflado).length, 4);

// Cada rol conocido tiene acento definido.
for (const rol of ["mesero", "digital", "cocina", "admin"] as const) {
  assert.ok(ACENTO_POR_ROL[rol].texto.length > 0);
  assert.ok(ACENTO_POR_ROL[rol].fondo.length > 0);
}


// Las pantallas internas no desplazan los cuatro accesos operativos del móvil.
for (const rol of ["mesero", "digital", "cocina", "admin"]) {
  const nav = resolverNav(rol, ctxSinPermiso);
  const items = nav.flatMap(s => s.items).flatMap(i => [i, ...(i.hijos ?? [])]);
  assert.ok(items.some(i => i.id === "mis-descuentos"));
  assert.equal(items.some(i => i.id === "consumos-empleados"), rol === "mesero" || rol === "admin");
  assert.equal(items.some(i => i.id === "cuentas-empleados"), rol === "admin");
  assert.ok(!itemsBarraInferior(nav).some(i => ["mis-descuentos", "consumos-empleados", "cuentas-empleados"].includes(i.id)));
}

// La topbar separa lo de la cuenta para que los destinos quepan en una linea.
const barraAdmin = itemsTopBar(admin);
assert.deepEqual(
  barraAdmin.principales.map((i) => i.id),
  ["cuadre", "empleados", "productos", "reportes", "usuarios"],
);
assert.deepEqual(
  barraAdmin.principales
    .find((i) => i.id === "empleados")
    ?.hijos?.map((h) => h.id),
  ["cuentas-empleados", "consumos-empleados"],
);
assert.deepEqual(
  barraAdmin.cuenta.map((i) => i.id),
  ["mis-descuentos", "logout"],
);
assert.deepEqual(
  itemsTopBar(desconocido).cuenta.map((i) => i.id),
  ["logout"],
);
// En escritorio no hay acciones de pagina: solo destinos.
assert.deepEqual(
  itemsTopBar(cocina).principales.map((i) => i.id),
  ["monitor"],
);

console.log("navegacion tests passed");
