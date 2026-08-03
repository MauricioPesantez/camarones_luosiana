# Comprobantes de transferencia en S3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el cobro por QR con transferencia suba la foto del comprobante a un object storage, guarde su `objectKey` validada, y que un admin pueda verla desde el detalle de orden y el cuadre de caja.

**Architecture:** El navegador comprime la foto y la envía por multipart a una ruta de Next, que valida bytes reales y sube al bucket con credenciales de servidor; el bucket queda privado, sin CORS. Toda regla que pueda rechazar una subida vive en un módulo puro y testeable (`lib/comprobantes.ts`); todo I/O con el storage vive detrás de `lib/storage.ts`. La validación de la key al cobrar se coloca en `collectOrderPayment`, único punto por el que pasan las dos rutas de cobro.

**Tech Stack:** Next.js 16 (App Router, `output: 'standalone'`), React 19, Prisma 5.22, TypeScript, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Tests: scripts de `ts-node` con `node:assert/strict`, sin framework.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-03-comprobantes-s3-design.md`. Ante cualquier duda, manda el spec.
- Alcance: **solo el flujo de cobro por QR**. No tocar `app/mesero/page.tsx`, `app/digital/page.tsx` ni el modal de cobro de `app/admin/page.tsx` para capturar comprobantes.
- MIME permitidos: exactamente `image/jpeg`, `image/png`, `image/webp`.
- Tamaño máximo del archivo recibido: `5 * 1024 * 1024` bytes.
- Formato de key: `cobros/{ordenId}/{uuid}.{ext}`. La extensión se deriva del MIME validado, nunca del nombre de archivo del cliente.
- La key se construye siempre en el servidor. Ninguna ruta acepta una key propuesta por el cliente sin validarla contra el `ordenId` de la orden en curso.
- Un fallo de subida **no** bloquea el cobro: la pantalla ofrece reintentar o registrar sin comprobante.
- Nunca persistir ni cachear URLs firmadas. TTL de lectura: 120 segundos.
- Retención del bucket: 30 días, clase Standard, sin transición de clase.
- Los tests del repo son scripts ejecutables de arriba a abajo (ver `lib/cuadre.test.ts`), no funciones `test()`. Cada archivo de test lleva su script `test:*` en `package.json`.
- Convención de comillas, tal como está hoy en el repositorio: los módulos de `lib/` y las rutas de `app/api/` usan comillas simples (ver `lib/order-payment.ts`); los archivos de test y los componentes `.tsx` usan comillas dobles (ver `lib/cuadre.test.ts`, `components/cobros/CobrarOrdenClient.tsx`). El código de este plan ya viene escrito con la convención que corresponde a cada archivo.
- Imports internos siempre con alias `@/`.

---

### Task 1: Reglas puras de comprobantes

Todo lo que puede rechazar una subida, sin I/O ni Prisma, para que sea testeable con el patrón del repositorio.

**Files:**
- Create: `lib/comprobantes.ts`
- Create: `lib/comprobantes.test.ts`
- Modify: `package.json` (agregar script `test:comprobantes`)

**Interfaces:**
- Consumes: nada.
- Produces: `MIME_PERMITIDOS`, `MAX_COMPROBANTE_BYTES`, `type MimeComprobante`, `esMimeComprobante(value: string): value is MimeComprobante`, `buildComprobanteKey(ordenId: string, mime: MimeComprobante, uuid: string): string`, `parseComprobanteKey(key: string): { ordenId: string } | null`, `validarComprobante(input: { mime: string; size: number; magicBytes: Uint8Array }): ResultadoValidacion` donde `type ResultadoValidacion = { ok: true; mime: MimeComprobante } | { ok: false; codigo: 'mime' | 'tamano' | 'contenido' }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/comprobantes.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  MAX_COMPROBANTE_BYTES,
  buildComprobanteKey,
  esMimeComprobante,
  parseComprobanteKey,
  validarComprobante,
} from "./comprobantes";

const ORDEN = "clz9k2m4x0000abcd1234efgh";
const UUID = "3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b";

// --- buildComprobanteKey / parseComprobanteKey ---

const keyJpg = buildComprobanteKey(ORDEN, "image/jpeg", UUID);
assert.equal(keyJpg, `cobros/${ORDEN}/${UUID}.jpg`);
assert.equal(buildComprobanteKey(ORDEN, "image/png", UUID), `cobros/${ORDEN}/${UUID}.png`);
assert.equal(buildComprobanteKey(ORDEN, "image/webp", UUID), `cobros/${ORDEN}/${UUID}.webp`);

// Ida y vuelta.
assert.deepEqual(parseComprobanteKey(keyJpg), { ordenId: ORDEN });

// Formas invalidas: cada una debe devolver null.
const keysInvalidas = [
  "",
  "cobros/",
  `cobros/${ORDEN}`,
  `cobros/${ORDEN}/${UUID}`,
  `cobros/${ORDEN}/${UUID}.gif`,
  `cobros/${ORDEN}/${UUID}.jpg.exe`,
  `otros/${ORDEN}/${UUID}.jpg`,
  `cobros/${ORDEN}/sub/${UUID}.jpg`,
  `cobros/../${ORDEN}/${UUID}.jpg`,
  `cobros/${ORDEN}/../${UUID}.jpg`,
  `/cobros/${ORDEN}/${UUID}.jpg`,
  `cobros/${ORDEN}/${UUID}.jpg/`,
  `cobros/${ORDEN}/no-es-uuid.jpg`,
  `cobros/ORDEN-CON-MAYUSCULAS/${UUID}.jpg`,
];
for (const key of keysInvalidas) {
  assert.equal(parseComprobanteKey(key), null, `deberia rechazar: ${key}`);
}

