import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { obtenerDatosCuadre } from "@/lib/cuadre-server";
import { getAuthenticatedUser } from "@/lib/session";
import type { DetalleRevision, RevisionGuardada } from "@/types/revision";

export async function GET(request: Request) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
    }
    if (usuario.rol !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores" },
        { status: 403 },
      );
    }

    const fecha = new URL(request.url).searchParams.get("fecha");
    if (!fecha) {
      return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
    }

    const datos = await obtenerDatosCuadre(fecha);
    if (!datos) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    // Aquí y no en obtenerDatosCuadre: esa función la comparten el cierre, el corte y el mesero.
    const filas = await prisma.revisionOrden.findMany({
      where: { ordenId: { in: datos.ordenes.map((o) => o.id) } },
    });
    const revisiones: RevisionGuardada[] = filas.map((f) => ({
      ordenId: f.ordenId,
      detalle: f.detalle as unknown as DetalleRevision,
      revisada: f.revisada,
      conErrores: f.conErrores,
      version: f.version,
      revisadaPorNombre: f.revisadaPorNombre,
      revisadaAt: f.revisadaAt ? f.revisadaAt.toISOString() : null,
    }));

    return NextResponse.json({ ...datos, revisiones });
  } catch (error) {
    console.error("Error en cuadre:", error);
    return NextResponse.json(
      { error: "Error al obtener cuadre" },
      { status: 500 },
    );
  }
}
