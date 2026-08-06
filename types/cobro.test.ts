import assert from "node:assert/strict";
import { calcularMovimientosCobro, montoACobrarEnCaja } from "./cobro";

// --- montoACobrarEnCaja ---
// Regla del negocio: la caja nunca recibe el envio en efectivo. En domicilio el
// motorizado cobra el total al cliente y entrega al local todo menos el envio.

// Domicilio en efectivo: el local recibe el total MENOS el envio.
assert.equal(
  montoACobrarEnCaja({
    tipoOrden: "domicilio",
    total: 25.5,
    costoEnvio: 3,
    metodoPago: "efectivo",
  }),
  22.5,
);

// Domicilio por transferencia: entra el total; el envio sale despues en efectivo.
assert.equal(
  montoACobrarEnCaja({
    tipoOrden: "domicilio",
    total: 25.5,
    costoEnvio: 3,
    metodoPago: "transferencia",
  }),
  25.5,
);

// Domicilio sin envio: no hay nada que descontar.
assert.equal(
  montoACobrarEnCaja({
    tipoOrden: "domicilio",
    total: 18,
    costoEnvio: 0,
    metodoPago: "efectivo",
  }),
  18,
);

// El envio nunca puede dejar el monto en negativo.
assert.equal(
  montoACobrarEnCaja({
    tipoOrden: "domicilio",
    total: 2,
    costoEnvio: 5,
    metodoPago: "efectivo",
  }),
  0,
);

// Local y para llevar: no hay envio, se cobra el total con cualquier metodo.
for (const tipoOrden of ["local", "para_llevar"]) {
  for (const metodoPago of ["efectivo", "transferencia"]) {
    assert.equal(
      montoACobrarEnCaja({ tipoOrden, total: 12.75, costoEnvio: 0, metodoPago }),
      12.75,
    );
  }
}

// Una orden local con envio cargado por error sigue cobrandose completa: la resta
// del envio es exclusiva de domicilio.
assert.equal(
  montoACobrarEnCaja({
    tipoOrden: "local",
    total: 12.75,
    costoEnvio: 3,
    metodoPago: "efectivo",
  }),
  12.75,
);

// Metodo invalido: no hay monto que cobrar.
assert.equal(
  montoACobrarEnCaja({
    tipoOrden: "domicilio",
    total: 25.5,
    costoEnvio: 3,
    metodoPago: "tarjeta",
  }),
  0,
);

// Acepta strings de Prisma/Decimal igual que calcularMovimientosCobro.
assert.equal(
  montoACobrarEnCaja({
    tipoOrden: "domicilio",
    total: "25.50",
    costoEnvio: "3.00",
    metodoPago: "efectivo",
  }),
  22.5,
);

// Centavos: sin errores de punto flotante.
assert.equal(
  montoACobrarEnCaja({
    tipoOrden: "domicilio",
    total: 10.1,
    costoEnvio: 0.2,
    metodoPago: "efectivo",
  }),
  9.9,
);

// --- Invariante compartida ---
// El monto de caja siempre es lo que el cobro asienta como ingreso: no puede
// divergir de calcularMovimientosCobro, que es lo que se persiste en `Cobro`.
const casos = [
  { tipoOrden: "domicilio", total: 25.5, costoEnvio: 3, metodoPago: "efectivo" },
  { tipoOrden: "domicilio", total: 25.5, costoEnvio: 3, metodoPago: "transferencia" },
  { tipoOrden: "local", total: 12.75, costoEnvio: 0, metodoPago: "efectivo" },
  { tipoOrden: "para_llevar", total: 8.4, costoEnvio: 0, metodoPago: "transferencia" },
];
for (const caso of casos) {
  const movimientos = calcularMovimientosCobro(caso);
  assert.equal(
    montoACobrarEnCaja(caso),
    movimientos.efectivoRecibido + movimientos.transferenciaRecibida,
  );
}

console.log("cobro: todos los casos pasaron");