// La key de otra orden parsea bien, pero con OTRO ordenId: quien llama compara.
const otraOrden = "clz9k2m4x0000zzzz9999wxyz";
assert.deepEqual(parseComprobanteKey(`cobros/${otraOrden}/${UUID}.jpg`), {
  ordenId: otraOrden,
});
assert.notEqual(parseComprobanteKey(`cobros/${otraOrden}/${UUID}.jpg`)?.ordenId, ORDEN);

// --- esMimeComprobante ---

assert.equal(esMimeComprobante("image/jpeg"), true);
assert.equal(esMimeComprobante("image/gif"), false);
assert.equal(esMimeComprobante("application/pdf"), false);

// --- validarComprobante ---

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

assert.deepEqual(validarComprobante({ mime: "image/jpeg", size: 1000, magicBytes: JPEG }), {
  ok: true,
  mime: "image/jpeg",
});
assert.deepEqual(validarComprobante({ mime: "image/png", size: 1000, magicBytes: PNG }), {
  ok: true,
  mime: "image/png",
});
assert.deepEqual(validarComprobante({ mime: "image/webp", size: 1000, magicBytes: WEBP }), {
  ok: true,
  mime: "image/webp",
});

// MIME fuera de lista.
assert.deepEqual(validarComprobante({ mime: "image/gif", size: 1000, magicBytes: JPEG }), {
  ok: false,
  codigo: "mime",
});
// El navegador manda a veces el MIME con parametros.
assert.deepEqual(
  validarComprobante({ mime: "image/jpeg; charset=binary", size: 1000, magicBytes: JPEG }),
  { ok: true, mime: "image/jpeg" },
);

// Tamano.
assert.deepEqual(
  validarComprobante({ mime: "image/jpeg", size: MAX_COMPROBANTE_BYTES + 1, magicBytes: JPEG }),
  { ok: false, codigo: "tamano" },
);
assert.deepEqual(
  validarComprobante({ mime: "image/jpeg", size: MAX_COMPROBANTE_BYTES, magicBytes: JPEG }),
  { ok: true, mime: "image/jpeg" },
);
assert.deepEqual(validarComprobante({ mime: "image/jpeg", size: 0, magicBytes: JPEG }), {
  ok: false,
  codigo: "tamano",
});

// Contenido que contradice el MIME declarado.
assert.deepEqual(validarComprobante({ mime: "image/jpeg", size: 1000, magicBytes: PNG }), {
  ok: false,
  codigo: "contenido",
});
assert.deepEqual(validarComprobante({ mime: "image/png", size: 1000, magicBytes: JPEG }), {
  ok: false,
  codigo: "contenido",
});
// Un PDF disfrazado de imagen.
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x00, 0x00]);
assert.deepEqual(validarComprobante({ mime: "image/jpeg", size: 1000, magicBytes: PDF }), {
  ok: false,
  codigo: "contenido",
});
// Archivo truncado: no alcanza para leer la firma.
assert.deepEqual(
  validarComprobante({ mime: "image/jpeg", size: 2, magicBytes: new Uint8Array([0xff, 0xd8]) }),
  { ok: false, codigo: "contenido" },
);
// RIFF sin WEBP.
const RIFF_AVI = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
]);
assert.deepEqual(validarComprobante({ mime: "image/webp", size: 1000, magicBytes: RIFF_AVI }), {
  ok: false,
  codigo: "contenido",
});

console.log("comprobantes: OK");
```

- [ ] **Step 2: Agregar el script y correr el test para verificar que falla**

En `package.json`, dentro de `"scripts"`, junto a los demás `test:*`:

```json
"test:comprobantes": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/comprobantes.test.ts",
```

Run: `npm run test:comprobantes`
Expected: FAIL — `Cannot find module './comprobantes'`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/comprobantes.ts`:

```ts
export const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type MimeComprobante = (typeof MIME_PERMITIDOS)[number];

export const MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024;

const EXTENSION_POR_MIME: Record<MimeComprobante, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// La key la arma siempre el servidor: prefijo fijo, id de la orden y un uuid.
// El patron es deliberadamente estricto para que nada con `..`, barras extra o
// una extension ajena pueda colarse.
const KEY_PATTERN =
  /^cobros\/([a-z0-9]{20,32})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export type ResultadoValidacion =
  | { ok: true; mime: MimeComprobante }
  | { ok: false; codigo: 'mime' | 'tamano' | 'contenido' };

export function esMimeComprobante(value: string): value is MimeComprobante {
  return (MIME_PERMITIDOS as readonly string[]).includes(value);
}

export function buildComprobanteKey(
  ordenId: string,
  mime: MimeComprobante,
  uuid: string,
): string {
  return `cobros/${ordenId}/${uuid}.${EXTENSION_POR_MIME[mime]}`;
}

export function parseComprobanteKey(key: string): { ordenId: string } | null {
  const match = KEY_PATTERN.exec(key);
  return match ? { ordenId: match[1] } : null;
}

// Los primeros bytes tienen que corresponder al MIME declarado: un
// `Content-Type` lo elige quien sube, la firma del archivo no.
function firmaCoincide(mime: MimeComprobante, bytes: Uint8Array): boolean {
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === 'image/png') {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= 8 && png.every((byte, i) => bytes[i] === byte);
  }
  // WebP: "RIFF" en 0..3 y "WEBP" en 8..11.
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  return (
    bytes.length >= 12 &&
    riff.every((byte, i) => bytes[i] === byte) &&
    webp.every((byte, i) => bytes[8 + i] === byte)
  );
}

export function validarComprobante(input: {
  mime: string;
  size: number;
  magicBytes: Uint8Array;
}): ResultadoValidacion {
  // El navegador puede mandar `image/jpeg; charset=binary`.
  const mime = input.mime.split(';')[0].trim().toLowerCase();
  if (!esMimeComprobante(mime)) return { ok: false, codigo: 'mime' };
  if (input.size <= 0 || input.size > MAX_COMPROBANTE_BYTES) {
    return { ok: false, codigo: 'tamano' };
  }
  if (!firmaCoincide(mime, input.magicBytes)) {
    return { ok: false, codigo: 'contenido' };
  }
  return { ok: true, mime };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm run test:comprobantes`
