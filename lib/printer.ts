import ThermalPrinter from 'node-thermal-printer';
import path from 'node:path';
import {
  esMetodoPago,
  esNivelPicante,
  obtenerEtiquetaNivelPicante,
} from '../types/orden';

const LINE_WIDTH = 42;
const STRONG_SEPARATOR = '='.repeat(LINE_WIDTH);
const SECTION_SEPARATOR = '-'.repeat(LINE_WIDTH);
/** Etiquetas cuya etiqueta se imprime en video inverso. */
const EMPHASIZED_LABEL_PATTERN = /^(Tipo|Mesa):/;
/** Etiquetas cuyo valor seleccionado se imprime en video inverso. */
const SELECTED_VALUE_PATTERN = /^(\s*Salsa Louisiana:) (.+)$/;
const DEFAULT_LOGO_PATH = path.join(
  process.cwd(),
  'public',
  'assets',
  'logo-camarones-louisiana.png',
);

type NumericValue = number | string | { toNumber(): number } | { toString(): string };

function ascii(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '?');
}

function centered(value: string): string {
  const clean = ascii(value).slice(0, LINE_WIDTH);
  return `${' '.repeat(Math.max(0, Math.floor((LINE_WIDTH - clean.length) / 2)))}${clean}`;
}

/** Etiqueta a la izquierda y monto pegado al borde derecho del ticket. */
function amountLine(label: string, amount: number): string {
  const value = `$${amount.toFixed(2)}`;
  const cleanLabel = ascii(label);
  const padding = Math.max(1, LINE_WIDTH - cleanLabel.length - value.length);
  return `${cleanLabel}${' '.repeat(padding)}${value}`;
}

/**
 * Bloque de montos al pie del ticket.
 *
 * - local: solo el total.
 * - para llevar: productos y recipientes desglosados mas el total a cobrar.
 * - domicilio en efectivo: productos y recipientes. El envio NO entra en el TOTAL:
 *   ese TOTAL es lo que el local le cobra al motorizado. Debajo, en un bloque
 *   propio, va lo que el motorizado le cobra al cliente (TOTAL + envio).
 * - domicilio por transferencia: solo el envio, que es lo unico que se mueve en el local.
 * - domicilio sin modalidad acordada (ordenes previas): sin montos, como antes.
 */
function buildAmountLines(params: {
  tipoOrden: string;
  recargo: number;
  costoEnvio: number;
  total: number;
  metodoPagoPrevisto: string | null;
}): string[] {
  const { tipoOrden, recargo, costoEnvio, total, metodoPagoPrevisto } = params;
  const subtotalProductos = total - recargo - costoEnvio;

  if (tipoOrden === 'local') {
    return [SECTION_SEPARATOR, amountLine('TOTAL:', total)];
  }

  if (tipoOrden === 'para_llevar') {
    return [
      SECTION_SEPARATOR,
      amountLine('Subtotal productos:', subtotalProductos),
      amountLine('Recipientes:', recargo),
      SECTION_SEPARATOR,
      amountLine('TOTAL:', total),
    ];
  }

  if (metodoPagoPrevisto === 'efectivo') {
    const totalLocal = subtotalProductos + recargo;
    return [
      SECTION_SEPARATOR,
      amountLine('Subtotal productos:', subtotalProductos),
      amountLine('Recipientes:', recargo),
      SECTION_SEPARATOR,
      amountLine('TOTAL:', totalLocal),
      SECTION_SEPARATOR,
      'DELIVERY:',
      amountLine('Envio:', costoEnvio),
      amountLine('Cobra al cliente:', totalLocal + costoEnvio),
    ];
  }

  if (metodoPagoPrevisto === 'transferencia') {
    return [SECTION_SEPARATOR, amountLine('Envio:', costoEnvio)];
  }

  return [];
}

function toNumber(value: NumericValue): number {
  const converted = typeof value === 'object' && 'toNumber' in value
    ? value.toNumber()
    : Number(value.toString());

  if (!Number.isFinite(converted)) {
    throw new Error('El total de la orden no es un valor numerico valido');
  }
  return converted;
}

/** Recargo y envio son opcionales en la orden: ausentes valen cero. */
function toOptionalNumber(value: NumericValue | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return toNumber(value);
}

export interface ItemComanda {
  cantidad: number;
  observaciones?: string | null;
  nivelPicante?: string | null;
  esCortesia?: boolean | null;
  producto: {
    nombre: string;
  };
}

export interface OrdenComanda {
  id: string;
  numeroDiario?: number | null;
  tipoOrden?: string | null;
  nivelPicante?: string | null;
  numeroMesa?: number | null;
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  mesero: string;
  observaciones?: string | null;
  printRevision?: number | null;
  recargo?: NumericValue | null;
  costoEnvio?: NumericValue | null;
  metodoPagoPrevisto?: string | null;
  total: NumericValue;
  createdAt: string | Date;
  items: ItemComanda[];
}

