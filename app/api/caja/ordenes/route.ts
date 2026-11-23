import { NextResponse } from "next/server";
import {
  bloquearCajaAbierta,
  CajaNoDisponibleError,
  obtenerCajaDeHoy,
} from "@/lib/caja";
import { obtenerDatosCuadre } from "@/lib/cuadre-server";
import { prisma } from "@/lib/db";
import { obtenerFechaEcuador } from "@/lib/fecha-ecuador";
import { ordenesParaMesero } from "@/lib/ordenes-mesero";
import { getAuthenticatedUser } from "@/lib/session";
import {
  ESTADO_CAJA_ABIERTA,
  ROL_ABRE_CAJA,
  ROL_CIERRA_CAJA,
  ultimoCorteVigente,
} from "@/types/caja";

/** Órdenes del día, solo para quien entregó el conteo y solo si el admin las habilitó. */
export async function GET() {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
    }
    const caja = await obtenerCajaDeHoy();
    if (
      usuario.rol !== ROL_ABRE_CAJA ||
      caja?.estado !== ESTADO_CAJA_ABIERTA ||
      !caja.ordenesHabilitadasAt ||
      ultimoCorteVigente(caja.cortes)?.usuarioId !== usuario.id
    ) {
      return NextResponse.json(
        { error: "El administrador no te ha habilitado las órdenes del día" },
        { status: 403 },
      );
    }

    const datos = await obtenerDatosCuadre(obtenerFechaEcuador());
    if (!datos) throw new Error("Fecha inválida");
    return NextResponse.json(ordenesParaMesero(datos));
  } catch (error) {
    console.error("Error al obtener las órdenes del día:", error);
    return NextResponse.json(
      { error: "Error al obtener las órdenes del día" },
      { status: 500 },
    );
  }
}

/** El admin muestra las órdenes. No se deshace: lo ya visto no se puede olvidar. */
export async function PATCH(request: Request) {
  try {
    const admin = await getAuthenticatedUser();
    if (!admin) {
      return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
    }
    if (admin.rol !== ROL_CIERRA_CAJA) {
      return NextResponse.json(
        { error: "Solo un administrador puede mostrar las órdenes" },
        { status: 403 },
      );
    }
    const body = (await request.json().catch(() => null)) as { fecha?: unknown } | null;
    if (body?.fecha !== obtenerFechaEcuador()) {
      return NextResponse.json(
        { error: "Solo se pueden mostrar las órdenes de hoy" },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      // Mismo candado que el corte y el cierre: nadie cuenta mientras se habilita.
      await bloquearCajaAbierta(tx);
      const caja = await obtenerCajaDeHoy(tx);
      if (!caja || !ultimoCorteVigente(caja.cortes)) {
        throw new CajaNoDisponibleError("Ningún mesero ha entregado su conteo");
      }
      if (caja.ordenesHabilitadasAt) return;
      await tx.sesionCaja.update({
        where: { id: caja.id },
        data: {
          ordenesHabilitadasAt: new Date(),
          ordenesHabilitadasPorNombre: admin.nombre,
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CajaNoDisponibleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Error al mostrar las órdenes:", error);
    return NextResponse.json(
      { error: "Error al mostrar las órdenes" },
      { status: 500 },
    );
  }
}
