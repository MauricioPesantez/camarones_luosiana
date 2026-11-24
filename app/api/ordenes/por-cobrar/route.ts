import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/session";
import { leerCursor, listarPorCobrar } from "@/lib/ordenes-por-cobrar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const usuario = await getAuthenticatedUser();
  if (!usuario)
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (usuario.rol !== "mesero")
    return NextResponse.json(
      { error: "Solo el mesero consulta esta lista" },
      { status: 403 },
    );
  let cursor;
  try {
    cursor = leerCursor(new URL(request.url).searchParams.get("cursor"));
  } catch {
    return NextResponse.json({ error: "Cursor inválido" }, { status: 400 });
  }
  try {
    return NextResponse.json(await listarPorCobrar(usuario, cursor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error al consultar órdenes por cobrar:", error);
    return NextResponse.json(
      { error: "No se pudieron consultar las órdenes por cobrar" },
      { status: 500 },
    );
  }
}
