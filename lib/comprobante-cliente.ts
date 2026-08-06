// Corre solo en el navegador. La URL firmada se pide recien en el clic y no se
// guarda en ningun lado: una lista de ordenes no debe disparar decenas de URLs
// ni mostrar datos bancarios a quien solo revisa totales.
export async function abrirComprobanteFirmado(ordenId: string): Promise<void> {
  try {
    const respuesta = await fetch(`/api/admin/ordenes/${ordenId}/comprobante`);
    let datos: { error?: string; url?: string };
    try {
      datos = await respuesta.json();
    } catch {
      // Un proxy o gateway puede devolver HTML (o nada) en vez de JSON en ciertos
      // codigos de error: sin este fallback el catch de abajo mostraria el error
      // crudo del parser ("Unexpected token '<'") en vez de un mensaje entendible.
      datos = {
        error:
          respuesta.status === 413
            ? 'La foto es muy pesada, repítela'
            : 'No se pudo abrir el comprobante',
      };
    }
    if (!respuesta.ok) {
      throw new Error(datos.error || 'No se pudo abrir el comprobante');
    }
    // Este punto ya perdió la ventana de activación del usuario (dos awaits antes),
    // y Safari/iOS bloquean `window.open` fuera de esa ventana: ahí devuelve `null`
    // sin lanzar excepción y no pasa nada. Chrome suele sobrevivir por activación
    // transitoria, por eso el fallo parecía específico de un navegador.
    const ventana = window.open(datos.url, '_blank', 'noopener,noreferrer');
    if (!ventana && datos.url) {
      window.location.href = datos.url;
    }
  } catch (error) {
    alert(error instanceof Error ? error.message : 'No se pudo abrir el comprobante');
  }
}
