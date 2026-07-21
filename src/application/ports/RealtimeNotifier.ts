/**
 * Facade de notificaciones en tiempo real (R14).
 *
 * Abstrae el mecanismo de notificación a los clientes conectados (polling,
 * WebSocket, SSE, etc.). La implementación concreta vive en infraestructura.
 */
export interface RealtimeNotifier {
  /**
   * Notifica a los suscriptores de un canal que hubo un cambio.
   *
   * @param canal - Nombre del canal (e.g., "orders" para el KDS).
   */
  notificarCambio(canal: string): Promise<void>;
}
