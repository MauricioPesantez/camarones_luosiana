import { registrarCliente, eliminarCliente } from '@/lib/sse';
import { randomUUID } from 'crypto';
import { getAuthenticatedUser } from '@/lib/session';

/**
 * GET /api/ordenes/events
 *
 * Endpoint Server-Sent Events (SSE).
 * La cocina se suscribe aquí y recibe eventos en tiempo real cuando
 * llega una nueva orden o cambia el estado de una existente.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const encoder = new TextEncoder();

export async function GET() {
  const usuario = await getAuthenticatedUser();
  if (!usuario) return new Response('Sesion requerida', { status: 401 });
  if (!['cocina', 'admin'].includes(usuario.rol)) {
    return new Response('Rol no autorizado', { status: 403 });
  }
  const clienteId = randomUUID();
  let keepaliveInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      registrarCliente(clienteId, controller);

      controller.enqueue(
        encoder.encode(`event: conectado\ndata: {"mensaje":"Conectado al sistema de notificaciones"}\n\n`)
      );

      // Ping cada 25 segundos para evitar que proxies/firewalls cierren la conexión idle
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          if (keepaliveInterval) clearInterval(keepaliveInterval);
          eliminarCliente(clienteId);
        }
      }, 25_000);
    },
    cancel() {
      if (keepaliveInterval) clearInterval(keepaliveInterval);
      eliminarCliente(clienteId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
