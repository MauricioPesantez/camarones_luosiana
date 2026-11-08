import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { bloquearCajaAbierta, CajaNoDisponibleError } from "@/lib/caja";
import { calcularCorteTurno, validarCorteTurno } from "@/lib/caja-validaciones";
import { obtenerDatosCuadre, resumirDatosCuadre } from "@/lib/cuadre-server";
import { prisma } from "@/lib/db";
import { obtenerFechaEcuador } from "@/lib/fecha-ecuador";
import { getAuthenticatedUser } from "@/lib/session";
import { ROL_ABRE_CAJA } from "@/types/caja";

class CorteConflictoError extends Error {}

/** Relevo de turno: el mesero que sale cuenta la caja compartida a ciegas. */
export async function POST(request: Request) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
    }
    if (usuario.rol !== ROL_ABRE_CAJA) {
      return NextResponse.json(
        { error: "Solo un mesero puede hacer el corte de turno" },
        { status: 403 },
      );
    }

    const validacion = validarCorteTurno(await request.json());
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }
    const { numero, montoContado } = validacion.data;
    const fecha = obtenerFechaEcuador();

    const resultado = await prisma.$transaction(async (tx) => {
      // Mismo candado que cobros y retiros: el esperado ve todo lo ya registrado.
      await bloquearCajaAbierta(tx);
      const datos = await obtenerDatosCuadre(fecha, tx);
      const caja = datos?.caja;
      if (!datos || !caja) {
        throw new CajaNoDisponibleError("La caja de hoy no ha sido iniciada");
      }
      const anterior = await tx.corteTurno.findFirst({
        where: { sesionCajaId: caja.id },
        orderBy: { numero: "desc" },
        select: { numero: true, montoContado: true, esperadoDia: true },
      });
      if (numero !== (anterior?.numero ?? 0) + 1) {
        throw new CorteConflictoError(
          "Otro mesero ya hizo un corte. Recarga la caja e intenta nuevamente.",
        );
      }

      const resumen = resumirDatosCuadre(datos);
      const calculo = calcularCorteTurno({
        montoInicial: caja.montoInicial,
        esperadoDia: resumen.efectivoEnCaja,
        anterior: anterior && {
          montoContado: Number(anterior.montoContado),
          esperadoDia: Number(anterior.esperadoDia),
        },
        montoContado,
      });
      const decimal = (valor: number) => new Prisma.Decimal(valor.toFixed(2));
      const corte = await tx.corteTurno.create({
        data: {
          sesionCajaId: caja.id,
          numero,
          fondoInicial: decimal(calculo.fondoInicial),
          esperadoDia: decimal(resumen.efectivoEnCaja),
          montoEsperado: decimal(calculo.montoEsperado),
          montoContado: decimal(montoContado),
          diferencia: decimal(calculo.diferencia),
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          usuarioRol: usuario.rol,
        },
        select: { id: true, numero: true, usuarioNombre: true, createdAt: true },
      });
      return {
        corte: {
          ...corte,
          ...calculo,
          montoContado,
          createdAt: corte.createdAt.toISOString(),
        },
        // Orden a domicilio con pago parcial: su efectivo se reconoce al cerrarla,
        // asi que puede descuadrar este turno y el siguiente en sentido opuesto.
        ordenesConSaldoPendiente: resumen.ordenesConSaldoPendiente,
      };
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    if (error instanceof CajaNoDisponibleError || error instanceof CorteConflictoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Otro mesero ya hizo un corte. Recarga la caja e intenta nuevamente." },
        { status: 409 },
      );
    }
    console.error("Error al hacer el corte de turno:", error);
    return NextResponse.json(
      { error: "Error al hacer el corte de turno" },
      { status: 500 },
    );
  }
}
