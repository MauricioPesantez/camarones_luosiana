import assert from "node:assert/strict";
import { resolverNav, itemsBarraInferior, ACENTO_POR_ROL } from "./navegacion";

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

// Mesero: tres destinos en la barra inferior, en orden.
const mesero = resolverNav("mesero", ctxSinPermiso);
assert.deepEqual(
  itemsBarraInferior(mesero).map((i) => i.id),
  ["crear", "ordenes", "retiro"],
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

console.log("navegacion tests passed");
