import { NextResponse } from 'next/server';

import { parseComprobanteKey } from '@/lib/comprobantes';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { getSignedReadUrl, storageConfigurado } from '@/lib/storage';

const TTL_SEGUNDOS = 120;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (usuario.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }
    if (!storageConfigurado()) {
      return NextResponse.json(
        { error: 'El almacenamiento de comprobantes no está configurado' },
        { status: 503 },
      );
    }

    const { id } = await params;
    const orden = await prisma.orden.findUnique({
      where: { id },
      select: { id: true, comprobanteTransferenciaKey: true },
    });
    if (!orden?.comprobanteTransferenciaKey) {
      return NextResponse.json({ error: 'Esta orden no tiene comprobante' }, { status: 404 });
    }
    // Defensa en profundidad: aunque la key la escribio el servidor, se vuelve a
    // comprobar que pertenece a esta orden antes de firmar una lectura.
    const parsed = parseComprobanteKey(orden.comprobanteTransferenciaKey);
    if (!parsed || parsed.ordenId !== orden.id) {
      return NextResponse.json({ error: 'Comprobante inválido' }, { status: 404 });
    }

    const url = await getSignedReadUrl(orden.comprobanteTransferenciaKey, TTL_SEGUNDOS);
    return NextResponse.json({ url, expiraEn: TTL_SEGUNDOS });
  } catch (error) {
    console.error('Error al firmar el comprobante:', error);
    return NextResponse.json({ error: 'No se pudo abrir el comprobante' }, { status: 502 });
  }
}
