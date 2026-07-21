import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { StorageService } from "@/application/ports/StorageService";

/**
 * Mapa mínimo de tipos MIME a extensiones para nombrar los objetos en S3.
 */
const EXTENSION_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

/**
 * Implementación del facade `StorageService` sobre AWS S3 (R9.3).
 *
 * Sube los comprobantes de transferencia a un bucket configurado por
 * `process.env.S3_BUCKET` y retorna la URL del objeto. La región se toma de
 * `process.env.AWS_REGION` (con `us-east-1` como valor por defecto).
 *
 * Las credenciales se resuelven con la cadena de proveedores por defecto del
 * SDK (variables de entorno `AWS_*`, rol de la instancia/Lambda, etc.), de modo
 * que no se incrustan secretos en el código.
 */
export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly region: string;

  constructor(client?: S3Client) {
    this.region = process.env.AWS_REGION ?? "us-east-1";
    this.client = client ?? new S3Client({ region: this.region });
  }

  private resolverBucket(): string {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error(
        "S3_BUCKET no está definido. Configúralo en las variables de entorno.",
      );
    }
    return bucket;
  }

  async subirComprobante(
    orderId: string,
    archivo: Buffer,
    mime: string,
  ): Promise<string> {
    const bucket = this.resolverBucket();
    const extension = EXTENSION_POR_MIME[mime] ?? "bin";
    const key = `comprobantes/${orderId}/${Date.now()}.${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: archivo,
        ContentType: mime,
      }),
    );

    return this.construirUrl(bucket, key);
  }

  /**
   * Construye la URL del objeto. Usa el endpoint virtual-hosted-style estándar
   * de S3. Si el bucket no es público, la presentación deberá generar una URL
   * firmada; este facade retorna la URL canónica del objeto.
   */
  private construirUrl(bucket: string, key: string): string {
    const encodedKey = key
      .split("/")
      .map((segmento) => encodeURIComponent(segmento))
      .join("/");
    return `https://${bucket}.s3.${this.region}.amazonaws.com/${encodedKey}`;
  }
}
