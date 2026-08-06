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

// Las ordenes suman 210 en bruto, pero 11 de eso son envios del motorizado.
assert.deepEqual(resumen, {
  totalOrdenes: 5,
  ordenesCobradas: 4,
  ordenesSinCobrar: 1,
  ordenesAnuladas: 0,
  ventasAnuladas: 0,
  ventasTotales: 199,
  ventasSinCobrar: 100,
  ventasCobradas: 99,
  efectivoVentasDirectas: 25,
  efectivoCobradoMotorizados: 25,
  efectivoEntregadoMotorizados: 6,
  efectivoEnCaja: 44,
  transferenciasVentas: 49,
  depositosRecibidos: 55,
  enviosMotorizados: 11,
  retirosEfectivo: 0,
  cantidadRetiros: 0,
  montoReembolsoPendiente: 0,
});

// El envio jamas entra en una cifra de venta.
assert.equal(resumen.ventasCobradas + resumen.ventasSinCobrar, resumen.ventasTotales);
assert.equal(
  resumen.depositosRecibidos - resumen.transferenciasVentas,
  resumen.efectivoEntregadoMotorizados,
);

const pagadaPeroAunEnPreparacion = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "para_llevar",
    total: "12.50",
    metodoPago: "efectivo",
  },
]);

assert.equal(pagadaPeroAunEnPreparacion.ordenesCobradas, 1);
assert.equal(pagadaPeroAunEnPreparacion.ventasTotales, 12.5);
assert.equal(pagadaPeroAunEnPreparacion.ventasSinCobrar, 0);
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

const domicilioConCentavos = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: "18.35",
    costoEnvio: "2.45",
    metodoPago: "efectivo",
  },
]);

assert.equal(domicilioConCentavos.ventasCobradas, 15.9);
assert.equal(domicilioConCentavos.efectivoEnCaja, 15.9);
assert.equal(domicilioConCentavos.enviosMotorizados, 2.45);

// Ordenes viejas sin metodo registrado: el envio se descuenta igual.
const cobradaSinMetodoLegado = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 9,
    metodoPago: null,
  },
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 20,
    costoEnvio: 4,
    metodoPago: null,
  },
]);

assert.equal(cobradaSinMetodoLegado.ordenesCobradas, 2);
assert.equal(cobradaSinMetodoLegado.ventasCobradas, 25);
assert.equal(cobradaSinMetodoLegado.enviosMotorizados, 4);
assert.equal(cobradaSinMetodoLegado.efectivoEnCaja, 0);

// Un domicilio sin cobrar tampoco puede inflar lo pendiente con el envio.
const domicilioSinCobrar = calcularResumenCuadre([
  {
    cobrada: false,
    tipoOrden: "domicilio",
    total: 33,
    costoEnvio: 3,
    metodoPago: null,
  },
]);

assert.equal(domicilioSinCobrar.ventasSinCobrar, 30);
assert.equal(domicilioSinCobrar.ventasTotales, 30);
assert.equal(domicilioSinCobrar.enviosMotorizados, 0);

// Un costo de envio fuera de domicilio es dato basura: no se descuenta.
const envioFueraDeDomicilio = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "para_llevar",
    total: 10,
    costoEnvio: 4,
    metodoPago: "efectivo",
  },
]);

assert.equal(envioFueraDeDomicilio.ventasCobradas, 10);
assert.equal(envioFueraDeDomicilio.efectivoEnCaja, 10);
assert.equal(envioFueraDeDomicilio.enviosMotorizados, 0);

// ---------------------------------------------------------------------------
// Retiros de caja
// ---------------------------------------------------------------------------

const ventasDelDia = [
  {
    cobrada: true,
    tipoOrden: "local",
    total: 80,
    metodoPago: "efectivo",
  },
] as const;

// Sin retiros el resultado es identico al de antes de la funcionalidad.
assert.equal(calcularResumenCuadre(ventasDelDia).efectivoEnCaja, 80);
assert.equal(calcularResumenCuadre(ventasDelDia).retirosEfectivo, 0);
assert.equal(calcularResumenCuadre(ventasDelDia, []).efectivoEnCaja, 80);

const conRetiros = calcularResumenCuadre(ventasDelDia, [
  { monto: 12.5, estado: "registrado" },
  { monto: "7.25", estado: "registrado" },
  { monto: 100, estado: "anulado" },
]);

assert.equal(conRetiros.retirosEfectivo, 19.75);
assert.equal(conRetiros.cantidadRetiros, 2, "el anulado no se cuenta");
assert.equal(conRetiros.efectivoEnCaja, 60.25);

// Los retiros no tocan ninguna cifra de venta ni el banco.
assert.equal(conRetiros.ventasTotales, 80);
assert.equal(conRetiros.ventasCobradas, 80);
assert.equal(conRetiros.efectivoVentasDirectas, 80);
assert.equal(conRetiros.transferenciasVentas, 0);
assert.equal(conRetiros.depositosRecibidos, 0);

