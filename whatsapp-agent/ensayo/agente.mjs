import { pathToFileURL } from 'node:url';

const ESPERA_MIN_MS = 5_000;
const ESPERA_MAX_MS = 60_000;
const TIMEOUT_ENVIO_MS = 30_000;
const TIMEOUT_POS_MS = 15_000;
// Repetirlos no cambia el resultado; una persona debe revisar el chat o la configuración.
const DEFINITIVOS = /IDEMPOTENCY_(OUTCOME_UNKNOWN|KEY_REUSED|KEY_INVALID)/;

let ultimoEstado = null;

export function leerConfig(entorno) {
  const faltantes = ['POS_URL', 'WHATSAPP_AGENT_TOKEN', 'WHATSAPP_SESSION_ID', 'OPENWA_API_KEY']
    .filter((nombre) => !entorno[nombre]);
  if (faltantes.length > 0) throw new Error(`Faltan variables: ${faltantes.join(', ')}`);

  const posUrl = entorno.POS_URL.replace(/\/$/, '');
  // shortcut: HTTP solo para el POS de desarrollo en red privada; producción exige HTTPS.
  if (!/^(https:|http:\/\/(localhost|127\.|10\.|192\.168\.))/.test(posUrl)) {
    throw new Error('POS_URL debe usar HTTPS');
  }
  const horario = entorno.HORARIO?.match(/^(\d{1,2})-(\d{1,2})$/);
  if (entorno.HORARIO && !horario) throw new Error('HORARIO debe ser como 10-22');

  return {
    posUrl,
    token: entorno.WHATSAPP_AGENT_TOKEN,
    sessionId: entorno.WHATSAPP_SESSION_ID,
    apiKey: entorno.OPENWA_API_KEY,
    openwaUrl: entorno.OPENWA_URL ?? 'http://openwa:2785/api',
    horario: horario ? { desde: Number(horario[1]), hasta: Number(horario[2]) } : null,
  };
}

export function dentroDeHorario(ahora, horario) {
  if (!horario) return true;
  const hora = Number(new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil', hour: '2-digit', hourCycle: 'h23',
  }).format(ahora));
  return hora >= horario.desde && hora < horario.hasta;
}

/** La misma clave hace seguro repetir: OpenWA devuelve el resultado original o informa la duda. */
export function clasificarEnvio(status, cuerpo, retryAfter) {
  let datos = {};
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    // Un proxy puede responder sin JSON; se clasifica por el estado.
  }
  if (status >= 200 && status < 300) return { ok: true, mensajeId: datos.messageId ?? null };

  const definitivo = cuerpo.match(DEFINITIVOS)?.[0];
  return {
    ok: false,
    codigo: definitivo ?? datos.code ?? `HTTP_${status}`,
    reintentable: !definitivo,
    esperaSeg: Number(retryAfter ?? datos.retryAfterSeconds) || undefined,
  };
}

async function estadoSesion(config, solicitar) {
  try {
    const respuesta = await solicitar(`${config.openwaUrl}/sessions/${encodeURIComponent(config.sessionId)}`, {
      headers: { 'X-API-Key': config.apiKey },
      signal: AbortSignal.timeout(TIMEOUT_POS_MS),
    });
    if (!respuesta.ok) return `HTTP_${respuesta.status}`;
    return String((await respuesta.json()).status).toLowerCase();
  } catch {
    return 'SIN_RESPUESTA';
  }
}

async function enviar(config, salida, solicitar) {
  try {
    const respuesta = await solicitar(
      `${config.openwaUrl}/sessions/${encodeURIComponent(config.sessionId)}/messages/send-text`,
      {
        method: 'POST',
        headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json', 'Idempotency-Key': salida.clave },
        body: JSON.stringify({ chatId: salida.destino, text: salida.texto }),
        signal: AbortSignal.timeout(TIMEOUT_ENVIO_MS),
      },
    );
    return clasificarEnvio(respuesta.status, await respuesta.text(), respuesta.headers.get('retry-after'));
  } catch {
    return { ok: false, codigo: 'SIN_RESPUESTA', reintentable: true };
  }
}

async function llamarPos(config, ruta, cuerpo, solicitar) {
  const respuesta = await solicitar(`${config.posUrl}/api/whatsapp-agent${ruta}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TIMEOUT_POS_MS),
  });
  if (!respuesta.ok) throw new Error(`POS ${ruta.split('/').at(-1)} ${respuesta.status}`);
  return respuesta.json();
}

/** Atiende una salida. Devuelve si hubo trabajo. Sin confirmar, la reserva vence y el POS la recupera. */
export async function ciclo(config, solicitar = fetch, ahora = new Date()) {
  if (!dentroDeHorario(ahora, config.horario)) return false;

  const estado = await estadoSesion(config, solicitar);
  if (estado !== ultimoEstado) console.log(`Sesion: ${estado}`);
  ultimoEstado = estado;

  const { salida } = await llamarPos(
    config,
    '/tick',
    { sessionId: config.sessionId, sesionLista: estado === 'ready' },
    solicitar,
  );
  if (!salida) return false;

  const resultado = await enviar(config, salida, solicitar);
  const { ok, ...detalle } = resultado;
  await llamarPos(
    config,
    `/salidas/${encodeURIComponent(salida.id)}/${ok ? 'complete' : 'fail'}`,
    { token: salida.reservaToken, ...detalle },
    solicitar,
  );
  console.log(JSON.stringify({ salida: salida.id, ok, codigo: resultado.codigo }));
  return true;
}

export async function iniciar(entorno) {
  const config = leerConfig(entorno);
  console.log('Agente de WhatsApp iniciado');
  let espera = ESPERA_MIN_MS;
  for (;;) {
    let huboTrabajo = false;
    try {
      huboTrabajo = await ciclo(config);
    } catch (error) {
      console.error(error.message);
    }
    espera = huboTrabajo ? ESPERA_MIN_MS : Math.min(espera * 2, ESPERA_MAX_MS);
    if (!huboTrabajo) await new Promise((listo) => setTimeout(listo, espera));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  iniciar(process.env).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
