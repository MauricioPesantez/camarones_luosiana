import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { PrinterService } from '@/lib/printer';
import { PUBLIC_PRODUCT_SELECT } from '@/lib/product-select';
import { ItemSinStock } from '@/types/stock';
import {
  CrearOrdenRequest,
  MetodoPago,
  RECARGO_RECIPIENTES,
  TipoOrden,
  calcularRecargoEnvases,
  esCategoriaCombo,
  esMetodoPago,
  esNivelPicante,
} from '@/types/orden';
import { notificarClientes } from '@/lib/sse';
import {
  PRINT_JOB_TYPES,
  enqueueOrderPrintJob,
  shouldEnqueuePrintJob,
} from '@/lib/print-jobs';
import { isDirectPrintEnabled } from '@/lib/print-config';
import { allocateDailyOrderNumber } from '@/lib/daily-order-number';
import { createPaymentLink } from '@/lib/payment-link';
import type { AuthenticatedUser } from '@/lib/session';
import { calcularMovimientosPago } from '@/types/cobro';
import { bloquearCajaAbierta, exigirCajaAbierta } from '@/lib/caja';
import { ROL_ABRE_CAJA } from '@/types/caja';
import { UbicacionInvalidaError, parsearUbicacionEntrega } from '@/lib/delivery-location';

export const ORDEN_INCLUDE = {
  items: {
    include: {
      producto: { select: PUBLIC_PRODUCT_SELECT },
    },
  },
} satisfies Prisma.OrdenInclude;

export class OrdenInvalidaError extends Error {}
/** Carrera real entre la validación y el descuento: se puede reintentar. */
export class StockConflictError extends Error {}
/** Falta stock para el pedido: reintentar igual no lo resuelve. */
export class StockInsuficienteError extends Error {
  constructor(readonly itemsSinStock: ItemSinStock[]) {
    const detalle = itemsSinStock
      .map((item) => `${item.productoNombre} (pedido ${item.cantidadSolicitada}, disponible ${item.stockDisponible})`)
      .join(', ');
    super(`Stock insuficiente: ${detalle}`);
  }
}

export type OrdenPreparada = Awaited<ReturnType<typeof prepararOrden>>;
type OrdenRegistrada = Awaited<ReturnType<typeof registrarOrden>>;

