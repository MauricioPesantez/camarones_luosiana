import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import {
  collectOrderPayment,
  PaymentConflictError,
  PaymentForbiddenError,
  PaymentValidationError,
} from '@/lib/order-payment';
import { hashPaymentToken } from '@/lib/payment-link';
import { canCollectPayments, getAuthenticatedUser } from '@/lib/session';
import { esMetodoPago } from '@/types/orden';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (!canCollectPayments(usuario)) {
      return NextResponse.json({ error: 'Rol no autorizado para cobrar' }, { status: 403 });
    }

    const { token } = await params;
    const orden = await prisma.orden.findUnique({
      where: { cobroTokenHash: hashPaymentToken(token) },
      select: { id: true },
    });
    // El token se resuelve solo despues de autenticar para no filtrar su validez.
    if (!orden) {
      return NextResponse.json({ error: 'Enlace de cobro no válido' }, { status: 404 });
    }

    const body = await request.json();
    if (!esMetodoPago(body.metodoPago)) {
      return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
    }
    const actualizada = await collectOrderPayment({
      orderId: orden.id,
      metodoPago: body.metodoPago,
      expectedRevision: body.expectedRevision,
      idempotencyKey: body.idempotencyKey,
      origen: 'qr',
      user: usuario,
      comprobanteTransferenciaKey: body.comprobanteTransferenciaKey,
    });
    return NextResponse.json(actualizada);
  } catch (error) {
    if (error instanceof PaymentForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof PaymentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error al cobrar mediante enlace:', error);
    return NextResponse.json({ error: 'Error al registrar el cobro' }, { status: 500 });
  }
}
