# Cuentas y consumos de empleados

Implementación local del plan aprobado el 4 de noviembre de 2026 y su simplificación posterior de consumos. La entrega inmediata reutiliza el esquema existente: no añade migraciones estructurales ni modifica la migración ya aplicada. La activación operativa requiere la conciliación histórica y las verificaciones descritas aquí.

## Estado de develop — 2026-11-04

Se aplicó `20261104000000_employee_accounts` a la base activa configurada en `.env`, confirmada por el dueño como develop. Prisma confirmó las 13 migraciones al día y se verificó el checksum del archivo aplicado.

Antes de aplicarla se corrigió la ampliación de `PrintJob_origen_check`: ahora admite comprobantes de liquidación además de los orígenes existentes, conservando exactamente un origen por trabajo. La migración completa se ejecuta dentro de una transacción.

La verificación contra PostgreSQL real creó cuentas, consumo, liquidación parcial, movimientos y comprobantes dentro de una transacción revertida. Se comprobaron saldo firmado, compatibilidad de comandas/retiros y rechazo de comprobantes sin origen o con dos orígenes. No quedaron datos de prueba ni se enviaron trabajos a una impresora. Los conteos antes y después se conservaron: 8 usuarios, 38 productos, 23 órdenes, 1 retiro y 27 trabajos de impresión.

Esto no activa automáticamente cuentas ni precios, no despliega la aplicación y no sustituye las pruebas de concurrencia o impresión física pendientes.

## Operación

1. En **Productos → Menú**, el administrador configura el precio para empleados. La configuración antigua de preparación se conserva internamente por compatibilidad, pero no controla estos consumos. Sin precio especial, el producto no se ofrece en consumos. El precio de empleado debe ser positivo y no superar el precio de carta.
2. En **Equipo → Cuentas de empleados**, revisar y activar cada cuenta. Se muestran sus adelantos históricos, incluidos los anulados. Indicar el pendiente real de cada adelanto y confirmar la revisión. Cero significa que ya no queda deuda, no que se elimina el documento.
3. Mesero o administrador utiliza **Consumos de empleados**. Seleccionar beneficiario, productos y modalidad. Los combos requieren nivel de salsa. Para llevar se agregan $1,25 por combo.
4. Una sola confirmación registra todos los productos como ya entregados y carga la cuenta en la misma transacción que descuenta stock. Seleccionar o editar productos solo prepara el formulario. No hay preparación, segunda entrega ni impresión automática de comanda o comprobante.
5. El adelanto en efectivo se registra por **Retiro de caja**, como antes. Requiere caja abierta y cuenta del beneficiario activada. Genera una salida de efectivo y un cargo a la cuenta en la misma transacción.
6. Al pagar el sueldo, abrir la cuenta y **Registrar descuento de sueldo**. Confirmar el monto realmente descontado y su fecha. Puede ser completo o parcial. Cada cuenta se cierra en su fecha real, sin un reinicio mensual automático.
7. **Mis descuentos** permite consultar la cuenta propia, incluido el documento original de los consumos y adelantos. El administrador conserva acceso a las cuentas inactivas aunque tengan saldo cero.

Los consumos se muestran por separado en el cuadre. No generan efectivo, transferencia, QR ni pendiente de cobro a clientes. Registrar un descuento de sueldo tampoco representa un ingreso a caja ni registra el pago del sueldo completo.

El estado de cuenta conserva todos sus movimientos. Un cierre parcial arrastra el pendiente; un abono posterior a un cierre puede producir saldo a favor, que compensa futuros cargos. Los filtros de fechas solo acotan la lista visible, nunca el saldo global.

## Correcciones y comprobantes

