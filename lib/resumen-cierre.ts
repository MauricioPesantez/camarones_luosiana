import { cortesVigentes, ultimoCorteVigente, type SesionCaja } from '../types/caja';
import { estaPorCobrar, type ResumenCuadre } from '../types/cuadre';
import { ESTADO_RETIRO_ANULADO, obtenerEtiquetaCategoriaRetiro, type RetiroCaja } from '../types/retiro';
import { obtenerFechaEcuador } from './fecha-ecuador';
import { dinero, horaLocal } from './whatsapp-mensajes';

/** WhatsApp corta con «leer más» los textos muy largos; se parten por líneas. */
export const MAX_CARACTERES = 3500;

/** Lo que cambia una orden ya creada. Sus descripciones las genera el POS, sin datos del cliente. */
export const ACCIONES_NOVEDAD = [
  'orden_anulada',
  'orden_aprobada_sin_stock',
  'orden_rechazada_sin_stock',
  'orden_cargada_empleado',
  'descuento_aplicado',
  'descuento_quitado',
  'cortesia_aplicada',
  'item_eliminado',
  'item_modificado',
  'metodo_pago_cambiado',
  'cobro_corregido',
];

export interface OrdenResumen {
  numeroDiario: number | null;
  fechaNumeroDiario: string | null;
  tipoOrden: string;
  numeroMesa: number | null;
  creadorNombre: string;
  total: unknown;
  montoPagado: unknown;
  estado: string;
  cobrada: boolean;
  anulada: boolean;
  empleadoId: string | null;
  metodoPago: string | null;
  pagos: { metodoPago: string; monto: number }[];
  createdAt: Date;
  items: { cantidad: number; nombreProducto: string | null; esCortesia: boolean; producto: { nombre: string } }[];
}

export interface NovedadResumen {
  tipoAccion: string;
  descripcion: string;
  usuarioNombre: string;
  razon: string | null;
  createdAt: Date;
  orden: { numeroDiario: number | null; fechaNumeroDiario: string | null };
}

export interface DatosResumenCierre {
  fecha: string;
  /** Ya cerrada: trae el esperado, el contado y la diferencia congelados. */
  caja: SesionCaja;
  resumen: ResumenCuadre;
  /** Venta de las órdenes que alguien todavía puede cobrar. */
  ventaPorCobrar: number;
  retiros: RetiroCaja[];
  consumos: { empleadoNombre: string | null; estado: string; total: number; anulada: boolean }[];
  ordenes: OrdenResumen[];
  novedades: NovedadResumen[];
}

const hora = (momento: string | Date) => horaLocal(new Date(momento));

function resultado(diferencia: number): string {
  if (diferencia === 0) return 'Cuadra exacto';
  return diferencia > 0 ? `Sobran ${dinero(diferencia)}` : `Faltan ${dinero(-diferencia)}`;
}

/** El número se repite cada día: si es de otra fecha, se dice cuál. */
export function numeroOrden(
  orden: { numeroDiario: number | null; fechaNumeroDiario: string | null },
  fecha: string,
): string {
  const otroDia = orden.fechaNumeroDiario && orden.fechaNumeroDiario !== fecha;
  return `#${orden.numeroDiario ?? '?'}${otroDia ? ` del ${orden.fechaNumeroDiario}` : ''}`;
}

