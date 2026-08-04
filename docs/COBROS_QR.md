# Cobros por QR y URL

## Flujo implementado

1. Cada orden nueva recibe un token aleatorio. En base se persisten su hash y la URL canónica.
2. La comanda imprime el QR para órdenes locales, para llevar y domicilios en efectivo.
3. Un domicilio por transferencia exige confirmar explícitamente que el dinero ya fue recibido y se registra pagado dentro de la misma transacción de creación. Si requiere aprobación por falta de stock, el pago se difiere hasta aprobarlo.
4. El QR abre `/ordenes/cobrar/[token]`. El token identifica la orden, pero no autoriza el cobro.
5. La página exige una sesión de servidor en cookie `HttpOnly`, `SameSite=Lax`. Si falta, vuelve al login y después retorna al QR.
6. Admin, mesero y digital cobran cualquier orden, sin importar quién la creó. Cocina no tiene permiso. La restricción por creador solo sigue vigente para modificar los items de una orden.
7. La confirmación crea un único registro `Cobro`, actualiza `Orden` mediante compare-and-set y escribe el historial en la misma transacción.

## Invariantes de caja

- `total = productos + recipientes + envío`.
- Domicilio en efectivo: el local recibe `total - envío`; el motorizado conserva el envío.
- Domicilio por transferencia: el local recibe el total por transferencia y entrega el envío en efectivo al motorizado.
- El cobro por enlace (QR) puede realizarse en cualquier estado operativo, sin importar el tipo de orden, siempre que la orden exista y no esté cobrada, cancelada ni pendiente de aprobación por stock. Al confirmar el pago, la orden se cierra como `cobrada` (marcada como lista y cobrada). El cobro desde la lista interna mantiene la regla previa: las órdenes de mesa solo se cobran cuando están listas o entregadas.
- `Cobro` guarda snapshots inmutables de total, envío, efectivo recibido, efectivo entregado y transferencia recibida.
- Si una transferencia confirmada queda sin stock y el admin rechaza la orden, el cobro pasa a `REEMBOLSO_PENDIENTE`; el cuadre mantiene visible el dinero recibido y muestra la obligación de devolución.

## Despliegue

1. Configurar `NEXT_PUBLIC_APP_URL` con el origen público, por ejemplo `https://pos.ejemplo.com`. Si falta, se usa el origen de la petición de creación.
2. Ejecutar `npx prisma migrate deploy` en el entorno correspondiente.
3. Desplegar la aplicación y después los agentes de impresión. El campo `paymentUrl` es opcional y mantiene compatibilidad progresiva con agentes anteriores.

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
