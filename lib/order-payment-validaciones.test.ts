import assert from "node:assert/strict";
import {
  ActoDeCobroInvalido,
  derivarClaveIdempotencia,
  validarActoDeCobro,
} from "./order-payment-validaciones";

const efectivo = (monto: number) => ({ metodoPago: "efectivo" as const, monto });
const transferencia = (monto: number) => ({
  metodoPago: "transferencia" as const,
  monto,
  comprobanteTransferenciaKey: "comprobantes/abc.jpg",
});

// Un cobro simple que cuadra pasa.
assert.doesNotThrow(() =>
  validarActoDeCobro({ saldo: 25, partes: [efectivo(25)] }),
);

// Un cobro mixto que cuadra pasa.
assert.doesNotThrow(() =>
  validarActoDeCobro({ saldo: 25, partes: [efectivo(10), transferencia(15)] }),
);

// Las partes deben sumar EXACTO el saldo.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(10), transferencia(14)] }),
  ActoDeCobroInvalido,
);
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(10), transferencia(16)] }),
  ActoDeCobroInvalido,
);

// Los centavos cuadran sin arrastrar error de float.
assert.doesNotThrow(() =>
  validarActoDeCobro({ saldo: 0.3, partes: [efectivo(0.1), transferencia(0.2)] }),
);

// Ninguna parte puede ser cero: eso es un cobro simple disfrazado de mixto.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(25), transferencia(0)] }),
  ActoDeCobroInvalido,
);

// Ni negativa.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(30), transferencia(-5)] }),
  ActoDeCobroInvalido,
);

// Como maximo una parte por metodo.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(10), efectivo(15)] }),
  ActoDeCobroInvalido,
);

// Sin partes no hay cobro.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [] }),
  ActoDeCobroInvalido,
);

// Un metodo invalido se rechaza.
assert.throws(
  () =>
    validarActoDeCobro({
      saldo: 25,
      partes: [{ metodoPago: "cheque" as never, monto: 25 }],
    }),
  ActoDeCobroInvalido,
);

// Una orden sin saldo no se puede volver a cobrar.
assert.throws(
  () => validarActoDeCobro({ saldo: 0, partes: [efectivo(0)] }),
  ActoDeCobroInvalido,
);

// La parte de transferencia exige comprobante.
assert.throws(
  () =>
    validarActoDeCobro({
      saldo: 25,
      partes: [{ metodoPago: "transferencia", monto: 25 }],
    }),
  ActoDeCobroInvalido,
);

// Claves de idempotencia derivadas: una por metodo, estables.
assert.equal(
  derivarClaveIdempotencia("abc123def456ghi7", "efectivo"),
  "abc123def456ghi7:efectivo",
);
assert.equal(
  derivarClaveIdempotencia("abc123def456ghi7", "transferencia"),
  "abc123def456ghi7:transferencia",
);

console.log("order-payment-validaciones.test.ts OK");
