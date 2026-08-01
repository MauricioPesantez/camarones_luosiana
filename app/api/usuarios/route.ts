import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizarNombre, validarUsuarioNuevo } from '@/lib/admin-validaciones';
import { aUsuarioAdmin } from '@/types/usuario';

export async function GET(request: Request) {
  try {
    const vistaAdmin = new URL(request.url).searchParams.get('vista') === 'admin';

    // Sin ?vista=admin la forma es la de siempre: la consume la pantalla de login.
    if (!vistaAdmin) {
      const usuarios = await prisma.usuario.findMany({
        where: { activo: true },
        select: {
          id: true,
          nombre: true,
          rol: true,
          activo: true,
        },
        orderBy: { nombre: 'asc' },
      });
      return NextResponse.json(usuarios);
    }

    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        password: true,
      },
      orderBy: { nombre: 'asc' },
    });

    // La clave nunca sale de aqui: solo si existe o no.
    return NextResponse.json(usuarios.map(aUsuarioAdmin));
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener usuarios',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const validacion = validarUsuarioNuevo(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;
    // Ignora tildes ademas de mayusculas: "JUAN PEREZ" y "Juan Perez" son la
    // misma persona en la pantalla de login.
    const nombreBuscado = normalizarNombre(datos.nombre);
    const existentes = await prisma.usuario.findMany({
      where: { activo: true },
      select: { nombre: true },
    });
    const duplicado = existentes.find(
      (otro) => normalizarNombre(otro.nombre) === nombreBuscado,
    );

    if (duplicado) {
      return NextResponse.json(
        { error: `Ya existe un usuario activo llamado "${duplicado.nombre}"` },
        { status: 409 },
      );
    }

    const usuario = await prisma.usuario.create({ data: datos });
    return NextResponse.json(aUsuarioAdmin(usuario), { status: 201 });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
