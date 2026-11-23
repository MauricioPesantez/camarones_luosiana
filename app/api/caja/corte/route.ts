import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  bloquearCajaAbierta,
  CajaNoDisponibleError,
  obtenerCajaDeHoy,
} from "@/lib/caja";
import { calcularCorteTurno, validarCorteTurno } from "@/lib/caja-validaciones";
import { obtenerDatosCuadre, resumirDatosCuadre } from "@/lib/cuadre-server";
import { prisma } from "@/lib/db";
import { obtenerFechaEcuador } from "@/lib/fecha-ecuador";
import { getAuthenticatedUser } from "@/lib/session";
import { ROL_ABRE_CAJA, ultimoCorteVigente } from "@/types/caja";
import { ESTADO_RETIRO_REGISTRADO } from "@/types/retiro";

class CorteConflictoError extends Error {}

/**
 * Salidas de todos los meseros desde el último corte, para revisarlas antes de
 * contar. Sin motivo ni beneficiario: un adelanto es asunto de quien lo recibe.
 */
export async function GET() {
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
    const caja = await obtenerCajaDeHoy();
    if (!caja) {
      return NextResponse.json(
        { error: "La caja de hoy no ha sido iniciada" },
        { status: 409 },
      );
    }
    const salidas = await prisma.retiroCaja.findMany({
      where: {
        estado: ESTADO_RETIRO_REGISTRADO,
        createdAt: {
          gt: ultimoCorteVigente(caja.cortes)?.createdAt ?? caja.abiertaAt,
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        categoria: true,
        monto: true,
        usuarioNombre: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      salidas: salidas.map((salida) => ({
        ...salida,
        monto: Number(salida.monto),
        createdAt: salida.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error al obtener las salidas del turno:", error);
    return NextResponse.json(
      { error: "Error al obtener las salidas del turno" },
      { status: 500 },
    );
  }
}

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

    const corte = await prisma.$transaction(async (tx) => {
      // Mismo candado que cobros y retiros: el esperado ve todo lo ya registrado.
      await bloquearCajaAbierta(tx);
      const datos = await obtenerDatosCuadre(fecha, tx);
      const caja = datos?.caja;
      if (!datos || !caja) {
        throw new CajaNoDisponibleError("La caja de hoy no ha sido iniciada");
      }
      const cortes = await tx.corteTurno.findMany({
        where: { sesionCajaId: caja.id },
        orderBy: { numero: "asc" },
        select: {
          numero: true,
          montoContado: true,
          esperadoDia: true,
          usuarioId: true,
          anuladoAt: true,
        },
      });
      const anterior = ultimoCorteVigente(cortes);
      // Antes que el numero: un doble clic no debe culpar a otro mesero.
      if (anterior?.usuarioId === usuario.id) {
        throw new CorteConflictoError(
          "Ya entregaste tu turno. Si hay un error, pide al administrador que anule el conteo.",
        );
      }
      // Quien vio las órdenes puede sumar el esperado: ya no habría conteo a ciegas.
      if (caja.ordenesHabilitadasAt) {
        throw new CorteConflictoError(
          "El administrador ya mostró las órdenes del día. No se puede entregar otro conteo.",
        );
      }
      if (numero !== (cortes.at(-1)?.numero ?? 0) + 1) {
        throw new CorteConflictoError(
          "Otro mesero ya hizo un corte. Recarga la caja e intenta nuevamente.",
        );
      }

      const resumen = resumirDatosCuadre(datos);
      const calculo = calcularCorteTurno({
        montoInicial: caja.montoInicial,
        esperadoDia: resumen.efectivoEnCaja,
        anterior: anterior
          ? {
              montoContado: Number(anterior.montoContado),
              esperadoDia: Number(anterior.esperadoDia),
            }
          : null,
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
        select: { numero: true, createdAt: true },
      });
      // Conteo a ciegas: ni el esperado ni la diferencia salen del servidor.
      return {
        numero: corte.numero,
        montoContado,
        createdAt: corte.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ corte }, { status: 201 });
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
