import type { SalidaDeTurno } from '../types/caja';
import { calcularLiquidacionDomicilio, calcularSaldo, calcularVentaPropia } from '../types/orden';
import { ESTADO_RETIRO_ANULADO, type RetiroCaja } from '../types/retiro';
import { numeroOrden } from './resumen-cierre';

/** Lo que se usa de cada orden del cuadre; los montos llegan como Decimal. */
export interface OrdenParaMesero {
  id: string;
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  tipoOrden: string;
  numeroMesa: number | null;
  recargo: unknown;
  costoEnvio: unknown;
  descuento: unknown;
  total: unknown;
  montoPagado: unknown;
  estado: string;
  cobrada: boolean;
  anulada: boolean;
  empleadoId: string | null;
  metodoPagoPrevisto: string | null;
  cobradaPor: string | null;
  creadorNombre: string;
  createdAt: Date;
  items: {
    cantidad: number;
    nombreProducto: string | null;
    subtotal: unknown;
    esCortesia: boolean;
    producto: { nombre: string };
  }[];
  pagos: { metodoPago: string; monto: number; enRango: boolean }[];
}

export type EtiquetaOrdenMesero =
  | 'efectivo'
  | 'transferencia'
  | 'mixto'
  | 'sin_cobrar'
  | 'anulada'
  | 'rechazada'
  | 'sin_aprobar'
  | 'cuenta_empleado';

export interface LineaOrdenMesero {
  concepto: string;
  monto: number;
}

export interface OrdenMesero {
  id: string;
  numero: string;
  titulo: string;
  createdAt: string;
  quien: string;
  etiqueta: EtiquetaOrdenMesero;
  /** `subtotal` es null cuando el precio no se muestra: no sale del servidor. */
  items: { cantidad: number; nombre: string; subtotal: number | null; esCortesia: boolean }[];
  extras: LineaOrdenMesero[];
  lineas: LineaOrdenMesero[];
}

export interface OrdenesDelDiaMesero {
  ordenes: OrdenMesero[];
  salidas: SalidaDeTurno[];
}

const aDecimal = (orden: OrdenParaMesero) => ({
  tipoOrden: orden.tipoOrden,
  total: Number(orden.total),
  costoEnvio: Number(orden.costoEnvio ?? 0),
  montoPagado: Number(orden.montoPagado),
});

function sumar(pagos: OrdenParaMesero['pagos'], metodo?: string): number {
  return (
    pagos
      .filter((pago) => !metodo || pago.metodoPago === metodo)
      .reduce((suma, pago) => suma + Math.round(pago.monto * 100), 0) / 100
  );
}

function etiquetaDe(orden: OrdenParaMesero): EtiquetaOrdenMesero {
  if (orden.anulada) return 'anulada';
  if (orden.estado === 'cancelada') return 'rechazada';
  if (orden.estado === 'pendiente_aprobacion_stock') return 'sin_aprobar';
  if (orden.empleadoId) return 'cuenta_empleado';
  if (!orden.cobrada) return 'sin_cobrar';
  const metodos = new Set(orden.pagos.map((pago) => pago.metodoPago));
  if (metodos.size > 1) return 'mixto';
  return metodos.has('transferencia') ? 'transferencia' : 'efectivo';
}

/** En domicilio por transferencia lo único que toca la caja es el envío. */
function esDomicilioPorTransferencia(orden: OrdenParaMesero): boolean {
  if (orden.tipoOrden !== 'domicilio') return false;
  return orden.pagos.length > 0
    ? orden.pagos.every((pago) => pago.metodoPago === 'transferencia')
    : orden.metodoPagoPrevisto === 'transferencia';
}

