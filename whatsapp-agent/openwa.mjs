import { pathToFileURL } from 'node:url';

const USO = `Uso (dentro del contenedor del agente):
  node openwa.mjs webhook <sesion>                apunta el webhook al POS_URL
  node openwa.mjs grupos <sesion>                 lista ID y nombre de los grupos
  node openwa.mjs enviar <sesion> <chatId> <texto> [clave]
  node openwa.mjs fallos <sesion>                 eventos que el POS no aceptó
  node openwa.mjs reenviar <sesion>               reintenta esos eventos`;

const RUTA_WEBHOOK = '/api/integraciones/whatsapp/webhook';

// El POS descarta lo demás igual; filtrar en el gateway evita tráfico y datos ajenos.
const FILTROS = {
  conditions: [
    { field: 'fromMe', operator: 'is', value: false },
    { field: 'isGroup', operator: 'is', value: false },
    { field: 'type', operator: 'is', value: ['text', 'location'] },
  ],
};

export async function ejecutar(args, entorno, solicitar = fetch) {
  const [comando, sesion, ...resto] = args;
  const api = entorno.OPENWA_URL ?? 'http://openwa:2785/api';

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

  if (!sesion) throw new Error(USO);
  const id = encodeURIComponent(sesion);

  switch (comando) {
    case 'webhook': {
      if (!entorno.POS_URL || !entorno.WEBHOOK_SECRET) throw new Error('Faltan POS_URL o WEBHOOK_SECRET');
      // Un solo destino: el registro anterior se reemplaza para no duplicar entregas.
      const existentes = await llamar(`/sessions/${id}/webhooks`);
      for (const webhook of existentes) {
        await llamar(`/sessions/${id}/webhooks/${webhook.id}`, { method: 'DELETE' });
      }
      return llamar(`/sessions/${id}/webhooks`, {
        method: 'POST',
        body: {
          url: `${entorno.POS_URL.replace(/\/$/, '')}${RUTA_WEBHOOK}`,
          events: ['message.received', 'session.status'],
          secret: entorno.WEBHOOK_SECRET,
          retryCount: 5,
          filters: FILTROS,
        },
      });
    }
    case 'grupos': {
      const grupos = await llamar(`/sessions/${id}/groups`);
      return grupos.map(({ id: grupo, name }) => `${grupo} ${name}`);
    }
    case 'enviar': {
      const [chatId, text, clave] = resto;
      if (!chatId || !text) throw new Error(USO);
      return llamar(`/sessions/${id}/messages/send-text`, {
        method: 'POST',
        headers: clave ? { 'Idempotency-Key': clave } : {},
        body: { chatId, text },
      });
    }
    case 'fallos':
      return llamar(`/webhooks/delivery-failures?sessionId=${id}`);
    case 'reenviar':
      return llamar('/webhooks/delivery-failures/redrive', { method: 'POST', body: { sessionId: sesion } });
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