- Los registros nuevos ya quedan entregados. Un error posterior se resuelve con una corrección administrativa, con motivo y referencia al original. La anulación heredada se mantiene únicamente para documentos antiguos que todavía no están regularizados.
- Usar una corrección para devolución de unidades o reasignación de deuda al beneficiario correcto. El producto y el precio originales no se reescriben. El stock no se descuenta nuevamente por una reasignación.
- El abono del envase se decide junto con la devolución de la unidad correspondiente. Esta versión no contempla una devolución posterior independiente del envase.
- Un descuento de sueldo equivocado se revierte con motivo y movimiento opuesto. El cierre original permanece disponible; no se modifica para cambiar el pasado.
- Se guarda el contenido del comprobante original, independiente de cambios posteriores de nombre, producto o beneficiario. Una copia no registra otro cargo ni otro descuento.
- Los tickets tienen espacio para firma física. El sistema no almacena una firma digital ni una imagen del ticket firmado.
- La primera impresión física y las copias se solicitan expresamente mediante **Imprimir comprobante** sobre el documento guardado. La etiqueta de copia no acredita una impresión física anterior. Si falla la impresión, el registro ya confirmado sigue vigente: reintentar desde su documento sin registrar otra operación. Un trabajo en cola no significa que ya salió papel.
- Ante una respuesta de red ambigua, reintentar los mismos datos. La pantalla bloquea un envío diferente mientras no se resuelva el anterior. Recargar completamente la página pierde ese bloqueo de interfaz: revisar el historial antes de volver a registrar manualmente.

## Apertura histórica

No cargar todos los adelantos anteriores como pendientes. Confirmar por cada persona qué parte ya se descontó fuera del sistema. La apertura conserva el autor, el detalle revisado y las versiones de los retiros; si cambian mientras se revisan, se rechaza la confirmación y se exige otra revisión.

Las cuentas inactivas también pueden abrirse para registrar y resolver deuda histórica, pero no reciben consumos o adelantos nuevos.

Los adelantos antiguos sin beneficiario se señalan en el resumen administrativo y no se asignan automáticamente. Resolver su identidad con documentación antes de incorporarlos; la primera versión no incluye una herramienta para atribuir automáticamente esos registros.

Si un adelanto de $20 tenía $12 recuperados antes de la apertura y se importaron $8 pendientes, una anulación posterior revierte los $8 importados. No devuelve automáticamente los $12 recuperados fuera del sistema. Ese importe requiere revisión administrativa documentada.

## Despliegue

1. Respaldar la base y ensayar la migración/restauración en una copia aislada.
2. Revisar y aplicar `prisma/migrations/20261104000000_employee_accounts/migration.sql` mediante el mecanismo habitual de migraciones (`prisma migrate deploy` en el entorno de destino). No utilizar reset ni `db push` sobre producción.
3. Generar el cliente Prisma y desplegar la aplicación junto con agentes de impresión actualizados. El cliente se genera también por el `postinstall` existente.
4. Actualizar el agente Node o Python que use el local: ahora anuncia soporte de `EMPLOYEE_RECEIPT`. Un agente antiguo no reclamará los nuevos comprobantes; conservará los tipos que ya entiende.
5. Ensayar impresión con `DRY_RUN=true`. Verificar luego comanda y comprobantes en la impresora física. Para estas operaciones, la cola activa tiene prioridad sobre la impresión directa.
6. Configurar precios especiales y revisar la apertura individual antes de registrar nuevos adelantos o consumos.
7. Conciliar las primeras entregas, adelantos y cierres contra stock, caja y tickets firmados.

La migración es aditiva: las órdenes existentes quedan clasificadas como `VENTA_CLIENTE`. No modifica sus importes ni presume que los adelantos antiguos estén pendientes.

Si es necesario volver a una versión anterior, detener primero los consumos y adelantos que alimentan cuentas y conservar todos los movimientos. Una aplicación anterior registraría adelantos sin su movimiento asociado. No reanudarla sin una conciliación posterior diseñada para ese intervalo. No eliminar las tablas o vaciar saldos para recuperarse de un error.

## Verificación anterior: módulo inicial de cuentas

Se añadieron pruebas de importes y saldos, apertura y cierre de rutas reales con transacciones simuladas, consumos con stock y rollback simulado, separación de ventas/caja, permisos, privacidad, reintentos y comprobantes. Los scripts `test:employee-*` en `package.json` son los puntos de entrada.

Resultado local: los 29 scripts `test:*` pasan, junto con TypeScript, ESLint y validación de Prisma. También pasaron las pruebas del agente Node y las 17 pruebas Python. Las regresiones abarcan retiros, caja, cobros, numeración, navegación e impresión.

La revisión visual de escritorio y móvil de 390 px utiliza datos ficticios y un proxy local: no verifica persistencia ni una base real. No se realizaron operaciones contra producción ni se imprimió en hardware.

Antes de activar en producción siguen siendo necesarias pruebas con PostgreSQL aislado: último stock concurrente, cierre simultáneo, entrega frente a cierre, anulación de adelanto frente a apertura/cierre y rollback real ante fallo. Las simulaciones no demuestran los bloqueos de PostgreSQL ni sustituyen esa prueba.

