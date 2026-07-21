import type { RealtimeNotifier } from "@/application/ports/RealtimeNotifier";

/**
 * Implementación del facade `RealtimeNotifier` para un modelo de polling (R14).
 *
 * En la arquitectura actual el refresco del KDS es impulsado por el cliente
 * (`usePollingOrders` consulta periódicamente `/api/orders/active`), de modo
 * que no hay un canal push que notificar desde el servidor. Esta implementación
 * existe detrás del facade para mantener la regla de dependencia: los casos de
 * uso invocan `notificarCambio` sin conocer el mecanismo concreto.
 *
 * Cuando se migre a WebSocket/SSE bastará con sustituir esta clase (o inyectar
 * otra implementación del puerto) sin tocar el dominio ni los casos de uso.
 */
export class PollingNotifier implements RealtimeNotifier {
  async notificarCambio(canal: string): Promise<void> {
    // No-op: el polling del cliente recoge los cambios en su próximo ciclo.
    // Dejamos una traza ligera en desarrollo para facilitar la depuración.
    if (process.env.NODE_ENV === "development") {
      console.debug(`[PollingNotifier] cambio notificado en canal "${canal}"`);
    }
  }
}