function lineasCierre({ caja, resumen, ventaPorCobrar, ordenes }: DatosResumenCierre): string[] {
  // El cuadre suma en lo vendido las rechazadas y las que esperan aprobación.
  const noCobrables = Math.round((resumen.ventaPorCobrar - ventaPorCobrar) * 100) / 100;
  const lineas = [
    `Abrió: ${caja.abiertaPorNombre} ${hora(caja.abiertaAt)}`,
    `Cerró: ${caja.cerradaPorNombre ?? 'administrador'}${caja.cerradaAt ? ` ${hora(caja.cerradaAt)}` : ''}`,
    ...(caja.ordenesHabilitadasAt
      ? [`${caja.ordenesHabilitadasPorNombre ?? 'El administrador'} mostró las órdenes del día a ${ultimoCorteVigente(caja.cortes)?.usuarioNombre ?? 'un mesero'} ${hora(caja.ordenesHabilitadasAt)}`]
      : []),
    '',
    `Fondo inicial: ${dinero(resumen.fondoInicial)}`,
    `+ Efectivo cobrado en el local: ${dinero(resumen.efectivoVentasDirectas)}`,
    `+ Recibido de motorizados: ${dinero(resumen.efectivoCobradoMotorizados)}`,
    `- Entregado a motorizados: ${dinero(resumen.efectivoEntregadoMotorizados)}`,
    `- Salidas de caja (${resumen.cantidadRetiros}): ${dinero(resumen.retirosEfectivo)}`,
    `Debía haber: ${dinero(caja.montoEsperadoCierre)}`,
    `Contado: ${dinero(caja.montoCierre)}`,
    `*${resultado(Number(caja.diferenciaCierre))}*`,
    '',
    `Vendido: ${dinero(resumen.ventasTotales)} en ${resumen.totalOrdenes} órdenes`,
    `Cobrado: ${dinero(resumen.ventasTotales - resumen.ventaPorCobrar)}`,
    `Falta cobrar: ${dinero(ventaPorCobrar)} en ${ordenes.filter(estaPorCobrar).length} órdenes`,
    ...(noCobrables > 0 ? [`Rechazadas o sin aprobar, incluidas en lo vendido: ${dinero(noCobrables)}`] : []),
    '',
    `Ventas por transferencia: ${dinero(resumen.transferenciasVentas)}`,
    `Total que debe constar en el banco: ${dinero(resumen.depositosRecibidos)}`,
    `Envíos de motorizados: ${dinero(resumen.enviosMotorizados)}`,
  ];
  if (resumen.montoReembolsoPendiente > 0) {
    lineas.push(`Por reembolsar a clientes: ${dinero(resumen.montoReembolsoPendiente)}`);
  }
  if (resumen.ordenesAnuladas > 0) {
    lineas.push(`Anuladas: ${resumen.ordenesAnuladas} por ${dinero(resumen.ventasAnuladas)}`);
  }
  return lineas;
}

function lineasTurnos({ caja }: DatosResumenCierre): string[] {
  if (caja.cortes.length === 0) return [];
  const vigentes = cortesVigentes(caja.cortes);
  const lineas = caja.cortes.map((corte) => {
    if (corte.anuladoAt) {
      return `Anulado · ${corte.usuarioNombre} ${hora(corte.createdAt)}: contó ${dinero(corte.montoContado)} (${resultado(corte.diferencia)}). Por ${corte.anuladoPorNombre}: ${corte.razonAnulacion}`;
    }
    return `Turno ${vigentes.indexOf(corte) + 1} · ${corte.usuarioNombre} ${hora(corte.createdAt)}: recibió ${dinero(corte.fondoInicial)}, debía haber ${dinero(corte.montoEsperado)}, contó ${dinero(corte.montoContado)}. *${resultado(corte.diferencia)}*`;
  });
  // Las diferencias de los turnos más este tramo suman la diferencia del día.
  const centavos = vigentes.reduce((suma, corte) => suma - Math.round(corte.diferencia * 100),
    Math.round(Number(caja.diferenciaCierre) * 100));
  if (ultimoCorteVigente(caja.cortes)) {
    lineas.push(`Desde el último corte hasta el cierre: *${resultado(centavos / 100)}*`);
  }
  return lineas;
}

function lineasSalidas({ retiros, consumos }: DatosResumenCierre): string[] {
  const linea = (retiro: RetiroCaja) =>
    `${hora(retiro.createdAt)} · ${dinero(retiro.monto)} · ${obtenerEtiquetaCategoriaRetiro(retiro.categoria)}${retiro.beneficiarioNombre ? ` para ${retiro.beneficiarioNombre}` : ''} · ${retiro.motivo} · ${retiro.usuarioNombre}`;
  const porHora = [...retiros].reverse();
  const registrados = porHora.filter((retiro) => retiro.estado !== ESTADO_RETIRO_ANULADO);
  const anulados = porHora.filter((retiro) => retiro.estado === ESTADO_RETIRO_ANULADO);
  return [
    ...registrados.map(linea),
    ...anulados.map((retiro) => `ANULADA ${linea(retiro)}. Por ${retiro.anuladoPorNombre}: ${retiro.razonAnulacion}`),
    ...(consumos.length > 0 ? ['', 'Consumos de empleados:'] : []),
    ...consumos.map((consumo) =>
      `${consumo.empleadoNombre ?? 'Empleado'}: ${dinero(consumo.total)}${consumo.anulada ? ' (anulado)' : ''}`),
  ];
}

