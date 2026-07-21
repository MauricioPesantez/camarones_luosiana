import { describe, it, expect } from "vitest";
import { Money } from "../order/Money";
import { Libro } from "./Libro";
import { TipoMovimiento } from "./TipoMovimiento";
import { MovimientoCaja } from "./MovimientoCaja";
import {
  efectivoEsperado,
  diferencia,
  puente,
  calcularCierre,
} from "./cierre";

/**
 * Pruebas de los cálculos puros del cierre de caja (R13.1, R13.2, R13.3).
 *
 * Convención verificada explícitamente: `efectivoEsperado` y `puente` devuelven
 * sumas CON SIGNO (los egresos restan); `puente` por tanto es ≤ 0.
 */

let secuencia = 0;

/** Fábrica de movimientos para fixtures; solo exige lo que cada caso varía. */
function mov(params: {
  tipo: TipoMovimiento;
  libro: Libro;
  monto: Money;
  esCarreraPassthrough?: boolean;
}): MovimientoCaja {
  secuencia += 1;
  return MovimientoCaja.crear({
    id: `mov-${secuencia}`,
    sesionId: "sesion-1",
    tipo: params.tipo,
    libro: params.libro,
    monto: params.monto,
    esCarreraPassthrough: params.esCarreraPassthrough,
    empleadoId: "empleado-1",
    timestamp: new Date("2024-01-01T08:00:00Z"),
  });
}

describe("cierre - efectivoEsperado (R13.1)", () => {
  it("suma solo los montos con signo del libro EFECTIVO y excluye TRANSFERENCIA", () => {
    const movimientos = [
      // APERTURA +100 (EFECTIVO)
      mov({
        tipo: TipoMovimiento.APERTURA,
        libro: Libro.EFECTIVO,
        monto: Money.de(100),
      }),
      // VENTA_EFECTIVO +25.50 (EFECTIVO)
      mov({
        tipo: TipoMovimiento.VENTA_EFECTIVO,
        libro: Libro.EFECTIVO,
        monto: Money.de(25.5),
      }),
      // PAGO_PROVEEDOR -40 (EFECTIVO, egreso)
      mov({
        tipo: TipoMovimiento.PAGO_PROVEEDOR,
        libro: Libro.EFECTIVO,
        monto: Money.de(40).negativo(),
      }),
      // VENTA_TRANSFERENCIA +200 (TRANSFERENCIA) -> debe excluirse
      mov({
        tipo: TipoMovimiento.VENTA_TRANSFERENCIA,
        libro: Libro.TRANSFERENCIA,
        monto: Money.de(200),
      }),
      // RETIRO_MANUAL -15 (EFECTIVO, egreso)
      mov({
        tipo: TipoMovimiento.RETIRO_MANUAL,
        libro: Libro.EFECTIVO,
        monto: Money.de(15).negativo(),
      }),
    ];

    // 100 + 25.50 - 40 - 15 = 70.50 (la transferencia de 200 NO influye)
    expect(efectivoEsperado(movimientos).toDecimal()).toBe(70.5);
  });

  it("ignora por completo los movimientos del libro TRANSFERENCIA", () => {
    const soloTransferencia = [
      mov({
        tipo: TipoMovimiento.VENTA_TRANSFERENCIA,
        libro: Libro.TRANSFERENCIA,
        monto: Money.de(200),
      }),
      mov({
        tipo: TipoMovimiento.VENTA_TRANSFERENCIA,
        libro: Libro.TRANSFERENCIA,
        monto: Money.de(50),
      }),
    ];
    expect(efectivoEsperado(soloTransferencia).toDecimal()).toBe(0);
  });

  it("devuelve cero para una lista vacía de movimientos", () => {
    expect(efectivoEsperado([]).toDecimal()).toBe(0);
    expect(efectivoEsperado([]).esCero()).toBe(true);
  });
});

describe("cierre - diferencia (R13.2)", () => {
  it("es positiva cuando lo contado supera lo esperado (sobrante)", () => {
    const d = diferencia(Money.de(120), Money.de(100));
    expect(d.toDecimal()).toBe(20);
  });

  it("es negativa cuando lo contado es menor que lo esperado (faltante)", () => {
    const d = diferencia(Money.de(80), Money.de(100));
    expect(d.toDecimal()).toBe(-20);
    expect(d.esNegativo()).toBe(true);
  });

  it("es cero cuando lo contado iguala lo esperado (cuadre exacto)", () => {
    const d = diferencia(Money.de(100), Money.de(100));
    expect(d.toDecimal()).toBe(0);
    expect(d.esCero()).toBe(true);
  });
});

