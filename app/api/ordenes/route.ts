import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PrinterService } from '@/lib/printer';
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
import { Prisma } from '@prisma/client';
import { notificarClientes } from '@/lib/sse';
import {
  PRINT_JOB_TYPES,
  enqueueOrderPrintJob,
  shouldEnqueuePrintJob,
} from '@/lib/print-jobs';
import { isDirectPrintEnabled } from '@/lib/print-config';
import { allocateDailyOrderNumber } from '@/lib/daily-order-number';

const ORDEN_INCLUDE = {
  items: {
    include: {
      producto: true,
    },
  },
} satisfies Prisma.OrdenInclude;

class StockConflictError extends Error {}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');

    // Soporta un solo estado o múltiples separados por coma: ?estado=pendiente,en_preparacion
    const estadoFiltro = estado
      ? estado.includes(',')
        ? { estado: { in: estado.split(',').map((s) => s.trim()) } }
        : { estado }
      : undefined;

    const ordenes = await prisma.orden.findMany({
      where: estadoFiltro,
      include: ORDEN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(ordenes);
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: CrearOrdenRequest = await request.json();

    const tipoOrden: TipoOrden = body.tipoOrden ?? 'local';

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'La orden debe incluir al menos un producto' },
        { status: 400 },
      );
    }

    if (
      body.items.some(
        (item) =>
          !item.productoId?.trim() ||
          !Number.isInteger(item.cantidad) ||
          item.cantidad < 1,
      )
    ) {
      return NextResponse.json(
        { error: 'Todos los items deben tener un producto y una cantidad válida' },
        { status: 400 },
      );
    }

    // Validaciones por tipo de orden
    if (tipoOrden === 'local' && !body.numeroMesa) {
      return NextResponse.json({ error: 'El número de mesa es requerido para órdenes locales' }, { status: 400 });
    }
    if (tipoOrden === 'para_llevar' && !body.nombreCliente?.trim()) {
      return NextResponse.json({ error: 'El nombre del cliente es requerido' }, { status: 400 });
    }
    if (tipoOrden === 'domicilio' && !body.telefonoCliente?.trim()) {
      return NextResponse.json({ error: 'El teléfono del cliente es requerido para domicilio' }, { status: 400 });
    }
    if (tipoOrden === 'domicilio' && (body.costoEnvio === undefined || body.costoEnvio < 0)) {
      return NextResponse.json({ error: 'El costo de envío es requerido para domicilio' }, { status: 400 });
    }
    if (tipoOrden === 'domicilio' && !esMetodoPago(body.metodoPagoPrevisto)) {
      return NextResponse.json(
        { error: 'La modalidad de pago es requerida para domicilio. Use: efectivo o transferencia' },
        { status: 400 },
      );
    }

    // La modalidad de pago se acuerda al crear solo en domicilio: define si el local
    // le cobra al motorizado (efectivo) o le entrega el envío (transferencia).
    // En local y para llevar el método se decide recién al momento de cobrar.
    const metodoPagoPrevisto: MetodoPago | null =
      tipoOrden === 'domicilio' && esMetodoPago(body.metodoPagoPrevisto)
        ? body.metodoPagoPrevisto
        : null;

    const creador = body.creadorId
      ? await prisma.usuario.findFirst({
          where: { id: body.creadorId, activo: true },
          select: { id: true, nombre: true, rol: true },
        })
      : null;
    const creadorNombre = creador?.nombre ?? body.mesero?.trim();

    if (!creadorNombre) {
      return NextResponse.json(
        { error: 'El usuario que crea la orden es requerido' },
        { status: 400 },
      );
    }

    const costoEnvio = tipoOrden === 'domicilio' ? (body.costoEnvio ?? 0) : 0;

    // Obtener productos con sus tiempos de preparación y stock
    const productosIds = body.items.map((item: { productoId: string }) => item.productoId);
    const productos = await prisma.producto.findMany({
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
      return NextResponse.json(
        { error: 'Uno de los productos no existe o no está disponible' },
        { status: 400 },
      );
    }

    const itemComboSinPicante = body.items.find((item) => {
      const producto = productosPorId.get(item.productoId);
      return esCategoriaCombo(producto?.categoria) && !esNivelPicante(item.nivelPicante);
    });
    if (itemComboSinPicante) {
      const producto = productosPorId.get(itemComboSinPicante.productoId);
      return NextResponse.json(
        { error: `El nivel de picante es requerido para ${producto?.nombre ?? 'cada combo'}` },
        { status: 400 },
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

    // Validar stock para cada producto
    const itemsSinStock: ItemSinStock[] = [];

    for (const item of body.items) {
      const producto = productos.find((p) => p.id === item.productoId);

      if (!producto) {
        itemsSinStock.push({
          productoId: item.productoId,
          productoNombre: 'Producto no encontrado',
          cantidadSolicitada: item.cantidad,
          stockDisponible: 0,
        });
        continue;
      }

      if (producto.stock < item.cantidad) {
        itemsSinStock.push({
          productoId: producto.id,
          productoNombre: producto.nombre,
          cantidadSolicitada: item.cantidad,
          stockDisponible: producto.stock,
        });
      }
    }

    // Si hay items sin stock y no se especifica forzar creación,
    // crear orden con estado pendiente_aprobacion_stock
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

    // Orden, stock, historial y trabajo de impresion se confirman juntos.
    const { orden, printJobQueued } = await prisma.$transaction(async (tx) => {
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
          recargo: recargo > 0 ? recargo : null,
          costoEnvio: costoEnvio > 0 ? costoEnvio : null,
          metodoPagoPrevisto,
          mesero: creadorNombre,
          creadorId: creador?.id ?? null,
          creadorRol: creador?.rol ?? null,
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
          usuarioRol: creador?.rol ?? 'desconocido',
          diferenciaTotal: Number(totalFinal),
        },
      });

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
    });

    // Solo imprimir comanda si la orden no está pendiente de aprobación
    let resultadoImpresion: { success: boolean; data?: unknown; error?: string } = {
      success: false,
      error: 'Orden pendiente de aprobación'
    };

    if (estadoInicial === 'pendiente' && isDirectPrintEnabled()) {
      const printer = new PrinterService();
      resultadoImpresion = await printer.imprimirComanda({
        ...orden,
        // Las órdenes nuevas imprimen el picante por item. El campo de Orden es legado.
        nivelPicante: null,
      });

      if (resultadoImpresion.success) {
        await prisma.orden.update({
          where: { id: orden.id },
          data: { impresa: true },
        });
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
    if (estadoInicial === 'pendiente') {
      notificarClientes('nueva-orden', {
        id: orden.id,
        numeroDiario: orden.numeroDiario,
        fechaNumeroDiario: orden.fechaNumeroDiario,
        revision: orden.printRevision,
        tipoOrden,
        numeroMesa: orden.numeroMesa,
        nombreCliente: orden.nombreCliente,
        telefonoCliente: orden.telefonoCliente,
        mesero: orden.mesero,
        tiempoEstimado: orden.tiempoEstimado,
        itemsCount: orden.items.length,
        createdAt: orden.createdAt,
      });
    }

    // Si hay items sin stock, incluir esa información en la respuesta
    const respuesta = {
      orden,
      impresion: resultadoImpresion,
      impresionEnCola: printJobQueued,
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

    return NextResponse.json(respuesta);
  } catch (error) {
    if (error instanceof StockConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error al crear orden:', error);
    return NextResponse.json({ error: 'Error al crear orden' }, { status: 500 });
  }
}
