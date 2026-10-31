import { NextResponse } from "next/server";
import { obtenerDatosCuadre } from "@/lib/cuadre-server";
import { getAuthenticatedUser } from "@/lib/session";

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

    return NextResponse.json(datos);
  } catch (error) {
    console.error("Error en cuadre:", error);
    return NextResponse.json(
      { error: "Error al obtener cuadre" },
      { status: 500 },
    );
  }
}
