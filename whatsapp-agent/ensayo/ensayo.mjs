import { pathToFileURL } from 'node:url';

const USO = `Uso:
  node ensayo.mjs webhook <sesion> [--filtros]
  node ensayo.mjs enviar <sesion> <chatId> <texto> [clave]
  node ensayo.mjs fallos <sesion>
  node ensayo.mjs reenviar <sesion>
  node ensayo.mjs fallar
  node ensayo.mjs normal`;

const FILTROS = {
  conditions: [
    { field: 'fromMe', operator: 'is', value: false },
    { field: 'hasMedia', operator: 'is', value: false },
  ],
};

export async function ejecutar(args, entorno, solicitar = fetch) {
  const [comando, sesion, ...resto] = args;
  const api = entorno.OPENWA_URL ?? 'http://openwa:2785/api';
  const receptor = entorno.RECEPTOR_URL ?? 'http://localhost:8080';

  const llamar = async (ruta, opciones = {}) => {
    const { body, headers, ...demas } = opciones;
    const respuesta = await solicitar(`${api}${ruta}`, {
      ...demas,
      headers: {
        'X-API-Key': entorno.OPENWA_API_KEY ?? '',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const texto = await respuesta.text();
    if (!respuesta.ok) throw new Error(`${respuesta.status} ${texto}`);
    return texto ? JSON.parse(texto) : null;
  };

  const exigirSesion = () => {
    if (!sesion) throw new Error(USO);
    return encodeURIComponent(sesion);
  };

  switch (comando) {
    case 'webhook': {
      const id = exigirSesion();
      const existentes = await llamar(`/sessions/${id}/webhooks`);
      for (const webhook of existentes) {
        await llamar(`/sessions/${id}/webhooks/${webhook.id}`, { method: 'DELETE' });
      }
      return llamar(`/sessions/${id}/webhooks`, {
        method: 'POST',
        body: {
          url: 'http://receptor:8080/webhook',
          events: ['message.received', 'session.status'],
          secret: entorno.WEBHOOK_SECRET,
          retryCount: 5,
          ...(resto.includes('--filtros') ? { filters: FILTROS } : {}),
        },
      });
    }
    case 'enviar': {
      const id = exigirSesion();
      const [chatId, text, clave] = resto;
      if (!chatId || !text) throw new Error(USO);
      return llamar(`/sessions/${id}/messages/send-text`, {
        method: 'POST',
        headers: clave ? { 'Idempotency-Key': clave } : {},
        body: { chatId, text },
      });
    }
    case 'fallos':
      exigirSesion();
      return llamar(`/webhooks/delivery-failures?sessionId=${encodeURIComponent(sesion)}`);
    case 'reenviar':
      exigirSesion();
      return llamar('/webhooks/delivery-failures/redrive', {
        method: 'POST',
        body: { sessionId: sesion },
      });
    case 'fallar':
    case 'normal': {
      const ruta = comando === 'fallar' ? 'fallar' : 'normal';
      const respuesta = await solicitar(`${receptor}/modo/${ruta}`, { method: 'POST' });
      return respuesta.json();
    }
    default:
      throw new Error(USO);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await ejecutar(process.argv.slice(2), process.env), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
