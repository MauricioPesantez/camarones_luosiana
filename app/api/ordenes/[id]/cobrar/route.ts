import { NextResponse } from 'next/server';

import {
  collectOrderPayment,
  PaymentConflictError,
  PaymentForbiddenError,
  PaymentNotFoundError,
  PaymentValidationError,
} from '@/lib/order-payment';
import { canCollectPayments, getAuthenticatedUser } from '@/lib/session';
import { esMetodoPago } from '@/types/orden';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (!canCollectPayments(usuario)) {
      return NextResponse.json({ error: 'Rol no autorizado para cobrar' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    if (!esMetodoPago(body.metodoPago)) {
      return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
    }

    const orden = await collectOrderPayment({
      orderId: id,
      metodoPago: body.metodoPago,
      expectedRevision: body.expectedRevision,
      idempotencyKey: body.idempotencyKey,
      origen: 'lista',
      user: usuario,
      comprobanteTransferenciaKey: body.comprobanteTransferenciaKey,
    });
    return NextResponse.json(orden);
  } catch (error) {
    if (error instanceof PaymentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PaymentForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof PaymentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error al registrar el cobro:', error);
    return NextResponse.json({ error: 'Error al registrar el cobro' }, { status: 500 });
  }
}