Expected: PASS — imprime `comprobantes: OK` y sale con código 0.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/comprobantes.ts lib/comprobantes.test.ts package.json
git commit -m "feat(cobros): add pure validation rules for transfer receipts"
```

---

### Task 2: Capa de object storage

Envoltorio delgado sobre el SDK. Nada fuera de este archivo importa `@aws-sdk/*`, para que cambiar de AWS a R2 o MinIO sea cambiar variables de entorno.

**Files:**
- Create: `lib/storage.ts`
- Create: `.env.example`
- Modify: `package.json` (dependencias)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `storageConfigurado(): boolean`, `putObject(key: string, body: Buffer, contentType: string): Promise<void>`, `objectExists(key: string): Promise<boolean>`, `getSignedReadUrl(key: string, ttlSeconds: number): Promise<string>`.

- [ ] **Step 1: Instalar las dependencias**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected: `package.json` queda con ambas en `dependencies`.

- [ ] **Step 2: Escribir `lib/storage.ts`**

```ts
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
  } catch {
    return false;
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
```

- [ ] **Step 3: Documentar las variables de entorno**

Crear `.env.example`:

```bash
# Base de datos
DATABASE_URL="postgresql://usuario:clave@localhost:5432/restaurant_pos"

# Origen publico de la app, usado para el enlace de cobro por QR
NEXT_PUBLIC_APP_URL="https://pos.ejemplo.com"

# Object storage de comprobantes de transferencia.
# Sin estas variables la app funciona: la subida queda deshabilitada.
S3_BUCKET="restaurant-pos-comprobantes"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
# Solo para proveedores compatibles con S3 (Cloudflare R2, MinIO):
# S3_ENDPOINT="https://<accountid>.r2.cloudflarestorage.com"
# S3_FORCE_PATH_STYLE="true"
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificar contra un MinIO local**

Levantar MinIO y crear el bucket:

```bash
docker run -d --name minio-pos -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin quay.io/minio/minio server /data --console-address ":9001"
```

Crear el bucket `restaurant-pos-comprobantes` desde la consola en `http://localhost:9001` (usuario y clave `minioadmin`).

En `.env.local`:

```bash
S3_BUCKET="restaurant-pos-comprobantes"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_ENDPOINT="http://localhost:9000"
S3_FORCE_PATH_STYLE="true"
```

Comprobar el ciclo completo con un script temporal:

```bash
cat > /tmp/probar-storage.ts <<'EOF'
import { getSignedReadUrl, objectExists, putObject, storageConfigurado } from "./lib/storage";

async function main() {
  console.log("configurado:", storageConfigurado());
  await putObject("cobros/prueba/uno.jpg", Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg");
  console.log("existe:", await objectExists("cobros/prueba/uno.jpg"));
  console.log("ausente:", await objectExists("cobros/prueba/no-existe.jpg"));
  console.log("url:", await getSignedReadUrl("cobros/prueba/uno.jpg", 120));
}
void main();
EOF
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' -r dotenv/config /tmp/probar-storage.ts
```

Expected: `configurado: true`, `existe: true`, `ausente: false`, y una URL firmada que abierta en el navegador descarga el archivo. Si `dotenv` no está instalado, exportar las variables a mano en la shell antes de correrlo.

Borrar el script: `rm /tmp/probar-storage.ts`

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts .env.example package.json package-lock.json
git commit -m "feat(cobros): add S3-compatible storage layer behind env config"
```

---

### Task 3: Validar la key al registrar el cobro

Cierra el paso crudo de `comprobanteTransferenciaKey` a Prisma. Se hace en `collectOrderPayment` porque es el único punto por el que pasan las dos rutas de cobro; validar solo en una dejaría la otra abierta.

**Files:**
- Modify: `lib/order-payment.ts` (imports; validación antes de la transacción; historial)

**Interfaces:**
- Consumes: `parseComprobanteKey` de Task 1, `objectExists` de Task 2.
- Produces: `collectOrderPayment` mantiene su firma actual; ahora lanza `PaymentValidationError` si la key no corresponde a la orden o el objeto no existe.

- [ ] **Step 1: Agregar los imports**

En `lib/order-payment.ts`, después de la línea `import { prisma } from '@/lib/db';`:

```ts
import { parseComprobanteKey } from '@/lib/comprobantes';
import { objectExists } from '@/lib/storage';
```

- [ ] **Step 2: Validar la key antes de la transacción**

En `lib/order-payment.ts`, localizar estas líneas dentro de `collectOrderPayment`:

```ts
  validateOrderCanBePaid(existing, input.expectedRevision, input.origen);
```

Insertar inmediatamente después:

```ts
  // La key nunca se acepta como viene: tiene que tener la forma exacta que arma
  // el servidor, apuntar a ESTA orden, y el objeto tiene que existir de verdad.
  if (input.comprobanteTransferenciaKey) {
    const parsed = parseComprobanteKey(input.comprobanteTransferenciaKey);
    if (!parsed || parsed.ordenId !== input.orderId) {
      throw new PaymentValidationError('El comprobante no corresponde a esta orden');
    }
    if (!(await objectExists(input.comprobanteTransferenciaKey))) {
      throw new PaymentValidationError('El comprobante no se guardó, reintenta');
    }
  }
```

- [ ] **Step 3: Dejar rastro en el historial cuando no hay comprobante**

En `lib/order-payment.ts`, localizar el bloque que arma el historial:

```ts
          tipoAccion: huboOverride ? 'metodo_pago_override' : 'orden_cobrada',
          descripcion: huboOverride
            ? `Cobro en ${input.metodoPago} sobre una orden acordada en ${existing.metodoPagoPrevisto}`
            : `Orden cobrada en ${input.metodoPago} por ${input.user.nombre}`,
```

Reemplazarlo por:

```ts
          tipoAccion: huboOverride ? 'metodo_pago_override' : 'orden_cobrada',
          descripcion: `${
            huboOverride
              ? `Cobro en ${input.metodoPago} sobre una orden acordada en ${existing.metodoPagoPrevisto}`
              : `Orden cobrada en ${input.metodoPago} por ${input.user.nombre}`
          }${sinComprobante ? ' · sin comprobante de transferencia' : ''}`,
```

Y declarar `sinComprobante` junto a `huboOverride`, localizando:

```ts
  const huboOverride =
    esMetodoPago(existing.metodoPagoPrevisto) &&
    existing.metodoPagoPrevisto !== input.metodoPago;
```

Agregar debajo:

```ts
  // Se permite cobrar una transferencia sin comprobante, pero queda asentado:
  // el cuadre lo muestra al cerrar el dia.
  const sinComprobante =
    input.metodoPago === 'transferencia' && !input.comprobanteTransferenciaKey;
```

- [ ] **Step 4: Registrar la key en `datosDespues`**

En el mismo bloque de historial, localizar:

```ts
          datosDespues: {
            cobrada: true,
            metodoPago: input.metodoPago,
```

Agregar la línea de comprobante justo debajo de `metodoPago`:

```ts
          datosDespues: {
            cobrada: true,
            metodoPago: input.metodoPago,
            comprobanteTransferenciaKey: input.comprobanteTransferenciaKey ?? null,
```

- [ ] **Step 5: Verificar tipos y que los tests siguen pasando**

Run: `npx tsc --noEmit && npm run test:comprobantes && npm run test:cuadre`
Expected: sin errores de tipos; ambos tests en PASS.

- [ ] **Step 6: Verificar manualmente que una key ajena se rechaza**

Con el servidor de desarrollo corriendo y una sesión de mesero activa, tomar el `id` de una orden sin cobrar y su `printRevision`, y llamar la ruta interna con una key que apunta a otra orden:

```bash
curl -i -X PATCH "http://localhost:3000/api/ordenes/<ID_ORDEN>/cobrar" -H "Content-Type: application/json" -H "Cookie: restaurant_pos_session=<TU_COOKIE>" -d '{"metodoPago":"transferencia","expectedRevision":0,"idempotencyKey":"abcdefghijklmnop1234","comprobanteTransferenciaKey":"cobros/otra-orden-cualquiera/3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b.jpg"}'
```

Expected: `HTTP/1.1 400` con `{"error":"El comprobante no corresponde a esta orden"}`. La orden sigue sin cobrar.

- [ ] **Step 7: Commit**

```bash
git add lib/order-payment.ts
git commit -m "fix(cobros): validate receipt key against the order before charging"
```

---

### Task 4: Ruta de subida del comprobante

**Files:**
- Create: `app/api/cobros/[token]/comprobante/route.ts`

**Interfaces:**
- Consumes: `validarComprobante`, `buildComprobanteKey`, `MAX_COMPROBANTE_BYTES` de Task 1; `putObject`, `storageConfigurado` de Task 2; `hashPaymentToken` de `lib/payment-link.ts`; `getAuthenticatedUser`, `canCollectPayments` de `lib/session.ts`.
- Produces: `POST /api/cobros/[token]/comprobante` responde `{ objectKey: string }` con `200`.

- [ ] **Step 1: Escribir la ruta**

Crear `app/api/cobros/[token]/comprobante/route.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  MAX_COMPROBANTE_BYTES,
  buildComprobanteKey,
  validarComprobante,
} from '@/lib/comprobantes';
import { prisma } from '@/lib/db';
import { hashPaymentToken } from '@/lib/payment-link';
import { canCollectPayments, getAuthenticatedUser } from '@/lib/session';
import { putObject, storageConfigurado } from '@/lib/storage';

const MENSAJE_POR_CODIGO = {
  mime: 'El archivo no es una imagen válida',
  contenido: 'El archivo no es una imagen válida',
  tamano: 'La foto es muy pesada, repítela',
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (!canCollectPayments(usuario)) {
      return NextResponse.json({ error: 'Rol no autorizado para cobrar' }, { status: 403 });
    }
    if (!storageConfigurado()) {
      return NextResponse.json(
        { error: 'El almacenamiento de comprobantes no está configurado' },
        { status: 503 },
      );
    }

    // Corte barato antes de leer el cuerpo entero en memoria. El margen cubre la
    // envoltura multipart, que suma unos cientos de bytes al archivo.
    const declarado = Number(request.headers.get('content-length') ?? 0);
    if (declarado > MAX_COMPROBANTE_BYTES + 64 * 1024) {
      return NextResponse.json(
        { error: MENSAJE_POR_CODIGO.tamano },
        { status: 413 },
      );
    }

    const { token } = await params;
    const orden = await prisma.orden.findUnique({
      where: { cobroTokenHash: hashPaymentToken(token) },
      select: { id: true, cobrada: true },
    });
    // Igual que en el cobro: el token se resuelve despues de autenticar, para no
    // filtrar si es valido.
    if (!orden) {
      return NextResponse.json({ error: 'Enlace de cobro no válido' }, { status: 404 });
    }
    if (orden.cobrada) {
      return NextResponse.json({ error: 'Esta orden ya fue cobrada' }, { status: 409 });
    }

    const form = await request.formData();
    const archivo = form.get('archivo');
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const validacion = validarComprobante({
      mime: archivo.type,
      size: buffer.byteLength,
      magicBytes: buffer.subarray(0, 12),
    });
    if (!validacion.ok) {
      return NextResponse.json(
        { error: MENSAJE_POR_CODIGO[validacion.codigo] },
        { status: validacion.codigo === 'tamano' ? 413 : 400 },
      );
    }

    // La key la arma el servidor a partir de la orden resuelta por el token: el
    // cliente nunca elige donde se escribe.
    const objectKey = buildComprobanteKey(orden.id, validacion.mime, randomUUID());
    await putObject(objectKey, buffer, validacion.mime);

    return NextResponse.json({ objectKey });
  } catch (error) {
    console.error('Error al subir el comprobante:', error);
    return NextResponse.json(
      { error: 'No se pudo guardar el comprobante' },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificar la ruta contra MinIO**

Con MinIO corriendo (Task 2, Step 5), `npm run dev`, una sesión de mesero y el token de una orden sin cobrar:

```bash
curl -i -X POST "http://localhost:3000/api/cobros/<TOKEN>/comprobante" -H "Cookie: restaurant_pos_session=<TU_COOKIE>" -F "archivo=@/ruta/a/una/foto.jpg"
```

Expected: `200` con `{"objectKey":"cobros/<idOrden>/<uuid>.jpg"}`, y el objeto visible en la consola de MinIO.

Repetir con un archivo que no sea imagen:

```bash
printf '%%PDF-1.4\n' > /tmp/falso.jpg
curl -i -X POST "http://localhost:3000/api/cobros/<TOKEN>/comprobante" -H "Cookie: restaurant_pos_session=<TU_COOKIE>" -F "archivo=@/tmp/falso.jpg;type=image/jpeg"
```

Expected: `400` con `{"error":"El archivo no es una imagen válida"}` — la validación de bytes reales atrapa el `Content-Type` mentido.

Y sin sesión:

```bash
curl -i -X POST "http://localhost:3000/api/cobros/<TOKEN>/comprobante" -F "archivo=@/ruta/a/una/foto.jpg"
```

Expected: `401`.

Limpiar: `rm /tmp/falso.jpg`

- [ ] **Step 4: Commit**

```bash
git add app/api/cobros/\[token\]/comprobante/route.ts
git commit -m "feat(cobros): add receipt upload endpoint for QR payments"
```

---

### Task 5: Subida desde la pantalla de cobro por QR

**Files:**
- Create: `lib/imagen-cliente.ts`
- Modify: `components/cobros/CobrarOrdenClient.tsx`
- Modify: `app/ordenes/cobrar/[token]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/cobros/[token]/comprobante` de Task 4; `storageConfigurado` de Task 2.
- Produces: `comprimirImagen(file: File, maxLado?: number, calidad?: number): Promise<Blob>`; `CobrarOrdenClient` acepta la prop nueva `storageDisponible: boolean`.

- [ ] **Step 1: Escribir la compresión de imagen**

Crear `lib/imagen-cliente.ts`:

```ts
// Corre solo en el navegador. Una foto de celular pesa 3-8 MB; comprimida a
// 1600 px de lado mayor y JPEG 0.8 queda en unos 200 KB, que es lo que sube.
export async function comprimirImagen(
  file: File,
  maxLado = 1600,
  calidad = 0.8,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('No se pudo procesar la imagen');
  contexto.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', calidad),
  );
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return blob;
}
```

- [ ] **Step 2: Pasar la disponibilidad del storage desde el servidor**

En `app/ordenes/cobrar/[token]/page.tsx`, agregar el import:

```ts
import { storageConfigurado } from '@/lib/storage';
```

Y en el JSX donde se renderiza `<CobrarOrdenClient ... />`, agregar la prop:

```tsx
storageDisponible={storageConfigurado()}
```

- [ ] **Step 3: Ampliar el estado y la firma del componente**

En `components/cobros/CobrarOrdenClient.tsx`, agregar el import junto a los existentes:

```ts
import { comprimirImagen } from "@/lib/imagen-cliente";
```

Cambiar la firma del componente, agregando `storageDisponible` a las props:

```tsx
export default function CobrarOrdenClient({
  token,
  orden,
  usuario,
  successUrl,
  cerrarAlFinalizar,
  storageDisponible,
}: {
  token: string;
  orden: CobroOrder;
  usuario: AuthenticatedUser;
  successUrl: string;
  cerrarAlFinalizar: boolean;
  storageDisponible: boolean;
}) {
```

Agregar dos estados junto a los existentes, después de `const [photo, setPhoto] = useState<File | null>(null);`:

```tsx
  const [subiendo, setSubiendo] = useState(false);
  const [falloSubida, setFalloSubida] = useState(false);
```

- [ ] **Step 4: Aceptar la key en `cobrar` y agregar el flujo de subida**

En `components/cobros/CobrarOrdenClient.tsx`, cambiar la firma de `cobrar` y el cuerpo del `fetch`. Localizar:

```tsx
  const cobrar = async (metodoPago: MetodoPago) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/cobros/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metodoPago,
          expectedRevision: orden.printRevision,
          idempotencyKey: idempotencyKey.current,
        }),
      });
```

Reemplazar por:

```tsx
  const cobrar = async (
    metodoPago: MetodoPago,
    comprobanteTransferenciaKey?: string,
  ) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/cobros/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metodoPago,
          expectedRevision: orden.printRevision,
          idempotencyKey: idempotencyKey.current,
          ...(comprobanteTransferenciaKey ? { comprobanteTransferenciaKey } : {}),
        }),
      });
```

Y agregar una función nueva justo después del cierre de `cobrar` (la línea `};` que sigue al bloque `finally`):

```tsx
  // Sube primero y cobra despues, con la key ya validada. Si el storage falla, el
  // cobro no se bloquea: la pantalla ofrece reintentar o registrar sin
  // comprobante, y el cuadre marca despues esa transferencia.
  const subirYCobrar = async () => {
    if (!photo) return;
    setSubiendo(true);
    setError("");
    setFalloSubida(false);
    try {
      const comprimida = await comprimirImagen(photo);
      const formData = new FormData();
      formData.append(
        "archivo",
        new File([comprimida], "comprobante.jpg", { type: "image/jpeg" }),
      );
      const respuesta = await fetch(
        `/api/cobros/${encodeURIComponent(token)}/comprobante`,
        { method: "POST", body: formData },
      );
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo subir el comprobante");
      setSubiendo(false);
      await cobrar("transferencia", datos.objectKey);
    } catch (subidaError) {
      setSubiendo(false);
      setFalloSubida(true);
      setError(
        subidaError instanceof Error
          ? subidaError.message
          : "No se pudo subir el comprobante",
      );
    }
  };
```

- [ ] **Step 5: Actualizar la sección de transferencia**

En `components/cobros/CobrarOrdenClient.tsx`, localizar el bloque completo desde `{photo && (` hasta el cierre del botón "Confirmar transferencia", es decir:

```tsx
            {photo && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Foto seleccionada: <strong>{photo.name}</strong>. La carga persistente a S3 queda preparada para la siguiente fase; esta versión todavía no envía el archivo.
              </div>
            )}
            <button
              onClick={() => void cobrar("transferencia")}
              disabled={loading || !photo}
              className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              {loading ? "Registrando…" : "Confirmar transferencia"}
            </button>
```

Reemplazarlo por:

```tsx
            {photo && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Foto seleccionada: <strong>{photo.name}</strong>
              </div>
            )}
            {!storageDisponible && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                El almacenamiento de comprobantes no está configurado en este
                entorno. Puedes registrar el cobro, pero la foto no se guardará.
              </div>
            )}
            {falloSubida ? (
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => void subirYCobrar()}
                  disabled={loading || subiendo}
                  className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  {subiendo ? "Subiendo…" : "Reintentar"}
                </button>
                <button
                  onClick={() => void cobrar("transferencia")}
                  disabled={loading || subiendo}
                  className="w-full rounded-xl border border-amber-400 bg-amber-50 py-3 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {loading ? "Registrando…" : "Registrar sin comprobante"}
                </button>
              </div>
            ) : (
              <button
                onClick={() =>
                  storageDisponible
                    ? void subirYCobrar()
                    : void cobrar("transferencia")
                }
                disabled={loading || subiendo || (storageDisponible && !photo)}
                className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {subiendo
                  ? "Subiendo comprobante…"
                  : loading
                    ? "Registrando…"
                    : "Confirmar transferencia"}
              </button>
            )}
```

- [ ] **Step 6: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Verificar el flujo completo en el navegador**

Con MinIO y `npm run dev` corriendo, abrir `/ordenes/cobrar/<TOKEN>` de una orden sin cobrar, iniciar sesión como mesero, elegir 🏦 Transferencia, adjuntar una foto y confirmar.

Expected:
1. El botón pasa por "Subiendo comprobante…" y luego "Registrando…".
2. En la consola de MinIO aparece un objeto bajo `cobros/<idOrden>/`, de ~200 KB aunque la foto original pesara varios MB.
3. En la base, `SELECT "comprobanteTransferenciaKey" FROM "Orden" WHERE id = '<ID>';` devuelve la misma key.

Después, con MinIO detenido (`docker stop minio-pos`), repetir sobre otra orden sin cobrar.

Expected: aparece el error, con los botones **Reintentar** y **Registrar sin comprobante**; el segundo cobra la orden y deja `comprobanteTransferenciaKey` en `NULL`, y el historial de esa orden incluye "· sin comprobante de transferencia".

Volver a levantar MinIO: `docker start minio-pos`

- [ ] **Step 8: Commit**

```bash
git add lib/imagen-cliente.ts components/cobros/CobrarOrdenClient.tsx app/ordenes/cobrar/\[token\]/page.tsx
git commit -m "feat(cobros): upload transfer receipt from the QR payment screen"
```

---

### Task 6: Lectura del comprobante en el panel admin

**Files:**
- Create: `app/api/admin/ordenes/[id]/comprobante/route.ts`
- Modify: `components/admin/DetalleOrdenModal.tsx`

**Interfaces:**
- Consumes: `getSignedReadUrl` de Task 2; `parseComprobanteKey` de Task 1.
- Produces: `GET /api/admin/ordenes/[id]/comprobante` responde `{ url: string; expiraEn: number }`.

- [ ] **Step 1: Escribir la ruta de lectura**

Crear `app/api/admin/ordenes/[id]/comprobante/route.ts`:

```ts
import { NextResponse } from 'next/server';

import { parseComprobanteKey } from '@/lib/comprobantes';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { getSignedReadUrl, storageConfigurado } from '@/lib/storage';

const TTL_SEGUNDOS = 120;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (usuario.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }
    if (!storageConfigurado()) {
      return NextResponse.json(
        { error: 'El almacenamiento de comprobantes no está configurado' },
        { status: 503 },
      );
    }

    const { id } = await params;
    const orden = await prisma.orden.findUnique({
      where: { id },
      select: { id: true, comprobanteTransferenciaKey: true },
    });
    if (!orden?.comprobanteTransferenciaKey) {
      return NextResponse.json({ error: 'Esta orden no tiene comprobante' }, { status: 404 });
    }
    // Defensa en profundidad: aunque la key la escribio el servidor, se vuelve a
    // comprobar que pertenece a esta orden antes de firmar una lectura.
    const parsed = parseComprobanteKey(orden.comprobanteTransferenciaKey);
    if (!parsed || parsed.ordenId !== orden.id) {
      return NextResponse.json({ error: 'Comprobante inválido' }, { status: 404 });
    }

    const url = await getSignedReadUrl(orden.comprobanteTransferenciaKey, TTL_SEGUNDOS);
    return NextResponse.json({ url, expiraEn: TTL_SEGUNDOS });
  } catch (error) {
    console.error('Error al firmar el comprobante:', error);
    return NextResponse.json({ error: 'No se pudo abrir el comprobante' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Declarar el campo en la interfaz del modal**

En `components/admin/DetalleOrdenModal.tsx`, dentro de `interface Orden`, junto a `metodoPago?: string | null;`:

```ts
  comprobanteTransferenciaKey?: string | null;
```

- [ ] **Step 3: Agregar el bloque de comprobante al modal**

En `components/admin/DetalleOrdenModal.tsx`, agregar el estado junto a los demás `useState` del componente:

```tsx
  const [abriendoComprobante, setAbriendoComprobante] = useState(false);
```

Y la función, junto a las demás funciones del componente:

```tsx
  // La URL firmada se pide recien en el clic y no se guarda en ningun lado: una
  // lista de ordenes no debe disparar decenas de URLs ni mostrar datos bancarios
  // a quien solo revisa totales.
  const abrirComprobante = async () => {
    setAbriendoComprobante(true);
    try {
      const respuesta = await fetch(`/api/admin/ordenes/${orden.id}/comprobante`);
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo abrir el comprobante");
      window.open(datos.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo abrir el comprobante");
    } finally {
      setAbriendoComprobante(false);
    }
  };
```

Insertar el bloque en el JSX inmediatamente antes del comentario `{/* Observaciones Generales */}` (alrededor de `components/admin/DetalleOrdenModal.tsx:340`), respetando esa indentación:

```tsx
              {orden.metodoPago === "transferencia" && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-gray-500">Comprobante</p>
                  {orden.comprobanteTransferenciaKey ? (
                    <button
                      onClick={() => void abrirComprobante()}
                      disabled={abriendoComprobante}
                      className="mt-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-400"
                    >
                      {abriendoComprobante ? "Abriendo…" : "📎 Ver comprobante"}
                    </button>
                  ) : (
                    <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Registrado sin comprobante
                    </p>
                  )}
                </div>
              )}
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificar en el navegador**

