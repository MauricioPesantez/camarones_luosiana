import { registrarCliente, eliminarCliente } from '@/lib/sse';
import { randomUUID } from 'crypto';

/**
 * GET /api/ordenes/events
 *
 * Endpoint Server-Sent Events (SSE).
 * La cocina se suscribe aquí y recibe eventos en tiempo real cuando
 * llega una nueva orden o cambia el estado de una existente.
 *
 * Desactiva el parseo de body y el caché para que funcione como stream.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const encoder = new TextEncoder();

export async function GET() {
  const clienteId = randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Registrar este cliente para recibir notificaciones
      registrarCliente(clienteId, controller);

      // Evento inicial de conexión confirmada
      controller.enqueue(
        encoder.encode(`event: conectado\ndata: {"mensaje":"Conectado al sistema de notificaciones"}\n\n`)
      );

      // Ping cada 25 segundos para evitar que proxies/firewalls cierren la conexión idle
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepalive);
          eliminarCliente(clienteId);
        }
      }, 25_000);

      // Guardar referencia al interval para limpiarlo al desconectar
      (controller as unknown as { _keepalive: ReturnType<typeof setInterval> })._keepalive = keepalive;
    },
    cancel(controller) {
      // El cliente cerró la pestaña o la conexión
      const c = controller as unknown as { _keepalive: ReturnType<typeof setInterval> };
      clearInterval(c._keepalive);
      eliminarCliente(clienteId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Desactiva buffering en Nginx
    },
  });
}
