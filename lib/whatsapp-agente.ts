import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { authenticatePrintAgent } from './print-agent-auth';
import { getRetryDelaySeconds, sanitizePrintErrorCode } from './print-agent-jobs';

const RESERVA_MS = 60 * 1000;
// Menor que la retención de claves de OpenWA: nada se reintenta sin deduplicación.
const VIGENCIA_SALIDA_MS = 30 * 60 * 1000;
const MAX_INTENTOS = 6;
const MAX_ESPERA_AGENTE_S = 3600;
const AGENTE_ID = 'whatsapp-agent';

const ENVIABLES = ['PENDIENTE', 'REINTENTO'];
const REVISION = 'REQUIERE_REVISION';
const SIN_RESERVA = { reservaToken: null, reservaExpiraAt: null };

/** Sin `?? ''` un token ausente caería en el valor por defecto: el del agente de impresión. */
export function autenticarAgenteWhatsapp(request: Request) {
  return authenticatePrintAgent(request, process.env.WHATSAPP_AGENT_TOKEN ?? '');
}

/** Reutiliza el registro de agentes; `printerReachable` indica aquí la sesión de WhatsApp. */
export function registrarSalud(prisma: PrismaClient, sesionLista: boolean, ahora: Date) {
  const datos = { lastSeenAt: ahora, printerReachable: sesionLista, lastPrinterCheckAt: ahora };
  return prisma.printAgent.upsert({
    where: { id: AGENTE_ID },
    create: { id: AGENTE_ID, name: 'Agente WhatsApp', ...datos },
    update: datos,
  });
}

/** Recupera reservas vencidas y reserva como máximo una salida. Mensajes antiguos pasan a revisión. */
export function reservarSalida(prisma: PrismaClient, sessionId: string, ahora = new Date()) {
  return prisma.$transaction(async (tx) => {
    await tx.whatsappSalida.updateMany({
      where: { estado: 'PROCESANDO', reservaExpiraAt: { lte: ahora } },
      data: { estado: 'REINTENTO', ...SIN_RESERVA, ultimoError: 'RESERVA_VENCIDA' },
    });
    await tx.whatsappSalida.updateMany({
      where: { estado: { in: ENVIABLES }, intentos: { gte: MAX_INTENTOS } },
      data: { estado: REVISION, ultimoError: 'INTENTOS_AGOTADOS' },
    });
    await tx.whatsappSalida.updateMany({
      where: {
        estado: { in: ENVIABLES },
        OR: [
          { venceAt: { lt: ahora } },
          { venceAt: null, createdAt: { lt: new Date(ahora.getTime() - VIGENCIA_SALIDA_MS) } },
        ],
      },
      data: { estado: REVISION, ultimoError: 'VENCIDA' },
    });

    // Releer elegibilidad: anulación, rechazo o delivery pedido por cualquier vía cancelan el aviso.
    await tx.whatsappSalida.updateMany({
      where: {
        tipo: 'RECORDATORIO_DELIVERY',
        estado: { in: ENVIABLES },
        orden: { OR: [{ anulada: true }, { estado: 'cancelada' }, { deliverySolicitadoAt: { not: null } }] },
      },
      data: { estado: 'CANCELADA', ultimoError: 'NO_ELEGIBLE' },
    });

    // Una corrección no sale antes que la publicación de su orden; otras órdenes siguen.
    const [candidata] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT s.id
      FROM "WhatsappSalida" s
      WHERE s."sessionId" = ${sessionId}
        AND s.estado IN ('PENDIENTE', 'REINTENTO')
        AND s."disponibleAt" <= ${ahora}
        AND NOT EXISTS (
          SELECT 1 FROM "WhatsappSalida" previa
          WHERE s.tipo = 'ACTUALIZACION_GRUPO'
            AND previa."ordenId" = s."ordenId"
            AND previa.tipo IN ('PUBLICACION_GRUPO', 'ACTUALIZACION_GRUPO')
            AND previa.estado NOT IN ('ENVIADA', 'CANCELADA')
            AND previa."revisadaAt" IS NULL
            AND previa."createdAt" < s."createdAt"
        )
      ORDER BY s."disponibleAt" ASC, s."createdAt" ASC
      FOR UPDATE OF s SKIP LOCKED
      LIMIT 1
    `;
    if (!candidata) return null;

    return tx.whatsappSalida.update({
      where: { id: candidata.id },
      data: {
        estado: 'PROCESANDO',
        intentos: { increment: 1 },
        reservaToken: randomUUID(),
        reservaExpiraAt: new Date(ahora.getTime() + RESERVA_MS),
      },
      select: { id: true, destino: true, texto: true, clave: true, reservaToken: true },
    });
  });
}

const reservaVigente = (id: string, token: string) => ({ id, reservaToken: token, estado: 'PROCESANDO' });

/** El token distingue este intento: uno antiguo no puede cerrar una reserva nueva. */
export function completarSalida(prisma: PrismaClient, id: string, token: string, mensajeId: string | null) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.whatsappSalida.updateMany({
      where: reservaVigente(id, token),
      data: { estado: 'ENVIADA', mensajeId, ultimoError: null, ...SIN_RESERVA },
    });
    if (count !== 1) return false;

    const salida = await tx.whatsappSalida.findUniqueOrThrow({ where: { id }, select: { tipo: true, ordenId: true } });
    if (salida.tipo === 'RECORDATORIO_DELIVERY' && salida.ordenId) await marcarMotoPedida(tx, salida.ordenId);
    return true;
  });
}

/** El aviso a Motos es el pedido de la moto: la orden lo refleja igual que el botón. */
async function marcarMotoPedida(tx: Prisma.TransactionClient, ordenId: string) {
  const deliverySolicitadoAt = new Date();
  const { count } = await tx.orden.updateMany({
    where: { id: ordenId, anulada: false, deliverySolicitadoAt: null },
    data: { deliverySolicitadoAt },
  });
  if (count !== 1) return;
  await tx.historialOrden.create({
    data: {
      ordenId,
      tipoAccion: 'delivery_solicitado',
      descripcion: 'Moto pedida al grupo Motos por WhatsApp',
      datosDespues: { deliverySolicitadoAt: deliverySolicitadoAt.toISOString() },
      usuarioNombre: 'Agente WhatsApp',
      usuarioRol: 'sistema',
      diferenciaTotal: 0,
    },
  });
}

export async function fallarSalida(
  prisma: PrismaClient,
  id: string,
  token: string,
  fallo: { codigo: unknown; reintentable: boolean; esperaSeg?: unknown },
  ahora = new Date(),
) {
  const salida = await prisma.whatsappSalida.findFirst({
    where: reservaVigente(id, token),
    select: { intentos: true },
  });
  if (!salida) return false;

  const pedida = Number(fallo.esperaSeg);
  const espera = Math.max(
    getRetryDelaySeconds(salida.intentos),
    Number.isFinite(pedida) ? Math.min(pedida, MAX_ESPERA_AGENTE_S) : 0,
  );
  const reintentar = fallo.reintentable && salida.intentos < MAX_INTENTOS;
  const { count } = await prisma.whatsappSalida.updateMany({
    where: reservaVigente(id, token),
    data: {
      ...SIN_RESERVA,
      ultimoError: sanitizePrintErrorCode(fallo.codigo),
      ...(reintentar
        ? { estado: 'REINTENTO', disponibleAt: new Date(ahora.getTime() + espera * 1000) }
        : { estado: REVISION }),
    },
  });
  return count === 1;
}
