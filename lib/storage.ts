import {
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.S3_REGION;
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const ENDPOINT = process.env.S3_ENDPOINT;
const FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === 'true';

// Sin bucket configurado la aplicacion arranca igual: la subida se deshabilita y
// el cobro sigue disponible sin comprobante.
export function storageConfigurado(): boolean {
  return Boolean(BUCKET && REGION && ACCESS_KEY_ID && SECRET_ACCESS_KEY);
}

let cliente: S3Client | null = null;

function getCliente(): S3Client {
  if (!storageConfigurado()) {
    throw new Error('Object storage sin configurar');
  }
  if (!cliente) {
    cliente = new S3Client({
      region: REGION!,
      credentials: {
        accessKeyId: ACCESS_KEY_ID!,
        secretAccessKey: SECRET_ACCESS_KEY!,
      },
      ...(ENDPOINT ? { endpoint: ENDPOINT } : {}),
      ...(FORCE_PATH_STYLE ? { forcePathStyle: true } : {}),
    });
  }
  return cliente;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getCliente().send(
    new PutObjectCommand({
      Bucket: BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
      // AWS acepta SSE-S3 explicito. R2 y MinIO cifran en reposo por su cuenta y
      // rechazan o ignoran la cabecera, asi que solo se envia contra AWS.
      ...(ENDPOINT ? {} : { ServerSideEncryption: 'AES256' as const }),
    }),
  );
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getCliente().send(new HeadObjectCommand({ Bucket: BUCKET!, Key: key }));
    return true;
  } catch (error) {
    // Distinguir "no existe" de fallo real (credenciales vencidas, endpoint caído).
    // Un objeto ausente es operacional (retorna false sin registrar).
    // Otros errores son anomalías que se deben escalar: se registran y relanza.
    const is404 = (error as any)?.$metadata?.httpStatusCode === 404 ||
                  (error as any)?.name === 'NotFound' ||
                  (error as any)?.name === 'NoSuchKey';
    if (is404) {
      return false;
    }
    console.error('Error al verificar objeto en storage:', error);
    throw error;
  }
}

export async function getSignedReadUrl(
  key: string,
  ttlSeconds: number,
): Promise<string> {
  return getSignedUrl(
    getCliente(),
    new GetObjectCommand({ Bucket: BUCKET!, Key: key }),
    { expiresIn: ttlSeconds },
  );
}