Como admin, abrir el detalle de la orden cobrada con comprobante en Task 5.

Expected: aparece "📎 Ver comprobante"; el clic abre la imagen en una pestaña nueva. Abrir el detalle de la orden cobrada sin comprobante y verificar que dice "Registrado sin comprobante". Copiar la URL firmada, esperar más de dos minutos y recargarla: debe fallar por expiración.

Verificar también que un mesero no puede usar la ruta:

```bash
curl -i "http://localhost:3000/api/admin/ordenes/<ID_ORDEN>/comprobante" -H "Cookie: restaurant_pos_session=<COOKIE_DE_MESERO>"
```

Expected: `403`.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/ordenes/\[id\]/comprobante/route.ts components/admin/DetalleOrdenModal.tsx
git commit -m "feat(admin): view transfer receipt from the order detail modal"
```

---

### Task 7: Indicador de comprobante en el cuadre de caja

Es la contrapartida de permitir cobrar sin comprobante: al cerrar el día, cada transferencia sin respaldo queda visible.

**Files:**
- Modify: `app/admin/page.tsx` (interfaz `Orden` y la celda de método de pago)

**Interfaces:**
- Consumes: `GET /api/admin/ordenes/[id]/comprobante` de Task 6.
- Produces: nada que consuman tareas posteriores.

No hace falta tocar `app/api/admin/cuadre/route.ts`: su respuesta se arma con `...safeOrder`, que ya arrastra todos los escalares de `Orden`, incluido `comprobanteTransferenciaKey`.

- [ ] **Step 1: Declarar el campo en la interfaz**

En `app/admin/page.tsx`, dentro de `interface Orden`, junto a `metodoPago: string | null;`:

```ts
  comprobanteTransferenciaKey?: string | null;
