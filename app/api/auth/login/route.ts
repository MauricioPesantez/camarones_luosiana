import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { attachSessionCookie, createSession } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { usuarioId, password } = body;

    const usuario = await prisma.usuario.findFirst({
      where: { id: usuarioId, activo: true },
    });

    if (!usuario) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Compatibilidad con las claves actuales. Su migracion a hash debe hacerse en
    // un cambio dedicado para no bloquear a los usuarios existentes.
    if (usuario.password && usuario.password !== password) {
      return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const session = await createSession(usuario.id);
    const response = NextResponse.json({
      success: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        activo: usuario.activo,
      },
    });
    attachSessionCookie(response, session);
    return response;
  } catch (error) {
    console.error('Error al autenticar:', error);
    return NextResponse.json({ success: false, error: 'Error al autenticar' }, { status: 500 });
  }
}
