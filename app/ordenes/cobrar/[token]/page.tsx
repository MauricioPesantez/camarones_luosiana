import { redirect } from 'next/navigation';

import CobrarOrdenClient from '@/components/cobros/CobrarOrdenClient';
import { prisma } from '@/lib/db';
import { canUserCollectOrder } from '@/lib/order-payment';
import { hashPaymentToken } from '@/lib/payment-link';
import {
  canCollectPayments,
  getAuthenticatedUser,
  roleHome,
  roleOrdersHome,
} from '@/lib/session';

export default async function CobrarOrdenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const usuario = await getAuthenticatedUser();
  const currentPath = `/ordenes/cobrar/${encodeURIComponent(token)}`;
  if (!usuario) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }
  if (!canCollectPayments(usuario)) redirect(roleHome(usuario.rol));

  const orden = await prisma.orden.findUnique({
    where: { cobroTokenHash: hashPaymentToken(token) },
    select: {
      id: true,
      numeroDiario: true,
      fechaNumeroDiario: true,
      tipoOrden: true,
      numeroMesa: true,
      nombreCliente: true,
      telefonoCliente: true,
      mesero: true,
      creadorId: true,
      estado: true,
      printRevision: true,
      recargo: true,
      costoEnvio: true,
      total: true,
      metodoPagoPrevisto: true,
      cobrada: true,
      createdAt: true,
      observaciones: true,
      items: {
        select: {
          id: true,
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
          observaciones: true,
          nivelPicante: true,
          esCortesia: true,
          producto: { select: { nombre: true } },
        },
      },
    },
  });

  if (!orden) redirect(roleOrdersHome(usuario.rol, 'enlace_invalido'));
  if (!canUserCollectOrder(usuario, orden)) {
    redirect(roleOrdersHome(usuario.rol, 'sin_permiso'));
  }
  if (orden.cobrada) redirect(roleOrdersHome(usuario.rol, 'ya_cobrada'));
  if (orden.estado === 'cancelada') {
    redirect(roleOrdersHome(usuario.rol, 'cancelada'));
  }
  if (orden.estado === 'pendiente_aprobacion_stock') {
    redirect(roleOrdersHome(usuario.rol, 'pendiente_aprobacion'));
  }
  if (
    (!orden.tipoOrden || orden.tipoOrden === 'local') &&
    !['lista', 'entregada'].includes(orden.estado)
  ) {
    redirect(roleOrdersHome(usuario.rol, 'aun_no_lista'));
  }

  const serializableOrder = {
    ...orden,
    recargo: Number(orden.recargo ?? 0),
    costoEnvio: Number(orden.costoEnvio ?? 0),
    total: Number(orden.total),
    createdAt: orden.createdAt.toISOString(),
    items: orden.items.map((item) => ({
      ...item,
      precioUnitario: Number(item.precioUnitario),
      subtotal: Number(item.subtotal),
    })),
  };

  return (
    <CobrarOrdenClient
      token={token}
      orden={serializableOrder}
      usuario={usuario}
      successUrl={roleOrdersHome(usuario.rol, 'cobro_exitoso')}
    />
  );
}
