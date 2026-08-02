import assert from "node:assert/strict";
import { validarAnulacion, validarRetiroNuevo } from "./retiros-validaciones";
import { MONTO_MAXIMO_RETIRO } from "../types/retiro";

function base(extra: Record<string, unknown> = {}) {
  return {
    usuarioId: "usuario-1",
    categoria: "insumos",
    motivo: "Compra de guantes",
    monto: 12.5,
    clientRequestId: "req-1",
    ...extra,
  };
}

function error(body: unknown): string {
  const resultado = validarRetiroNuevo(body);
  assert.equal(resultado.ok, false, "se esperaba un rechazo");
  return resultado.ok ? "" : resultado.error;
}

// Caso feliz: el monto queda normalizado a centavos exactos.
const valido = validarRetiroNuevo(base());
assert.ok(valido.ok);
assert.deepEqual(valido.data, {
  usuarioId: "usuario-1",
  categoria: "insumos",
  motivo: "Compra de guantes",
  monto: 12.5,
  beneficiarioId: null,
  clientRequestId: "req-1",
});

// Los textos se recortan.
const conEspacios = validarRetiroNuevo(
  base({ motivo: "  Taxi al mercado  ", usuarioId: " usuario-1 " }),
);
assert.ok(conEspacios.ok);
assert.equal(conEspacios.data.motivo, "Taxi al mercado");
assert.equal(conEspacios.data.usuarioId, "usuario-1");

// Montos que no pueden salir de la caja.
assert.match(error(base({ monto: 0 })), /mayor que 0/);
assert.match(error(base({ monto: -5 })), /mayor que 0/);
assert.match(error(base({ monto: "abc" })), /mayor que 0/);
assert.match(error(base({ monto: Infinity })), /mayor que 0/);
assert.match(error(base({ monto: 12.345 })), /2 decimales/);
assert.match(error(base({ monto: MONTO_MAXIMO_RETIRO + 0.01 })), /no puede superar/);

// El techo exacto si pasa.
const enElTecho = validarRetiroNuevo(base({ monto: MONTO_MAXIMO_RETIRO }));
assert.ok(enElTecho.ok);

// Un monto valido cuyo producto por 100 no es exacto en coma flotante.
const centavosIncomodos = validarRetiroNuevo(base({ monto: 18.35 }));
assert.ok(centavosIncomodos.ok, "18.35 es un monto valido");
assert.equal(centavosIncomodos.data.monto, 18.35);

// El monto puede llegar como texto desde un formulario.
const montoTexto = validarRetiroNuevo(base({ monto: "7.05" }));
assert.ok(montoTexto.ok);
assert.equal(montoTexto.data.monto, 7.05);

// Campos obligatorios.
assert.match(error(base({ motivo: "" })), /motivo/i);
assert.match(error(base({ motivo: "   " })), /motivo/i);
assert.match(error(base({ usuarioId: "" })), /usuario/i);
assert.match(error(base({ clientRequestId: "" })), /identificador/i);
assert.match(error(base({ categoria: "sueldos" })), /categoria/i);
assert.match(error(base({ categoria: undefined })), /categoria/i);
assert.match(error(null), /invalido/i);
assert.match(error([]), /invalido/i);
assert.match(error("retiro"), /invalido/i);

// La regla del adelanto va en los dos sentidos.
assert.match(error(base({ categoria: "adelanto" })), /a quien se le entrega/i);
assert.match(
  error(base({ categoria: "adelanto", beneficiarioId: "" })),
  /a quien se le entrega/i,
);
assert.match(
  error(base({ categoria: "insumos", beneficiarioId: "usuario-2" })),
  /solo los adelantos/i,
);

const adelanto = validarRetiroNuevo(
  base({ categoria: "adelanto", beneficiarioId: "usuario-2", motivo: "Adelanto quincena" }),
);
assert.ok(adelanto.ok);
assert.equal(adelanto.data.beneficiarioId, "usuario-2");

// Un beneficiario nulo o ausente fuera de adelanto es normal, no un error.
assert.ok(validarRetiroNuevo(base({ beneficiarioId: null })).ok);
assert.ok(validarRetiroNuevo(base({ beneficiarioId: undefined })).ok);

// Anulacion.
const anulacion = validarAnulacion({ adminId: "admin-1", razon: " Gasto duplicado " });
assert.ok(anulacion.ok);
assert.deepEqual(anulacion.data, { adminId: "admin-1", razon: "Gasto duplicado" });

const sinRazon = validarAnulacion({ adminId: "admin-1", razon: "" });
assert.equal(sinRazon.ok, false);

const sinAdmin = validarAnulacion({ razon: "Gasto duplicado" });
assert.equal(sinAdmin.ok, false);

console.log("retiros-validaciones tests passed");
