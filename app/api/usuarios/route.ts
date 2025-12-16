import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    console.log('[API /usuarios] Intentando conectar a la base de datos...');
    console.log('[API /usuarios] DATABASE_URL exists:', !!process.env.DATABASE_URL);

    const usuarios = await prisma.usuario.findMany({
      where: {
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
      },
      orderBy: { nombre: 'asc' },
    });

    console.log('[API /usuarios] Usuarios activos encontrados:', usuarios.length);
    return NextResponse.json(usuarios);
  } catch (error) {
    console.error('[API /usuarios] Error completo:', error);
    console.error('[API /usuarios] Error message:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json({
      error: 'Error al obtener usuarios',
      details: error instanceof Error ? error.message : 'Unknown error',
      hasDbUrl: !!process.env.DATABASE_URL
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const usuario = await prisma.usuario.create({
      data: {
        nombre: body.nombre,
        rol: body.rol,
        activo: body.activo ?? true,
      },
    });
    return NextResponse.json(usuario);
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
