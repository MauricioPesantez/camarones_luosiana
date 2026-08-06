import { NextResponse } from 'next/server';

import { parseComprobanteKey } from '@/lib/comprobantes';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { getSignedReadUrl, objectExists, storageConfigurado } from '@/lib/storage';

const TTL_SEGUNDOS = 120;

export async function GET(
  request: Request,
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
    const { searchParams } = new URL(request.url);
    const cobroId = searchParams.get('cobroId');

    let comprobanteKey: string | null;
    if (cobroId) {
      // Multipago: el key real vive en el pago, no en la orden.
      const cobro = await prisma.cobro.findUnique({
        where: { id: cobroId },
        select: { ordenId: true, comprobanteTransferenciaKey: true },
      });
      if (!cobro || cobro.ordenId !== id) {
        return NextResponse.json({ error: 'Comprobante inválido' }, { status: 404 });
      }
      comprobanteKey = cobro.comprobanteTransferenciaKey;
    } else {
      // Ordenes de antes de esta funcionalidad: un solo pago, key en la orden.
      const orden = await prisma.orden.findUnique({
        where: { id },
        select: { id: true, comprobanteTransferenciaKey: true },
      });
      comprobanteKey = orden?.comprobanteTransferenciaKey ?? null;
    }
    if (!comprobanteKey) {
      return NextResponse.json({ error: 'Esta orden no tiene comprobante' }, { status: 404 });
    }
    // Defensa en profundidad: aunque la key la escribio el servidor, se vuelve a
    // comprobar que pertenece a esta orden antes de firmar una lectura.
    const parsed = parseComprobanteKey(comprobanteKey);
    if (!parsed || parsed.ordenId !== id) {
      return NextResponse.json({ error: 'Comprobante inválido' }, { status: 404 });
    }

    // Presignar nunca contacta a S3, asi que siempre devolveria 200 aunque el
    // objeto ya no exista. El lifecycle de 30 dias borra el objeto pero no la
    // key en la base, asi que hay que verificar antes de firmar para no mandar
    // al admin a una pestaña con el XML crudo de NoSuchKey.
    if (!(await objectExists(comprobanteKey))) {
      return NextResponse.json(
        { error: 'El comprobante ya expiró (retención de 30 días)' },
        { status: 410 },
      );
    }

    const url = await getSignedReadUrl(comprobanteKey, TTL_SEGUNDOS);
    return NextResponse.json({ url, expiraEn: TTL_SEGUNDOS });
  } catch (error) {
    console.error('Error al firmar el comprobante:', error);
    return NextResponse.json({ error: 'No se pudo abrir el comprobante' }, { status: 502 });
  }
}
