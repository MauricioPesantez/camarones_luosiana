/**
 * Server-Sent Events (SSE) — módulo compartido
 *
 * Mantiene un registro de todos los clientes conectados al endpoint /api/ordenes/events.
 * NOTA: funciona en servidores persistentes (local, VPS, Railway, Render, etc.).
 * En entornos completamente serverless (Vercel Edge) cada request es stateless
 * y este registry no persiste; para esos casos se necesitaría Redis Pub/Sub.
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

// Singleton via globalThis para que todos los route handlers compartan el mismo Map,
// igual que se hace con PrismaClient en lib/db.ts
const globalForSSE = globalThis as unknown as {
  sseClientes: Map<string, SSEController>;
};

const clientes: Map<string, SSEController> =
  globalForSSE.sseClientes ?? new Map<string, SSEController>();

if (process.env.NODE_ENV !== 'production') globalForSSE.sseClientes = clientes;

const encoder = new TextEncoder();

export function registrarCliente(id: string, controller: SSEController) {
  clientes.set(id, controller);
}

export function eliminarCliente(id: string) {
  clientes.delete(id);
}

/**
 * Notifica a todos los clientes conectados con un evento SSE.
 * @param event  Nombre del evento (e.g. "nueva-orden")
 * @param data   Objeto JSON que se enviará como payload
 */
export function notificarClientes(event: string, data: unknown) {
  const mensaje = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const bytes = encoder.encode(mensaje);

  clientes.forEach((controller, id) => {
    try {
      controller.enqueue(bytes);
    } catch {
      // El cliente cerró la conexión
      clientes.delete(id);
    }
  });
}

export function cantidadClientes() {
  return clientes.size;
}
