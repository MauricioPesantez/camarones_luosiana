import assert from "node:assert/strict";
import {
  calcularCorteTurno,
  validarAperturaCaja,
  validarCierreCaja,
  validarCorteTurno,
} from "./caja-validaciones";

assert.deepEqual(validarAperturaCaja({ montoInicial: 50 }), {
  ok: true,
  data: { montoInicial: 50 },
});
assert.deepEqual(validarAperturaCaja({ montoInicial: "18.35" }), {
  ok: true,
  data: { montoInicial: 18.35 },
});
assert.equal(validarAperturaCaja({ montoInicial: -1 }).ok, false);
assert.equal(validarAperturaCaja({ montoInicial: 1.234 }).ok, false);
assert.equal(validarAperturaCaja({ montoInicial: 10000 }).ok, false);
assert.equal(validarAperturaCaja({ montoInicial: "" }).ok, false);
assert.equal(validarAperturaCaja({ montoInicial: false }).ok, false);
assert.equal(validarAperturaCaja(null).ok, false);

assert.deepEqual(
  validarCierreCaja({ fecha: "2026-08-08", montoCierre: 125.4 }),
  {
    ok: true,
    data: { fecha: "2026-08-08", montoCierre: 125.4 },
  },
);
assert.equal(validarCierreCaja({ fecha: "", montoCierre: 10 }).ok, false);
assert.equal(
  validarCierreCaja({ fecha: "2026-08-08", montoCierre: -0.01 }).ok,
  false,
);

assert.deepEqual(validarCorteTurno({ numero: 1, montoContado: "80.5" }), {
  ok: true,
  data: { numero: 1, montoContado: 80.5 },
});
assert.equal(validarCorteTurno({ numero: 0, montoContado: 10 }).ok, false);
assert.equal(validarCorteTurno({ numero: 1.5, montoContado: 10 }).ok, false);
assert.equal(validarCorteTurno({ numero: 1, montoContado: -1 }).ok, false);

// Dia: fondo $50. Turno 1 vende $100 en efectivo y cuenta $147 (faltan $3).
const turno1 = calcularCorteTurno({
  montoInicial: 50,
  esperadoDia: 150,
  anterior: null,
  montoContado: 147,
});
assert.deepEqual(turno1, { fondoInicial: 50, montoEsperado: 150, diferencia: -3 });

// Turno 2 recibe los $147 contados, vende $60.10 y retira $10: el dia espera
// $200.10. Su esperado no arrastra el faltante del turno 1.
const turno2 = calcularCorteTurno({
  montoInicial: 50,
  esperadoDia: 200.1,
  anterior: { montoContado: 147, esperadoDia: 150 },
  montoContado: 197.1,
});
assert.deepEqual(turno2, { fondoInicial: 147, montoEsperado: 197.1, diferencia: 0 });
// La suma de diferencias de los turnos es la diferencia del dia: 197.10 - 200.10.
assert.equal(Math.round((turno1.diferencia + turno2.diferencia) * 100), -300);

// Cobro que llega justo al cortar: queda fuera de la foto del turno 1 y entra
// entero en el turno 2, nunca en ambos.
const tardio = calcularCorteTurno({
  montoInicial: 50,
  esperadoDia: 165,
  anterior: { montoContado: 150, esperadoDia: 150 },
  montoContado: 165,
});
assert.deepEqual(tardio, { fondoInicial: 150, montoEsperado: 165, diferencia: 0 });

console.log("caja-validaciones tests passed");
