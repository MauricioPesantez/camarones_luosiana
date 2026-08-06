import assert from "node:assert/strict";
import {
  aCentavos,
  aDolares,
  calcularMovimientosPago,
  resumirMetodoPago,
} from "../types/cobro";

// Los movimientos de un pago son brutos: lo que el cliente entrego, sin
// descontar el envio. El envio se liquida a nivel de orden, no de pago.
assert.deepEqual(calcularMovimientosPago({ metodoPago: "efectivo", monto: 30 }), {
  efectivoRecibido: 30,
  transferenciaRecibida: 0,
});
assert.deepEqual(
  calcularMovimientosPago({ metodoPago: "transferencia", monto: 40 }),
  { efectivoRecibido: 0, transferenciaRecibida: 40 },
);

// Un metodo desconocido no inventa dinero.
assert.deepEqual(calcularMovimientosPago({ metodoPago: "cheque", monto: 10 }), {
  efectivoRecibido: 0,
  transferenciaRecibida: 0,
});

// Los montos llegan como Decimal serializado a string desde Prisma.
assert.deepEqual(
  calcularMovimientosPago({ metodoPago: "efectivo", monto: "12.35" }),
  { efectivoRecibido: 12.35, transferenciaRecibida: 0 },
);

// Centavos: la suma de tres tercios de centavo no se escapa.
assert.equal(aCentavos("0.1") + aCentavos("0.2"), aCentavos("0.3"));
assert.equal(aDolares(aCentavos(19.99)), 19.99);
assert.equal(aCentavos(null), 0);
assert.equal(aCentavos(undefined), 0);

// El resumen del metodo es dato de presentacion de la orden.
assert.equal(resumirMetodoPago([]), null);
assert.equal(resumirMetodoPago([{ metodoPago: "efectivo" }]), "efectivo");
assert.equal(
  resumirMetodoPago([{ metodoPago: "transferencia" }]),
  "transferencia",
);
assert.equal(
  resumirMetodoPago([{ metodoPago: "efectivo" }, { metodoPago: "transferencia" }]),
  "mixto",
);
// Dos pagos del mismo metodo no son mixto.
assert.equal(
  resumirMetodoPago([{ metodoPago: "efectivo" }, { metodoPago: "efectivo" }]),
  "efectivo",
);
// Un metodo invalido se ignora en el resumen.
assert.equal(
  resumirMetodoPago([{ metodoPago: "cheque" }, { metodoPago: "efectivo" }]),
  "efectivo",
);
assert.equal(resumirMetodoPago([{ metodoPago: "cheque" }]), null);

console.log("cobro.test.ts OK");
