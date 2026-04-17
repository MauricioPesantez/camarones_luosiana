import ThermalPrinter from 'node-thermal-printer';

// Representa un valor numérico que puede ser un Decimal de Prisma, number o string
type NumericValue = number | string | { toNumber(): number; toFixed(d?: number): string };

interface ItemComanda {
  cantidad: number;
  observaciones?: string | null;
  producto: {
    nombre: string;
  };
}

interface OrdenComanda {
  id: string;
  tipoOrden?: string | null;
  numeroMesa?: number | null;
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  mesero: string;
  observaciones?: string | null;
  recargo?: NumericValue | null;
  costoEnvio?: NumericValue | null;
  total: NumericValue;
  createdAt: string | Date;
  items: ItemComanda[];
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
      // Configurar impresora
      this.printer.alignCenter();
      this.printer.println('================================');
      this.printer.setTextSize(1, 1);
      this.printer.bold(true);
      this.printer.println('COMANDA DE COCINA');
      this.printer.bold(false);
      this.printer.println('================================');
      this.printer.newLine();

      // Tipo de orden
      const tipoOrden = orden.tipoOrden ?? 'local';
      const labelTipo = tipoOrden === 'para_llevar' ? 'PARA LLEVAR'
        : tipoOrden === 'domicilio' ? 'DOMICILIO'
          : 'LOCAL';
      this.printer.bold(true);
      this.printer.println(`TIPO: ${labelTipo}`);
      this.printer.bold(false);

      // Información de la orden
      this.printer.alignLeft();
      this.printer.bold(true);
      if (tipoOrden === 'local') {
        this.printer.println(`Mesa: ${orden.numeroMesa}`);
      } else {
        this.printer.println(`Cliente: ${orden.nombreCliente}`);
        if (tipoOrden === 'domicilio' && orden.telefonoCliente) {
          this.printer.println(`Telefono: ${orden.telefonoCliente}`);
        }
      }
      this.printer.println(`Mesero: ${orden.mesero}`);
      this.printer.bold(false);
      this.printer.println(`Hora: ${new Date(orden.createdAt).toLocaleTimeString('es-EC')}`);
      this.printer.println(`Fecha: ${new Date(orden.createdAt).toLocaleDateString('es-EC')}`);
      this.printer.println('--------------------------------');
      this.printer.newLine();

      // Items
      orden.items.forEach((item: ItemComanda) => {
        this.printer.bold(true);
        this.printer.setTextSize(1, 1);
        this.printer.println(`${item.cantidad}x ${item.producto.nombre}`);
        this.printer.setTextSize(0, 0);
        this.printer.bold(false);

        if (item.observaciones) {
          this.printer.println(`   Obs: ${item.observaciones}`);
        }
        this.printer.newLine();
      });

      this.printer.println('--------------------------------');

      // Observaciones generales
      if (orden.observaciones) {
        this.printer.bold(true);
        this.printer.println('OBSERVACIONES GENERALES:');
        this.printer.bold(false);
        this.printer.println(orden.observaciones);
        this.printer.println('--------------------------------');
      }

      // Desglose de precios
      this.printer.alignLeft();
      const subtotal = Number(orden.total) - Number(orden.recargo ?? 0) - Number(orden.costoEnvio ?? 0);
      this.printer.println(`Subtotal:   $${subtotal.toFixed(2)}`);
      if (Number(orden.recargo ?? 0) > 0) {
        this.printer.println(`Recargo:    $${Number(orden.recargo).toFixed(2)}`);
      }
      if (Number(orden.costoEnvio ?? 0) > 0) {
        this.printer.println(`Envio:      $${Number(orden.costoEnvio).toFixed(2)}`);
      }
      this.printer.println('--------------------------------');
      this.printer.bold(true);
      this.printer.println(`TOTAL:      $${Number(orden.total).toFixed(2)}`);
      this.printer.bold(false);

      this.printer.newLine();
      this.printer.alignCenter();
      this.printer.println(`Orden #${orden.id.slice(-6)}`);
      this.printer.println('================================');
      this.printer.newLine();
      this.printer.newLine();
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
