import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { usuarioId, password } = body;

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!usuario) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Verificar contraseña (comparación simple, en producción usar bcrypt)
    if (usuario.password === password) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error al autenticar' }, { status: 500 });
  }
}