// Sacar mas de lo que entro deja la caja en negativo: es un dato real.
const cajaEnNegativo = calcularResumenCuadre(ventasDelDia, [
  { monto: 95, estado: "registrado" },
]);
assert.equal(cajaEnNegativo.efectivoEnCaja, -15);

// Sin errores de coma flotante al acumular centavos.
const centavos = calcularResumenCuadre([], [
  { monto: 0.1, estado: "registrado" },
  { monto: 0.2, estado: "registrado" },
]);
assert.equal(centavos.retirosEfectivo, 0.3);
assert.equal(centavos.efectivoEnCaja, -0.3);

// Un dia solo de retiros sigue siendo un cuadre valido.
const soloRetiros = calcularResumenCuadre([], [
  { monto: 40, estado: "registrado" },
]);
assert.equal(soloRetiros.totalOrdenes, 0);
assert.equal(soloRetiros.ventasTotales, 0);
assert.equal(soloRetiros.efectivoEnCaja, -40);

// Todos anulados equivale a no tener retiros.
const todosAnulados = calcularResumenCuadre(ventasDelDia, [
  { monto: 30, estado: "anulado" },
  { monto: 10, estado: "anulado" },
]);
assert.equal(todosAnulados.retirosEfectivo, 0);
assert.equal(todosAnulados.cantidadRetiros, 0);
assert.equal(todosAnulados.efectivoEnCaja, 80);

// ---------------------------------------------------------------------------
// Ordenes anuladas
// ---------------------------------------------------------------------------

// Una orden anulada se informa aparte y no toca ninguna cifra: ni la venta, ni
// lo pendiente, ni la caja, ni el banco.
const conAnuladas = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 20,
    metodoPago: "efectivo",
  },
  {
    cobrada: true,
    tipoOrden: "local",
    total: 50,
    metodoPago: "efectivo",
    anulada: true,
  },
  {
    cobrada: false,
    tipoOrden: "domicilio",
    total: 33,
    costoEnvio: 3,
    metodoPago: null,
    anulada: true,
  },
]);

assert.equal(conAnuladas.totalOrdenes, 1, "la anulada no se cuenta");
assert.equal(conAnuladas.ordenesAnuladas, 2);
assert.equal(conAnuladas.ordenesCobradas, 1);
assert.equal(conAnuladas.ordenesSinCobrar, 0);
assert.equal(conAnuladas.ventasTotales, 20);
assert.equal(conAnuladas.ventasCobradas, 20);
assert.equal(conAnuladas.ventasSinCobrar, 0);
assert.equal(conAnuladas.efectivoEnCaja, 20);
assert.equal(conAnuladas.depositosRecibidos, 0);
assert.equal(conAnuladas.enviosMotorizados, 0);
// La venta anulada se informa sin el envio, igual que cualquier otra cifra.
assert.equal(conAnuladas.ventasAnuladas, 80);

// Anular una transferencia tampoco puede dejar rastro en el banco.
const transferenciaAnulada = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "para_llevar",
    total: 15,
    metodoPago: "transferencia",
    anulada: true,
  },
]);
assert.equal(transferenciaAnulada.transferenciasVentas, 0);
assert.equal(transferenciaAnulada.depositosRecibidos, 0);
assert.equal(transferenciaAnulada.totalOrdenes, 0);

// Anular es "esta orden nunca fue una venta": el cobro queda marcado como
// reembolso en la base para auditoria, pero el cuadre ya no lo arrastra como
// deuda, porque el dinero se devuelve junto con la anulacion.
const anuladaConReembolso = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 18,
    metodoPago: "efectivo",
    estadoCobro: "REEMBOLSO_PENDIENTE",
    anulada: true,
  },
]);
assert.equal(anuladaConReembolso.montoReembolsoPendiente, 0);

// `anulada: false` o ausente son lo mismo: la orden cuenta normal.
assert.equal(
  calcularResumenCuadre([
    { cobrada: true, tipoOrden: "local", total: 10, metodoPago: "efectivo", anulada: false },
  ]).ventasCobradas,
  10,
);

// ---------------------------------------------------------------------------
// Cobros: fecha del movimiento y reembolsos pendientes
// ---------------------------------------------------------------------------

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
// La venta propia excluye el envio, pero la deuda con el cliente no: el cliente
// pago los 40 completos y hay que devolverle los 40.
assert.equal(conReembolsoPendiente.transferenciasVentas, 35);
assert.equal(conReembolsoPendiente.depositosRecibidos, 40);
assert.equal(conReembolsoPendiente.montoReembolsoPendiente, 40);

console.log("cuadre tests passed");
