# Investigación: entrega inmediata de consumos

Fecha: 2026-11-04. Revisión de código local, sin conexiones ni escrituras de negocio. La revisión especializada de transición se completó; la integración se revisó directamente al detenerse su subagente por límite de uso.

## 1. Modalidad única de registro

**Decision**: Reutilizar el servicio de consumos, sus precios, numeración, bloqueos, stock e historial. Todos los consumos nuevos nacen entregados y con un cargo inicial, independientemente de la configuración anterior de preparación.

**Rationale**: `lib/employee-consumption.ts:22` contiene la creación y `:65` decide el estado según preparación. La rama directa existente ya ofrece la operación económica buscada. `components/empleados/ConsumosEmpleados.tsx:23` y `:44` agregan filtros y acciones que dejan de ser necesarios.

**Alternatives considered**: Cambiar solo el formulario dejaría vigente la preparación en el servidor. Construir otro módulo de ventas o cuenta duplicaría reglas. Eliminar estados o columnas compartidas pondría en riesgo pedidos de clientes.

## 2. Impresión exclusivamente solicitada

**Decision**: Conservar `receiptLines` al registrar, sin `enqueueEmployeeReceipt`, envío directo, comanda ni evento de nueva preparación. Usar el servicio de impresión manual existente para primera impresión y copias.

**Rationale**: `app/api/consumos-empleados/route.ts:36` inicia comanda y recibo automáticamente; `lib/employee-consumption.ts:69` guarda el documento. `lib/employee-receipts-server.ts:10` exige entrega y snapshot conservado: quitar la impresión no puede quitar ese snapshot. Los agentes ya aceptan `EMPLOYEE_RECEIPT`; no cambia su protocolo.

**Alternatives considered**: Desactivar la impresora globalmente perjudicaría clientes, adelantos y descuentos de sueldo. Generar un trabajo y dejarlo pendiente contradice la decisión C. Reconstruir el ticket desde el catálogo actual perdería evidencia histórica.

## 3. Compatibilidad de lectura y acciones

**Decision**: Retirar preparación del formulario, listas y configuración visible específica de consumos. Conservar el campo `requierePreparacionEmpleado` sin efecto operativo y las formas de respuesta antiguas durante la transición. La cocina consulta solo ventas de clientes y rechaza cambios de estado de consumos.

**Rationale**: La bandera está en `components/admin/FormularioProducto.tsx:28`, `lib/admin-validaciones.ts:134` y el catálogo de consumos. Cocina acepta consumos en `app/api/ordenes/route.ts:83` y `app/api/ordenes/[id]/route.ts:47`. Las cuentas proyectan pendientes en `app/api/empleados/cuentas/route.ts:13` y `app/api/empleados/[id]/cuenta/route.ts:21`.

**Alternatives considered**: Borrar de inmediato la bandera o los campos de respuesta rompería clientes anteriores sin aportar valor al dueño. Cambiar `ORDENES_VIGENTES` globalmente ocultaría operaciones en consumidores no analizados. Mantener un botón de entrega en la interfaz nueva contradice la modalidad única.

## 4. Transición autorizada de documentos anteriores

**Decision**: Proveer una operación administrativa explícita de revisión técnica y ejecución por lotes. Abarca exclusivamente órdenes `CONSUMO_EMPLEADO`, no anuladas, con estado `pendiente`, `en_preparacion` o `lista`, anteriores al corte del cambio. Todas las válidas se consideran entregadas según la decisión B; no se solicita juzgar individualmente si se entregaron.

**Rationale**: La creación ya descontó stock para esos documentos. La transición no toca productos ni vuelve a crear órdenes. El efecto permitido es el cargo histórico faltante y la evidencia de regularización. Un análisis previo de solo lectura identifica número de documentos, suma a cargar y conflictos sin aplicar cambios.

**Alternatives considered**: Un UPDATE masivo de estado perdería cargos y snapshots. Invocar la entrega anterior volvería a imprimir, exigiría estado listo y no cubre todos los antecedentes. Considerar todo ya pagado borraría deuda sin evidencia.

## 5. Beneficiario, importe y cargo existente

**Decision**: Validar la cadena de historial y movimientos antes de decidir que falta un cargo. Reutilizar la clave canónica `consumo:<ordenId>`. Las reasignaciones pueden tener otros movimientos CONSUMO y deben respetarse; no imponer unicidad genérica por orden y tipo. Usar precios, cantidades y envases históricos, incluyendo correcciones demostrables; no usar precio, nombre o categoría actuales para completar historia faltante.

**Rationale**: `MovimientoCuentaEmpleado.origenClave` e `idempotencyKey` son únicos, pero `ordenId` solo está indexado (`prisma/schema.prisma:310`). `lib/employee-consumption.ts:113` reconstruye cantidades corregidas, y `:133` contempla traslados. Un cargo previo válido se conserva sin insertar otro. Si no hay cargo ni correcciones, el total histórico debe conciliar con sus líneas y envases. Si hubo correcciones previas, el remanente debe demostrarse con el historial; una discrepancia se informa como conflicto.

**Alternatives considered**: Buscar solo el empleado actual o sumar todos los CONSUMO confunde traslados con deuda nueva. Insertar la diferencia entre total original y saldo actual confunde descuentos de sueldo con cargos faltantes. Usar la tarifa actual de envase no acredita la histórica: se conserva o deriva exactamente del recargo original y su evidencia; si no puede probarse, no se inventa.

