import { NivelPicante, esNivelPicante, obtenerEtiquetaNivelPicante } from '../types/orden';

/** Datos ya guardados: el mensaje refleja la orden, no el texto recibido. */
export interface OrdenPublicable {
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  tipoOrden: string;
  estado: string;
  anulada: boolean;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  ubicacionUrl: string | null;
  referenciaEntrega: string | null;
  observaciones: string | null;
  total: unknown;
  metodoPagoPrevisto: string | null;
  cobrada: boolean;
  mesero: string;
  items?: Array<{
    cantidad: number;
    nivelPicante: string | null;
    observaciones: string | null;
    producto: { nombre: string };
  }>;
}

export type Encabezado = Pick<OrdenPublicable, 'numeroDiario' | 'fechaNumeroDiario'>;

export function enlaceDePin({ latitud, longitud }: { latitud: number; longitud: number }): string {
  return `https://www.google.com/maps?q=${latitud},${longitud}`;
}

function numero({ numeroDiario }: Encabezado): string {
  return `#${numeroDiario ?? '?'}`;
}

function fecha({ fechaNumeroDiario }: Encabezado): string {
  return fechaNumeroDiario?.split('-').reverse().join('/') ?? '';
}

const dinero = (valor: unknown) => `$${Number(valor).toFixed(2)}`;

const lineaUbicacion = (orden: Pick<OrdenPublicable, 'ubicacionUrl'>) => `Ubicación: ${orden.ubicacionUrl ?? 'pendiente'}`;

function lineaConfirmacionUbicacion(orden: OrdenPublicable): string {
  return orden.ubicacionUrl
    ? lineaUbicacion(orden)
    : 'Ubicación: pendiente. Complétala desde el POS.';
}

function lineaPago(orden: OrdenPublicable): string {
  if (orden.cobrada) return 'transferencia confirmada';
  return orden.tipoOrden === 'domicilio' ? 'efectivo' : 'en el local';
}

function lineaItem(item: NonNullable<OrdenPublicable['items']>[number]): string {
  const partes = [`${item.cantidad} x ${item.producto.nombre}`];
  if (esNivelPicante(item.nivelPicante)) {
    partes.push(obtenerEtiquetaNivelPicante(item.nivelPicante as NivelPicante));
  }
  if (item.observaciones) partes.push(item.observaciones);
  return partes.join(' | ');
}

export function textoPublicacion(orden: OrdenPublicable): string {
  const domicilio = orden.tipoOrden === 'domicilio';
  const cliente = [domicilio ? 'Domicilio' : 'Para llevar', orden.nombreCliente, orden.telefonoCliente]
    .filter(Boolean)
    .join(' · ');
  return [
    `ORDEN ${numero(orden)} · ${fecha(orden)}`,
    cliente,
    ...(orden.items ?? []).map(lineaItem),
    `Total: ${dinero(orden.total)}`,
    `Pago: ${lineaPago(orden)}`,
    ...(domicilio ? [lineaUbicacion(orden)] : []),
    ...(orden.referenciaEntrega ? [`Referencia: ${orden.referenciaEntrega}`] : []),
    ...(orden.observaciones ? [`Observaciones: ${orden.observaciones}`] : []),
  ].join('\n');
}

function horaLocal(momento: Date): string {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(momento);
}

export function textoConfirmacion(
  orden: OrdenPublicable,
  { impresionEnCola, avisoDelivery }: { impresionEnCola: boolean; avisoDelivery: Date | null },
): string {
  const domicilio = orden.tipoOrden === 'domicilio';
  const pago = orden.cobrada ? `${lineaPago(orden)} por ${orden.mesero}` : lineaPago(orden);
  return [
    `Orden ${numero(orden)} registrada · ${fecha(orden)}`,
    'Estado: pendiente de preparación',
    ...(orden.nombreCliente ? [`Cliente: ${orden.nombreCliente}`] : []),
    ...(domicilio ? [lineaConfirmacionUbicacion(orden)] : []),
    `Pago: ${pago}`,
    `Total: ${dinero(orden.total)}`,
    'Publicación al grupo: pendiente',
    `Impresión: ${impresionEnCola ? 'en cola' : 'no está en cola; revisa el POS'}`,
    ...(avisoDelivery ? [`Aviso para pedir delivery: ${horaLocal(avisoDelivery)}`] : []),
  ].join('\n');
}

export function textoPendienteAprobacion(orden: OrdenPublicable): string {
  return [
    `Orden ${numero(orden)} guardada · ${fecha(orden)}`,
    'Estado: pendiente de aprobación por falta de stock',
    `Total: ${dinero(orden.total)}`,
    'Se avisará cuando un administrador la apruebe o la rechace.',
  ].join('\n');
}

export function textoRechazo(orden: Encabezado, razon: string | null | undefined): string {
  return [
    `Orden ${numero(orden)} rechazada · ${fecha(orden)}`,
    ...(razon ? [`Motivo: ${razon}`] : []),
  ].join('\n');
}

type Recordable = Encabezado & Pick<OrdenPublicable, 'nombreCliente' | 'ubicacionUrl'>;

export function textoRecordatorio(orden: Recordable): string {
  return [
    `Pedir delivery para orden ${numero(orden)} · ${fecha(orden)}`,
    'Verifica el estado en el POS antes de contratar el motorizado.',
    ...(orden.nombreCliente ? [`Cliente: ${orden.nombreCliente}`] : []),
    lineaUbicacion(orden),
  ].join('\n');
}

export function textoReenvio(orden: OrdenPublicable): string {
  const estado = orden.anulada ? 'anulada' : orden.estado;
  return `Este pedido ya está registrado como Orden ${numero(orden)} · ${fecha(orden)}.\nEstado: ${estado}`;
}

export function textoConflicto(orden: Encabezado): string {
  return [
    `Pedido no registrado: este cliente ya tiene la Orden ${numero(orden)} con otro contenido.`,
    'Modifícala desde la aplicación.',
    'Si es otro pedido, reenvíalo con la línea Nuevo pedido',
  ].join('\n');
}

export function textoUbicacionGuardada(orden: OrdenPublicable): string {
  const cliente = orden.nombreCliente ?? orden.telefonoCliente;
  return [
    `Ubicación guardada en Orden ${numero(orden)}${cliente ? ` · ${cliente}` : ''}`,
    orden.ubicacionUrl ?? '',
  ].join('\n');
}

export function textoActualizacionUbicacion(
  orden: Encabezado & Pick<OrdenPublicable, 'ubicacionUrl' | 'referenciaEntrega'>,
): string {
  return [
    `ACTUALIZACIÓN orden ${numero(orden)} · ${fecha(orden)}`,
    lineaUbicacion(orden),
    ...(orden.referenciaEntrega ? [`Referencia: ${orden.referenciaEntrega}`] : []),
  ].join('\n');
}

export function textoActualizacionItems(orden: OrdenPublicable): string {
  return [
    `ACTUALIZACIÓN orden ${numero(orden)} · ${fecha(orden)}`,
    'Productos ahora:',
    ...(orden.items ?? []).map(lineaItem),
    `Total: ${dinero(orden.total)}`,
    `Pago: ${lineaPago(orden)}`,
  ].join('\n');
}

export function textoAnulacion(orden: Encabezado): string {
  return `ANULADA orden ${numero(orden)} · ${fecha(orden)}\nNo preparar ni enviar.`;
}

export function textoOrdenesSinUbicacion(ordenes: Encabezado[]): string {
  return `Ubicación no guardada: hay ${ordenes.length} órdenes sin ubicación (${ordenes.map(numero).join(', ')}). Complétala desde el POS.`;
}
