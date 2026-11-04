import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_BYTES = 2 * 1024 * 1024;

export function firmaValida(cuerpo, encabezado, secreto) {
  const esperada = Buffer.from(
    `sha256=${createHmac('sha256', secreto).update(cuerpo).digest('hex')}`,
  );
  const recibida = Buffer.from(String(encabezado ?? ''));
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

// shortcut: enmascara identidades y nombres, no el texto del mensaje; usar datos de prueba.
export function enmascarar(texto) {
  return texto
    .replace(/\d{7,}(?=@)/g, (n) => `${n.slice(0, 3)}***${n.slice(-2)}`)
    .replace(/"\+?\d{7,15}"/g, '"***"')
    .replace(/"(pushName|notifyName|senderName|shortName|name)"\s*:\s*"[^"]*"/g, '"$1":"***"');
}

function resumen(evento, reintento) {
  const data = evento.data ?? {};
  return {
    event: evento.event,
    type: data.type,
    from: data.from,
    chatId: data.chatId,
    fromMe: data.fromMe,
    isGroup: data.isGroup,
    location: data.location,
    idempotencyKey: evento.idempotencyKey,
    reintento,
  };
}

export function crearReceptor({ secreto, directorio }) {
  let fallar = false;
  let contador = 0;
  mkdirSync(directorio, { recursive: true });

  return createServer((req, res) => {
    const responder = (status, cuerpo) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(cuerpo));
    };

    if (req.method === 'GET' && req.url === '/salud') return responder(200, { fallar });
    if (req.method === 'POST' && req.url === '/modo/fallar') {
      fallar = true;
      return responder(200, { fallar });
    }
    if (req.method === 'POST' && req.url === '/modo/normal') {
      fallar = false;
      return responder(200, { fallar });
    }
    if (req.method !== 'POST' || req.url !== '/webhook') {
      return responder(404, { error: 'No encontrado' });
    }

    const partes = [];
    let bytes = 0;
    let excedido = false;
    req.on('data', (parte) => {
      bytes += parte.length;
      if (bytes > MAX_BYTES) excedido = true;
      else partes.push(parte);
    });
    req.on('end', () => {
      if (excedido) return responder(413, { error: 'Cuerpo excesivo' });
      const cuerpo = Buffer.concat(partes);
      if (!firmaValida(cuerpo, req.headers['x-openwa-signature'], secreto)) {
        console.log('RECHAZADO: firma invalida');
        return responder(401, { error: 'Firma invalida' });
      }

      let evento;
      try {
        evento = JSON.parse(cuerpo.toString('utf8'));
      } catch {
        return responder(400, { error: 'JSON invalido' });
      }

      const reintento = req.headers['x-openwa-retry-count'] ?? '0';
      console.log(JSON.stringify(resumen(evento, reintento)));
      if (fallar) return responder(503, { error: 'Fallo simulado' });

      contador += 1;
      const nombre = String(evento.event ?? 'evento').replace(/[^a-z0-9.-]/gi, '_');
      writeFileSync(
        join(directorio, `${Date.now()}-${contador}-${nombre}.json`),
        `${enmascarar(JSON.stringify(evento, null, 2))}\n`,
      );
      return responder(200, { ok: true });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const secreto = process.env.WEBHOOK_SECRET?.trim();
  if (!secreto || secreto.length < 16) {
    throw new Error('WEBHOOK_SECRET debe tener al menos 16 caracteres');
  }
  crearReceptor({ secreto, directorio: '/muestras' }).listen(8080, () => {
    console.log('Receptor listo en el puerto 8080');
  });
}
