import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizarNombre, validarUsuarioParcial } from '@/lib/admin-validaciones';
import { aUsuarioAdmin } from '@/types/usuario';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        password: true, // Solo para verificar si tiene contraseña
      },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // No devolver la contraseña real, solo indicar si la tiene
    return NextResponse.json({
      ...usuario,
      password: usuario.password ? true : false,
    });
  } catch (error) {
    console.error('Error en /api/usuarios/[id]:', error);
    return NextResponse.json({
      error: 'Error al obtener usuario',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validacion = validarUsuarioParcial(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;
    const usuario = await prisma.usuario.findUnique({ where: { id } });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (datos.nombre) {
      const nombreBuscado = normalizarNombre(datos.nombre);
      const existentes = await prisma.usuario.findMany({
        where: { id: { not: id }, activo: true },
        select: { nombre: true },
      });
      const duplicado = existentes.find(
        (otro) => normalizarNombre(otro.nombre) === nombreBuscado,
      );

      if (duplicado) {
        return NextResponse.json(
          { error: `Ya existe un usuario activo llamado "${duplicado.nombre}"` },
          { status: 409 }
        );
      }
    }

    const actualizado = await prisma.usuario.update({ where: { id }, data: datos });
    return NextResponse.json(aUsuarioAdmin(actualizado));
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}
