export const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type MimeComprobante = (typeof MIME_PERMITIDOS)[number];

export const MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024;

const EXTENSION_POR_MIME: Record<MimeComprobante, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// La key la arma siempre el servidor: prefijo fijo, id de la orden y un uuid.
// El patron es deliberadamente estricto para que nada con `..`, barras extra o
// una extension ajena pueda colarse.
const KEY_PATTERN =
  /^cobros\/([a-z0-9]{20,32})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export type ResultadoValidacion =
  | { ok: true; mime: MimeComprobante }
  | { ok: false; codigo: 'mime' | 'tamano' | 'contenido' };

export function esMimeComprobante(value: string): value is MimeComprobante {
  return (MIME_PERMITIDOS as readonly string[]).includes(value);
}

export function buildComprobanteKey(
  ordenId: string,
  mime: MimeComprobante,
  uuid: string,
): string {
  return `cobros/${ordenId}/${uuid}.${EXTENSION_POR_MIME[mime]}`;
}

export function parseComprobanteKey(key: string): { ordenId: string } | null {
  const match = KEY_PATTERN.exec(key);
  return match ? { ordenId: match[1] } : null;
}

// Los primeros bytes tienen que corresponder al MIME declarado: un
// `Content-Type` lo elige quien sube, la firma del archivo no.
function firmaCoincide(mime: MimeComprobante, bytes: Uint8Array): boolean {
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === 'image/png') {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= 8 && png.every((byte, i) => bytes[i] === byte);
  }
  // WebP: "RIFF" en 0..3 y "WEBP" en 8..11.
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  return (
    bytes.length >= 12 &&
    riff.every((byte, i) => bytes[i] === byte) &&
    webp.every((byte, i) => bytes[8 + i] === byte)
  );
}

export function validarComprobante(input: {
  mime: string;
  size: number;
  magicBytes: Uint8Array;
}): ResultadoValidacion {
  // El navegador puede mandar `image/jpeg; charset=binary`.
  const mime = input.mime.split(';')[0].trim().toLowerCase();
  if (!esMimeComprobante(mime)) return { ok: false, codigo: 'mime' };
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_COMPROBANTE_BYTES) {
    return { ok: false, codigo: 'tamano' };
  }
  if (!firmaCoincide(mime, input.magicBytes)) {
    return { ok: false, codigo: 'contenido' };
  }
  return { ok: true, mime };
}