El build normal en este entorno quedó bloqueado al descargar Inter desde Google Fonts. Se debe verificar el build en el entorno de despliegue con esa dependencia disponible; no se cambió la configuración de fuentes para ocultar el fallo.

## Alcance

Incluye consumos a cuenta, adelantos en efectivo del flujo existente, cierres completos/parciales, correcciones vinculadas, historial, consulta propia y comprobantes.

No incluye nómina completa, multas, cuotas por cada movimiento, pagos inmediatos de consumos, anticipos por transferencia/fuera de caja, devolución física de saldos a favor, ingredientes/recetas, sucursales ni firma digital. La clasificación de ventas es operativa; no redefine el tratamiento contable o tributario.

## Transición a consumos entregados

La simplificación no necesita ejecutar otra migración de Prisma. No editar ni volver a generar la migración aplicada para cambiar estados. Los documentos anteriores no anulados pendientes, en preparación o listos se consideran entregados por la decisión del dueño; se verifica su integridad técnica, sin exigir una decisión individual sobre si la entrega ocurrió.

1. Coordinar el corte para detener escritores antiguos de consumos y comandas internas. Desplegar la nueva versión en todos los procesos que puedan crear o entregar consumos. No dejar una versión antigua creando pendientes durante la conciliación.
2. Como administrador, abrir **Regularización histórica** en consumos, fijar el corte y solicitar **Analizar**. La consulta no escribe, imprime ni activa cuentas y revisa antecedentes de todas las fechas hasta ese corte mediante páginas de hasta 50 documentos.
3. Revisar cargos encontrados, importes faltantes e incidencias. Ejecutar el lote revisado con motivo; cada documento se vuelve a validar y se procesa en su propia transacción. Una respuesta exitosa del lote puede incluir conflictos: revisar sus resultados y continuar las páginas pendientes. Ante datos cambiados, analizar de nuevo; ante una respuesta de red incierta, reintentar el mismo lote y su misma clave.
4. Conciliar cargos agregados, libro y documentos regularizados. El stock anterior debe permanecer idéntico: ya se descontó al crear el consumo. No recalcular precios, recargos o nombres desde el catálogo actual. Cargos existentes y traslados/devoluciones válidos se conservan; evidencia inconsistente queda como conflicto sin cambios parciales.
5. Los cargos históricos pueden incorporarse aun con empleado inactivo o cuenta sin apertura; esta excepción no reactiva personas ni permite nuevas entregas. La apertura posterior añade los adelantos revisados al saldo existente. Cargos tardíos afectan al saldo actual y al siguiente descuento, sin alterar cierres firmados.
6. Revisar comandas internas anteriores: los trabajos todavía no enviados se descartan con evidencia; los enviados se conservan. Un trabajo **PROCESSING** puede haberse enviado físicamente y requiere revisión: no se promete cancelar papel ya emitido. No descartar comandas de clientes ni comprobantes solicitados manualmente.
7. Ante una interrupción, conservar movimientos, historial y resultados; reanudar con las claves y revisiones correspondientes. No borrar deuda ni restaurar una versión que vuelva a crear preparaciones o autoimprimir consumos regularizados.

## Pruebas de la simplificación

Los resultados actuales y pendientes se registran en `specs/001-simplificar-consumos-empleados/quickstart.md`. Los resultados del módulo inicial documentados arriba no certifican automáticamente este cambio.

El arnés `lib/employee-consumption.postgres.test.ts` exige `EMPLOYEE_TEST_DATABASE_URL` explícita para una base cuyo nombre contenga `test`, distinta de la conexión operativa. Crea y elimina exclusivamente un esquema aleatorio propio en esa base y utiliza las migraciones existentes. No usa silenciosamente `DATABASE_URL`, no trunca tablas compartidas y no envía impresiones. Las pruebas de PostgreSQL, revisión visual e impresión física se consideran pendientes hasta registrar su ejecución real.

Validación local de la simplificación: 31 scripts automatizados sin PostgreSQL aprobados; TypeScript, ESLint, Prisma, agente Node y 17 pruebas Python aprobados. Build intentado y bloqueado por descarga de Inter. La base PostgreSQL aislada, ensayo real de corte y papel impreso continúan pendientes; no se regularizaron datos activos. Detalle y evidencia visual con fixtures en la guía de la feature.
