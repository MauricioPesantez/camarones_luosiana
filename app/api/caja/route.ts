import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { CAJA_SELECT, serializarCaja } from "@/lib/caja";
import {
  validarAperturaCaja,
  validarCierreCaja,
} from "@/lib/caja-validaciones";
import { obtenerDatosCuadre } from "@/lib/cuadre-server";
import { prisma } from "@/lib/db";
import { obtenerFechaEcuador, obtenerRangoEcuador } from "@/lib/fecha-ecuador";
import { getAuthenticatedUser } from "@/lib/session";
import {
  ESTADO_CAJA_ABIERTA,
  ESTADO_CAJA_CERRADA,
  ROL_ABRE_CAJA,
  ROL_CIERRA_CAJA,
} from "@/types/caja";
import { calcularResumenCuadre } from "@/types/cuadre";

class CierreCajaConflictError extends Error {
  constructor(
    message: string,
    readonly detalle: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function GET(request: Request) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
    }

    const hoy = obtenerFechaEcuador();
    const fecha = new URL(request.url).searchParams.get("fecha") ?? hoy;
    if (!obtenerRangoEcuador(fecha)) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    if (usuario.rol !== ROL_CIERRA_CAJA && fecha !== hoy) {
      return NextResponse.json(
        { error: "Solo un administrador puede consultar cajas históricas" },
        { status: 403 },
      );
    }

    const caja = await prisma.sesionCaja.findUnique({
      where: { fecha },
      select: CAJA_SELECT,
    });
    return NextResponse.json({ fecha, caja: caja ? serializarCaja(caja) : null });
  } catch (error) {
    console.error("Error al obtener la caja:", error);
    return NextResponse.json(
      { error: "Error al obtener la caja" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
    }
    if (usuario.rol !== ROL_ABRE_CAJA) {
      return NextResponse.json(
        { error: "Solo un mesero puede iniciar la caja" },
        { status: 403 },
      );
    }

    const validacion = validarAperturaCaja(await request.json());
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const fecha = obtenerFechaEcuador();
    const existente = await prisma.sesionCaja.findUnique({
      where: { fecha },
      select: CAJA_SELECT,
    });
    if (existente) {
      return NextResponse.json(
        {
          error:
            existente.estado === ESTADO_CAJA_CERRADA
              ? "La caja de hoy ya fue cerrada"
              : "La caja de hoy ya fue iniciada",
          caja: serializarCaja(existente),
        },
        { status: 409 },
      );
    }

    try {
      const caja = await prisma.sesionCaja.create({
        data: {
          fecha,
          montoInicial: new Prisma.Decimal(
            validacion.data.montoInicial.toFixed(2),
          ),
          abiertaPorId: usuario.id,
          abiertaPorNombre: usuario.nombre,
          abiertaPorRol: usuario.rol,
        },
        select: CAJA_SELECT,
      });
      return NextResponse.json({ caja: serializarCaja(caja) }, { status: 201 });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const caja = await prisma.sesionCaja.findUnique({
          where: { fecha },
          select: CAJA_SELECT,
        });
        return NextResponse.json(
          {
            error: "La caja de hoy fue iniciada al mismo tiempo",
            caja: caja ? serializarCaja(caja) : null,
          },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Error al iniciar la caja:", error);
    return NextResponse.json(
      { error: "Error al iniciar la caja" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
    }
    if (usuario.rol !== ROL_CIERRA_CAJA) {
      return NextResponse.json(
        { error: "Solo un administrador puede cerrar la caja" },
        { status: 403 },
      );
    }

    const validacion = validarCierreCaja(await request.json());
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }
    if (!obtenerRangoEcuador(validacion.data.fecha)) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const cajaCerrada = await prisma.$transaction(async (tx) => {
      // Mismo candado usado por cobros y retiros. Al obtenerlo, todos los
      // movimientos iniciados terminaron y ninguno nuevo puede entrar.
      const filas = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "SesionCaja"
        WHERE "fecha" = ${validacion.data.fecha}
        FOR UPDATE
      `;
      if (!filas[0]) {
        throw new CierreCajaConflictError(
          "La caja de esa fecha no fue iniciada",
        );
      }

      const datos = await obtenerDatosCuadre(validacion.data.fecha, tx);
      const caja = datos?.caja;
      if (!datos || !caja) {
        throw new CierreCajaConflictError(
          "La caja de esa fecha no fue iniciada",
        );
      }
      if (caja.estado !== ESTADO_CAJA_ABIERTA) {
        throw new CierreCajaConflictError(
          "La caja de esa fecha ya fue cerrada",
          { caja },
        );
      }

      const resumen = calcularResumenCuadre(
        datos.ordenes.map((orden) => ({
          ...orden,
          total: Number(orden.total),
          costoEnvio:
            orden.costoEnvio === null ? null : Number(orden.costoEnvio),
          montoPagado: Number(orden.montoPagado),
        })),
        datos.retiros,
        caja.montoInicial,
      );
      if (resumen.ordenesConSaldoPendiente > 0) {
        throw new CierreCajaConflictError(
          "No se puede cerrar: existen órdenes con pagos parciales y saldo pendiente",
          {
            ordenesConSaldoPendiente: resumen.ordenesConSaldoPendiente,
            montoSaldoPendiente: resumen.montoSaldoPendiente,
          },
        );
      }

      const montoEsperado = resumen.efectivoEnCaja;
      const diferencia =
        Math.round((validacion.data.montoCierre - montoEsperado) * 100) / 100;
      const cerrada = await tx.sesionCaja.update({
        where: { id: caja.id },
        data: {
          estado: ESTADO_CAJA_CERRADA,
          montoEsperadoCierre: new Prisma.Decimal(montoEsperado.toFixed(2)),
          montoCierre: new Prisma.Decimal(
            validacion.data.montoCierre.toFixed(2),
          ),
          diferenciaCierre: new Prisma.Decimal(diferencia.toFixed(2)),
          cerradaPorId: usuario.id,
          cerradaPorNombre: usuario.nombre,
          cerradaAt: new Date(),
        },
        select: CAJA_SELECT,
      });
      return serializarCaja(cerrada);
    });

    return NextResponse.json({ caja: cajaCerrada });
  } catch (error) {
    if (error instanceof CierreCajaConflictError) {
      return NextResponse.json(
        { error: error.message, ...error.detalle },
        { status: 409 },
      );
    }
    console.error("Error al cerrar la caja:", error);
    return NextResponse.json(
      { error: "Error al cerrar la caja" },
      { status: 500 },
    );
  }
}
