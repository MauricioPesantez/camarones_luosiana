// Corre solo en el navegador. La URL firmada se pide recien en el clic y no se
// guarda en ningun lado: una lista de ordenes no debe disparar decenas de URLs
// ni mostrar datos bancarios a quien solo revisa totales.
export async function abrirComprobanteFirmado(
  ordenId: string,
  cobroId?: string,
): Promise<void> {
  // La pestaña se abre antes del primer await: después ya pasó la ventana de
  // activación del usuario y Safari/iOS bloquean `window.open` (devuelve `null`).
  // Sin 'noopener': con él `window.open` devuelve `null` siempre, por norma, y no
  // habría cómo llevarla a la URL firmada. Por eso `opener` se corta a mano.
  const ventana = window.open('', '_blank');
  if (ventana) ventana.opener = null;
  try {
    const query = cobroId ? `?cobroId=${encodeURIComponent(cobroId)}` : '';
    const respuesta = await fetch(`/api/admin/ordenes/${ordenId}/comprobante${query}`);
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
    if (!datos.url) throw new Error('No se pudo abrir el comprobante');
    // Bloqueada igual (ventanas emergentes desactivadas): se abre en esta pestaña.
    (ventana ?? window).location.href = datos.url;
  } catch (error) {
    ventana?.close();
    alert(error instanceof Error ? error.message : 'No se pudo abrir el comprobante');
  }
}