## 6. Cuenta sin apertura, inactivos y cierres

**Decision**: Para esta regularización histórica autorizada, permitir registrar la obligación del beneficiario original aunque esté inactivo o la cuenta no tenga apertura, sin activar la cuenta ni reactivar al usuario. Esta excepción pertenece únicamente a la acción administrativa de transición; los registros nuevos mantienen todos sus requisitos actuales. La apertura posterior conserva los movimientos de consumo y añade solo los adelantos históricos revisados, sin reemplazar el saldo ni reiniciar secuencias.

**Rationale**: La especificación diferencia deuda previa de nuevas entregas. `lockEmployeeAccount(..., false)` omite ambas restricciones, por lo que debe usarse deliberadamente solo en este contexto. La apertura existente agrega movimientos y no sobrescribe el libro. Los cierres se preservan: el cargo de regularización se registra ahora, conserva referencia a la fecha original y modifica el saldo actual, no un snapshot de sueldo anterior.

**Alternatives considered**: Exigir apertura para completar la regularización bloquearía la decisión de considerar entregados todos los documentos válidos. Activar cuentas o empleados silenciosamente ampliaría permisos. Recalcular liquidaciones anteriores cambiaría documentos confirmados.

## 7. Integridad, concurrencia y recuperación

**Decision**: Por documento, bloquear orden y después cuenta; revalidar revisión y huella del análisis; confirmar estado, eventual cargo, historial, snapshot y descarte de trabajos antiguos en una transacción. No adquirir bloqueos de productos porque la transición no modifica stock. Reintentar es seguro por clave canónica e historial. Los conflictos no dejan efectos parciales en su documento y se reportan por separado.

**Rationale**: Las correcciones actuales bloquean Orden antes de Usuario; los cierres bloquean Usuario e invalidan revisiones obsoletas. Un lote completo en una sola transacción sería innecesariamente largo. Los lotes se limitan a 50 candidatos y se pueden continuar. La comprobación de reintentos no depende de la memoria del navegador.

**Alternatives considered**: Ignorar conflictos y anunciar éxito ocultaría deudas. Revertir todos los documentos completados por un conflicto posterior complicaría la recuperación. Una regla nueva de unicidad global por orden rompería traslados legítimos.

## 8. Cola previa y despliegue

**Decision**: Coordinar una ventana breve de corte de consumos de empleados y trabajos antiguos de cocina de ese origen. Impedir que una versión anterior siga creando consumos pendientes. Detener o descartar los trabajos de preparación todavía no ejecutados; conservar evidencia de los ya impresos y tratar los PROCESSING como entrega física incierta, sin prometer retirarla. La regularización no genera impresión.

**Rationale**: Un trabajo confirmado en cola puede imprimirse después del cambio de estado. La revisión no puede asegurar que un trabajo ya enviado no llegó al papel. El aislamiento por tipo de operación y origen conserva las comandas de clientes.

**Alternatives considered**: Borrar toda la cola destruiría evidencia y afectaría clientes. Dejar impresiones de preparación activas generaría pedidos después de considerarlos entregados. Activar dos mecanismos de impresión para resolver la transición causaría duplicados.

## 9. Esquema y límites del diseño

**Decision**: No se requiere de entrada otra migración de estructura: se reutilizan estado, bandera heredada, historial JSON, snapshots, movimientos, claves y secuencias existentes. La transición es una operación de datos versionada y auditable, no un cambio de precios o un reset. No modificar `20261104000000_employee_accounts`, ya aplicada.

**Rationale**: Todos los datos necesarios tienen representación existente. El estado técnico entregada sirve para conservar compatibilidad, aunque no se muestre como un flujo al operador. Si durante implementación apareciera una restricción adicional imprescindible, se propondrá una migración nueva y aditiva con evidencia; no se eliminarán columnas por limpiar el modelo.

**Alternatives considered**: Quitar Orden.estado afectaría clientes. Eliminar el historial de preparación rompería auditoría. Reescribir la migración aplicada desalinearía su checksum.

## Cierre de aclaración

Dos preguntas hechas y respondidas. Se modificaron Clarifications, historias, casos excepcionales, requisitos, entidades, criterios de éxito y supuestos. Checklist: 16/16 → 16/16, sin cambios de marcadores; no hay elementos pendientes. No hay hooks registrados de aclaración o planificación.

| Categoría | Estado |
|---|---|
| Alcance y comportamiento | Resuelto: entrega inmediata e impresión explícita |
| Dominio y datos | Resuelto: tratamiento de consumos anteriores |
| Interacción y experiencia | Resuelto: sin flujo de preparación ni impresión automática |
| Calidad no funcional | Claro: integridad, permisos y recuperación vigentes |
| Integraciones | Resuelto: cocina, impresión y compatibilidad delimitadas |
| Casos excepcionales | Resuelto: reintentos, conflictos y cierres previos |
| Restricciones y compromisos | Claro: cambio acotado sin borrado de esquema |
| Terminología | Claro: entrega, impresión y corrección son conceptos distintos |
| Criterios de finalización | Claro: resultados medibles y pruebas definidas |
| Marcadores y pendientes | Claro: sin decisiones de negocio pendientes |

Los detalles técnicos de ejecución de la transición pertenecen al plan, no requieren otra ronda de preguntas de negocio. Este documento no acredita implementación ni ejecución en la base.
