import ThermalPrinter from 'node-thermal-printer';
import path from 'node:path';
import { esNivelPicante, obtenerEtiquetaNivelPicante } from '../types/orden';

const LINE_WIDTH = 42;
const STRONG_SEPARATOR = '='.repeat(LINE_WIDTH);
const SECTION_SEPARATOR = '-'.repeat(LINE_WIDTH);
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

function toNumber(value: NumericValue): number {
  const converted = typeof value === 'object' && 'toNumber' in value
    ? value.toNumber()
    : Number(value.toString());

  if (!Number.isFinite(converted)) {
    throw new Error('El total de la orden no es un valor numerico valido');
  }
  return converted;
}

export interface ItemComanda {
  cantidad: number;
  observaciones?: string | null;
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
  const nivelPicante = esNivelPicante(orden.nivelPicante)
    ? orden.nivelPicante
    : 'natural';
  const visibleOrderNumber = orden.numeroDiario ?? orden.id.slice(-6);
  const lines = [
    STRONG_SEPARATOR,
    centered(`ORDEN #${visibleOrderNumber}`),
    STRONG_SEPARATOR,
    ...(tipoOrden === 'local' ? [] : [`Tipo: ${labelTipo}`]),
    `Picante: ${obtenerEtiquetaNivelPicante(nivelPicante).toUpperCase()}`,
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
    if (item.observaciones) lines.push(`  Obs: ${item.observaciones}`);
  }

  if (orden.observaciones) {
    lines.push(SECTION_SEPARATOR, 'OBSERVACIONES:', orden.observaciones);
  }

  if (tipoOrden === 'local') {
    lines.push(SECTION_SEPARATOR, `TOTAL: $${toNumber(orden.total).toFixed(2)}`);
  }

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
        this.printer.println(line);
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
