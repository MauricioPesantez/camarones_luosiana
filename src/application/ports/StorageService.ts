/**
 * Facade de almacenamiento de archivos (R9.3).
 *
 * Abstrae la subida de comprobantes de transferencia. La implementación
 * concreta (S3) vive en infraestructura.
 */
export interface StorageService {
  /**
   * Sube un comprobante de pago y retorna la URL pública/firmada del archivo.
   *
   * @param orderId - Id de la orden asociada al comprobante.
   * @param archivo - Contenido del archivo en buffer.
   * @param mime - Tipo MIME del archivo (e.g., "image/jpeg").
   * @returns URL del comprobante subido.
   */
  subirComprobante(orderId: string, archivo: Buffer, mime: string): Promise<string>;
}
