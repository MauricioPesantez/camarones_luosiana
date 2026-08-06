import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  PRINT_JOB_TYPES,
  enqueueOrderPrintJob,
  shouldEnqueuePrintJob,
  type AmendmentChangeSource,
} from '@/lib/print-jobs';
import { notificarClientes } from '@/lib/sse';
import {
  calcularRecargoEnvases,
  esCategoriaCombo,
  esNivelPicante,
  RECARGO_RECIPIENTES,
  type NivelPicante,
  type TipoOrden,
} from '@/types/orden';
import { canUserModifyOrder } from '@/lib/order-payment';
import { canCollectPayments, getAuthenticatedUser } from '@/lib/session';

type ItemChange =
  | { accion: 'eliminar'; itemId: string }
  | {
      accion: 'agregar';
      productoId: string;
      cantidad: number;
      observaciones?: string;
      nivelPicante?: NivelPicante;
    }
  | { accion: 'modificar'; itemId: string; cantidad: number };

interface ModificationRequest {
  items: ItemChange[];
  razon: string;
  expectedRevision: number;
  usuario: {
    nombre: string;
    rol: string;
  };
}

interface HistoryRecord {
  tipoAccion: string;
  descripcion: string;
  itemAfectado?: Prisma.InputJsonValue;
  datosAntes?: Prisma.InputJsonValue;
  datosDespues?: Prisma.InputJsonValue;
  usuarioNombre: string;
  usuarioRol: string;
  razon: string;
  diferenciaTotal: number;
}

class ModificationRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function validateRequest(body: ModificationRequest): void {
  if (!body.razon?.trim()) {
    throw new ModificationRequestError(
      'La razón del cambio es obligatoria',
      400,
    );
  }

  if (!body.usuario?.nombre?.trim() || !body.usuario?.rol?.trim()) {
    throw new ModificationRequestError(
      'El usuario que realiza el cambio es requerido',
      400,
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new ModificationRequestError(
      'Se requiere al menos un cambio de items',
      400,
    );
  }

  if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) {
    throw new ModificationRequestError(
      'La revisión esperada de la orden es requerida',
      400,
    );
  }

  const touchedItems = new Set<string>();

