import { createHmac, timingSafeEqual } from 'node:crypto';

/** Texto y ubicación; el motor con navegador puede incluir la miniatura de un pin. */
export const MAX_CUERPO_WEBHOOK = 256 * 1024;
const MIN_SECRETO = 32;

export interface ConfiguracionWhatsapp {
  secreto: string;
  sessionId: string;
  operadores: Set<string>;
  usuarioOperadorId: string;
  grupoChatId: string;
  motosChatId: string;
  habilitado: boolean;
}

export interface MensajeEntrante {
  tipo: 'PEDIDO' | 'UBICACION';
  sessionId: string;
  messageId: string;
  claveEntrega: string | null;
  remitente: string;
  chatId: string;
  enviadoAt: Date;
  texto: string | null;
  location: unknown;
}

export type Clasificacion =
  | { relevante: true; mensaje: MensajeEntrante }
  | { relevante: false; malformado?: boolean };

export function leerConfiguracion(
  entorno: Record<string, string | undefined>,
): ConfiguracionWhatsapp | null {
  const secreto = entorno.WHATSAPP_WEBHOOK_SECRET?.trim() ?? '';
  const sessionId = entorno.WHATSAPP_SESSION_ID?.trim() ?? '';
  const usuarioOperadorId = entorno.WHATSAPP_OPERATOR_USER_ID?.trim() ?? '';
  const grupoChatId = entorno.WHATSAPP_GROUP_CHAT_ID?.trim() ?? '';
  const motosChatId = entorno.WHATSAPP_MOTOS_CHAT_ID?.trim() ?? '';
  const operadores = new Set(
    (entorno.WHATSAPP_OPERATOR_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean),
  );
  if (
    secreto.length < MIN_SECRETO ||
    !sessionId ||
    !usuarioOperadorId ||
    !grupoChatId ||
    !motosChatId ||
    operadores.size === 0
  ) {
    return null;
  }
  return {
    secreto,
    sessionId,
    operadores,
    usuarioOperadorId,
    grupoChatId,
    motosChatId,
    habilitado: entorno.WHATSAPP_ENABLED === 'true',
  };
}

/** Compara contra los bytes recibidos: reserializar el JSON cambiaría la firma. */
export function firmaValida(cuerpo: Buffer, encabezado: string | null, secreto: string): boolean {
  const esperada = Buffer.from(`sha256=${createHmac('sha256', secreto).update(cuerpo).digest('hex')}`);
  const recibida = Buffer.from(encabezado ?? '');
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

/** Devuelve el cuerpo o `null` si excede el límite, sin leer el resto. */
export async function leerCuerpoLimitado(request: Request, maximo: number): Promise<Buffer | null> {
  if (Number(request.headers.get('content-length') ?? 0) > maximo) return null;

  const partes: Uint8Array[] = [];
  let bytes = 0;
  const lector = request.body?.getReader();
  while (lector) {
    const { done, value } = await lector.read();
    if (done) break;
    bytes += value.length;
    if (bytes > maximo) {
      await lector.cancel();
      return null;
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

export function marcaDeTiempoMs(valor: number): number {
  return valor < 1e11 ? valor * 1000 : valor;
}

export function leerCoordenadas(valor: unknown): { latitud: number; longitud: number } | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const { latitude: latitud, longitude: longitud } = valor as Record<string, unknown>;
  if (typeof latitud !== 'number' || typeof longitud !== 'number') return null;
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  // Baileys entrega 0 cuando falta una coordenada.
  if (latitud === 0 || longitud === 0) return null;
  if (Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null;
  return { latitud, longitud };
}

const textoNoVacio = (valor: unknown): valor is string => typeof valor === 'string' && valor.length > 0;

/** Valida el sobre de OpenWA 0.27.1 y decide si el mensaje le interesa al POS. */
export function clasificarMensaje(evento: unknown, config: ConfiguracionWhatsapp): Clasificacion {
  if (typeof evento !== 'object' || evento === null) return { relevante: false, malformado: true };
  const { event, sessionId, idempotencyKey, data } = evento as Record<string, unknown>;
  if (!textoNoVacio(event) || !textoNoVacio(sessionId) || typeof data !== 'object' || data === null) {
    return { relevante: false, malformado: true };
  }
  if (event !== 'message.received' || sessionId !== config.sessionId) return { relevante: false };

  const mensaje = data as Record<string, unknown>;
  const { id, from, chatId, type, timestamp, fromMe, body } = mensaje;
  if (
    !textoNoVacio(id) ||
    !textoNoVacio(from) ||
    !textoNoVacio(chatId) ||
    !textoNoVacio(type) ||
    typeof timestamp !== 'number' ||
    !(timestamp > 0) ||
    typeof fromMe !== 'boolean' ||
    (type === 'text' && typeof body !== 'string')
  ) {
    return { relevante: false, malformado: true };
  }

  if (fromMe || mensaje.isGroup || mensaje.isStatusBroadcast || chatId.endsWith('@g.us')) {
    return { relevante: false };
  }
  // Comparación exacta: un ID `@lid` no contiene un teléfono que se pueda deducir.
  if (!config.operadores.has(from)) return { relevante: false };

  const base = {
    sessionId,
    messageId: id,
    claveEntrega: textoNoVacio(idempotencyKey) ? idempotencyKey : null,
    remitente: from,
    chatId,
    enviadoAt: new Date(marcaDeTiempoMs(timestamp)),
  };
  // En su chat privado con el ejecutor, todo texto del operador se interpreta como pedido.
  if (type === 'text' && (body as string).trim()) {
    return {
      relevante: true,
      mensaje: { ...base, tipo: 'PEDIDO', texto: body as string, location: mensaje.location },
    };
  }
  if (type === 'location') {
    return {
      relevante: true,
      mensaje: { ...base, tipo: 'UBICACION', texto: null, location: mensaje.location },
    };
  }
  return { relevante: false };
}
