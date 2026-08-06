import assert from "node:assert/strict";
import { calcularLiquidacionDomicilio, calcularSaldo } from "../types/orden";

// Regla unica: el envio se descuenta del efectivo que el motorizado cobro al
// cliente. Si sobra, el motorizado entrega la diferencia al local; si falta,
// el local le completa.

// Transferencia pura: el motorizado no cobro efectivo, el local le entrega el envio.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: 3 }, 0),
  { entregaElLocal: 3, entregaElMotorizado: 0 },
);

// Efectivo puro: cobro el total de 10, se queda 3 de envio y entrega 7.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: 3 }, 10),
  { entregaElLocal: 0, entregaElMotorizado: 7 },
);

// Mixto, el caso real: transferencia de 8 que ya incluia el envio, mas 5 en
// efectivo por un producto agregado. El motorizado entrega 5 - 3 = 2.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: 3 }, 5),
  { entregaElLocal: 0, entregaElMotorizado: 2 },
);

// El efectivo cubre el envio exacto: nadie entrega nada.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: 3 }, 3),
  { entregaElLocal: 0, entregaElMotorizado: 0 },
);

// Fuera de domicilio no hay liquidacion.
assert.equal(calcularLiquidacionDomicilio({ tipoOrden: "local" }, 25), null);
assert.equal(
  calcularLiquidacionDomicilio({ tipoOrden: "para_llevar", costoEnvio: 3 }, 15),
  null,
);

// Domicilio sin envio configurado: no hay nada que liquidar, pero sigue siendo
// domicilio, asi que devuelve ceros y no null.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: null }, 20),
  { entregaElLocal: 0, entregaElMotorizado: 20 },
);

// Centavos, no floats.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: "2.50" }, "10.10"),
  { entregaElLocal: 0, entregaElMotorizado: 7.6 },
);

// Saldo.
assert.equal(calcularSaldo({ total: 25, montoPagado: 0 }), 25);
assert.equal(calcularSaldo({ total: 25, montoPagado: 25 }), 0);
assert.equal(calcularSaldo({ total: 30, montoPagado: "25.50" }), 4.5);
// Una orden que nunca se pago no trae el campo.
assert.equal(calcularSaldo({ total: 25 }), 25);
// El saldo nunca es negativo: pagar de mas no genera credito, se bloquea antes.
assert.equal(calcularSaldo({ total: 25, montoPagado: 30 }), 0);

console.log("liquidacion-domicilio.test.ts OK");
