import assert from "node:assert/strict";
import { shouldPrintPaymentQr } from "./payment-link";

const URL_COBRO = "https://pos.example.com/ordenes/cobrar/token-seguro";

// --- shouldPrintPaymentQr ---
// Decide si la comanda lleva QR. Lo consumen los dos caminos de impresion:
// buildOrderSnapshot (cola) y PrinterService.imprimirComanda (directo).

// Domicilio acordado por transferencia: el dinero ya entro al crear la orden,
// asi que la comanda NO debe llevar QR. Se verifica con y sin `cobrada`, porque
// son dos guardas independientes.
assert.equal(
  shouldPrintPaymentQr({
    tipoOrden: "domicilio",
    metodoPagoPrevisto: "transferencia",
    cobrada: true,
    cobroUrl: URL_COBRO,
  }),
  false,
);
assert.equal(
  shouldPrintPaymentQr({
    tipoOrden: "domicilio",
    metodoPagoPrevisto: "transferencia",
    cobrada: false,
    cobroUrl: URL_COBRO,
  }),
  false,
  "domicilio por transferencia no lleva QR ni aunque quede sin cobrar",
);

// Domicilio en efectivo sin cobrar: si lleva QR, es el caso que lo necesita.
assert.equal(
  shouldPrintPaymentQr({
    tipoOrden: "domicilio",
    metodoPagoPrevisto: "efectivo",
    cobrada: false,
    cobroUrl: URL_COBRO,
  }),
  true,
);

// Local y para llevar sin cobrar: siempre llevan QR.
for (const tipoOrden of ["local", "para_llevar"]) {
  assert.equal(
    shouldPrintPaymentQr({
      tipoOrden,
      metodoPagoPrevisto: null,
      cobrada: false,
      cobroUrl: URL_COBRO,
    }),
    true,
  );
}

// Cualquier orden ya cobrada no vuelve a imprimir QR: no hay nada que cobrar.
for (const tipoOrden of ["local", "para_llevar", "domicilio"]) {
  assert.equal(
    shouldPrintPaymentQr({
      tipoOrden,
      metodoPagoPrevisto: "efectivo",
      cobrada: true,
      cobroUrl: URL_COBRO,
    }),
    false,
  );
}

// Sin enlace no hay QR posible (ordenes anteriores a esta funcionalidad).
assert.equal(
  shouldPrintPaymentQr({
    tipoOrden: "local",
    metodoPagoPrevisto: null,
    cobrada: false,
    cobroUrl: null,
  }),
  false,
);

// --- Rama de saldo (total presente): el balance manda, no el booleano `cobrada` ---

// Orden reabierta (crecio despues de pagada): todavia queda saldo, asi que
// necesita QR aunque nadie haya vuelto a marcarla como no cobrada.
assert.equal(
  shouldPrintPaymentQr({
    tipoOrden: "local",
    metodoPagoPrevisto: null,
    cobrada: false,
    total: 16,
    montoPagado: 11,
    cobroUrl: URL_COBRO,
  }),
  true,
  "con saldo pendiente debe imprimir QR aunque cobrada sea false",
);

// Pagada por completo y marcada como cobrada: caso normal, sin QR.
assert.equal(
  shouldPrintPaymentQr({
    tipoOrden: "local",
    metodoPagoPrevisto: null,
    cobrada: true,
    total: 16,
    montoPagado: 16,
    cobroUrl: URL_COBRO,
  }),
  false,
);

// Saldo en cero pero el flag `cobrada` quedo desactualizado (false): el
// balance calculado es quien manda cuando hay `total`, no el flag viejo.
assert.equal(
  shouldPrintPaymentQr({
    tipoOrden: "local",
    metodoPagoPrevisto: null,
    cobrada: false,
    total: 16,
    montoPagado: 16,
    cobroUrl: URL_COBRO,
  }),
  false,
  "el balance en cero manda sobre un flag `cobrada` desactualizado",
);

console.log("payment-link: todos los casos pasaron");