export function buildOrderTicketLines(orden: OrdenComanda): string[] {
  const tipoOrden = orden.tipoOrden ?? 'local';
  const nombreCliente = orden.nombreCliente?.trim();
  const labelTipo = tipoOrden === 'para_llevar'
    ? 'PARA LLEVAR'
    : tipoOrden === 'domicilio'
      ? 'DOMICILIO'
      : 'LOCAL';
  const visibleOrderNumber = orden.numeroDiario ?? orden.id.slice(-6);
  // La modalidad de pago solo se acuerda de antemano en domicilio.
  const metodoPagoPrevisto =
    tipoOrden === 'domicilio' && esMetodoPago(orden.metodoPagoPrevisto)
      ? orden.metodoPagoPrevisto
      : null;
  const lines = [
    STRONG_SEPARATOR,
    centered(`ORDEN #${visibleOrderNumber}`),
    STRONG_SEPARATOR,
    ...(tipoOrden === 'local' ? [] : [`Tipo: ${labelTipo}`]),
    ...(metodoPagoPrevisto ? [`Pago: ${metodoPagoPrevisto.toUpperCase()}`] : []),
    ...(tipoOrden === 'local'
      ? [`Mesa: ${orden.numeroMesa ?? '-'}`]
      : nombreCliente
        ? [`Cliente: ${nombreCliente}`]
        : []),
    ...(orden.telefonoCliente
      ? [`Telefono: ${orden.telefonoCliente}`]
      : []),
    `Hora: ${new Date(orden.createdAt).toLocaleString('es-EC')}`,
    SECTION_SEPARATOR,
  ];

  for (const item of orden.items) {
    lines.push(
      `${item.cantidad}x ${item.producto.nombre}${item.esCortesia ? ' [CORTESIA]' : ''}`,
    );
    if (esNivelPicante(item.nivelPicante)) {
      lines.push(
        `  Salsa Louisiana: ${obtenerEtiquetaNivelPicante(item.nivelPicante).toUpperCase()}`,
      );
    }
    if (item.observaciones) lines.push(`  Obs: ${item.observaciones}`);
  }

  // Compatibilidad con comandas históricas, anteriores al picante por item.
  if (
    !orden.items.some((item) => esNivelPicante(item.nivelPicante)) &&
    esNivelPicante(orden.nivelPicante)
  ) {
    lines.push(
      SECTION_SEPARATOR,
      `Salsa Louisiana: ${obtenerEtiquetaNivelPicante(orden.nivelPicante).toUpperCase()}`,
    );
  }

  if (orden.observaciones) {
    lines.push(SECTION_SEPARATOR, 'OBSERVACIONES:', orden.observaciones);
  }

  lines.push(
    ...buildAmountLines({
      tipoOrden,
      recargo: toOptionalNumber(orden.recargo),
      costoEnvio: toOptionalNumber(orden.costoEnvio),
      total: toNumber(orden.total),
      metodoPagoPrevisto,
    }),
  );

  lines.push(STRONG_SEPARATOR, '', '', '');
  return lines.map(ascii);
}

export class PrinterService {
  private printer: ThermalPrinter.printer;

  constructor() {
    this.printer = new ThermalPrinter.printer({
      type: ThermalPrinter.types.EPSON,
      interface: `tcp://${process.env.PRINTER_IP}`,
      characterSet: ThermalPrinter.characterSet.SLOVENIA,
      removeSpecialCharacters: false,
      lineCharacter: '=',
      options: {
        timeout: 5000,
      },
    });
  }

  async imprimirComanda(orden: OrdenComanda) {
    try {
      // Mantener el mismo formato que print-agent/src/printer.ts para trabajos ORDER.
      try {
        const logo = await this.printer.printImage(
          process.env.PRINT_LOGO_PATH || DEFAULT_LOGO_PATH,
        );
        this.printer.setBuffer(Buffer.concat([
          Buffer.from([0x1b, 0x61, 0x01]),
          logo,
          Buffer.from([0x0a, 0x1b, 0x61, 0x00]),
        ]));
      } catch (error) {
        console.warn('No se pudo cargar el logo de impresion:', error);
        this.printer.clear();
      }

      this.printer.setTextSize(0, 0);
      this.printer.bold(false);
      this.printer.alignLeft();
      for (const line of buildOrderTicketLines(orden)) {
        const emphasizedLabel = line.match(EMPHASIZED_LABEL_PATTERN);
        const selectedValue = line.match(SELECTED_VALUE_PATTERN);

        if (emphasizedLabel) {
          const label = emphasizedLabel[0].toUpperCase();
          this.printer.invert(true);
          this.printer.print(label);
          this.printer.invert(false);
          this.printer.println(line.slice(emphasizedLabel[0].length));
        } else if (selectedValue) {
          // La opcion elegida se resalta en negro con letras blancas.
          this.printer.print(`${selectedValue[1]} `);
          this.printer.invert(true);
          this.printer.print(` ${selectedValue[2]} `);
          this.printer.invert(false);
          this.printer.println('');
        } else {
          this.printer.println(line);
        }
      }
      this.printer.cut();

      // Ejecutar impresión
      const execute = await this.printer.execute();
      console.log('Impresión exitosa');
      return { success: true, data: execute };
    } catch (error) {
      console.error('Error al imprimir:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async testConexion() {
    try {
      this.printer.alignCenter();
      this.printer.println('Test de Conexion');
      this.printer.println('Impresora conectada correctamente');
      this.printer.cut();
      await this.printer.execute();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
