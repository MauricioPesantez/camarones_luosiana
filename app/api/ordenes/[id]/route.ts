import { PUBLIC_PRODUCT_SELECT } from "@/lib/product-select";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/session";
import { canUserModifyOrder } from "@/lib/order-payment";
import { sePuedeEditar } from "@/lib/edicion-orden";

const ALLOWED_STATES = new Set([
  "pendiente",
  "en_preparacion",
  "lista",
  "entregada",
]);

/** Detalle para editar: ver un domicilio compartido no autoriza modificarlo. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await getAuthenticatedUser();
  if (!usuario)
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!["mesero", "admin", "digital"].includes(usuario.rol))
    return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
  try {
    const { id } = await params;
    const orden = await prisma.orden.findUnique({
      where: { id },
      select: {
        id: true,
        creadorId: true,
        mesero: true,
        anulada: true,
        cobrada: true,
        empleadoId: true,
        tipoOperacion: true,
        printRevision: true,
        tipoOrden: true,
        estado: true,
        numeroMesa: true,
        nombreCliente: true,
        telefonoCliente: true,
        costoEnvio: true,
        descuentoTipo: true,
        descuentoValor: true,
        total: true,
        montoPagado: true,
        items: { include: { producto: { select: PUBLIC_PRODUCT_SELECT } } },
      },
    });
    if (
      !orden ||
      orden.anulada ||
      orden.tipoOperacion !== "VENTA_CLIENTE" ||
      !canUserModifyOrder(usuario, orden) ||
      !sePuedeEditar(orden)
    ) {
      return NextResponse.json(
        { error: "Orden no disponible para editar" },
        { status: 404 },
      );
    }
    return NextResponse.json(orden, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error al cargar detalle de orden:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la orden" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
    }
    if (!["cocina", "admin"].includes(usuario.rol)) {
      return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    if (!ALLOWED_STATES.has(body.estado)) {
      return NextResponse.json(
        { error: "Estado de orden no válido" },
        { status: 400 },
      );
    }
    const existente = await prisma.orden.findUnique({
      where: { id },
      select: {
        cobrada: true,
        anulada: true,
        tipoOperacion: true,
        estado: true,
        printRevision: true,
      },
    });

    if (!existente) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    if (existente.anulada) {
      return NextResponse.json(
        { error: "Una orden anulada no cambia de estado" },
        { status: 409 },
      );
    }

    if (existente.tipoOperacion === "CONSUMO_EMPLEADO") {
      return NextResponse.json(
        {
          error:
            "Los consumos de empleados requieren regularización administrativa",
        },
        { status: 409 },
      );
    }

    // Si cocina marca la orden como 'entregada' y ya fue cobrada, cerrarla directamente.
    let estadoFinal = body.estado;
    if (estadoFinal === "entregada" && existente.cobrada) {
      estadoFinal = "cobrada";
    }

    const orden = await prisma.orden.update({
      where: { id },
      data: { estado: estadoFinal },
      include: {
        items: {
          include: {
            producto: { select: PUBLIC_PRODUCT_SELECT },
          },
        },
      },
    });
    return NextResponse.json(orden);
  } catch (error) {
    console.error("Error al actualizar orden:", error);
    return NextResponse.json(
      { error: "Error al actualizar orden" },
      { status: 500 },
    );
  }
}

/**
 * Una orden no se borra nunca: se anula con
 * `PATCH /api/ordenes/[id]/anular`, que exige una razon y la deja fuera del
 * cuadre sin perder el numero diario, el historial ni el cobro.
 *
 * Borrarla de verdad se llevaria por cascada sus items, su historial y sus
 * trabajos de impresion, y dejaria un hueco en la numeracion del dia.
 */
export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "Las ordenes no se eliminan. Anula la orden para sacarla del cuadre conservando su historial.",
    },
    { status: 405 },
  );
}