```

- [ ] **Step 2: Agregar la función que abre el comprobante**

En `app/admin/page.tsx`, junto a las demás funciones del componente (por ejemplo cerca de `cobrarOrden`):

```tsx
  // Igual que en el detalle: la URL firmada se pide en el clic, nunca antes.
  const abrirComprobante = async (ordenId: string) => {
    try {
      const res = await fetch(`/api/admin/ordenes/${ordenId}/comprobante`);
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error || "No se pudo abrir el comprobante");
      window.open(datos.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo abrir el comprobante");
    }
  };
```

- [ ] **Step 3: Renderizar el indicador en la fila**

En `app/admin/page.tsx`, localizar el cierre del badge de método de pago dentro de la celda de cobro:

```tsx
                                {orden.metodoPago === "efectivo"
                                  ? "💵 Efectivo"
                                  : "🏦 Transferencia"}
                              </span>
```

Insertar inmediatamente después de ese `</span>`:

```tsx
                              {orden.metodoPago === "transferencia" &&
                                (orden.comprobanteTransferenciaKey ? (
                                  <button
                                    onClick={() => void abrirComprobante(orden.id)}
                                    className="self-start text-xs font-bold text-blue-700 underline"
                                  >
                                    📎 Ver comprobante
                                  </button>
                                ) : (
                                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    ⚠️ Sin comprobante
                                  </span>
                                ))}
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificar en el navegador**

