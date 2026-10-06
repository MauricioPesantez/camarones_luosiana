import assert from "node:assert/strict";
import {
  validarAperturaCaja,
  validarCierreCaja,
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

console.log("caja-validaciones tests passed");
