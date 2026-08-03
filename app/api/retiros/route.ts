import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { obtenerRangoEcuador } from '@/lib/fecha-ecuador';
import { RETIRO_SELECT, serializarRetiro } from '@/lib/retiros';
import { validarRetiroNuevo } from '@/lib/retiros-validaciones';
import { getAuthenticatedUser } from '@/lib/session';
import { CATEGORIA_ADELANTO, ROL_REGISTRA_RETIRO } from '@/types/retiro';

export async function GET(request: Request) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');

    if (!fecha) {
      return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 });
    }

    const rango = obtenerRangoEcuador(fecha);
    if (!rango) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
    }

    // Solo el admin ve los retiros de todos; el resto ve unicamente los suyos.
    const retiros = await prisma.retiroCaja.findMany({
      where: {
        createdAt: { gte: rango.inicio, lt: rango.fin },
        ...(usuario.rol === 'admin' ? {} : { usuarioId: usuario.id }),
      },
      select: RETIRO_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      fecha,
      retiros: retiros.map(serializarRetiro),
    });
  } catch (error) {
    console.error('Error al obtener retiros:', error);
    return NextResponse.json(
      { error: 'Error al obtener los retiros' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    // La autoria sale de la sesion firmada, no del cuerpo: nadie puede registrar
    // una salida de dinero a nombre de otro.
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }

    const validacion = validarRetiroNuevo(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;

    if (usuario.rol !== ROL_REGISTRA_RETIRO) {
      return NextResponse.json(
        { error: 'Solo un mesero puede registrar un retiro de caja' },
        { status: 403 },
      );
    }

    let beneficiario: { id: string; nombre: string } | null = null;

    if (datos.categoria === CATEGORIA_ADELANTO && datos.beneficiarioId) {
      beneficiario = await prisma.usuario.findFirst({
        where: { id: datos.beneficiarioId, activo: true },
        select: { id: true, nombre: true },
      });

      if (!beneficiario) {
        return NextResponse.json(
          { error: 'El beneficiario del adelanto no existe o está inactivo' },
          { status: 400 },
        );
      }
    }

    try {
      const retiro = await prisma.retiroCaja.create({
        data: {
          monto: new Prisma.Decimal(datos.monto.toFixed(2)),
          categoria: datos.categoria,
          motivo: datos.motivo,
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          usuarioRol: usuario.rol,
          beneficiarioId: beneficiario?.id ?? null,
          beneficiarioNombre: beneficiario?.nombre ?? null,
          clientRequestId: datos.clientRequestId,
        },
        select: RETIRO_SELECT,
      });

      return NextResponse.json(serializarRetiro(retiro), { status: 201 });
    } catch (error) {
      // Reintento o doble clic del mismo envio: se devuelve el retiro que ya
      // quedo registrado en vez de sacar el dinero dos veces.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existente = await prisma.retiroCaja.findUnique({
          where: { clientRequestId: datos.clientRequestId },
          select: RETIRO_SELECT,
        });

        if (existente) {
          return NextResponse.json(serializarRetiro(existente));
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error al registrar el retiro:', error);
    return NextResponse.json(
      { error: 'Error al registrar el retiro' },
      { status: 500 },
    );
  }
}