describe("cierre - puente (R13.3)", () => {
  it("suma con signo solo los PAGO_CARRERA passthrough", () => {
    const movimientos = [
      // PAGO_CARRERA passthrough -3 (EFECTIVO)
      mov({
        tipo: TipoMovimiento.PAGO_CARRERA,
        libro: Libro.EFECTIVO,
        monto: Money.de(3).negativo(),
        esCarreraPassthrough: true,
      }),
      // PAGO_CARRERA passthrough -2.50 (EFECTIVO)
      mov({
        tipo: TipoMovimiento.PAGO_CARRERA,
        libro: Libro.EFECTIVO,
        monto: Money.de(2.5).negativo(),
        esCarreraPassthrough: true,
      }),
      // PAGO_CARRERA NO passthrough -4 -> debe excluirse
      mov({
        tipo: TipoMovimiento.PAGO_CARRERA,
        libro: Libro.EFECTIVO,
        monto: Money.de(4).negativo(),
        esCarreraPassthrough: false,
      }),
      // Otros tipos -> deben excluirse
      mov({
        tipo: TipoMovimiento.VENTA_EFECTIVO,
        libro: Libro.EFECTIVO,
        monto: Money.de(30),
      }),
      mov({
        tipo: TipoMovimiento.PAGO_PROVEEDOR,
        libro: Libro.EFECTIVO,
        monto: Money.de(10).negativo(),
      }),
    ];

    // -3 + -2.50 = -5.50 (signo conservado; no passthrough y otros excluidos)
    expect(puente(movimientos).toDecimal()).toBe(-5.5);
  });

  it("devuelve cero para una lista vacía de movimientos", () => {
    expect(puente([]).toDecimal()).toBe(0);
    expect(puente([]).esCero()).toBe(true);
  });

  it("escenario passthrough R12: VENTA_TRANSFERENCIA(+total) con PAGO_CARRERA(-envio)", () => {
    const total = Money.de(50);
    const envio = Money.de(3);
    const movimientos = [
      // R12.1: venta por transferencia +total en libro TRANSFERENCIA
      mov({
        tipo: TipoMovimiento.VENTA_TRANSFERENCIA,
        libro: Libro.TRANSFERENCIA,
        monto: total,
      }),
      // R12.2: carrera passthrough -envio en libro EFECTIVO
      mov({
        tipo: TipoMovimiento.PAGO_CARRERA,
        libro: Libro.EFECTIVO,
        monto: envio.negativo(),
        esCarreraPassthrough: true,
      }),
    ];

    // El efectivo esperado refleja el -envio (la venta por transferencia no cuenta)
    expect(efectivoEsperado(movimientos).toDecimal()).toBe(-3);
    // El puente iguala exactamente ese -envio
    expect(puente(movimientos).toDecimal()).toBe(-3);
    expect(puente(movimientos).equals(envio.negativo())).toBe(true);
  });
});

describe("cierre - calcularCierre (R13.1, R13.2, R13.3)", () => {
  it("agrega esperado, diferencia y puente de forma coherente con las funciones individuales", () => {
    const movimientos = [
      mov({
        tipo: TipoMovimiento.APERTURA,
        libro: Libro.EFECTIVO,
        monto: Money.de(100),
      }),
      mov({
        tipo: TipoMovimiento.VENTA_TRANSFERENCIA,
        libro: Libro.TRANSFERENCIA,
        monto: Money.de(50),
      }),
      mov({
        tipo: TipoMovimiento.PAGO_CARRERA,
        libro: Libro.EFECTIVO,
        monto: Money.de(3).negativo(),
        esCarreraPassthrough: true,
      }),
    ];
    const efectivoContado = Money.de(95);

    const resultado = calcularCierre(movimientos, efectivoContado);

    // esperado = 100 - 3 = 97
    expect(resultado.esperado.toDecimal()).toBe(97);
    // diferencia = 95 - 97 = -2
    expect(resultado.diferencia.toDecimal()).toBe(-2);
    // puente = -3
    expect(resultado.puente.toDecimal()).toBe(-3);

    // Coherencia con las funciones individuales
    expect(
      resultado.esperado.equals(efectivoEsperado(movimientos)),
    ).toBe(true);
    expect(
      resultado.diferencia.equals(
        diferencia(efectivoContado, efectivoEsperado(movimientos)),
      ),
    ).toBe(true);
    expect(resultado.puente.equals(puente(movimientos))).toBe(true);
  });

  it("no muta el arreglo de movimientos recibido", () => {
    const movimientos = [
      mov({
        tipo: TipoMovimiento.APERTURA,
        libro: Libro.EFECTIVO,
        monto: Money.de(100),
      }),
    ];
    const copia = [...movimientos];
    calcularCierre(movimientos, Money.de(100));
    expect(movimientos).toEqual(copia);
    expect(movimientos.length).toBe(1);
  });
});
