import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
