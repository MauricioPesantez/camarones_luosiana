import { redirect } from 'next/navigation';

import CobrarOrdenClient from '@/components/cobros/CobrarOrdenClient';
import { prisma } from '@/lib/db';
import { hashPaymentToken } from '@/lib/payment-link';
import {
  canCollectPayments,
  getAuthenticatedUser,
  roleHome,
  roleOrdersHome,
} from '@/lib/session';

export default async function CobrarOrdenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ origen?: string }>;
}) {
  const { token } = await params;
  const { origen } = await searchParams;
  // Desde la lista interna se navega en la misma pestaña: ahí no se debe cerrar
  // nada al terminar. El enlace/QR sí abre una pestaña dedicada al cobro.
  const abiertoDesdeLista = origen === 'lista';
  const usuario = await getAuthenticatedUser();
  const currentPath = `/ordenes/cobrar/${encodeURIComponent(token)}${
    abiertoDesdeLista ? '?origen=lista' : ''
  }`;
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
      anulada: true,
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
  // El permiso de cobro ya se validó por rol arriba: quien tenga el enlace y pueda
  // cobrar cierra el pago aunque la orden la haya creado otro usuario.
  if (orden.cobrada) redirect(roleOrdersHome(usuario.rol, 'ya_cobrada'));
  // El QR impreso sigue existiendo despues de anular: no debe abrir un cobro.
  if (orden.anulada) redirect(roleOrdersHome(usuario.rol, 'anulada'));
  if (orden.estado === 'cancelada') {
    redirect(roleOrdersHome(usuario.rol, 'cancelada'));
  }
  if (orden.estado === 'pendiente_aprobacion_stock') {
    redirect(roleOrdersHome(usuario.rol, 'pendiente_aprobacion'));
  }
  // El cobro por enlace (QR) permite cerrar el pago en cualquier estado operativo,
  // sin importar el tipo de orden. Basta con que exista, no esté cobrada, cancelada
  // ni pendiente de aprobación por stock.

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
      cerrarAlFinalizar={!abiertoDesdeLista}
    />
  );
}
