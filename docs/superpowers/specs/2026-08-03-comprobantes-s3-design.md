# Comprobantes de transferencia en object storage

Fecha: 2026-08-03
Estado: aprobado, pendiente de implementar

## Problema

El esquema ya reserva `comprobanteTransferenciaKey` en `Orden` y en `Cobro`, y la
pantalla de cobro por QR ya abre la cámara. Nada de eso llega a un bucket: el
archivo nunca sale del navegador, el campo viaja crudo desde el cliente hasta
Prisma sin validación, y ninguna vista muestra el comprobante. Esta fase cierra
el flujo de punta a punta para el cobro por QR.

## Alcance

Dentro:

- Subida del comprobante desde la pantalla de cobro por QR
  (`components/cobros/CobrarOrdenClient.tsx`).
- Validación en servidor de la key recibida en el cobro.
- Lectura del comprobante en el detalle de orden del panel admin y en el cuadre
  de caja.
- Retención y cifrado del bucket.

Fuera, documentado como deuda:

- Comprobante al cobrar transferencia desde la lista interna
  (`app/mesero/page.tsx`, `app/admin/page.tsx`, `app/digital/page.tsx`).
- Comprobante en la confirmación de transferencia al crear un domicilio
  (`app/api/ordenes/route.ts`, origen `creacion_domicilio_transferencia`).

Ambos flujos siguen registrando transferencias sin respaldo tras esta fase.

## Decisiones

**Storage agnóstico.** El proveedor no está decidido. Toda la interacción con el
object storage vive en `lib/storage.ts`, configurado por variables de entorno, de
modo que AWS S3, Cloudflare R2 o MinIO se eligen al desplegar sin tocar código.

**Subida por el servidor, no prefirmada.** El documento `docs/COBROS_QR.md`
planteaba una carga prefirmada. Se desvía a propósito: el motivo habitual para
prefirmar es no pasar archivos grandes por el runtime, y `next.config.ts` usa
`output: 'standalone'` (servidor Node propio, sin límite de body serverless).
Con la foto comprimida a ~200 KB en el cliente, el proxy no cuesta nada y a
cambio deja el bucket completamente privado —sin CORS ni endpoint alcanzable
desde el navegador— y permite validar los bytes reales del archivo en lugar de
un `Content-Type` que el cliente declara.

**El cobro no se bloquea si la subida falla.** Cuando el storage no responde, la
pantalla ofrece reintentar o registrar el cobro sin comprobante. La
contrapartida es que el cuadre de caja marca cada transferencia sin comprobante
con un aviso visible, para que el hueco sea auditable al cerrar el día.

Consecuencia sobre `docs/COBROS_QR.md`: la línea "confirmar en servidor que el
objeto existe antes de cerrar una transferencia" pasa a aplicarse sólo cuando el
cobro llega con una key. Ese documento se actualiza como parte de esta fase.

**Retención de 30 días, clase Standard.** Para ventanas de 15 a 30 días,
Standard es la clase más barata: Standard-IA factura un mínimo de 30 días por
objeto y Glacier 90, así que mover objetos antes de que expiren sale más caro.
El costo es despreciable en cualquier caso —100 transferencias diarias a ~200 KB
son ~600 MB, alrededor de $0.014 al mes—, de modo que la retención se elige por
privacidad y utilidad, no por precio. La key permanece en la base aunque el
objeto expire.

## Arquitectura

### `lib/storage.ts`

Única puerta al object storage. Nada fuera de este archivo importa `@aws-sdk/*`.

```ts
putObject(key: string, body: Buffer, contentType: string): Promise<void>
getSignedReadUrl(key: string, ttlSeconds: number): Promise<string>
objectExists(key: string): Promise<boolean>
storageConfigurado(): boolean
```

Configuración por entorno:

