import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validarAnulacion } from "@/lib/retiros-validaciones";
import { getAuthenticatedUser } from "@/lib/session";
import { ESTADO_CAJA_ABIERTA, ROL_CIERRA_CAJA, ultimoCorteVigente } from "@/types/caja";

class AnularCorteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Corrige un conteo entregado: solo el último, para no mover los turnos siguientes. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = await getAuthenticatedUser();
    if (!admin) {
      return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
    }
    if (admin.rol !== ROL_CIERRA_CAJA) {
      return NextResponse.json(
        { error: "Solo un administrador puede anular un corte" },
        { status: 403 },
      );
    }

    const validacion = validarAnulacion(await request.json());
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const corte = await tx.corteTurno.findUnique({
        where: { id },
        select: { sesionCajaId: true },
      });
      if (!corte) throw new AnularCorteError("Corte no encontrado", 404);

      // Mismo candado que el corte y el cierre: ninguno entra mientras se anula.
      const [caja] = await tx.$queryRaw<Array<{ estado: string }>>`
        SELECT "estado"
        FROM "SesionCaja"
        WHERE "id" = ${corte.sesionCajaId}
        FOR UPDATE
      `;
      if (caja?.estado !== ESTADO_CAJA_ABIERTA) {
        throw new AnularCorteError("La caja ya fue cerrada", 409);
      }
      const cortes = await tx.corteTurno.findMany({
        where: { sesionCajaId: corte.sesionCajaId },
        orderBy: { numero: "asc" },
        select: { id: true, anuladoAt: true },
      });
      if (ultimoCorteVigente(cortes)?.id !== id) {
        throw new AnularCorteError(
          "Solo se puede anular el último corte vigente. Recarga la pantalla.",
          409,
        );
      }
      await tx.corteTurno.update({
        where: { id },
        data: {
          anuladoPorNombre: admin.nombre,
          razonAnulacion: validacion.data.razon,
          anuladoAt: new Date(),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AnularCorteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al anular el corte:", error);
    return NextResponse.json(
      { error: "Error al anular el corte" },
      { status: 500 },
    );
  }
}