function lineasDe(orden: OrdenParaMesero, etiqueta: EtiquetaOrdenMesero): LineaOrdenMesero[] {
  const deHoy = orden.pagos.filter((pago) => pago.enRango);
  const porTransferencia = esDomicilioPorTransferencia(orden);

  if (etiqueta === 'sin_cobrar') {
    if (orden.pagos.length === 0) {
      return porTransferencia
        ? []
        : [{ concepto: 'Por cobrar', monto: calcularVentaPropia(aDecimal(orden)) }];
    }
    return [
      ...(porTransferencia ? [] : porMetodo(deHoy)),
      { concepto: 'Por cobrar', monto: calcularSaldo(aDecimal(orden)) },
    ];
  }

  if (orden.tipoOrden === 'domicilio') {
    // Igual que el cuadre: el envío se liquida con todo el efectivo de la orden.
    const liquidacion = calcularLiquidacionDomicilio(aDecimal(orden), sumar(orden.pagos, 'efectivo'))!;
    const transferido = sumar(deHoy, 'transferencia');
    return [
      ...(etiqueta === 'mixto' && transferido > 0
        ? [{ concepto: 'Transferencia', monto: transferido }]
        : []),
      liquidacion.entregaElMotorizado > 0
        ? { concepto: 'Recibido del motorizado', monto: liquidacion.entregaElMotorizado }
        : { concepto: 'Envío entregado al motorizado', monto: 0 - liquidacion.entregaElLocal },
    ];
  }

  return etiqueta === 'mixto'
    ? porMetodo(deHoy)
    : [{ concepto: 'Cobrado', monto: sumar(deHoy) }];
}

function porMetodo(pagos: OrdenParaMesero['pagos']): LineaOrdenMesero[] {
  return [
    { concepto: 'Transferencia', monto: sumar(pagos, 'transferencia') },
    { concepto: 'Efectivo', monto: sumar(pagos, 'efectivo') },
  ].filter((linea) => linea.monto > 0);
}

function tituloDe(orden: OrdenParaMesero): string {
  if (orden.tipoOrden === 'domicilio') return 'Domicilio';
  if (orden.tipoOrden === 'para_llevar') return 'Para llevar';
  return orden.numeroMesa === null ? 'Local' : `Mesa ${orden.numeroMesa}`;
}

/**
 * Lista corta para que quien entregó el conteo revise qué se vendió y cómo se
 * cobró. Cada campo se nombra: uno nuevo de la orden no llega por descuido.
 */
export function ordenesParaMesero(datos: {
  fecha: string;
  ordenes: readonly OrdenParaMesero[];
  retiros: readonly RetiroCaja[];
}): OrdenesDelDiaMesero {
  const ordenes = [...datos.ordenes]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((orden): OrdenMesero => {
      const etiqueta = etiquetaDe(orden);
      const mueveDinero = ['efectivo', 'transferencia', 'mixto', 'sin_cobrar'].includes(etiqueta);
      const conPrecios = mueveDinero && !esDomicilioPorTransferencia(orden);
      const recargo = Number(orden.recargo ?? 0);
      const descuento = Number(orden.descuento);
      return {
        id: orden.id,
        numero: numeroOrden(orden, datos.fecha),
        titulo: tituloDe(orden),
        createdAt: orden.createdAt.toISOString(),
        quien:
          orden.cobrada && mueveDinero && orden.cobradaPor
            ? `cobró ${orden.cobradaPor}`
            : `creó ${orden.creadorNombre}`,
        etiqueta,
        items: orden.items.map((item) => ({
          cantidad: item.cantidad,
          nombre: item.nombreProducto || item.producto.nombre,
          subtotal: conPrecios ? Number(item.subtotal) : null,
          esCortesia: item.esCortesia,
        })),
        extras: conPrecios
          ? [
              ...(recargo > 0 ? [{ concepto: 'Envases', monto: recargo }] : []),
              ...(descuento > 0 ? [{ concepto: 'Descuento', monto: -descuento }] : []),
            ]
          : [],
        lineas: mueveDinero ? lineasDe(orden, etiqueta) : [],
      };
    });

  const salidas = datos.retiros
    .filter((retiro) => retiro.estado !== ESTADO_RETIRO_ANULADO)
    .map(({ id, categoria, monto, usuarioNombre, createdAt }) => ({
      id,
      categoria,
      monto,
      usuarioNombre,
      createdAt,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return { ordenes, salidas };
}