Como admin, abrir el cuadre del día en que se hicieron las pruebas de Task 5.

Expected: la orden con comprobante muestra "📎 Ver comprobante" y abre la imagen; la orden cobrada sin comprobante muestra el aviso ámbar "⚠️ Sin comprobante"; las órdenes en efectivo no muestran ninguno de los dos.

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): flag transfers without receipt in the cash close view"
```

---

### Task 8: Documentación e infraestructura del bucket

**Files:**
- Modify: `docs/COBROS_QR.md`
- Create: `docs/COMPROBANTES_STORAGE.md`

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Actualizar `docs/COBROS_QR.md`**

Reemplazar la sección completa que empieza en `## Pendiente: comprobantes en S3` y termina en la línea `Hasta integrar S3, la pantalla avisa expresamente que la foto seleccionada no se persiste.` por:

```markdown
## Comprobantes de transferencia

El cobro por QR con transferencia sube la foto del comprobante antes de
registrar el pago. El navegador la comprime (1600 px de lado mayor, JPEG 0.8) y
la envía a `POST /api/cobros/[token]/comprobante`; el servidor valida el MIME,
el tamaño y los bytes reales del archivo, arma la `objectKey` a partir de la
orden resuelta por el token y la sube al bucket. El cobro viaja después con esa
key, que `collectOrderPayment` vuelve a validar contra la orden y contra la
existencia del objeto.

La subida pasa por el servidor en lugar de usar una carga prefirmada: con
`output: 'standalone'` no hay límite de body que esquivar, y proxyar deja el
bucket privado, sin CORS, y permite validar el contenido real y no un
`Content-Type` que el cliente declara.

Si el almacenamiento falla, el cobro no se bloquea: la pantalla ofrece
reintentar o registrar sin comprobante. Esa transferencia queda marcada en el
historial de la orden y aparece con un aviso "⚠️ Sin comprobante" en el cuadre
de caja. Los comprobantes se consultan desde el detalle de orden y el cuadre,
solo con rol admin, mediante una URL firmada de 120 segundos que nunca se
persiste.

Los detalles de configuración y del bucket están en
`docs/COMPROBANTES_STORAGE.md`.

Siguen sin capturar comprobante, por decisión de alcance: el cobro de
transferencia desde la lista interna (mesero, admin y digital) y la
confirmación de transferencia al crear un domicilio.
```

