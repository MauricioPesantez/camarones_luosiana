import { redirect } from "next/navigation";

import CobrarOrdenClient from "@/components/cobros/CobrarOrdenClient";
import { alcancePorCobrar } from "@/lib/ordenes-por-cobrar";
import { paymentBlockReason } from "@/lib/payment-policy";
import { prisma } from "@/lib/db";
import { hashPaymentToken } from "@/lib/payment-link";
import {
  canCollectPayments,
  getAuthenticatedUser,
  roleHome,
  roleOrdersHome,
} from "@/lib/session";
import { storageConfigurado } from "@/lib/storage";
import { presentarCobro } from "@/lib/presentacion-cobro";
import { calcularSaldo } from "@/types/orden";

export async function paginaCobro(
  referencia: { token: string } | { id: string },
  abiertoDesdeLista: boolean,
) {
  const token = "token" in referencia ? referencia.token : null;
  const usuario = await getAuthenticatedUser();
  const currentPath = token
    ? `/ordenes/cobrar/${encodeURIComponent(token)}${abiertoDesdeLista ? "?origen=lista" : ""}`
    : `/ordenes/${encodeURIComponent("id" in referencia ? referencia.id : "")}/cobrar`;
  if (!usuario) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }
  if (!canCollectPayments(usuario)) redirect(roleHome(usuario.rol));

  if (!token && usuario.rol !== "mesero") redirect(roleHome(usuario.rol));
  const orden = await prisma.orden.findFirst({
    where: token
      ? { cobroTokenHash: hashPaymentToken(token) }
      : {
          AND: [
            { id: "id" in referencia ? referencia.id : "" },
            alcancePorCobrar(usuario),
          ],
        },
    select: {
      id: true,
      tipoOperacion: true,
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
      descuento: true,
      total: true,
      montoPagado: true,
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

  if (!orden) redirect(roleOrdersHome(usuario.rol, "enlace_invalido"));
  // El permiso de cobro ya se validó por rol arriba: quien tenga el enlace y pueda
  // cobrar cierra el pago aunque la orden la haya creado otro usuario.
  if (
    calcularSaldo({
      total: orden.total.toString(),
      montoPagado: orden.montoPagado.toString(),
    }) <= 0
  )
    redirect(roleOrdersHome(usuario.rol, "ya_cobrada"));
  // El QR impreso sigue existiendo despues de anular: no debe abrir un cobro.
  if (orden.tipoOperacion === "CONSUMO_EMPLEADO")
    redirect(roleOrdersHome(usuario.rol, "enlace_invalido"));
  if (orden.anulada) redirect(roleOrdersHome(usuario.rol, "anulada"));
  if (orden.estado === "cancelada") {
    redirect(roleOrdersHome(usuario.rol, "cancelada"));
  }
  if (orden.estado === "pendiente_aprobacion_stock") {
    redirect(roleOrdersHome(usuario.rol, "pendiente_aprobacion"));
  }
  if (paymentBlockReason(orden, token ? "qr" : "lista"))
    redirect(roleOrdersHome(usuario.rol, "no_disponible"));

  const serializableOrder = {
    ...orden,
    recargo: Number(orden.recargo ?? 0),
    costoEnvio: Number(orden.costoEnvio ?? 0),
    descuento: Number(orden.descuento),
    total: Number(orden.total),
    montoPagado: Number(orden.montoPagado),
    createdAt: orden.createdAt.toISOString(),
    items: orden.items.map((item) => ({
      ...item,
      precioUnitario: Number(item.precioUnitario),
      subtotal: Number(item.subtotal),
    })),
  };

  return (
    <CobrarOrdenClient
      endpoints={
        token
          ? {
              confirmar: `/api/cobros/${encodeURIComponent(token)}`,
              previsualizar: `/api/cobros/${encodeURIComponent(token)}/previsualizar`,
              comprobante: `/api/cobros/${encodeURIComponent(token)}/comprobante`,
            }
          : {
              confirmar: `/api/ordenes/${orden.id}/cobrar`,
              previsualizar: `/api/ordenes/${orden.id}/previsualizar-cobro`,
              comprobante: null,
            }
      }
      presentacion={presentarCobro(orden)}
      orden={serializableOrder}
      usuario={usuario}
      successUrl={roleOrdersHome(usuario.rol, "cobro_exitoso")}
      cerrarAlFinalizar={!abiertoDesdeLista}
      storageDisponible={Boolean(token) && storageConfigurado()}
    />
  );
}
