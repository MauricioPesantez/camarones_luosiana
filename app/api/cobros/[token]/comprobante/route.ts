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

// Margen que cubre la envoltura multipart (boundary y encabezados de cada
// parte), que suma unos cientos de bytes por encima del archivo real.
const MARGEN_MULTIPART_BYTES = 64 * 1024;
const LIMITE_CUERPO_BYTES = MAX_COMPROBANTE_BYTES + MARGEN_MULTIPART_BYTES;

type LecturaCuerpo = { ok: true; buffer: Buffer } | { ok: false };

// El content-length declarado no alcanza para hacer cumplir el limite: falta
// con chunked transfer-encoding (queda en 0) y un valor mal formado da NaN.
// Por eso el limite real se aplica contra los bytes que efectivamente llegan,
// cortando apenas se supera sin esperar a que el cuerpo termine de recibirse.
async function leerCuerpoAcotado(
  request: Request,
  limiteBytes: number,
): Promise<LecturaCuerpo> {
  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: true, buffer: Buffer.alloc(0) };
  }
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limiteBytes) {
        // Se cancela el reader para no dejar la conexion drenando un cuerpo
        // que ya se sabe que va a ser rechazado.
        await reader.cancel();
        return { ok: false };
      }
      partes.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return { ok: true, buffer: Buffer.concat(partes, total) };
}

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

    // Camino barato: si el cliente ya declara un cuerpo mas grande que el
    // limite, se rechaza sin leer nada. No reemplaza el conteo real (ver
    // leerCuerpoAcotado): es solo para no gastar ni un byte de lectura en una
    // subida obviamente demasiado grande.
    const declarado = Number(request.headers.get('content-length') ?? 0);
    if (declarado > LIMITE_CUERPO_BYTES) {
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

    const cuerpo = await leerCuerpoAcotado(request, LIMITE_CUERPO_BYTES);
    if (!cuerpo.ok) {
      return NextResponse.json(
        { error: MENSAJE_POR_CODIGO.tamano },
        { status: 413 },
      );
    }

    let form: FormData;
    try {
      // El stream original ya se consumio para acotar el tamano; se arma un
      // Response con esos mismos bytes y el content-type original para poder
      // parsear el multipart sin volver a leer de la red.
      form = await new Response(new Uint8Array(cuerpo.buffer), {
        headers: { 'content-type': request.headers.get('content-type') ?? '' },
      }).formData();
    } catch (error) {
      // Un cuerpo multipart mal formado es un error del cliente, no una falla
      // de guardado: no se debe reportar como 502.
      console.error('Cuerpo multipart invalido en la subida del comprobante:', error);
      return NextResponse.json(
        { error: 'La solicitud no tiene un formato válido' },
        { status: 400 },
      );
    }

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

    try {
      await putObject(objectKey, buffer, validacion.mime);
    } catch (error) {
      // Solo una falla real del backend de storage es un 502: los errores de
      // autenticacion, de rol o del cuerpo de la solicitud ya se resolvieron
      // antes de llegar aqui.
      console.error('Error al guardar el comprobante en el storage:', error);
      return NextResponse.json(
        { error: 'No se pudo guardar el comprobante' },
        { status: 502 },
      );
    }

    return NextResponse.json({ objectKey });
  } catch (error) {
    console.error('Error inesperado al subir el comprobante:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error inesperado' },
      { status: 500 },
    );
  }
}