| Variable | Obligatoria | Nota |
|---|---|---|
| `S3_BUCKET` | sí | |
| `S3_REGION` | sí | `auto` en R2 |
| `S3_ACCESS_KEY_ID` | sí | |
| `S3_SECRET_ACCESS_KEY` | sí | |
| `S3_ENDPOINT` | no | requerida en R2 y MinIO |
| `S3_FORCE_PATH_STYLE` | no | `true` en MinIO |

`storageConfigurado()` devuelve `false` si falta alguna obligatoria. La
aplicación arranca igual: la subida se deshabilita y el cobro sigue funcionando
sin comprobante.

Objetos escritos sin ACL pública. El cifrado en reposo depende del proveedor:
contra AWS S3 se envía `ServerSideEncryption: AES256`; contra R2 y MinIO no se
envía la cabecera, porque ambos cifran en reposo por su cuenta y rechazan o
ignoran ese parámetro. La diferencia se resuelve dentro de `storage.ts` según
`S3_ENDPOINT` esté o no definido.

### `lib/comprobantes.ts`

Reglas puras, sin I/O ni Prisma. Concentra todo lo que puede rechazar una
subida, y por eso se prueba sin bucket ni base de datos.

```ts
MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024

buildComprobanteKey(ordenId: string, ext: string): string
parseComprobanteKey(key: string): { ordenId: string } | null
validarComprobante(input: {
  mime: string;
  size: number;
  magicBytes: Uint8Array;
}): { ok: true } | { ok: false; codigo: 'mime' | 'tamano' | 'contenido' }
```

Formato de key: `cobros/{ordenId}/{uuid}.{ext}`. `parseComprobanteKey` rechaza
cualquier cosa que no calce exactamente con esa forma, incluidos `..`, barras
extra y extensiones fuera de la lista.

La extensión se deriva del MIME ya validado (`image/jpeg` → `jpg`, `image/png` →
`png`, `image/webp` → `webp`), nunca del nombre del archivo que envía el
cliente.

`validarComprobante` compara los primeros bytes contra la firma del MIME
declarado (`FF D8 FF` para JPEG, `89 50 4E 47` para PNG, `RIFF....WEBP` para
WebP). Un `Content-Type` que miente se rechaza con código `contenido`.

### `lib/comprobantes.test.ts`

`node:assert/strict`, script `test:comprobantes`, siguiendo el patrón de
`lib/cuadre.test.ts`. Casos: key bien formada ida y vuelta; key mal formada; key
de otra orden; key con recorrido de directorios; MIME fuera de lista; tamaño
excedido; magic bytes que contradicen el `Content-Type`.

## Endpoints

### `POST /api/cobros/[token]/comprobante`

Recibe el multipart. Cuelga del mismo `[token]` que el cobro para reutilizar la
resolución token→orden y la autorización existentes, sin una segunda ruta de
permisos que mantener.

1. `getAuthenticatedUser()`; sin sesión → `401`.
2. `canCollectPayments(usuario)`; rol sin permiso → `403`.
3. Resolver la orden por `hashPaymentToken(token)`; sin orden → `404`.
4. Leer el archivo, aplicar `validarComprobante`.
5. `buildComprobanteKey(orden.id, ext)` — la key se arma **en el servidor**; el
   cliente nunca elige dónde se escribe.
6. `putObject`, y devolver `{ objectKey }`.

### Validación de la key en `collectOrderPayment`

Hoy la key llega cruda a Prisma por **dos** puertas: `PATCH /api/cobros/[token]`
y `PATCH /api/ordenes/[id]/cobrar`. Validar solo en la primera dejaría la
segunda abierta, así que la validación vive en `lib/order-payment.ts`, el punto
único por el que pasan ambas.

- Si llega key: `parseComprobanteKey` debe devolver el `ordenId` de esta misma
  orden **y** `objectExists` debe confirmarla. Cualquier fallo lanza
  `PaymentValidationError`, que las dos rutas ya traducen a `400`.
- Si no llega key: el cobro procede. El historial registra que la transferencia
  quedó sin comprobante.

