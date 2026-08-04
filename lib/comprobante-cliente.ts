// Corre solo en el navegador. La URL firmada se pide recien en el clic y no se
// guarda en ningun lado: una lista de ordenes no debe disparar decenas de URLs
// ni mostrar datos bancarios a quien solo revisa totales.
export async function abrirComprobanteFirmado(ordenId: string): Promise<void> {
  try {
    const respuesta = await fetch(`/api/admin/ordenes/${ordenId}/comprobante`);
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      throw new Error(datos.error || 'No se pudo abrir el comprobante');
    }
    window.open(datos.url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    alert(error instanceof Error ? error.message : 'No se pudo abrir el comprobante');
  }
}
