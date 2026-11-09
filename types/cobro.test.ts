import assert from "node:assert/strict";
import {
  montoACobrarEnCaja,
  montoARepartirEnMixto,
  partesDeCobroMixto,
} from "./cobro";

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

// --- montoARepartirEnMixto ---
// Regla del negocio: en un cobro mixto se reparte lo que el local realmente
// recibe, no lo que pago el cliente. En domicilio el motorizado ya se quedo el
// envio, asi que pedirselo para devolverselo despues es mover plata en circulo.

// Domicilio, primer pago: se reparten 22 - 2 = 20.
assert.equal(
  montoARepartirEnMixto({
    tipoOrden: "domicilio",
    saldo: 22,
    costoEnvio: 2,
    esPrimerPago: true,
  }),
  20,
);

// Domicilio reabierto: el envio ya se liquidó en el pago anterior, asi que el
// saldo nuevo se reparte tal cual.
assert.equal(
  montoARepartirEnMixto({
    tipoOrden: "domicilio",
    saldo: 5,
    costoEnvio: 2,
    esPrimerPago: false,
  }),
  5,
);

// Local y para llevar: no hay envio que apartar, se reparte el saldo completo.
for (const tipoOrden of ["local", "para_llevar"]) {
  assert.equal(
    montoARepartirEnMixto({
      tipoOrden,
      saldo: 30,
      costoEnvio: 0,
      esPrimerPago: true,
    }),
    30,
  );
}

// Una orden local con envio cargado por error se reparte completa: apartar el
// envio es exclusivo de domicilio, igual que en montoACobrarEnCaja.
assert.equal(
  montoARepartirEnMixto({
    tipoOrden: "local",
    saldo: 30,
    costoEnvio: 3,
    esPrimerPago: true,
  }),
  30,
);

// Nunca negativo, aunque el envio supere al saldo.
assert.equal(
  montoARepartirEnMixto({
    tipoOrden: "domicilio",
    saldo: 2,
    costoEnvio: 5,
    esPrimerPago: true,
  }),
  0,
);

// Strings de Prisma/Decimal y centavos exactos.
assert.equal(
  montoARepartirEnMixto({
    tipoOrden: "domicilio",
    saldo: "10.10",
    costoEnvio: "0.20",
    esPrimerPago: true,
  }),
  9.9,
);

// --- partesDeCobroMixto ---
// Convierte el reparto (espacio caja: lo que el cobrador tiene delante) a las
// partes que exige el servidor (espacio cliente: tienen que sumar el saldo).

// El caso real: el motorizado debe 20 y solo trae 12 en efectivo, transfiere 8.
// La parte de efectivo repone el envio que el ya se habia quedado.
assert.deepEqual(
  partesDeCobroMixto({
    tipoOrden: "domicilio",
    saldo: 22,
    costoEnvio: 2,
    esPrimerPago: true,
    efectivoEnCaja: 12,
  }),
  [
    { metodoPago: "efectivo", monto: 14 },
    { metodoPago: "transferencia", monto: 8 },
  ],
);

// Las partes siempre suman el saldo: es lo que valida el servidor.
for (const efectivoEnCaja of [0, 0.01, 5, 19.99, 20]) {
  const partes = partesDeCobroMixto({
    tipoOrden: "domicilio",
    saldo: 22,
    costoEnvio: 2,
    esPrimerPago: true,
    efectivoEnCaja,
  });
  assert.equal(
    Math.round(
      partes.reduce((suma: number, parte) => suma + parte.monto, 0) * 100,
    ),
    2200,
  );
}

// Efectivo en caja 0: el motorizado transfirio todo lo que debia, pero el envio
// igual paso por sus manos en efectivo. No es lo mismo que transferencia pura.
assert.deepEqual(
  partesDeCobroMixto({
    tipoOrden: "domicilio",
    saldo: 22,
    costoEnvio: 2,
    esPrimerPago: true,
    efectivoEnCaja: 0,
  }),
  [
    { metodoPago: "efectivo", monto: 2 },
    { metodoPago: "transferencia", monto: 20 },
  ],
);

// Local: no hay envio, lo que se escribe es lo que se guarda.
assert.deepEqual(
  partesDeCobroMixto({
    tipoOrden: "local",
    saldo: 30,
    costoEnvio: 0,
    esPrimerPago: true,
    efectivoEnCaja: 10,
  }),
  [
    { metodoPago: "efectivo", monto: 10 },
    { metodoPago: "transferencia", monto: 20 },
  ],
);

// Domicilio reabierto: sin envio que reponer, igual que local.
assert.deepEqual(
  partesDeCobroMixto({
    tipoOrden: "domicilio",
    saldo: 5,
    costoEnvio: 2,
    esPrimerPago: false,
    efectivoEnCaja: 3,
  }),
  [
    { metodoPago: "efectivo", monto: 3 },
    { metodoPago: "transferencia", monto: 2 },
  ],
);

// Centavos: sin errores de punto flotante en ninguna de las dos partes.
assert.deepEqual(
  partesDeCobroMixto({
    tipoOrden: "domicilio",
    saldo: "10.10",
    costoEnvio: "0.20",
    esPrimerPago: true,
    efectivoEnCaja: "3.30",
  }),
  [
    { metodoPago: "efectivo", monto: 3.5 },
    { metodoPago: "transferencia", monto: 6.6 },
  ],
);

console.log("cobro: todos los casos pasaron");
