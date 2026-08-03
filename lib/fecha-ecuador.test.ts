import assert from "node:assert/strict";
import { obtenerFechaEcuador, obtenerRangoEcuador } from "./fecha-ecuador";

// Ecuador esta en UTC-5 todo el año: el dia local arranca a las 05:00 UTC.
const rango = obtenerRangoEcuador("2026-08-01");
assert.ok(rango);
assert.equal(rango.inicio.toISOString(), "2026-08-01T05:00:00.000Z");
assert.equal(rango.fin.toISOString(), "2026-08-02T05:00:00.000Z");
assert.equal(rango.fin.getTime() - rango.inicio.getTime(), 24 * 60 * 60 * 1000);

// Una orden creada a las 23:59 locales todavia cae dentro del dia.
const casiMedianoche = new Date("2026-08-02T04:59:00.000Z");
assert.ok(casiMedianoche >= rango.inicio && casiMedianoche < rango.fin);

// Un minuto despues ya pertenece al dia siguiente.
const yaEsManana = new Date("2026-08-02T05:00:00.000Z");
assert.ok(yaEsManana >= rango.fin);

// Formatos que no calzan.
assert.equal(obtenerRangoEcuador("2026-8-1"), null);
assert.equal(obtenerRangoEcuador("01-08-2026"), null);
assert.equal(obtenerRangoEcuador(""), null);
assert.equal(obtenerRangoEcuador("hoy"), null);

// Fechas que `Date` normalizaria en silencio en lugar de rechazar.
assert.equal(obtenerRangoEcuador("2026-02-31"), null);
assert.equal(obtenerRangoEcuador("2026-13-01"), null);

// Un año bisiesto real si existe.
assert.ok(obtenerRangoEcuador("2028-02-29"));
assert.equal(obtenerRangoEcuador("2026-02-29"), null);

// La fecha de hoy sale en el mismo formato que aceptan las rutas.
const hoy = obtenerFechaEcuador(new Date("2026-08-02T04:30:00.000Z"));
assert.equal(hoy, "2026-08-01");
assert.ok(obtenerRangoEcuador(hoy));

console.log("fecha-ecuador tests passed");
