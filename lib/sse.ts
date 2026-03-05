/**
 * Server-Sent Events (SSE) — módulo compartido
 *
 * Mantiene un registro de todos los clientes conectados al endpoint /api/ordenes/events.
 * NOTA: funciona en servidores persistentes (local, VPS, Railway, Render, etc.).
 * En entornos completamente serverless (Vercel Edge) cada request es stateless
 * y este registry no persiste; para esos casos se necesitaría Redis Pub/Sub.
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

// Map con controller por id de cliente para poder limpiar bien
const clientes = new Map<string, SSEController>();
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
