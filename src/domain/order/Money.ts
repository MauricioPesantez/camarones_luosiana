/**
 * Value object para montos de dinero.
 *
 * Opera internamente en centavos enteros para evitar errores de coma flotante
 * (p. ej. 0.1 + 0.2 !== 0.3). Es inmutable: toda operación devuelve una nueva
 * instancia. Las conversiones a/desde `Decimal` de Prisma ocurren en los
 * repositorios mediante `toDecimal` / `de`.
 */
export class Money {
  private constructor(private readonly cents: number) {}

  /**
   * Crea un `Money` a partir de un valor decimal (p. ej. 0.50 → 50 centavos).
   * Redondea al centavo más cercano (round half away from zero) para tolerar
   * imprecisiones de coma flotante.
   */
  static de(valor: number): Money {
    if (!Number.isFinite(valor)) {
      throw new RangeError("Money.de requiere un número finito");
    }
    // Math.round redondea .5 hacia +∞; para montos negativos preservamos la
    // simetría redondeando la magnitud y reaplicando el signo.
    const signo = valor < 0 ? -1 : 1;
    // `valor * 100` arrastra ruido de coma flotante (p. ej. 1.005 * 100 =
    // 100.4999...). `toPrecision(15)` descarta ese ruido conservando los
    // dígitos significativos reales, de modo que el redondeo financiero sea
    // correcto (1.005 → 1.01).
    const escalado = Number((Math.abs(valor) * 100).toPrecision(15));
    const centavos = signo * Math.round(escalado);
    // Normaliza -0 a 0.
    return new Money(centavos === 0 ? 0 : centavos);
  }

  /**
   * Crea un `Money` a partir de un entero de centavos (sin conversión decimal).
   * Útil para repositorios y pruebas que ya trabajan en centavos.
   */
  static deCentavos(centavos: number): Money {
    if (!Number.isInteger(centavos)) {
      throw new RangeError("Money.deCentavos requiere un entero de centavos");
    }
    return new Money(centavos === 0 ? 0 : centavos);
  }

  /** Monto cero. */
  static cero(): Money {
    return new Money(0);
  }

  /** Suma: this + otro. */
  suma(otro: Money): Money {
    return new Money(this.cents + otro.cents);
  }

  /** Resta: this − otro (puede resultar negativo). */
  resta(otro: Money): Money {
    return new Money(this.cents - otro.cents);
  }

  /**
   * Multiplica el monto por una cantidad entera (p. ej. precio × cantidad).
   * Exige un entero para mantener exactitud en centavos.
   */
  multiplica(cantidad: number): Money {
    if (!Number.isInteger(cantidad)) {
      throw new RangeError("Money.multiplica requiere una cantidad entera");
    }
    const centavos = this.cents * cantidad;
    return new Money(centavos === 0 ? 0 : centavos);
  }

  /** ¿El monto es exactamente cero? */
  esCero(): boolean {
    return this.cents === 0;
  }

  /** ¿El monto es negativo? */
  esNegativo(): boolean {
    return this.cents < 0;
  }

  /** Devuelve el monto con el signo invertido (p. ej. para movimientos de egreso). */
  negativo(): Money {
    // Normaliza -0 a 0 cuando el monto es cero.
    return new Money(this.cents === 0 ? 0 : -this.cents);
  }

  /** Igualdad por valor. */
  equals(otro: Money): boolean {
    return this.cents === otro.cents;
  }

  /** Centavos enteros con signo (representación interna). */
  get centavos(): number {
    return this.cents;
  }

  /**
   * Convierte a número decimal (p. ej. 50 centavos → 0.5).
   * Pensado para mapear hacia `Decimal(10,2)` de Prisma en los repositorios.
   */
  toDecimal(): number {
    const decimal = this.cents / 100;
    // Evita devolver -0 de forma defensiva.
    return decimal === 0 ? 0 : decimal;
  }

  /** Representación legible con dos decimales (p. ej. "0.50", "-1.25"). */
  toString(): string {
    return (this.cents / 100).toFixed(2);
  }
}
