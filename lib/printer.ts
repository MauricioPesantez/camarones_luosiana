import ThermalPrinter from 'node-thermal-printer';

export class PrinterService {
  private printer: any;

  constructor() {
    this.printer = new ThermalPrinter.printer({
      type: ThermalPrinter.types.EPSON,
      interface: `tcp://${process.env.PRINTER_IP}`,
      characterSet: 'SLOVENIA',
      removeSpecialCharacters: false,
      lineCharacter: '=',
      options: {
        timeout: 5000,
      },
    });
  }

  async imprimirComanda(orden: any) {
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

      // Información de la orden
      this.printer.alignLeft();
      this.printer.bold(true);
      this.printer.println(`Mesa: ${orden.numeroMesa}`);
      this.printer.println(`Mesero: ${orden.mesero}`);
      this.printer.bold(false);
      this.printer.println(`Hora: ${new Date(orden.createdAt).toLocaleTimeString('es-EC')}`);
      this.printer.println(`Fecha: ${new Date(orden.createdAt).toLocaleDateString('es-EC')}`);
      this.printer.println('--------------------------------');
      this.printer.newLine();

      // Items
      orden.items.forEach((item: any) => {
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
      return { success: false, error: error };
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
      return { success: false, error };
    }
  }
}
