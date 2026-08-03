# Cobros por QR y URL

## Flujo implementado

1. Cada orden nueva recibe un token aleatorio. En base se persisten su hash y la URL canónica.
2. La comanda imprime el QR para órdenes locales, para llevar y domicilios en efectivo.
3. Un domicilio por transferencia exige confirmar explícitamente que el dinero ya fue recibido y se registra pagado dentro de la misma transacción de creación. Si requiere aprobación por falta de stock, el pago se difiere hasta aprobarlo.
4. El QR abre `/ordenes/cobrar/[token]`. El token identifica la orden, pero no autoriza el cobro.
5. La página exige una sesión de servidor en cookie `HttpOnly`, `SameSite=Lax`. Si falta, vuelve al login y después retorna al QR.
6. Mesero y digital solo cobran órdenes propias; admin puede cobrar cualquiera. Cocina no tiene permiso.
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

## Pendiente: comprobantes en S3

El esquema ya reserva `comprobanteTransferenciaKey` tanto en `Orden` como en `Cobro`, y la pantalla móvil ya abre la cámara con `accept="image/*" capture="environment"`. En la siguiente fase se debe:

- generar una carga prefirmada de corta duración;
- validar MIME, tamaño máximo y prefijo por orden;
- guardar únicamente el `objectKey`, nunca una URL firmada ni credenciales;
- confirmar en servidor que el objeto existe antes de cerrar una transferencia;
- definir retención y cifrado del bucket.

Hasta integrar S3, la pantalla avisa expresamente que la foto seleccionada no se persiste.