### `GET /api/admin/ordenes/[id]/comprobante`

Sólo rol `admin`. Devuelve `{ url, expiraEn }` con URL firmada a 120 segundos.
La URL firmada no se persiste ni se cachea.

## Flujo de datos

```
foto → comprimir en canvas (máx 1600 px, JPEG 0.8, ~200 KB)
     → POST multipart → { objectKey }
     → PATCH cobro { metodoPago, expectedRevision, idempotencyKey, objectKey }
     → servidor revalida key + objectExists
     → transacción existente de collectOrderPayment
```

Dos propiedades del orden elegido, conocidas y aceptadas:

**Objetos huérfanos.** La subida ocurre antes de la transacción de cobro. Si el
cobro falla después por conflicto (`409`), o si el usuario reintenta con otra
foto, el objeto ya escrito queda sin referencia. El lifecycle de 30 días los
elimina; no se agrega tabla de limpieza.

**El primer comprobante gana.** El reintento idempotente del `PATCH` devuelve la
orden ya cobrada sin reescribir la key. Es correcto para auditoría —refleja lo
que se registró— pero subir otra foto tras un reintento no reemplaza la
guardada.

## Lectura

Ninguna vista renderiza la imagen por sí sola. Las dos pantallas muestran un
botón que pide la URL firmada al endpoint recién en el clic y abre el
comprobante. Así una lista de cuarenta órdenes no dispara cuarenta URLs firmadas
ni expone imágenes con datos bancarios a quien sólo estaba revisando totales.

**Detalle de orden (admin).** Cuando la orden es transferencia, un bloque
"Comprobante" con el botón "Ver comprobante" si hay key, o la leyenda
"Registrado sin comprobante" si no la hay.

**Cuadre de caja.** `app/api/admin/cuadre/route.ts` arma su respuesta con
`...safeOrder`, que ya arrastra todos los escalares de `Orden`; por lo tanto
`comprobanteTransferenciaKey` viaja sin ningún cambio de consulta. Solo hace
falta declararlo en la interfaz `Orden` del cliente y renderizarlo. Cada
transferencia lleva un indicador: 📎 que abre el comprobante, o aviso ámbar "sin
comprobante".

## Manejo de errores

| Situación | Respuesta | Qué ve quien cobra |
|---|---|---|
| MIME o bytes no son imagen | `400` | "El archivo no es una imagen válida" |
| Archivo mayor a 5 MB | `413` | "La foto es muy pesada, repítela" |
| Storage caído o timeout | `502` | Error con **Reintentar** y **Registrar sin comprobante** |
| Key ajena o mal formada en el `PATCH` | `400` | No ocurre por UI; cierra la ruta a un cliente manipulado |
| `objectExists` falla | `400` | "El comprobante no se guardó, reintenta" |
| Entorno sin storage configurado | subida deshabilitada | Aviso en pantalla; el cobro sigue disponible |

## Pruebas

`lib/comprobantes.test.ts` cubre las reglas puras, con el patrón del repositorio
(`node:assert/strict`, sin framework ni mocks).

Lo que toca I/O —`lib/storage.ts` y las rutas— se verifica manualmente contra un
MinIO local. El repositorio no tiene infraestructura de tests de integración y
montarla queda fuera de este alcance.

## Infraestructura

- Bucket privado, sin acceso público ni ACL abierta.
- Cifrado en reposo activado (`SSE-S3` / `AES256`).
- Regla de lifecycle: expiración de objetos bajo `cobros/` a los 30 días, sin
  transición de clase de almacenamiento.
- CORS no es necesario: el navegador nunca habla directo con el bucket.

## Cambios en documentación

`docs/COBROS_QR.md` deja de listar los comprobantes como pendientes y refleja lo
implementado: subida por el servidor en lugar de carga prefirmada, la
verificación de existencia condicionada a que llegue una key, la retención de 30
días, y los dos flujos que siguen sin comprobante.