  for (const change of body.items) {
    if (!change || typeof change !== 'object') {
      throw new ModificationRequestError('Cambio de item inválido', 400);
    }
    if (!['agregar', 'modificar', 'eliminar'].includes(change.accion)) {
      throw new ModificationRequestError('Acción de item inválida', 400);
    }

    if (change.accion === 'agregar') {
      if (!change.productoId?.trim()) {
        throw new ModificationRequestError('El producto es requerido', 400);
      }
      if (!Number.isInteger(change.cantidad) || change.cantidad < 1) {
        throw new ModificationRequestError('La cantidad debe ser mayor a cero', 400);
      }
    } else {
      if (!change.itemId?.trim()) {
        throw new ModificationRequestError('El item es requerido', 400);
      }
      if (touchedItems.has(change.itemId)) {
        throw new ModificationRequestError(
          'Un item no puede modificarse más de una vez en la misma solicitud',
          400,
        );
      }
      touchedItems.add(change.itemId);
      if (
        change.accion === 'modificar' &&
        (!Number.isInteger(change.cantidad) || change.cantidad < 1)
      ) {
        throw new ModificationRequestError('La cantidad debe ser mayor a cero', 400);
      }
    }
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuarioSesion = await getAuthenticatedUser();
    if (!usuarioSesion) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (!canCollectPayments(usuarioSesion)) {
      return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
    }
    const { id } = await params;
    const requestBody = (await request.json()) as ModificationRequest;
    const body: ModificationRequest = {
      ...requestBody,
      usuario: {
        nombre: usuarioSesion.nombre,
        rol: usuarioSesion.rol,
      },
    };
    validateRequest(body);

    const result = await prisma.$transaction(
      async (tx) => {
        const order = await tx.orden.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                producto: true,
              },
            },
          },
        });

        if (!order) {
          throw new ModificationRequestError('Orden no encontrada', 404);
        }

        if (!canUserModifyOrder(usuarioSesion, order)) {
          throw new ModificationRequestError(
            'No puedes modificar una orden de otro usuario',
            403,
          );
        }

        if (order.cobrada) {
          throw new ModificationRequestError(
            'No se puede modificar una orden que ya fue cobrada',
            409,
          );
        }

        if (order.printRevision !== body.expectedRevision) {
          throw new ModificationRequestError(
            'La orden cambió mientras estaba abierta. Recárgala e intenta nuevamente.',
            409,
          );
        }

        const editableStatuses = ['pendiente', 'en_preparacion', 'lista'];
        if (!editableStatuses.includes(order.estado)) {
          throw new ModificationRequestError(
            'Solo se pueden modificar órdenes activas',
            400,
          );
        }

        const wasReady = order.estado === 'lista';
        if (wasReady) {
          const invalidChange = body.items.some((change) => {
            if (change.accion === 'eliminar') return true;
            if (change.accion !== 'modificar') return false;

            const original = order.items.find(
              (item) => item.id === change.itemId,
            );
            return original ? change.cantidad < original.cantidad : true;
          });

          if (invalidChange) {
            throw new ModificationRequestError(
              'No se pueden eliminar items ni reducir cantidades de una orden ya lista.',
              400,
            );
          }
        }

        const previousTotal = Number(order.total);
        const packagingApplies = order.tipoOrden !== 'local';
        const history: HistoryRecord[] = [];
        const amendmentChanges: AmendmentChangeSource[] = [];

        for (const change of body.items) {
          if (change.accion === 'eliminar') {
            const item = order.items.find(
              (current) => current.id === change.itemId,
            );
            if (!item) {
              throw new ModificationRequestError('Item no encontrado', 404);
            }

            await tx.producto.update({
              where: { id: item.productoId },
              data: { stock: { increment: item.cantidad } },
            });
            await tx.item.delete({ where: { id: item.id } });

            history.push({
              tipoAccion: 'item_eliminado',
              descripcion: `Eliminado: ${item.cantidad}x ${item.producto.nombre}`,
              itemAfectado: {
                id: item.id,
                nombre: item.producto.nombre,
                cantidad: item.cantidad,
                precio: Number(item.precioUnitario),
              },
              datosAntes: {
                cantidad: item.cantidad,
                subtotal: Number(item.subtotal),
              },
              usuarioNombre: body.usuario.nombre,
              usuarioRol: body.usuario.rol,
              razon: body.razon,
              diferenciaTotal: -Number(item.subtotal),
            });
            amendmentChanges.push({
              action: 'REMOVE',
              itemId: item.id,
              productId: item.productoId,
              productName: item.producto.nombre,
              previousQuantity: item.cantidad,
              quantity: 0,
              quantityDelta: -item.cantidad,
              unitPrice: Number(item.precioUnitario),
              amountDelta: -Number(item.subtotal),
              surchargeDelta:
                packagingApplies && esCategoriaCombo(item.producto.categoria)
                  ? -item.cantidad * RECARGO_RECIPIENTES
                  : 0,
              observations: item.observaciones,
              spiceLevel: item.nivelPicante,
              complimentary: item.esCortesia,
            });
            continue;
          }

          if (change.accion === 'agregar') {
            const product = await tx.producto.findUnique({
              where: { id: change.productoId },
            });
            if (!product) {
              throw new ModificationRequestError('Producto no encontrado', 404);
            }
            if (!product.disponible) {
              throw new ModificationRequestError(
                'El producto no está disponible',
                400,
              );
            }
            if (
              esCategoriaCombo(product.categoria) &&
              !esNivelPicante(change.nivelPicante)
            ) {
              throw new ModificationRequestError(
                `El nivel de picante es requerido para ${product.nombre}`,
                400,
              );
            }

            const stockUpdate = await tx.producto.updateMany({
              where: {
                id: product.id,
                stock: { gte: change.cantidad },
              },
              data: { stock: { decrement: change.cantidad } },
            });
            if (stockUpdate.count !== 1) {
              throw new ModificationRequestError(
                `Stock insuficiente para ${product.nombre}`,
                409,
              );
            }

            const unitPrice = Number(product.precio);
            const subtotal = change.cantidad * unitPrice;
            const newItem = await tx.item.create({
              data: {
                ordenId: id,
                productoId: product.id,
                cantidad: change.cantidad,
                precioUnitario: unitPrice,
                subtotal,
                observaciones: change.observaciones,
                nivelPicante:
                  esCategoriaCombo(product.categoria) &&
                  esNivelPicante(change.nivelPicante)
                    ? change.nivelPicante
                    : null,
              },
            });

            history.push({
              tipoAccion: 'item_agregado',
              descripcion: `Agregado: ${change.cantidad}x ${product.nombre}`,
              itemAfectado: {
                id: newItem.id,
                nombre: product.nombre,
                cantidad: change.cantidad,
                precio: unitPrice,
              },
              datosDespues: {
                cantidad: change.cantidad,
                subtotal,
              },
              usuarioNombre: body.usuario.nombre,
              usuarioRol: body.usuario.rol,
              razon: body.razon,
              diferenciaTotal: subtotal,
            });
            amendmentChanges.push({
              action: 'ADD',
              itemId: newItem.id,
              productId: product.id,
              productName: product.nombre,
              previousQuantity: 0,
              quantity: change.cantidad,
              quantityDelta: change.cantidad,
              unitPrice,
              amountDelta: subtotal,
              surchargeDelta:
                packagingApplies && esCategoriaCombo(product.categoria)
                  ? change.cantidad * RECARGO_RECIPIENTES
                  : 0,
              observations: change.observaciones,
              spiceLevel: newItem.nivelPicante,
              complimentary: false,
            });
            continue;
          }

          const item = order.items.find(
            (current) => current.id === change.itemId,
          );
          if (!item) {
            throw new ModificationRequestError('Item no encontrado', 404);
          }
          if (change.cantidad === item.cantidad) continue;

          const quantityDifference = change.cantidad - item.cantidad;
          if (quantityDifference > 0) {
            const stockUpdate = await tx.producto.updateMany({
              where: {
                id: item.productoId,
                stock: { gte: quantityDifference },
              },
              data: { stock: { decrement: quantityDifference } },
            });
            if (stockUpdate.count !== 1) {
              throw new ModificationRequestError(
                `Stock insuficiente para ${item.producto.nombre}`,
                409,
              );
            }
          } else {
            await tx.producto.update({
              where: { id: item.productoId },
              data: { stock: { increment: -quantityDifference } },
            });
          }

          const unitPrice = Number(item.precioUnitario);
          const previousSubtotal = Number(item.subtotal);
          const newSubtotal = change.cantidad * unitPrice;
          await tx.item.update({
            where: { id: item.id },
            data: {
              cantidad: change.cantidad,
              subtotal: newSubtotal,
            },
          });

          history.push({
            tipoAccion: 'item_modificado',
            descripcion: `Modificado: ${item.producto.nombre} (${item.cantidad} → ${change.cantidad})`,
            itemAfectado: {
              id: item.id,
              nombre: item.producto.nombre,
              cantidad: item.cantidad,
              precio: unitPrice,
            },
            datosAntes: {
              cantidad: item.cantidad,
              subtotal: previousSubtotal,
            },
            datosDespues: {
              cantidad: change.cantidad,
              subtotal: newSubtotal,
            },
            usuarioNombre: body.usuario.nombre,
            usuarioRol: body.usuario.rol,
            razon: body.razon,
            diferenciaTotal: newSubtotal - previousSubtotal,
          });
          amendmentChanges.push({
            action: 'UPDATE',
            itemId: item.id,
            productId: item.productoId,
            productName: item.producto.nombre,
            previousQuantity: item.cantidad,
            quantity: change.cantidad,
            quantityDelta: quantityDifference,
            unitPrice,
            amountDelta: newSubtotal - previousSubtotal,
            surchargeDelta:
              packagingApplies && esCategoriaCombo(item.producto.categoria)
                ? quantityDifference * RECARGO_RECIPIENTES
                : 0,
            observations: item.observaciones,
            spiceLevel: item.nivelPicante,
            complimentary: item.esCortesia,
          });
        }

        if (history.length === 0) {
          throw new ModificationRequestError(
            'No hay cambios efectivos para guardar',
            400,
          );
        }

        const updatedItems = await tx.item.findMany({
          where: { ordenId: id },
          include: { producto: true },
        });
        if (updatedItems.length === 0) {
          throw new ModificationRequestError(
            'La orden debe conservar al menos un item',
            400,
          );
        }

        const productsSubtotal = updatedItems.reduce(
          (sum, item) => sum + Number(item.subtotal),
          0,
        );
        const orderType = (
          order.tipoOrden === 'domicilio' || order.tipoOrden === 'para_llevar'
            ? order.tipoOrden
            : 'local'
        ) as TipoOrden;
        const newSurcharge = calcularRecargoEnvases(
          orderType,
          updatedItems.map((item) => ({
            cantidad: item.cantidad,
            categoria: item.producto.categoria,
          })),
        );
        const previousSurcharge = Number(order.recargo ?? 0);
        if (newSurcharge !== previousSurcharge) {
          history.push({
            tipoAccion: 'recargo_envases_actualizado',
            descripcion: `Recargo de envases actualizado: $${previousSurcharge.toFixed(2)} → $${newSurcharge.toFixed(2)}`,
            datosAntes: { recargo: previousSurcharge },
            datosDespues: { recargo: newSurcharge },
            usuarioNombre: body.usuario.nombre,
            usuarioRol: body.usuario.rol,
            razon: body.razon,
            diferenciaTotal: newSurcharge - previousSurcharge,
          });
        }
        const newTotal =
          productsSubtotal +
          newSurcharge +
          Number(order.costoEnvio ?? 0);

        let baseTime = 0;
        let additionalTime = 0;
        updatedItems.forEach((item) => {
          const preparationTime = item.producto.tiempoPreparacion || 0;
          if (item.producto.categoria === 'Platos Fuertes') {
            baseTime = Math.max(baseTime, preparationTime);
          } else if (
            item.producto.categoria === 'Acompañamientos' ||
            item.producto.categoria === 'Entradas'
          ) {
            additionalTime += preparationTime * 0.1;
          }
        });

        const newEstimatedTime = Math.ceil(baseTime + additionalTime);
        const hasNewPreparation = amendmentChanges.some(
          (change) => change.quantityDelta > 0,
        );
        const newStatus = wasReady && hasNewPreparation ? 'en_preparacion' : undefined;

        const orderUpdate = await tx.orden.updateMany({
          where: {
            id,
            cobrada: false,
            printRevision: body.expectedRevision,
          },
          data: {
            total: newTotal,
            recargo: newSurcharge > 0 ? newSurcharge : null,
            tiempoEstimado: newEstimatedTime,
            modificada: true,
            printRevision: body.expectedRevision + 1,
            ...(newStatus ? { estado: newStatus } : {}),
          },
        });
        if (orderUpdate.count !== 1) {
          throw new ModificationRequestError(
            'La orden fue cobrada o modificada al mismo tiempo. Recárgala e intenta nuevamente.',
            409,
          );
        }

        const updatedOrder = await tx.orden.findUniqueOrThrow({
          where: { id },
          include: {
            items: {
              include: {
                producto: true,
              },
            },
          },
        });

        await tx.historialOrden.createMany({
          data: history.map((record) => ({
            ...record,
            ordenId: id,
          })),
        });

        let printJobQueued = false;
        const amendmentCreatedAt = new Date();
        if (shouldEnqueuePrintJob(amendmentCreatedAt)) {
          await enqueueOrderPrintJob(tx, updatedOrder, {
            type: PRINT_JOB_TYPES.AMENDMENT,
            revision: updatedOrder.printRevision,
            changes: amendmentChanges,
            reason: body.razon,
            requestedBy: body.usuario.nombre,
            now: amendmentCreatedAt,
          });
          printJobQueued = true;
        }

        return {
          order: updatedOrder,
          changesCount: history.length,
          previousTotal,
          newTotal,
          returnsToKitchen: Boolean(newStatus),
          newItemsCount: amendmentChanges.reduce(
            (total, change) => total + Math.max(0, change.quantityDelta),
            0,
          ),
          printJobQueued,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.returnsToKitchen) {
      const title =
        !result.order.tipoOrden || result.order.tipoOrden === 'local'
          ? `Mesa ${result.order.numeroMesa}`
          : (result.order.nombreCliente ?? 'Cliente');
      notificarClientes('regresa-a-cocina', {
        ordenId: id,
        numeroDiario: result.order.numeroDiario,
        fechaNumeroDiario: result.order.fechaNumeroDiario,
        revision: result.order.printRevision,
        tituloOrden: title,
        itemsNuevos: result.newItemsCount,
      });
    }

    return NextResponse.json({
      orden: result.order,
      cambios: result.changesCount,
      totalAnterior: result.previousTotal,
      totalNuevo: result.newTotal,
      diferencia: result.newTotal - result.previousTotal,
      regresaACocina: result.returnsToKitchen,
      impresionEnCola: result.printJobQueued,
    });
  } catch (error) {
    if (error instanceof ModificationRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      return NextResponse.json(
        { error: 'La orden cambió al mismo tiempo. Intenta nuevamente.' },
        { status: 409 },
      );
    }

    console.error('Error al modificar orden:', error);
    return NextResponse.json(
      { error: 'Error al modificar orden' },
      { status: 500 },
    );
  }
}
