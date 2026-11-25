import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { getAuthenticatedUser, canCollectPayments } from "./session";
import { hashPaymentToken } from "./payment-link";
import { alcancePorCobrar } from "./ordenes-por-cobrar";
import { paymentBlockReason } from "./payment-policy";
import { previsualizarMixto } from "./presentacion-cobro";
import { ActoDeCobroInvalido } from "./order-payment-validaciones";

export async function previewPayment(
  request: Request,
  referencia: { token: string } | { id: string },
) {
  const user = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!canCollectPayments(user))
    return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json(
        { error: "Solicitud inválida" },
        { status: 400 },
      );
    const token = "token" in referencia;
    if (!token && user.rol !== "mesero")
      return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
    const order = await prisma.orden.findFirst({
      where: token
        ? { cobroTokenHash: hashPaymentToken(referencia.token) }
        : { AND: [{ id: referencia.id }, alcancePorCobrar(user)] },
      select: {
        total: true,
        montoPagado: true,
        costoEnvio: true,
        tipoOrden: true,
        estado: true,
        anulada: true,
        tipoOperacion: true,
        printRevision: true,
      },
    });
    if (!order)
      return NextResponse.json(
        { error: "Orden no disponible" },
        { status: 404 },
      );
    const bloqueo = paymentBlockReason(order, token ? "qr" : "lista");
    if (bloqueo || body.expectedRevision !== order.printRevision)
      return NextResponse.json(
        {
          error:
            bloqueo || "La orden cambió. Recárgala para revisar el importe.",
        },
        { status: 409 },
      );
    return NextResponse.json(previsualizarMixto(order, body.efectivo), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ActoDeCobroInvalido)
      return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Error al previsualizar cobro:", error);
    return NextResponse.json(
      { error: "No se pudo revisar el cobro" },
      { status: 500 },
    );
  }
}
