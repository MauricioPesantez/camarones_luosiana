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

Regla de lifecycle en AWS. Guardar este JSON como `lifecycle.json`:

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

## Límite de tamaño en la subida

El máximo son 5 MB, y se hace cumplir contando los bytes que efectivamente llegan
por el stream de la solicitud: la lectura se corta apenas se supera el límite, sin
esperar a que el cuerpo termine de recibirse.

El encabezado `Content-Length` se consulta antes, pero solo como camino rápido: si
ya viene declarando un cuerpo demasiado grande, la solicitud se rechaza con 413 sin
leer un solo byte. No sirve como control real, porque está ausente cuando el cliente
usa chunked transfer-encoding y puede venir malformado. Por eso un 413 puede
aparecer tanto antes de leer el cuerpo como a mitad de la lectura.

## Techo de payload en Amplify

El despliegue es AWS Amplify Hosting, donde el SSR de Next corre sobre Lambda:
la invocación tiene un techo de payload de unos 6 MB, y es ese techo (no un
límite propio del servidor) el que de verdad acota cuánto puede pesar la
solicitud de subida. Los 5 MB de `validarComprobante` quedan cómodos por
debajo. Hoy no es un problema porque la compresión en el navegador deja la
imagen en unos 200 KB, pero el diseño asume ese margen: subir el objetivo de
compresión, o mandar la foto original sin comprimir, chocaría con el techo de
Lambda antes que con nuestra validación — y ahí ya no se ve nuestro mensaje de
"La foto es muy pesada, repítela", sino un error genérico del gateway.

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
