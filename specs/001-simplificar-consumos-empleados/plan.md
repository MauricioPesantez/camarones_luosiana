# Implementation Plan: Consumos de empleados con entrega inmediata

**Branch**: `develop` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Feature directory**: `specs/001-simplificar-consumos-empleados` (independiente de la rama Git).

**Input**: Especificación aclarada con dos decisiones del dueño: impresión solo bajo solicitud; consumos anteriores pendientes considerados entregados con sus cargos faltantes, sin repetir stock.

**Status**: Diseño terminado hasta Phase 1. No se implementó este cambio, ejecutó transición de datos ni creó tasks.md.

## Summary

Simplificar la operación existente: una confirmación guarda el consumo como entregado, descuenta stock y carga al empleado de forma atómica. Bebidas, combos y mezclas siguen el mismo camino. Guardar el documento imprimible, pero retirar comanda, impresión automática y notificación de preparación de consumos. El usuario puede pedir su comprobante después.

Conservar las estructuras existentes, las correcciones y los procesos de clientes. Retirar de la interfaz de consumos los estados de preparación, su filtro y el segundo botón de entrega. La bandera específica de preparación se conserva como dato heredado sin efecto en nuevos consumos, evitando borrar esquema o modificar la migración ya aplicada.

Los documentos previos no anulados en pendiente/en_preparacion/lista se regularizan mediante una acción administrativa controlada: se consideran entregados, se conserva todo el stock ya descontado y se añade solo el cargo histórico que falte. El resultado modifica el saldo actual sin reescribir cierres de sueldo anteriores. El proceso informa inconsistencias y soporta reintentos sin duplicaciones.

## Technical Context

**Language/Version**: TypeScript 5; ejecución Node compatible con el repositorio. SQL PostgreSQL solo donde lo exige el bloqueo y la verificación de datos.

**Primary Dependencies**: Next.js 16.0.6, React 19.2, Prisma Client/CLI 5.22, Tailwind existente; ninguna dependencia nueva prevista. Agentes Node y Python conservan EMPLOYEE_RECEIPT.

**Storage**: PostgreSQL con Orden, Item, Usuario, MovimientoCuentaEmpleado, HistorialOrden, PrintJob y LiquidacionEmpleado existentes. No se prevé migración estructural ni cambio de protocolo de impresión.

**Testing**: Scripts test:* actuales con ts-node y pruebas de servicios/rutas; escenarios PostgreSQL aislados para carreras, claves únicas y rollback; agentes Node/Python; revisión visual móvil y escritorio.

**Target Platform**: Aplicación web actual del restaurante y sus agentes de impresión. America/Guayaquil para fechas operativas.

**Project Type**: Aplicación web Next.js con rutas y servicios de dominio, un repositorio y una base compartida; sin servicio paralelo.

**Performance Goals**: Una confirmación y cero pasos posteriores de preparación por consumo; cero llamadas a dispositivos o servicios de impresión dentro de la transacción de negocio. La transición se procesa en lotes de hasta 50 documentos, con una transacción breve por documento y continuación explícita. No se introduce un SLA de latencia sin medición.

**Constraints**: Dinero exacto, stock no negativo, reintentos seguros, privacidad y autoría de sesión. Sin impresión automática en creación o regularización. Sin recálculo de precios históricos, borrado de evidencias ni actualización retroactiva de cierres. Preservar todos los cambios locales anteriores.

**Scale/Scope**: Un local y el volumen actual de empleados/consumos, sin presumir conteos actuales de la base ni añadir arquitectura de sucursales. La revisión de datos reales pertenece a ejecución posterior y no se realizó para planificar.

## Constitution Check

Revisión previa a Phase 0 y posterior al diseño contra `.specify/memory/constitution.md`, versión 1.0.0.

| Gate | Antes de investigación | Después del diseño y evidencia prevista |
|---|---|---|
| I. Dinero, inventario e historial | Cumple: preservar cuentas y stock es condición del cambio | Transacción de alta; regularización sin escritura de productos; claves canónicas; snapshots conservados; pruebas de cargo único, rollback y cierre inmutable. |
| II. Autorización y privacidad | Cumple: no se amplían permisos | Sesión para registro/corrección/impresión; transición solo admin; fingerprint no autoriza; excepción histórica sin activar cuentas o usuarios. |
| III. Continuidad de operación | Cumple: alcance específico de empleados | Clientes conservan estados, pagos y preparación; corte de procesos viejos; protección de trabajos previos; errores de comprobante no repiten entrega. |
| IV. Simplicidad y responsabilidad | Cumple: reutilización de servicio y libro actuales | Sin nueva dependencia o tabla. Servicio de transición específico y operación administrativa por el alcance de datos confirmado. Campo legado y contratos conservados durante compatibilidad. |
| V. Verificación proporcional | Cumple: criterios medibles definidos | Suite enfocada y pruebas PostgreSQL aisladas; casos de documentos históricos, impresión manual y regresión de clientes; validación física separada si se ejecuta. |
| Migraciones y recuperación | Cumple: no se requiere destruir estructura | No editar migración aplicada ni usar reset/db push. Conservar cargos de versión nueva al recuperar; respaldo/restauración previo a transición productiva. |

