import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

export const SESSION_COOKIE = 'restaurant_pos_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export interface AuthenticatedUser {
  id: string;
  nombre: string;
  rol: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(usuarioId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.$transaction([
    prisma.sesionUsuario.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    }),
    prisma.sesionUsuario.create({
      data: {
        tokenHash: hashToken(token),
        usuarioId,
        expiresAt,
      },
    }),
  ]);

  return { token, expiresAt };
}

export function attachSessionCookie(
  response: NextResponse,
  session: { token: string; expiresAt: Date },
): void {
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: session.expiresAt,
  });
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.sesionUsuario.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      usuario: {
        select: { id: true, nombre: true, rol: true, activo: true },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || !session.usuario.activo) {
    if (session) {
      await prisma.sesionUsuario.delete({ where: { id: session.id } });
    }
    return null;
  }

  // Es solo telemetria de uso; no se extiende la duracion absoluta del turno.
  void prisma.sesionUsuario.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => undefined);

  return {
    id: session.usuario.id,
    nombre: session.usuario.nombre,
    rol: session.usuario.rol,
  };
}

export async function destroyCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  await prisma.sesionUsuario.deleteMany({
    where: { tokenHash: hashToken(token) },
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
}

export function canCollectPayments(user: AuthenticatedUser): boolean {
  return ['admin', 'mesero', 'digital'].includes(user.rol);
}

export function roleHome(rol: string): string {
  if (rol === 'admin') return '/admin';
  if (rol === 'mesero') return '/mesero';
  if (rol === 'digital') return '/digital';
  if (rol === 'cocina') return '/cocina';
  return '/login';
}

export function roleOrdersHome(rol: string, reason?: string): string {
  const suffix = reason ? `&cobro=${encodeURIComponent(reason)}` : '';
  if (rol === 'mesero') return `/mesero?vista=ordenes${suffix}`;
  if (rol === 'digital') return `/digital?vista=pedidos${suffix}`;
  if (rol === 'admin') return reason ? `/admin?cobro=${encodeURIComponent(reason)}` : '/admin';
  return roleHome(rol);
}
