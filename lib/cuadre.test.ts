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
  ordenesConSaldoPendiente: 0,
  montoSaldoPendiente: 0,
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
      pagos: [
        {
          createdAt: new Date("2026-08-02T15:00:00.000Z"),
          estado: "CONFIRMADO",
        },
      ],
    },
    rangoCierre,
  ),
  true,
);
assert.equal(
  isConfirmedPaymentInRange(
    {
      cobrada: true,
      pagos: [
        {
          createdAt: new Date("2026-08-02T15:00:00.000Z"),
          estado: "REEMBOLSO_PENDIENTE",
        },
      ],
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

// --- Multipago ---------------------------------------------------------

const pago = (metodoPago: string, monto: number) => ({
  metodoPago,
  monto,
  enRango: true,
});

// Los cuatro casos historicos, ahora expresados como pagos, deben dar
// exactamente las mismas cifras que el primer bloque de este fichero.
const conPagos = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 25,
    montoPagado: 25,
    pagos: [pago("efectivo", 25)],
  },
  {
    cobrada: true,
    tipoOrden: "para_llevar",
    total: 15,
    montoPagado: 15,
    pagos: [pago("transferencia", 15)],
  },
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 30,
    costoEnvio: 5,
    montoPagado: 30,
    pagos: [pago("efectivo", 30)],
  },
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 40,
    costoEnvio: 6,
    montoPagado: 40,
    pagos: [pago("transferencia", 40)],
  },
  { cobrada: false, tipoOrden: "local", total: 100, montoPagado: 0, pagos: [] },
]);

assert.equal(conPagos.efectivoVentasDirectas, 25);
assert.equal(conPagos.efectivoCobradoMotorizados, 25);
assert.equal(conPagos.efectivoEntregadoMotorizados, 6);
assert.equal(conPagos.transferenciasVentas, 49);
assert.equal(conPagos.depositosRecibidos, 55);
assert.equal(conPagos.ventasCobradas, 99);
assert.equal(conPagos.efectivoEnCaja, 44);

// El caso real: domicilio de 13 con envio de 3, pagado 8 por transferencia y
// 5 en efectivo. El motorizado entrega 5 - 3 = 2 al local.
const mixtoDomicilio = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 13,
    costoEnvio: 3,
    montoPagado: 13,
    pagos: [pago("transferencia", 8), pago("efectivo", 5)],
  },
]);
assert.equal(mixtoDomicilio.efectivoCobradoMotorizados, 2);
assert.equal(mixtoDomicilio.efectivoEntregadoMotorizados, 0);
assert.equal(mixtoDomicilio.depositosRecibidos, 8);
assert.equal(mixtoDomicilio.transferenciasVentas, 8);
assert.equal(mixtoDomicilio.ventasCobradas, 10);
assert.equal(mixtoDomicilio.efectivoEnCaja, 2);
assert.equal(
  mixtoDomicilio.depositosRecibidos - mixtoDomicilio.transferenciasVentas,
  mixtoDomicilio.efectivoEntregadoMotorizados,
);

// Mixto sin motorizado: las dos partes son venta propia y caja directa.
const mixtoLocal = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 25,
    montoPagado: 25,
    pagos: [pago("efectivo", 10), pago("transferencia", 15)],
  },
]);
assert.equal(mixtoLocal.efectivoVentasDirectas, 10);
assert.equal(mixtoLocal.transferenciasVentas, 15);
assert.equal(mixtoLocal.depositosRecibidos, 15);
assert.equal(mixtoLocal.ventasCobradas, 25);

// Un pago fuera del rango no entra en el dinero del dia.
const pagoDeOtroDia = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 25,
    montoPagado: 25,
    pagos: [
      { metodoPago: "efectivo", monto: 10, enRango: false },
      { metodoPago: "efectivo", monto: 15, enRango: true },
    ],
  },
]);
assert.equal(pagoDeOtroDia.efectivoVentasDirectas, 15);