No hay excepciones constitucionales solicitadas. Registrar un cargo histórico autorizado en una cuenta aún sin apertura no habilita entregas nuevas ni sustituye la apertura revisada: conserva la obligación y su evidencia. Si los datos no acreditan beneficiario o importe, el documento queda en conflicto sin efectos parciales.

## Project Structure

### Documentation (this feature)

```text
specs/001-simplificar-consumos-empleados/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    └── consumos.md
```

`tasks.md` se generará posteriormente con speckit-tasks. No se crea en esta fase.

### Source Code (repository root)

```text
app/api/consumos-empleados/route.ts
app/api/consumos-empleados/action.ts
app/api/consumos-empleados/[id]/{entregar,anular,corregir,imprimir}/route.ts
app/api/admin/consumos-empleados/regularizacion/route.ts   # propuesto
app/api/ordenes/route.ts
app/api/ordenes/[id]/route.ts
app/api/empleados/cuentas/route.ts
app/api/empleados/[id]/cuenta/route.ts
components/empleados/{ConsumosEmpleados,CuentasEmpleados}.tsx
components/admin/FormularioProducto.tsx
lib/employee-consumption.ts
lib/employee-consumption-validation.ts
lib/employee-consumption-regularization.ts                 # propuesto si separa la transición de las altas
lib/employee-account.ts
lib/employee-print.ts
lib/employee-receipts-server.ts
lib/admin-validaciones.ts
prisma/schema.prisma                                       # conservación, sin borrado previsto
docs/EMPLEADOS.md
```

**Structure Decision**: Conservar la estructura del repositorio. La alta y las correcciones continúan en su dominio; la transición usa un servicio específico solo si evita mezclar el procesamiento histórico con la creación diaria. Las rutas autentican y delegan; el componente no calcula la deuda definitiva ni decide si se omite una validación histórica.

## Complexity Tracking

Sin violaciones que justifiquen complejidad adicional. La operación administrativa de transición es necesaria para aplicar la decisión B con sesión, evidencia y conflictos visibles; sustituye una modificación SQL indiscriminada. No se añade un motor de migraciones de negocio, una cola nueva ni un panel general de mantenimiento.

## Phase 0 — Investigación completada

[research.md](research.md) documenta las decisiones, alternativas descartadas y localizaciones verificadas. Resueltos:

- Punto responsable de crear entregas/cargos y disparar impresión automática.
- Lecturas de cocina, pendientes de cuentas y controles de producto/formulario que dependen de preparación.
- Necesidad de guardar snapshot aunque no se imprima.
- Claves de cargo existentes y diferencia entre cargo inicial, devolución y reasignación.
- Tratamiento autorizado de históricos, cuentas no abiertas/inactivos y cierres previos.
- Descarte coordinado de preparación aún sin enviar y límites de trabajos ya PROCESSING.
- Conservación de esquema y estrategia de recuperación sin borrar movimientos.

No quedan decisiones de negocio ni incógnitas técnicas bloqueantes para generar tareas. Las condiciones de los datos reales se verifican en el análisis previo a ejecutar, no se presumen como hechos de planificación.

## Phase 1 — Diseño y contratos completados

- [data-model.md](data-model.md): entidades, invariantes y evidencia de la transición.
- [contracts/consumos.md](contracts/consumos.md): altas, consultas, impresión, acciones heredadas y operación administrativa propuesta.
- [quickstart.md](quickstart.md): preparación aislada, comandos y escenarios de validación futuros.

### Secuencia de implementación propuesta