- [ ] **Step 2: Escribir el documento de infraestructura**

Crear `docs/COMPROBANTES_STORAGE.md`:

```markdown
# Almacenamiento de comprobantes

Las imágenes de comprobantes viven en un bucket compatible con S3. La aplicación
no depende de un proveedor concreto: `lib/storage.ts` es el único módulo que
habla con el SDK y se configura por variables de entorno.

## Variables

| Variable | Obligatoria | Nota |
|---|---|---|
| `S3_BUCKET` | sí | |
| `S3_REGION` | sí | `auto` en Cloudflare R2 |
| `S3_ACCESS_KEY_ID` | sí | |
| `S3_SECRET_ACCESS_KEY` | sí | |
| `S3_ENDPOINT` | no | requerida en R2 y MinIO |
| `S3_FORCE_PATH_STYLE` | no | `true` en MinIO |

Si falta alguna de las obligatorias, la aplicación arranca igual: la subida se
deshabilita, la pantalla de cobro lo avisa y el cobro sigue disponible sin
comprobante.

## Configuración del bucket

- **Acceso público bloqueado.** El navegador nunca habla directo con el bucket:
  la subida pasa por el servidor y la lectura usa URLs firmadas. No hace falta
  configurar CORS.
- **Cifrado en reposo.** Contra AWS la aplicación envía
  `ServerSideEncryption: AES256`. R2 y MinIO cifran por su cuenta y rechazan o
  ignoran esa cabecera, así que solo se envía cuando `S3_ENDPOINT` está vacío.
- **Retención: 30 días.** Regla de lifecycle que expira los objetos bajo el
  prefijo `cobros/`, sin transición de clase de almacenamiento. Para ventanas
  cortas la clase Standard es la más barata: Standard-IA factura un mínimo de 30
  días por objeto y Glacier 90, de modo que mover objetos antes de que expiren
  sale más caro. La `objectKey` permanece en la base aunque el objeto expire.

Regla de lifecycle en AWS:

```json
{
  "Rules": [
    {
      "ID": "expirar-comprobantes",
      "Status": "Enabled",
      "Filter": { "Prefix": "cobros/" },
      "Expiration": { "Days": 30 }
    }
  ]
}
```

```bash
aws s3api put-bucket-lifecycle-configuration --bucket "$S3_BUCKET" --lifecycle-configuration file://lifecycle.json
```

## Objetos huérfanos

La subida ocurre antes de la transacción de cobro. Si el cobro falla después por
conflicto, o si quien cobra reintenta con otra foto, el objeto ya escrito queda
sin referencia en la base. El lifecycle de 30 días los elimina; no hay proceso
de limpieza propio.

## Desarrollo local

```bash
docker run -d --name minio-pos -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin quay.io/minio/minio server /data --console-address ":9001"
```

Crear el bucket desde `http://localhost:9001` y apuntar `.env.local` a
`http://localhost:9000` con `S3_FORCE_PATH_STYLE="true"`.
```

- [ ] **Step 3: Correr toda la batería de tests**

Run:

```bash
npm run test:comprobantes && npm run test:cuadre && npm run test:retiros-validaciones && npm run test:admin-validaciones && npm run test:navegacion && npx tsc --noEmit && npm run lint
```

Expected: todos en PASS, sin errores de tipos ni de lint.

- [ ] **Step 4: Commit**

```bash
git add docs/COBROS_QR.md docs/COMPROBANTES_STORAGE.md
git commit -m "docs(cobros): document receipt storage flow and bucket setup"
```
