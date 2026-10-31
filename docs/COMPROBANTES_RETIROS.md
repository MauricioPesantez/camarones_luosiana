# Comprobantes de retiros de caja

Implementación local: 2026-10-31. Pendientes migración en la BD de destino, despliegue, actualización del agente activo y prueba física.

## Formato

Comprobante de 80 mm y 42 columnas, sin logo, QR ni casillas. Incluye identificador completo del retiro, fecha/hora de Ecuador, categoría, motivo, monto y quién retiró el dinero. El adelanto incluye los nombres de quien recibe y quien entrega y dos espacios independientes para sus firmas. Quien entrega es el usuario autenticado que registra la salida, conforme al flujo existente de caja.

`public/plantilla-retiros.html` muestra dos ejemplos ficticios generados con `buildWithdrawalPrintPayload`. Los botones de esa página imprimen solo ejemplos; el flujo real imprime desde el registro del retiro.

## Flujo

- Al crear un retiro, si corresponde la cola según las variables y la fecha de corte actuales, se guarda el retiro y el trabajo `CASH_WITHDRAWAL` en la misma transacción. Un fallo al encolar revierte el registro. La clave única de impresión se forma con el retiro y su revisión.
- Si no corresponde la cola y está habilitada la impresión directa, el envío se realiza después de confirmar el retiro. Un error de impresora se informa como error del comprobante; no pide repetir la salida de dinero. Si ambos mecanismos están habilitados, este comprobante usa solo la cola.
- El reintento del mismo `clientRequestId` devuelve el retiro existente sin retirar ni imprimir de nuevo. No se permite usar el identificador de otro usuario.
- La lista de retiros muestra el estado conocido de la cola al cargarla y ofrece `Imprimir comprobante`. Solo el autor o un administrador pueden usar esa acción; no crea movimientos de caja. Un trabajo pendiente se reutiliza, uno fallido/expirado se reactiva con revisión auditada y una copia posterior a un envío confirmado crea una revisión nueva rotulada como copia.
- Anular el retiro descarta sus trabajos aún pendientes o no confirmados e impide solicitar otras copias. No es posible retirar un papel que ya haya salido: la validez del retiro se consulta en el sistema.
- Las líneas del comprobante se congelan al crear el trabajo. Node y Python validan el formato de texto antes de imprimirlo; las comandas mantienen su formato y QR.

## Migración y despliegue

La migración `20261031000000_add_withdrawal_print_jobs` añade el tipo de impresión y la relación opcional `PrintJob.retiroId`. `ordenId` pasa a ser opcional; una restricción SQL exige exactamente un origen y que corresponda al tipo de documento. Los trabajos históricos conservan su orden y no se convierten en retiros.

Orden de puesta en servicio:

1. Confirmar respaldo, base de datos de destino y agente activo. No cambiar las variables de impresión ni ejecutar dos agentes por esta función.
2. Actualizar el agente Node o Python que ya se usa. Es compatible con la API previa y anuncia explícitamente que admite `CASH_WITHDRAWAL`.
3. Aplicar las migraciones pendientes en la BD de destino mediante el procedimiento de despliegue del proyecto (`npx prisma migrate deploy`), generar el cliente Prisma y desplegar la aplicación actualizada. La migración se debe aplicar antes de que la nueva aplicación consulte `retiroId` o la relación de comprobantes.
4. Revisar primero el agente en `DRY_RUN=true`. Este modo verifica salud pero no reclama trabajos ni demuestra el formato del papel. Coordinar la pausa y revisar la cola antes de volver al modo de operación anterior.
5. Probar un gasto y un adelanto controlados, verificar nombres, monto, identificador y espacio de firmas. Verificar también copia y anulación. Conservar el papel firmado para auditoría.

Los agentes antiguos que solo envían `workerId` continúan recibiendo únicamente `ORDER`, `AMENDMENT` y `REPRINT`. Los comprobantes quedan pendientes hasta que un agente actualizado los reclame. No revertir a una API anterior que carezca de este filtro mientras haya comprobantes nuevos en la cola.

## Verificación y límites

Pruebas enfocadas de formato, validación de retiros, rutas HTTP con BD/sesión/impresora simuladas, idempotencia, permisos, copias, anulación y recuperación de errores. Se verifican también los generadores ESC/POS Node/Python, el contrato de comandas y el QR. TypeScript y ESLint comprueban los archivos afectados; el esquema Prisma se valida y el cliente se genera localmente.

Comandos principales:

```bash
npm run test:withdrawal-print
npm run test:retiros-validaciones
npm run test:printer
npm run test:print-jobs
npm run test:print-agent
npm run test:payment-link
npm --prefix print-agent test
python3 -B -m unittest discover -s print-agent-python -p 'test_*.py'
npx tsc --noEmit --incremental false
npx prisma validate
```

No se ha aplicado la migración a una BD ni probado la concurrencia con PostgreSQL real. No se han registrado retiros reales ni enviado papel a una impresora. Las pruebas simuladas verifican las llamadas y los límites de transacción del código; no sustituyen la prueba de BD ni UAT. Como en la cola existente, un envío TCP exitoso no demuestra salida física y una pérdida de confirmación puede producir copias; el identificador del retiro permite reconocerlas sin duplicar el movimiento de dinero.
