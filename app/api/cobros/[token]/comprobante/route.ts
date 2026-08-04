import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  MAX_COMPROBANTE_BYTES,
  buildComprobanteKey,
  validarComprobante,
} from '@/lib/comprobantes';
import { prisma } from '@/lib/db';
import { hashPaymentToken } from '@/lib/payment-link';
import { canCollectPayments, getAuthenticatedUser } from '@/lib/session';
import { putObject, storageConfigurado } from '@/lib/storage';

const MENSAJE_POR_CODIGO = {
  mime: 'El archivo no es una imagen válida',
  contenido: 'El archivo no es una imagen válida',
  tamano: 'La foto es muy pesada, repítela',
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (!canCollectPayments(usuario)) {
      return NextResponse.json({ error: 'Rol no autorizado para cobrar' }, { status: 403 });
    }
    if (!storageConfigurado()) {
      return NextResponse.json(
        { error: 'El almacenamiento de comprobantes no está configurado' },
        { status: 503 },
      );
    }

    // Corte barato antes de leer el cuerpo entero en memoria. El margen cubre la
    // envoltura multipart, que suma unos cientos de bytes al archivo.
    const declarado = Number(request.headers.get('content-length') ?? 0);
    if (declarado > MAX_COMPROBANTE_BYTES + 64 * 1024) {
      return NextResponse.json(
        { error: MENSAJE_POR_CODIGO.tamano },
        { status: 413 },
      );
    }

    const { token } = await params;
    const orden = await prisma.orden.findUnique({
      where: { cobroTokenHash: hashPaymentToken(token) },
      select: { id: true, cobrada: true },
    });
    // Igual que en el cobro: el token se resuelve despues de autenticar, para no
    // filtrar si es valido.
    if (!orden) {
      return NextResponse.json({ error: 'Enlace de cobro no válido' }, { status: 404 });
    }
    if (orden.cobrada) {
      return NextResponse.json({ error: 'Esta orden ya fue cobrada' }, { status: 409 });
    }

    const form = await request.formData();
    const archivo = form.get('archivo');
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const validacion = validarComprobante({
      mime: archivo.type,
      size: buffer.byteLength,
      magicBytes: buffer.subarray(0, 12),
    });
    if (!validacion.ok) {
      return NextResponse.json(
        { error: MENSAJE_POR_CODIGO[validacion.codigo] },
        { status: validacion.codigo === 'tamano' ? 413 : 400 },
      );
    }

    // La key la arma el servidor a partir de la orden resuelta por el token: el
    // cliente nunca elige donde se escribe.
    const objectKey = buildComprobanteKey(orden.id, validacion.mime, randomUUID());
    await putObject(objectKey, buffer, validacion.mime);

    return NextResponse.json({ objectKey });
  } catch (error) {
    console.error('Error al subir el comprobante:', error);
    return NextResponse.json(
      { error: 'No se pudo guardar el comprobante' },
      { status: 502 },
    );
  }
}
