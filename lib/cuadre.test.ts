import assert from "node:assert/strict";
import { calcularResumenCuadre } from "../types/cuadre";
import { isConfirmedPaymentInRange } from "./cuadre-date";

const resumen = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 25,
    metodoPago: "efectivo",
  },
  {
    cobrada: true,
    tipoOrden: "para_llevar",
    total: 15,
    metodoPago: "transferencia",
  },
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 30,
    costoEnvio: 5,
    metodoPago: "efectivo",
  },
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 40,
    costoEnvio: 6,
    metodoPago: "transferencia",
  },
  {
    cobrada: false,
    tipoOrden: "local",
    total: 100,
    metodoPago: null,
  },
]);

assert.deepEqual(resumen, {
  totalOrdenes: 5,
  ordenesCobradas: 4,
  ordenesSinCobrar: 1,
  montoTotalOrdenes: 210,
  montoSinCobrar: 100,
  totalCobrado: 110,
  efectivoVentasDirectas: 25,
  efectivoCobradoMotorizados: 25,
  efectivoEntregadoMotorizados: 6,
  efectivoEnCaja: 44,
  transferencias: 55,
  montoReembolsoPendiente: 0,
});

const pagadaPeroAunEnPreparacion = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "para_llevar",
    total: "12.50",
    metodoPago: "efectivo",
  },
]);

assert.equal(pagadaPeroAunEnPreparacion.ordenesCobradas, 1);
assert.equal(pagadaPeroAunEnPreparacion.montoTotalOrdenes, 12.5);
assert.equal(pagadaPeroAunEnPreparacion.montoSinCobrar, 0);
assert.equal(pagadaPeroAunEnPreparacion.efectivoEnCaja, 12.5);

const sinErrorDePuntoFlotante = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 0.1,
    metodoPago: "efectivo",
  },
  {
    cobrada: true,
    tipoOrden: "local",
    total: 0.2,
    metodoPago: "efectivo",
  },
]);

assert.equal(sinErrorDePuntoFlotante.efectivoEnCaja, 0.3);

const cobradaSinMetodoLegado = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 9,
    metodoPago: null,
  },
]);

assert.equal(cobradaSinMetodoLegado.ordenesCobradas, 1);
assert.equal(cobradaSinMetodoLegado.totalCobrado, 9);
assert.equal(cobradaSinMetodoLegado.efectivoEnCaja, 0);

const rangoCierre = {
  inicio: new Date("2026-08-02T05:00:00.000Z"),
  fin: new Date("2026-08-03T05:00:00.000Z"),
};
assert.equal(
  isConfirmedPaymentInRange(
    {
      cobrada: true,
      fechaCobro: new Date("2026-08-03T06:00:00.000Z"),
    },
    rangoCierre,
  ),
  false,
  "un cobro del dia siguiente no debe contarse retroactivamente",
);
assert.equal(
  isConfirmedPaymentInRange(
    {
      cobrada: true,
      fechaCobro: new Date("2026-08-02T15:00:00.000Z"),
      cobro: {
        createdAt: new Date("2026-08-02T15:00:00.000Z"),
        estado: "CONFIRMADO",
      },
    },
    rangoCierre,
  ),
  true,
);
assert.equal(
  isConfirmedPaymentInRange(
    {
      cobrada: true,
      cobro: {
        createdAt: new Date("2026-08-02T15:00:00.000Z"),
        estado: "REEMBOLSO_PENDIENTE",
      },
    },
    rangoCierre,
  ),
  true,
);

const conReembolsoPendiente = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 40,
    costoEnvio: 5,
    metodoPago: "transferencia",
    estadoCobro: "REEMBOLSO_PENDIENTE",
  },
]);
assert.equal(conReembolsoPendiente.transferencias, 40);
assert.equal(conReembolsoPendiente.montoReembolsoPendiente, 40);

console.log("cuadre tests passed");