// Fallback historico: una orden cobrada sin filas de pago se lee por
// `metodoPago`, con la logica de siempre.
const historica = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 40,
    costoEnvio: 6,
    metodoPago: "transferencia",
  },
]);
assert.equal(historica.transferenciasVentas, 34);
assert.equal(historica.depositosRecibidos, 40);
assert.equal(historica.efectivoEntregadoMotorizados, 6);

// La red que evita que una orden reabierta cruce el cierre del dia.
const conSaldo = calcularResumenCuadre([
  {
    cobrada: false,
    tipoOrden: "local",
    total: 30,
    montoPagado: 25,
    pagos: [pago("efectivo", 25)],
  },
  { cobrada: true, tipoOrden: "local", total: 10, montoPagado: 10, pagos: [pago("efectivo", 10)] },
]);
assert.equal(conSaldo.ordenesConSaldoPendiente, 1);
assert.equal(conSaldo.montoSaldoPendiente, 5);
// El efectivo ya recibido si cuenta, aunque la orden no este cerrada.
assert.equal(conSaldo.efectivoVentasDirectas, 35);

// El caso del reviewer: domicilio de 13 con envio de 3, un solo pago en
// efectivo. La orden entra a este reporte por otra fecha (p. ej. `createdAt`
// de un dia, el pago del dia siguiente), asi que el pago no cae en el rango
// (`enRango: false`) y la ruta todavia no marca la orden como cerrada en
// este rango (`cobrada: false`). La liquidacion con el motorizado NO debe
// reconocerse aqui, o la misma orden se acreditaria de nuevo cuando aparezca
// en el reporte del dia en que si cierra: doble conteo.
const domicilioSinCerrarEnEsteRango = calcularResumenCuadre([
  {
    cobrada: false,
    tipoOrden: "domicilio",
    total: 13,
    costoEnvio: 3,
    montoPagado: 13,
    pagos: [{ metodoPago: "efectivo", monto: 13, enRango: false }],
  },
]);
assert.equal(domicilioSinCerrarEnEsteRango.efectivoCobradoMotorizados, 0);
assert.equal(domicilioSinCerrarEnEsteRango.efectivoEntregadoMotorizados, 0);
assert.equal(domicilioSinCerrarEnEsteRango.depositosRecibidos, 0);

// La companera: el mismo historial de efectivo, pero en el reporte del dia
// en que el pago que cierra la orden si cae en el rango (`cobrada: true`,
// ya resuelto por la ruta con `cobradaEnFecha`). Ahi si se reconoce, una
// sola vez, el $10 completo de liquidacion.
const domicilioCerrandoEnEsteRango = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 13,
    costoEnvio: 3,
    montoPagado: 13,
    pagos: [{ metodoPago: "efectivo", monto: 13, enRango: true }],
  },
]);
assert.equal(domicilioCerrandoEnEsteRango.efectivoCobradoMotorizados, 10);
assert.equal(domicilioCerrandoEnEsteRango.efectivoEntregadoMotorizados, 0);

// Reembolso parcial en una orden con multipago: solo una de las dos partes
// esta pendiente de reembolso (los $5 en efectivo), asi que la deuda es
// $5, no el total de la orden ($13). Sumar el total completo sobreestimaria
// la deuda con el cliente cuando el resto del pago si quedo confirmado.
const reembolsoParcialMultipago = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 13,
    montoPagado: 13,
    estadoCobro: "REEMBOLSO_PENDIENTE",
    pagos: [
      { metodoPago: "efectivo", monto: 5, enRango: true, estado: "REEMBOLSO_PENDIENTE" },
      { metodoPago: "transferencia", monto: 8, enRango: true, estado: "CONFIRMADO" },
    ],
  },
]);
assert.equal(
  reembolsoParcialMultipago.montoReembolsoPendiente,
  5,
  "solo la parte pendiente de reembolso debe contar como deuda, no el total de la orden",
);

console.log("cuadre.test.ts multipago OK");