1. **Asegurar el registro único**. Modificar el dominio para crear siempre entregada, conservar stock/cargo/historial/snapshot y retirar todo disparador automático de impresión. Ajustar la ruta y sus contratos de respuesta sin tocar adelantos ni descuentos de sueldo.
2. **Separar cocina y compatibilidad**. Excluir consumos de lecturas/transiciones de cocina; la entrega heredada no genera otro cargo o impresión. Conservar guardas de cobro y corrección y las ventas a clientes. Mantener datos/campos heredados mientras puedan existir clientes viejos.
3. **Simplificar las pantallas**. Quitar preparación y estados de la experiencia de consumos, el segundo botón de entrega y la bandera específica visible del producto. Mantener selección, salsa, precio, envases, historial y correcciones. Mostrar comprobante bajo solicitud sin mensaje de fallo cuando nadie pidió imprimir.
4. **Implementar la regularización**. Análisis de lectura y ejecución administrativa por lotes con revisión/huella. Bloquear Orden → Usuario, validar evidencia, preservar snapshots o crear uno histórico fiel, marcar entregada y agregar exclusivamente el cargo faltante. No tocar stock, caja, aperturas ni liquidaciones.
5. **Validar antes de activar**. Servicios/rutas, concurrencia PostgreSQL, idempotencia de lotes y de altas, cierre frente a regularización, impresión manual y regresión de clientes. Revisar móvil. Distinguir mocks, PostgreSQL y hardware.
6. **Ejecutar un corte coordinado**. Asegurar que ninguna instancia anterior pueda crear pendientes o enviar comandas de empleados. Realizar el análisis, ejecutar lotes, registrar conflictos y conciliar los totales sin emitir impresión automática. No declarar completada la transición con conflictos escondidos.

### Preservación y compatibilidad

| Área | Cambia | Debe preservarse |
|---|---|---|
| Nuevo consumo | Siempre entrega/cargo al confirmar; cero impresión automática | Precio, envase, stock, permisos, claves y evidencia. |
| Preparación | Sale de la experiencia de empleados | Flujo de clientes; datos históricos de preparación. |
| Comprobante | Se imprime solo al solicitarlo | Snapshot original, pertenencia, copia y agentes existentes. |
| Consumo anterior pendiente | Pasa entregado y obtiene el cargo faltante | Stock ya descontado, importes originales y cierre previo. |
| Cuenta sin apertura/inactivo | Puede recibir el cargo histórico de regularización | No habilita nuevas entregas; apertura aditiva y restricciones vigentes. |
| Corrección | Opera sobre entrega ya registrada | Límites, motivo, reversos y saldos a favor. |
| Esquema | No requiere ampliación inicial | No borrar columnas ni editar migraciones aplicadas. |

### Pruebas mínimas de preservación

- Alta con antiguo flag true/false, bebida/combos/mixto: mismo resultado entregada/cargo, cero comanda o recibo automático aun con impresora configurada.
- Respuesta perdida, clave incompatible, último stock concurrente y fallo de escritura: sin duplicaciones ni efectos parciales.
- Impresión manual por primera vez, copia y recuperación: mismo documento, saldo y stock.
- Histórico pendiente, en_preparacion y lista: cargo faltante exacto y ningún ajuste de producto; repetición del lote no agrega movimientos.
- Cargos existentes y traslados válidos: no se confunden con deuda faltante. Beneficiario/importe/evidencia ambigua genera conflicto trazable.
- Regularización de inactivo o cuenta sin apertura, remanente cero, falta de snapshot y apertura posterior: conservar restricciones, secuencias y evidencia.
- Cierre de sueldo y corrección concurrentes: revisiones obsoletas detectadas; documentos ya firmados intactos.
- Clientes: preparación, entrega, cobros, QR, fondo/cierre de caja, reportes e impresión permanecen en sus caminos existentes.

### Despliegue y recuperación

El análisis previo es lectura; ejecutar la regularización es una mutación separada y visible del administrador, con motivo y resultado por documento. Durante el corte no pueden convivir instancias que creen consumos pendientes con la modalidad nueva. La estrategia concreta de pausa debe limitarse a empleados cuando la infraestructura actual lo permita y documentar cualquier impacto de agentes compartidos.

No se reinician bases ni cuentas y no se fuerza una impresión para verificar el cambio. Una recuperación conserva los cargos ya confirmados: se reanuda por claves/evidencia o se realiza una corrección administrativa explícita si un cargo fuera incorrecto. No se eliminan movimientos ni se recalculan cierres. Restaurar código anterior sin control reintroduciría preparación e impresión automática, por lo que debe mantenerse detenido ese flujo hasta conciliar.

## Resultado de esta fase

Plan y artefactos de diseño terminados, en la rama actual develop. Las dos preguntas de aclaración están integradas; checklist 16/16 → 16/16, sin casillas cambiadas ni pendientes. La cobertura detallada está en research.md. No hay hooks before/after_plan ni after_clarify registrados.

Solo se modificaron documentos de esta funcionalidad. No se implementaron rutas, servicios o pruebas nuevos, no se conectó a la base y no se aplicó regularización o migración. Siguiente fase: speckit-tasks.