/** Valida y calcula la orden fuera de la transacción. El actor lo decide el llamador. */
export async function prepararOrden(
  actor: AuthenticatedUser,
  body: CrearOrdenRequest,
  requestUrl: string,
  db: Pick<Prisma.TransactionClient, 'producto'> = prisma,
) {
  if ('tipoOperacion' in body && body.tipoOperacion !== 'VENTA_CLIENTE') {
    throw new OrdenInvalidaError('Utiliza el registro de consumos de empleados');
  }
  const tipoOrden: TipoOrden = body.tipoOrden ?? 'local';

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new OrdenInvalidaError('La orden debe incluir al menos un producto');
  }

  if (
    body.items.some(
      (item) =>
        !item.productoId?.trim() ||
        !Number.isInteger(item.cantidad) ||
        item.cantidad < 1,
    )
  ) {
    throw new OrdenInvalidaError('Todos los items deben tener un producto y una cantidad válida');
  }

  // Validaciones por tipo de orden
  if (tipoOrden === 'local' && !body.numeroMesa) {
    throw new OrdenInvalidaError('El número de mesa es requerido para órdenes locales');
  }
  if (tipoOrden === 'para_llevar' && !body.nombreCliente?.trim()) {
    throw new OrdenInvalidaError('El nombre del cliente es requerido');
  }
  if (tipoOrden === 'domicilio' && !body.telefonoCliente?.trim()) {
    throw new OrdenInvalidaError('El teléfono del cliente es requerido para domicilio');
  }
  if (tipoOrden === 'domicilio' && (body.costoEnvio === undefined || body.costoEnvio < 0)) {
    throw new OrdenInvalidaError('El costo de envío es requerido para domicilio');
  }
  if (tipoOrden === 'domicilio' && !esMetodoPago(body.metodoPagoPrevisto)) {
    throw new OrdenInvalidaError(
      'La modalidad de pago es requerida para domicilio. Use: efectivo o transferencia',
    );
  }
  if (
    tipoOrden === 'domicilio' &&
    body.metodoPagoPrevisto === 'transferencia' &&
    body.transferenciaConfirmada !== true
  ) {
    throw new OrdenInvalidaError('Debe confirmar que la transferencia ya fue recibida');
  }

  let ubicacion = { ubicacionUrl: null as string | null, referenciaEntrega: null as string | null };
  if (tipoOrden === 'domicilio') {
    try {
      ubicacion = parsearUbicacionEntrega(body);
    } catch (error) {
      if (error instanceof UbicacionInvalidaError) throw new OrdenInvalidaError(error.message);
      throw error;
    }
  }

  // La modalidad de pago se acuerda al crear solo en domicilio: define si el local
  // le cobra al motorizado (efectivo) o le entrega el envío (transferencia).
  // En local y para llevar el método se decide recién al momento de cobrar.
  const metodoPagoPrevisto: MetodoPago | null =
    tipoOrden === 'domicilio' && esMetodoPago(body.metodoPagoPrevisto)
      ? body.metodoPagoPrevisto
      : null;

  const costoEnvio = tipoOrden === 'domicilio' ? (body.costoEnvio ?? 0) : 0;

  // Obtener productos con sus tiempos de preparación y stock
  const productosIds = body.items.map((item: { productoId: string }) => item.productoId);
  const productos = await db.producto.findMany({
    where: { id: { in: productosIds } },
    select: {
      id: true,
      nombre: true,
      categoria: true,
      precio: true,
      disponible: true,
      descripcion: true,
      tiempoPreparacion: true,
      stock: true,
      stockMinimo: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
  const productoInvalido = body.items.find((item) => {
    const producto = productosPorId.get(item.productoId);
    return !producto || !producto.disponible;
  });
  if (productoInvalido) {
    throw new OrdenInvalidaError('Uno de los productos no existe o no está disponible');
  }

  const itemComboSinPicante = body.items.find((item) => {
    const producto = productosPorId.get(item.productoId);
    return esCategoriaCombo(producto?.categoria) && !esNivelPicante(item.nivelPicante);
  });
  if (itemComboSinPicante) {
    const producto = productosPorId.get(itemComboSinPicante.productoId);
    throw new OrdenInvalidaError(
      `El nivel de picante es requerido para ${producto?.nombre ?? 'cada combo'}`,
    );
  }

  const recargo = calcularRecargoEnvases(
    tipoOrden,
    body.items.flatMap((item) => {
      const producto = productosPorId.get(item.productoId);
      return producto
        ? [{ cantidad: item.cantidad, categoria: producto.categoria }]
        : [];
    }),
  );

  // Varias líneas del mismo producto comparten existencias.
  const cantidadPorProducto = new Map<string, number>();
  for (const item of body.items) {
    cantidadPorProducto.set(
      item.productoId,
      (cantidadPorProducto.get(item.productoId) ?? 0) + item.cantidad,
    );
  }

  const itemsSinStock: ItemSinStock[] = [];
  for (const [productoId, cantidadSolicitada] of cantidadPorProducto) {
    const producto = productosPorId.get(productoId)!;
    if (producto.stock < cantidadSolicitada) {
      itemsSinStock.push({
        productoId,
        productoNombre: producto.nombre,
        cantidadSolicitada,
        stockDisponible: producto.stock,
      });
    }
  }

  // Sin stock, la orden solo se crea si se pidió aprobación del administrador.
  const solicitarAprobacion = body.solicitarAprobacion === true;
  const hayStockInsuficiente = itemsSinStock.length > 0;

  // Calcular total y tiempo estimado
  let total = 0;
  let tiempoBase = 0;
  let tiempoAdicional = 0;

  const itemsData = body.items.map((item: {
    productoId: string;
    cantidad: number;
    precioUnitario: number;
    observaciones?: string;
    nivelPicante?: string;
  }) => {
    // Buscar el producto para obtener su tiempo de preparación
    const producto = productosPorId.get(item.productoId)!;
    const precioUnitario = Number(producto.precio);
    const subtotal = item.cantidad * precioUnitario;
    total += subtotal;
    const tiempoPreparacion = producto?.tiempoPreparacion || 0;

    // Calcular tiempo según categoría
    if (producto?.categoria === 'Platos Fuertes') {
      // Para platos fuertes, tomamos el tiempo máximo
      tiempoBase = Math.max(tiempoBase, tiempoPreparacion);
    } else if (
      producto?.categoria === 'Acompañamientos' ||
      producto?.categoria === 'Entradas'
    ) {
      // Para acompañamientos y entradas, sumamos el 10%
      tiempoAdicional += tiempoPreparacion * 0.1;
    }

    return {
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioUnitario,
      subtotal,
      observaciones: item.observaciones,
      nivelPicante:
        esCategoriaCombo(producto?.categoria) && esNivelPicante(item.nivelPicante)
          ? item.nivelPicante
          : null,
    };
  });

  // Calcular tiempo estimado total (redondeado al entero más cercano)
  const tiempoEstimado = Math.ceil(tiempoBase + tiempoAdicional);

  // Total final: subtotal de productos + recargo + costo de envío
  const subtotalProductos = total;
  const totalFinal = subtotalProductos + recargo + costoEnvio;

  // Determinar el estado inicial de la orden
  const estadoInicial = hayStockInsuficiente && solicitarAprobacion
    ? 'pendiente_aprobacion_stock'
    : 'pendiente';
  const paymentLink = createPaymentLink(requestUrl);
  // Una transferencia confirmada nace pagada, en domicilio o para llevar, incluso si requiere
  // aprobacion de stock. Si el admin la rechaza, el cobro queda como reembolso
  // pendiente y no desaparece del cuadre.
  const cobradaAlCrear =
    tipoOrden !== 'local' &&
    body.metodoPagoPrevisto === 'transferencia' &&
    body.transferenciaConfirmada === true;

  const requiereCajaAbierta = actor.rol === ROL_ABRE_CAJA;
  if (requiereCajaAbierta) {
    await exigirCajaAbierta();
  }

  if (hayStockInsuficiente && !solicitarAprobacion) {
    throw new StockInsuficienteError(itemsSinStock);
  }

  return {
    actor,
    body,
    tipoOrden,
    metodoPagoPrevisto,
    costoEnvio,
    ubicacion,
    recargo,
    itemsSinStock,
    solicitarAprobacion,
    hayStockInsuficiente,
    itemsData,
    tiempoEstimado,
    subtotalProductos,
    totalFinal,
    estadoInicial,
    paymentLink,
    cobradaAlCrear,
    requiereCajaAbierta,
  };
}

/** Orden, stock, historial y trabajo de impresion se confirman juntos en `tx`. */
export async function registrarOrden(tx: Prisma.TransactionClient, preparada: OrdenPreparada) {
  const {
    actor: creador,
    body,
    tipoOrden,
    metodoPagoPrevisto,
    costoEnvio,
    ubicacion,
    recargo,
    itemsSinStock,
    solicitarAprobacion,
    hayStockInsuficiente,
    itemsData,
    tiempoEstimado,
    subtotalProductos,
    totalFinal,
    estadoInicial,
    paymentLink,
    cobradaAlCrear,
    requiereCajaAbierta,
  } = preparada;
  const creadorNombre = creador.nombre;
  const origenCobroAlCrear = `creacion_${tipoOrden}_transferencia`;

  if (requiereCajaAbierta) {
    await bloquearCajaAbierta(tx);
  }
  const createdAt = new Date();
  const dailyNumber = await allocateDailyOrderNumber(tx, createdAt);
  const nuevaOrden = await tx.orden.create({
    data: {
      numeroDiario: dailyNumber.number,
      fechaNumeroDiario: dailyNumber.dateKey,
      createdAt,
      tipoOrden,
      numeroMesa: tipoOrden === 'local' ? (body.numeroMesa ?? null) : null,
      nombreCliente:
        tipoOrden !== 'local' ? body.nombreCliente?.trim() || null : null,
      telefonoCliente:
        tipoOrden === 'domicilio' ? body.telefonoCliente?.trim() : null,
      ...ubicacion,
      recargo: recargo > 0 ? recargo : null,
      costoEnvio: costoEnvio > 0 ? costoEnvio : null,
      metodoPagoPrevisto,
      transferenciaConfirmadaAlCrear: cobradaAlCrear,
      metodoPago: cobradaAlCrear ? 'transferencia' : null,
      montoPagado: cobradaAlCrear ? totalFinal : 0,
      cobrada: cobradaAlCrear,
      fechaCobro: cobradaAlCrear ? createdAt : null,
      cobradaPor: cobradaAlCrear ? creadorNombre : null,
      cobradaPorId: cobradaAlCrear ? creador.id : null,
      origenCobro: cobradaAlCrear ? origenCobroAlCrear : null,
      cobroTokenHash: paymentLink.tokenHash,
      cobroUrl: paymentLink.url,
      mesero: creadorNombre,
      creadorId: creador.id,
      creadorRol: creador.rol,
      observaciones: body.observaciones,
      total: totalFinal,
      tiempoEstimado,
      estado: estadoInicial,
      itemsSinStock: (hayStockInsuficiente && solicitarAprobacion
        ? (itemsSinStock as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull),
      items: {
        create: itemsData,
      },
    },
    include: ORDEN_INCLUDE,
  });

  // Solo descontar stock si la orden fue creada con estado pendiente (con stock suficiente)
  if (estadoInicial === 'pendiente') {
    for (const item of body.items) {
      const resultado = await tx.producto.updateMany({
        where: {
          id: item.productoId,
          stock: { gte: item.cantidad },
        },
        data: { stock: { decrement: item.cantidad } },
      });

      if (resultado.count !== 1) {
        throw new StockConflictError(
          'El stock cambio mientras se creaba la orden. Intenta nuevamente.',
        );
      }
    }
  }

  const itemsDescripcion = nuevaOrden.items
    .map((item) => `${item.cantidad}x ${item.producto.nombre}`)
    .join(', ');

  const tipoAccion = estadoInicial === 'pendiente_aprobacion_stock'
    ? 'orden_creada_pendiente_stock'
    : 'orden_creada';

  const descripcion = estadoInicial === 'pendiente_aprobacion_stock'
    ? `Orden creada pendiente de aprobación (sin stock) con ${nuevaOrden.items.length} items: ${itemsDescripcion}`
    : `Orden creada con ${nuevaOrden.items.length} items: ${itemsDescripcion}`;

  await tx.historialOrden.create({
    data: {
      ordenId: nuevaOrden.id,
      tipoAccion,
      descripcion,
      datosDespues: {
        tipoOrden,
        items: nuevaOrden.items.map((item) => ({
          nombre: item.producto.nombre,
          cantidad: item.cantidad,
          precio: Number(item.precioUnitario),
          subtotal: Number(item.subtotal),
          nivelPicante: item.nivelPicante,
        })),
        subtotalProductos: Number(subtotalProductos),
        recargo: Number(recargo),
        costoEnvio: Number(costoEnvio),
        metodoPagoPrevisto,
        total: Number(totalFinal),
        tiempoEstimado,
        itemsSinStock: hayStockInsuficiente && solicitarAprobacion
          ? JSON.parse(JSON.stringify(itemsSinStock))
          : null,
      },
      usuarioNombre: creadorNombre,
      usuarioRol: creador.rol,
      diferenciaTotal: Number(totalFinal),
    },
  });

  if (cobradaAlCrear) {
    const movimientos = calcularMovimientosPago({
      metodoPago: 'transferencia',
      monto: totalFinal,
    });
    await tx.cobro.create({
      data: {
        ordenId: nuevaOrden.id,
        metodoPago: 'transferencia',
        monto: totalFinal,
        montoTotal: totalFinal,
        costoEnvio,
        ...movimientos,
        cobradoPorId: creador.id,
        cobradoPorNombre: creador.nombre,
        cobradoPorRol: creador.rol,
        origen: origenCobroAlCrear,
        idempotencyKey: `auto_${nuevaOrden.id}`,
      },
    });
    await tx.historialOrden.create({
      data: {
        ordenId: nuevaOrden.id,
        tipoAccion: 'orden_cobrada_automaticamente',
        descripcion: `${tipoOrden === 'domicilio' ? 'Domicilio' : 'Para llevar'} pagado por transferencia al crear la orden`,
        datosDespues: {
          metodoPago: 'transferencia',
          total: Number(totalFinal),
          costoEnvio: Number(costoEnvio),
          ...movimientos,
        },
        usuarioNombre: creador.nombre,
        usuarioRol: creador.rol,
        diferenciaTotal: 0,
      },
    });
  }

  let queued = false;
  if (
    estadoInicial === 'pendiente' &&
    shouldEnqueuePrintJob(nuevaOrden.createdAt)
  ) {
    await enqueueOrderPrintJob(tx, nuevaOrden, {
      type: PRINT_JOB_TYPES.ORDER,
      revision: nuevaOrden.printRevision,
    });
    queued = true;
  }

  return { orden: nuevaOrden, printJobQueued: queued };
}

/** Aviso a cocina en tiempo real; quien lo llama decide qué hacer si falla. */
export function notificarNuevaOrden(orden: OrdenRegistrada['orden']): void {
  notificarClientes('nueva-orden', {
    id: orden.id,
    numeroDiario: orden.numeroDiario,
    fechaNumeroDiario: orden.fechaNumeroDiario,
    revision: orden.printRevision,
    tipoOrden: orden.tipoOrden,
    numeroMesa: orden.numeroMesa,
    nombreCliente: orden.nombreCliente,
    telefonoCliente: orden.telefonoCliente,
    mesero: orden.mesero,
    tiempoEstimado: orden.tiempoEstimado,
    itemsCount: orden.items.length,
    createdAt: orden.createdAt,
  });
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido';
}

/** Efectos posteriores al commit: la orden ya existe aunque alguno falle. */
export async function ejecutarEfectosPosteriores(
  preparada: OrdenPreparada,
  { orden, printJobQueued }: OrdenRegistrada,
) {
  const { estadoInicial } = preparada;

  // Solo imprimir comanda si la orden no está pendiente de aprobación
  let resultadoImpresion: { success: boolean; data?: unknown; error?: string } = {
    success: false,
    error: 'Orden pendiente de aprobación',
  };

  if (estadoInicial === 'pendiente' && isDirectPrintEnabled()) {
    try {
      const printer = new PrinterService();
      resultadoImpresion = await printer.imprimirComanda({
        ...orden,
        // Las órdenes nuevas imprimen el picante por item. El campo de Orden es legado.
        nivelPicante: null,
      });
    } catch (error) {
      console.error('Error al imprimir comanda:', error);
      resultadoImpresion = { success: false, error: mensajeDeError(error) };
    }

    if (resultadoImpresion.success) {
      try {
        await prisma.orden.update({
          where: { id: orden.id },
          data: { impresa: true },
        });
      } catch (error) {
        console.error('Error al marcar orden impresa:', error);
      }
    }
  } else if (estadoInicial === 'pendiente' && printJobQueued) {
    resultadoImpresion = {
      success: true,
      data: { mode: 'queue' },
    };
  } else if (estadoInicial === 'pendiente') {
    resultadoImpresion = {
      success: false,
      error: 'No hay ningun mecanismo de impresion activo',
    };
  }

  // Notificar en tiempo real a la cocina (solo órdenes que ya están en estado pendiente)
  let notificacion: { success: boolean; error?: string } = { success: true };
  if (estadoInicial === 'pendiente') {
    try {
      notificarNuevaOrden(orden);
    } catch (error) {
      console.error('Error al notificar nueva orden:', error);
      notificacion = { success: false, error: mensajeDeError(error) };
    }
  }

  return { impresion: resultadoImpresion, notificacion };
}

/** Crea la orden completa. La respuesta incluye secretos de cobro: el llamador los filtra. */
export async function crearOrden(
  actor: AuthenticatedUser,
  body: CrearOrdenRequest,
  requestUrl: string,
) {
  const preparada = await prepararOrden(actor, body, requestUrl);
  const registrada = await prisma.$transaction((tx) => registrarOrden(tx, preparada));
  const efectos = await ejecutarEfectosPosteriores(preparada, registrada);
  const {
    recargo,
    costoEnvio,
    subtotalProductos,
    totalFinal,
    metodoPagoPrevisto,
    hayStockInsuficiente,
    itemsSinStock,
    solicitarAprobacion,
  } = preparada;

  // Si hay items sin stock, incluir esa información en la respuesta
  return {
    orden: registrada.orden,
    ...efectos,
    impresionEnCola: registrada.printJobQueued,
    desglose: {
      subtotalProductos: Number(subtotalProductos),
      cantidadEnvases: recargo / RECARGO_RECIPIENTES,
      recargo: Number(recargo),
      costoEnvio: Number(costoEnvio),
      total: Number(totalFinal),
      metodoPagoPrevisto,
    },
    ...(hayStockInsuficiente && {
      stockInsuficiente: true,
      itemsSinStock,
      pendienteAprobacion: solicitarAprobacion,
    }),
  };
}