function lineasNovedades({ fecha, novedades, ordenes }: DatosResumenCierre): string[] {
  const sinCobrar = ordenes.filter(estaPorCobrar);
  return [
    ...novedades.map((novedad) => {
      const quien = novedad.descripcion.includes(novedad.usuarioNombre) ? '' : ` · ${novedad.usuarioNombre}`;
      return `${hora(novedad.createdAt)} · ${numeroOrden(novedad.orden, fecha)} · ${novedad.descripcion}${quien}${novedad.razon ? `: ${novedad.razon}` : ''}`;
    }),
    ...(sinCobrar.length > 0 ? ['', 'Sin cobrar al cierre:'] : []),
    ...sinCobrar.map((orden) =>
      `${numeroOrden(orden, fecha)} · ${dinero(Number(orden.total) - Number(orden.montoPagado))} · ${orden.creadorNombre}`),
  ];
}

const LUGARES: Record<string, string> = { domicilio: 'Domicilio', para_llevar: 'Para llevar' };

function lugar(orden: OrdenResumen): string {
  return LUGARES[orden.tipoOrden] ?? (orden.numeroMesa === null ? 'Local' : `Mesa ${orden.numeroMesa}`);
}

function pago(orden: OrdenResumen): string {
  if (orden.anulada) return 'ANULADA';
  if (orden.empleadoId) return 'cuenta de empleado';
  if (orden.estado === 'cancelada') return 'cancelada';
  if (orden.estado === 'pendiente_aprobacion_stock') return 'sin aprobar';
  if (!orden.cobrada) return Number(orden.montoPagado) > 0 ? `abono ${dinero(orden.montoPagado)}` : 'sin cobrar';
  const metodos = new Set(orden.pagos.map((p) => p.metodoPago));
  if (metodos.size > 1) {
    return [...metodos]
      .map((metodo) => `${metodo} ${dinero(orden.pagos.filter((p) => p.metodoPago === metodo).reduce((suma, p) => suma + p.monto, 0))}`)
      .join(' + ');
  }
  return [...metodos][0] ?? orden.metodoPago ?? 'cobrada';
}

function lineasOrdenes({ fecha, ordenes }: DatosResumenCierre): string[] {
  return [...ordenes]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((orden) =>
      `${numeroOrden(orden, fecha)} · ${hora(orden.createdAt)} · ${lugar(orden)} · ${orden.creadorNombre} · ${dinero(orden.total)} · ${pago(orden)}`);
}

function lineasProductos({ fecha, ordenes }: DatosResumenCierre): string[] {
  const unidades = new Map<string, number>();
  for (const orden of ordenes) {
    // Una orden de ayer pagada hoy entra en el cuadre, pero se preparó ayer.
    if (obtenerFechaEcuador(orden.createdAt) !== fecha) continue;
    if (orden.anulada || ['cancelada', 'pendiente_aprobacion_stock'].includes(orden.estado)) continue;
    for (const item of orden.items) {
      const nombre = `${item.nombreProducto ?? item.producto.nombre}${item.esCortesia ? ' (cortesía)' : ''}`;
      unidades.set(nombre, (unidades.get(nombre) ?? 0) + item.cantidad);
    }
  }
  return [...unidades]
    .sort(([a, cantidadA], [b, cantidadB]) => cantidadB - cantidadA || a.localeCompare(b))
    .map(([nombre, cantidad]) => `${cantidad} x ${nombre}`);
}

/** Deja margen para el título; una línea sola más larga se recorta. */
function partir(lineas: string[]): string[] {
  const maximo = MAX_CARACTERES - 100;
  const partes: string[] = [];
  for (const completa of lineas) {
    const linea = completa.slice(0, maximo);
    const actual = partes.at(-1);
    if (actual !== undefined && actual.length + 1 + linea.length <= maximo) {
      partes[partes.length - 1] = `${actual}\n${linea}`;
    } else {
      partes.push(linea);
    }
  }
  return partes.map((parte) => parte.trim());
}

/** Todo lo que pasó en el día, en mensajes numerados; una sección vacía no se envía. */
export function textosResumenCierre(datos: DatosResumenCierre): string[] {
  const secciones: Array<[string, string[]]> = [
    ['CIERRE DE CAJA', lineasCierre(datos)],
    ['TURNOS', lineasTurnos(datos)],
    ['SALIDAS DE DINERO', lineasSalidas(datos)],
    ['NOVEDADES', lineasNovedades(datos)],
    ['ÓRDENES', lineasOrdenes(datos)],
    ['PRODUCTOS VENDIDOS', lineasProductos(datos)],
  ];
  const mensajes = secciones.flatMap(([titulo, lineas]) =>
    partir(lineas).map((cuerpo) => ({ titulo, cuerpo })));
  const dia = datos.fecha.split('-').reverse().join('/');
  return mensajes.map(({ titulo, cuerpo }, i) =>
    `*${titulo}* · ${dia} · ${i + 1}/${mensajes.length}\n\n${cuerpo}`);
}
