---
description: "Tareas para registrar consumos de empleados directamente como entregados"
---

# Tasks: Simplificar consumos de empleados

**Input**: Diseño en `specs/001-simplificar-consumos-empleados/`.
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/consumos.md`, `quickstart.md` y constitución v1.0.0.
**Tests**: Se incluyen por el requisito explícito SC-003 de repetición/concurrencia, los escenarios de aceptación y las garantías financieras de la constitución. Las pruebas con dobles no sustituyen PostgreSQL para carreras y rollback.
**Organization**: Fases por historia y prioridad: US1 P1 → US2 P1 → US4 P1 → US3 P2. US4 conserva su identificador original aunque se ejecute antes de US3.

## Formato y convenciones

- Formato: `- [ ] Tnnn [P] [USn] Acción con archivo concreto`.
- `[P]` permite paralelismo únicamente dentro de los grupos y después de las dependencias indicadas al final. No autoriza editar simultáneamente el mismo archivo.
- Las rutas de tareas son relativas a `/Users/mauriciopesantezg/restaurant-pos`. Los archivos identificados como nuevos deben crearse; los demás se reutilizan.
- Conservar los cambios locales previos. No reinicializar el proyecto, añadir dependencias, borrar campos ni editar `prisma/migrations/20261104000000_employee_accounts/migration.sql`.
- Generar este documento no ejecuta sus tareas. La implementación y las pruebas usarán fixtures; este plan no aplica regularización sobre la base activa.

## Phase 1: Setup

**Propósito**: Fijar una línea base reproducible sobre el proyecto existente.

- [X] T001 Registrar en `specs/001-simplificar-consumos-empleados/quickstart.md` la línea base de los scripts de empleados, clientes e impresión de `package.json`, los cambios locales que deben preservarse y cualquier fallo previo, separando pruebas con dobles, PostgreSQL y revisión manual; no declarar aprobada una comprobación no ejecutada.

## Phase 2: Foundational

**Propósito**: Proporcionar infraestructura aislada para demostrar integridad sin afectar datos operativos.

- [X] T002 Crear en `lib/employee-consumption.postgres.test.ts` un arnés PostgreSQL con fixtures de empleados, apertura, adelantos, productos, consumos, movimientos y cierres; exigir `EMPLOYEE_TEST_DATABASE_URL` explícita destinada a pruebas, sin fallback a la base activa, sin reset/truncate global, con limpieza exclusiva de fixtures y aserciones de stock, libro e historial; reutilizar Prisma y el ejecutor existente.

**Checkpoint**: Infraestructura disponible; las historias no deben depender de datos reales ni de una impresora física.

## Phase 3: US1 — Registrar lo entregado en una sola confirmación (P1)

**Objetivo**: Una confirmación guarda el consumo entregado y su cargo, sin preparación ni impresión automática.

**Prueba independiente**: Con empleado activo y cuenta abierta, registrar bebida, combo y mezcla con la antigua bandera true/false; todos quedan entregados, con un cargo y una salida de stock, sin entrada en cocina ni impresión. Editar el formulario antes de confirmar no escribe datos.

### Tests

- [X] T003 [P] [US1] Ampliar `lib/employee-consumption.service.test.cjs` con bebidas, combos y mezclas para ambos valores de `requierePreparacionEmpleado`; exigir estado entregada, cargo canónico único, stock una vez, snapshot conservado y cero trabajos o llamadas de impresión al crear/reintentar.
- [X] T004 [P] [US1] Ampliar `lib/employee-consumption-route.test.cjs` para respuestas 201 nueva/200 replay, `printJobQueued: false`, `impresion: null`, `impresionComanda: null`, sin notificación de nueva preparación y sin errores de configuración de impresora durante el registro.

### Implementation

- [X] T005 [US1] Unificar el alta en `lib/employee-consumption.ts` reutilizando la transacción existente y estas restricciones textuales de `data-model.md`: «Datos completos y válidos; beneficiario activo y cuenta con apertura.»; «Estado técnico inicial/final: `entregada`. No hace falta una transición de preparación ni un botón de entrega.»; «`cobrada = false`, `montoPagado = 0`, sin Cobro ni enlace de cobro.»; «Documento, descuento de stock, movimiento CONSUMO con clave `consumo:<ordenId>`, historial y snapshot se confirman juntos.»; ignorar la bandera heredada para decidir entrega y guardar el comprobante sin encolarlo.
- [X] T006 [US1] Ajustar `app/api/consumos-empleados/route.ts` al contrato de alta: «No se crea trabajo de impresión ni se llama a impresora o notificación de nueva preparación.»; retirar disparos de comanda/comprobante directo y en cola, conservar autenticación, errores, replay y campos de respuesta compatibles definidos en `specs/001-simplificar-consumos-empleados/contracts/consumos.md`.
- [X] T007 [P] [US1] Simplificar `components/empleados/ConsumosEmpleados.tsx`: quitar elección/filtro/badges de preparación, distinción directa/cocina y segunda confirmación de entrega; mantener una confirmación final, edición local sin persistencia, precios, salsa, envases, historial, correcciones e impresión solicitada; explicar que confirmar registra productos ya entregados.
- [X] T008 [P] [US1] Ocultar la configuración de preparación específica de empleados en `components/admin/FormularioProducto.tsx`, conservando precio especial y controles de preparación de clientes; mantener compatible la propiedad heredada y su almacenamiento, sin cambiar el esquema ni la validación comercial general.
- [X] T009 [US1] Ejecutar la aceptación independiente de US1 y sus pruebas de servicio/ruta; registrar en `specs/001-simplificar-consumos-empleados/quickstart.md` evidencia de una confirmación, cero escrituras al seleccionar productos y cero impresión automática con impresión configurada o desactivada.

**Checkpoint**: US1 demostrable con fixtures. La activación operativa requiere las garantías y transición de las siguientes fases.

## Phase 4: US2 — Conservar stock y saldo ante errores y reintentos (P1)

**Objetivo**: Preservar centavos, elegibilidad, atomicidad e idempotencia del registro directo.

**Prueba independiente**: Dos colas de $0,75 y un combo de $4 para llevar cargan $6,75; con adelanto previo de $30, saldo $36,75. Repetición, competencia por la última unidad e intentos rechazados no duplican dinero ni stock.

### Tests

- [X] T010 [P] [US2] Completar `lib/employee-consumption-validation.test.ts` con centavos exactos, recargo $1,25 por unidad de combo para llevar, cantidades agregadas de productos repetidos con distinta salsa y validación de precio cambiado; cubrir la restricción «Total exacto calculado en servidor; stock suficiente por cantidades agregadas de producto.» sin recalcular documentos ya guardados.
- [X] T011 [P] [US2] Ampliar `components/empleados/envio.test.ts` para respuesta perdida/doble clic: misma clave al reintentar el mismo contenido, bloqueo de reutilización con contenido distinto y recuperación tras un 409 corregible; preservar `components/empleados/envio.ts` salvo fallo demostrado, sin introducir otro mecanismo de idempotencia.
- [X] T012 [US2] Incorporar en `lib/employee-consumption.postgres.test.ts` carreras por última existencia, misma clave concurrente, misma clave con otro payload y fallos entre escrituras; comprobar un único documento/cargo y salida, rollback completo y cero efectos al rechazar empleado inactivo, cuenta sin apertura o precio desactualizado; simular pérdida de respuesta tras commit.

### Implementation

- [X] T013 [US2] Corregir únicamente desviaciones demostradas en `lib/employee-consumption.ts` y `lib/employee-account.ts`, conservando bloqueos de alta cuenta → contador diario → productos y restricciones: «Reintento de misma clave/contenido recupera el original; contenido distinto produce conflicto.»; beneficiario activo/apertura obligatorios para altas, importes exactos y movimiento canónico; mantener `origenClave`/`idempotencyKey` únicos sin imponer unicidad por `ordenId` que impediría traslados válidos.
- [ ] T014 [US2] Ejecutar las pruebas focalizadas y PostgreSQL de US2 y registrar resultados en `specs/001-simplificar-consumos-empleados/quickstart.md`, diferenciando prueba real de concurrencia de pruebas con dobles; demostrar $6,75/$36,75 y cero efectos de cada rechazo o rollback.

**Checkpoint**: El alta directa tiene evidencia de integridad bajo errores y concurrencia.

## Phase 5: US4 — Preservar clientes e historia durante la transición (P1)

**Objetivo**: Regularizar los históricos válidos sin repetir stock/cargos y separar completamente los flujos de clientes.

**Prueba independiente**: Fixtures pendientes/en_preparacion/lista pasan a entregada, reciben solo deuda faltante y conservan stock/precios/cierres; repetir no agrega efectos. Anulados se excluyen, ambigüedades se enumeran y las ventas a clientes mantienen su comportamiento.

### Tests

- [X] T015 [P] [US4] Crear `lib/employee-consumption-regularization.test.cjs` con los tres estados heredados, anulados, ya entregados, cargo canónico previo, traslados/devoluciones válidos, remanente cero, falta de snapshot y fuente ambigua; cubrir inactivo/sin apertura, repetición y fallo por documento sin mutación parcial ni nuevas salidas de stock.
- [X] T016 [P] [US4] Crear `lib/employee-consumption-regularization-route.test.cjs` para GET sin escrituras y POST exclusivo de administrador autenticado, motivo obligatorio, corte/cursor, máximo 50 candidatos, revisión/huella obsoletas, colisión de clave y resultados por documento; la respuesta 200 debe poder contener conflictos sin presentarlos como éxito total.
- [X] T017 [P] [US4] Ampliar `lib/employee-sales-boundaries.test.cjs` con cocina excluyendo todo consumo interno, PATCH genérico rechazando sus estados y ventas a clientes conservando preparación, entrega, cobros, aprobación, QR y separación de reportes; conservar guardas de caja según rol autenticado y límites de acceso a cuentas propias.

### Implementation

- [X] T018 [US4] Crear el análisis de solo lectura en `lib/employee-consumption-regularization.ts`: recorrer históricos de todas las fechas hasta el corte, paginar y proyectar estado/revisión/huella de datos relevantes, cargo canónico, cadena de beneficiarios/ajustes y deuda faltante; aplicar «Beneficiario ausente, cargo ambiguo, snapshot irrecuperable o importe inconsistente: conflicto sin mutación del documento. No inferir datos desde el catálogo actual.» y distinguir cargos iniciales de CONSUMO legítimos por reasignación.
- [X] T019 [US4] Incorporar en `lib/employee-print.ts` la reconstrucción del comprobante histórico solo desde evidencia guardada, reutilizando el formato existente y conservando snapshots recuperables; identificar la regularización y separar fecha/autor original de fecha/actor administrativo real, sin inventar entrega física ni consultar precios actuales ni encolar impresión.
- [X] T020 [US4] Implementar la ejecución por documento en `lib/employee-consumption-regularization.ts`, con bloqueos Orden → Usuario y revalidación de huella/revisión: «Consumo histórico válido: pendiente/en_preparacion/lista → regularización → entregada, sin volver a tocar stock.»; «Anulados: fuera de la regularización. Ya entregados: no volver a cobrar.»; cargo inicial con `consumo:<ordenId>` cuando falte, cadena de ajustes preservada y «Importe histórico remanente cero: registrar regularización sin un movimiento monetario de importe cero, que el libro prohíbe.»; permitir solo aquí el cargo administrativo de inactivo/sin apertura, sin activarlos, sin modificar cierres ni productos y con apertura posterior aditiva. Guardar atómicamente snapshot y `consumo_regularizado_entregado` con versión, corte, clave/huella, antes/después, beneficiario, cargo/importe, fechas, actor de sesión y motivo obligatorio; incrementar revisión de cuenta solo si se añade movimiento.
- [X] T021 [US4] Añadir en `lib/employee-consumption-regularization.ts` y en el reclamo de `lib/print-agent-jobs.ts` la coordinación de trabajos heredados de preparación según `specs/001-simplificar-consumos-empleados/research.md`: limitar a ORDER/AMENDMENT/REPRINT del consumo interno, impedir nuevos envíos pendientes mediante los estados válidos de la cola y conservar evidencia de SUCCEEDED; informar PROCESSING/envío incierto sin prometer cancelación física, sin cancelar recibos manuales u órdenes de clientes y sin impresión automática de regularización.
- [X] T022 [US4] Crear `app/api/admin/consumos-empleados/regularizacion/route.ts` con GET administrativo de diagnóstico y POST de lotes revisados de hasta 50 candidatos según `specs/001-simplificar-consumos-empleados/contracts/consumos.md`: motivo, corte, clave, ordenId/expectedRevision/fingerprint, actor de sesión y resultados regularizado/ya_regularizado/excluido/conflicto con totales y cursor; no exponer la excepción histórica de elegibilidad en el alta ordinaria.
- [X] T023 [US4] Ajustar `app/api/ordenes/route.ts` y `app/api/ordenes/[id]/route.ts` para que cocina liste únicamente pedidos de clientes y no cambie estados de consumos internos; conservar filtros, transiciones, cobros y autorizaciones de clientes sin extender el cambio al flujo comercial.
- [X] T024 [US4] Adaptar compatibilidad en `app/api/consumos-empleados/action.ts` y `app/api/consumos-empleados/[id]/entregar/route.ts`: conservar permisos, revisión e idempotencia; entregada responde sin nuevo cargo/stock/impresión y pendiente heredado devuelve conflicto indicando regularización; conservar la anulación heredada autorizada para registros todavía no regularizados y las correcciones para entregados, sin retirar endpoints en esta fase.
- [X] T025 [US4] Retirar el flujo normal de pendientes de preparación en `app/api/empleados/cuentas/route.ts`, `app/api/empleados/[id]/cuenta/route.ts` y `components/empleados/CuentasEmpleados.tsx`, preservando campos de respuesta compatibles y el saldo calculado desde el libro; no ocultar conflictos históricos como si estuvieran regularizados ni mostrar deuda faltante como cero definitivo al administrador.
- [X] T026 [US4] Crear `components/empleados/RegularizacionConsumos.tsx` e integrarlo en `components/empleados/ConsumosEmpleados.tsx` solo para administrador: diagnóstico sin escritura, resumen revisable, ejecución paginada sobre el corte/huellas revisados, avance, conflictos y reanudación; no volver a preguntar si cada entrega ocurrió, no aplicar automáticamente al abrir la pantalla y no tratar todo 200 como lote íntegramente completado.
- [X] T027 [US4] Ampliar `lib/employee-consumption.postgres.test.ts` para regularización concurrente con reintento, corrección y cierre de sueldo, rollback por documento y lote parcialmente completado; comprobar stock idéntico, snapshots/cierres previos idénticos, secuencias/revisiones coherentes, preservación de traslados válidos, excepción histórica para inactivo/sin apertura y apertura posterior sumada al saldo existente sin habilitar nuevas entregas antes de apertura.
- [X] T028 [US4] Ejecutar aceptación de US4 y regresión de cuentas, límites comerciales y cola en fixtures; registrar en `specs/001-simplificar-consumos-empleados/quickstart.md` totales antes/después, conflictos, reanudación y evidencia de que clientes conservan cantidades/importes/transiciones/cobros/reportes, distinguiendo simulación de envío físico.

**Checkpoint**: La transición es reintentable, tiene resultados verificables por documento y conserva evidencia; no se ha ejecutado sobre datos operativos.

## Phase 6: US3 — Corregir entregas conservando la evidencia (P2)

**Objetivo**: Conservar correcciones administrativas e imprimir solo por petición expresa, sin recrear entrega ni deuda.

**Prueba independiente**: Corregir, devolver producto recuperable/envase o reasignar con motivo; comprobar límites, beneficiarios y evidencia. Pedir primera impresión, copia y recuperación fallida deja stock/saldo/cantidad de consumos idénticos y cierres firmados intactos.

### Tests

- [X] T029 [P] [US3] Ampliar `lib/employee-receipts-server.test.cjs` con primera impresión manual sin impresión previa, copia, fallo/reintento, snapshot original y accesos administrador/creador/beneficiario histórico frente a terceros; verificar aislamiento por identificador, reasignación y cero mutaciones de stock/libro/consumos, manteniendo exclusivamente EMPLOYEE_RECEIPT para la solicitud autorizada.
- [X] T030 [P] [US3] Ampliar `lib/employee-consumption.service.test.cjs` con correcciones de entregas nuevas y regularizadas: motivo/rol administrador, devolución recuperable frente a producto irrecuperable, límites de unidades/envases, reasignación y saldo del beneficiario correspondiente según cadena de movimientos; repetición sin duplicación, original y cierres de sueldo previos intactos, sin impresión automática.

### Implementation

- [X] T031 [US3] Completar la acción «Imprimir comprobante» en `components/empleados/ConsumosEmpleados.tsx` y los ajustes mínimos demostrados por pruebas en `lib/employee-receipts-server.ts`, reutilizando `app/api/consumos-empleados/[id]/imprimir/route.ts`: primera impresión/copia explícitas, estado real enviada/en cola/error y recuperación sobre el mismo registro; conservar snapshot original y distinguir fallo de impresión de fallo del consumo. Corregir desviaciones de T030 solo en `lib/employee-consumption.ts`, preservando evidencia y reglas vigentes.
- [X] T032 [US3] Ejecutar aceptación independiente de correcciones y comprobantes de US3, incluidos entregados regularizados y cierre de sueldo previo, documentando en `specs/001-simplificar-consumos-empleados/quickstart.md` ausencia de nuevos cargos/salidas al imprimir; mantener prueba física pendiente si no se realizó y no ampliar el refactor de impresión.

**Checkpoint**: Las correcciones e impresiones funcionan sobre el registro existente y preservan su historia.

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] Registrar en `package.json` los nuevos ejecutores de pruebas de regularización y PostgreSQL con los patrones existentes, sin nuevas dependencias; hacer explícita la variable de base aislada y mantener disponibles los scripts actuales de empleados y clientes.
- [X] T034 [P] Actualizar `docs/EMPLEADOS.md` con registro directo, precios/envases vigentes, apertura obligatoria en nuevas entregas, correcciones, impresión manual y procedimiento de diagnóstico/regularización por lotes; incluir conflictos, trabajos de envío incierto y recuperación sin borrar movimientos, aclarando que no hay migración estructural nueva y que este documento no aplica datos.
- [X] T035 Ejecutar los scripts focalizados de `package.json`, comprobación TypeScript, lint configurado, validación Prisma y build, más regresión pertinente de `print-agent/src/printer.test.ts` y `print-agent-python/test_agent.py`; registrar en `specs/001-simplificar-consumos-empleados/quickstart.md` resultados, fallos de base/entorno y límites de ejecución, sin declarar aprobada una suite fallida o bloqueada por red/fuentes.
- [ ] T036 Validar visualmente móvil de 390 px y escritorio: registro, saldos, historial, correcciones, impresión y regularización administrativa con fixtures; comprobar permisos y hora de Ecuador, ausencia de controles de preparación en consumos y preservación de cocina de clientes; registrar evidencia o pendientes en `specs/001-simplificar-consumos-empleados/quickstart.md` sin afirmar UAT o impresión física no realizadas.
- [ ] T037 Ensayar corte y recuperación sobre fixtures aislados de `lib/employee-consumption.postgres.test.ts` y documentar en `docs/EMPLEADOS.md` y `specs/001-simplificar-consumos-empleados/quickstart.md` el orden de activación: detener escritores antiguos, instalar el flujo nuevo, analizar/regularizar por lotes, conciliar cargos/stock/cierres y resolver conflictos con evidencia; verificar que volver a ejecutar no duplica efectos y que recuperación no restaura escritores que creen pendientes o autoimpriman. Mantener cualquier ejecución sobre la base operativa fuera de estas tareas de desarrollo.

## Dependencies & Execution Order

### Dependencias de fases e historias

```text
T001 → T002 → US1 (T003–T009) → US2 (T010–T014)
                                  ↓
                          US4 (T015–T028)
                                  ↓
                          US3 (T029–T032)
                                  ↓
                         Final (T033–T037)
```

Las historias tienen fixtures y criterios independientes; se serializa su implementación porque comparten servicio, pantalla e infraestructura. El orden sitúa todas las historias P1 antes de US3 P2. No se interpreta independencia de pruebas como permiso para desplegar una transición incompleta.

### Orden dentro de cada historia

- US1: T003/T004 → T005 → T006 → T007/T008 → T009. Los contratos se estabilizan antes de dividir trabajo de interfaz.
- US2: T010/T011 → T012 → T013 → T014. Si T011 demuestra un defecto, T013 incluye la mínima corrección en `components/empleados/envio.ts` antes de validar; no basta ajustar la expectativa de prueba.
- US4: T015/T016/T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028. El recorrido conservador evita conflictos en servicios y UI compartidos. Las pruebas de contrato se redactan primero y deben fallar por la conducta faltante antes de implementar.
- US3: T029/T030 → T031 → T032. No modificar el servicio de T030 mientras otro colaborador lo esté editando.
- Final: T033/T034 → T035 → T036 → T037. Las tareas que actualizan `quickstart.md` se ejecutan en serie.

### Parallel opportunities y ejemplos por historia

| Historia/fase | Grupo ejecutable en paralelo | Condición previa |
|---|---|---|
| US1 | T003 servicio + T004 contrato de ruta | T002 finalizada; archivos de pruebas distintos |
| US1 | T007 pantalla de consumo + T008 formulario de producto | T006 finalizada; contrato estable |
| US2 | T010 validaciones + T011 envío/reintentos UI | US1 finalizada; sin ediciones al mismo archivo |
| US4 | T015 servicio histórico + T016 ruta administrativa + T017 límites comerciales | US2 finalizada; tres archivos de pruebas distintos |
| US3 | T029 comprobantes + T030 correcciones | US4 finalizada; archivos distintos |
| Final | T033 scripts + T034 documentación operativa | US3 finalizada; archivos distintos |

Ejemplos de reparto: en US1 un colaborador redacta pruebas de servicio mientras otro redacta las de ruta; después uno cambia la pantalla de consumos y otro el formulario de producto. En US2 se separan validación de importes y envío idempotente. En US4 se separan servicio histórico, contrato administrativo y límites de clientes. En US3 se separan comprobantes y correcciones. Cada grupo se reúne para revisar el contrato antes de implementar el siguiente paso.

## Implementation Strategy

### MVP y entregas incrementales

1. Completar Setup/Foundational y US1 para demostrar el nuevo flujo mínimo con fixtures: una confirmación, entregada y cargo, sin preparación ni impresión automática.
2. Completar US2 para demostrar exactitud financiera, elegibilidad, replay y carreras reales. No usar el MVP aislado como activación operativa.
3. Completar US4 antes de la transición: conservar clientes, retirar caminos heredados de cocina y ofrecer conciliación histórica reintentable, sin otro descuento de stock.
4. Completar US3 para demostrar que correcciones y comprobantes preservan historia, saldos y cierres; ejecutar verificación final y ensayo de corte.

### Trabajo con equipo

Asignar tareas paralelas solo dentro de los grupos indicados; dar a cada responsable archivos exclusivos y los contratos de la historia. Integrar y verificar cada grupo antes de continuar. No dividir simultáneamente `lib/employee-consumption.ts`, `components/empleados/ConsumosEmpleados.tsx` o el arnés PostgreSQL entre colaboradores.

## Cobertura y notas

| Requisitos | Tareas principales |
|---|---|
| FR-001–FR-007, SC-001/002/005 | T003–T009; T023–T025 |
| FR-008–FR-011, SC-003/004 | T010–T014 |
| FR-012–FR-015, SC-005 | T019; T029–T032 |
| FR-016, SC-007 | T015–T022; T026–T028; T037 |
| FR-017–FR-020, SC-006/008 | T017; T020; T023–T025; T027–T032; T036 |

- Mantener campos y estados técnicos por compatibilidad; simplificar la operación no requiere borrarlos ni añadir enum/columnas.
- El cargo histórico tardío afecta el saldo actual y la próxima liquidación; nunca modifica una liquidación ya firmada.
- Una prueba omitida o bloqueada debe quedar explícita; mocks no prueban bloqueos PostgreSQL y un envío confirmado por software no demuestra papel impreso.
- Total: 37 tareas; US1: 7, US2: 5, US4: 14, US3: 4; comunes: 7.

## Estado de ejecución — 2026-11-04

Las marcas completadas indican código/pruebas/documentación realizados, no aprobación de despliegue. T035 ejecutada: tipos, lint, Prisma y agentes aprobados; build bloqueado por descarga de Inter, tal como se registra en `quickstart.md`.

T014 y T037 siguen pendientes de ejecución PostgreSQL y ensayo real aislado: falta `EMPLOYEE_TEST_DATABASE_URL`. El arnés T002/T012/T027 está escrito y comprobado por TypeScript/ESLint, pero todavía no ejecutado contra PostgreSQL. No se tocó la base activa ni se hizo una regularización real.

T036 parcial: escenarios principales validados en escritorio/móvil con fixtures; revisión visual adicional de mesero y detalle de correcciones bloqueada por indisponibilidad de IAB y rechazo de autorización para Chrome nativo. Backend de permisos/correcciones aprobado. Estado final: 34 tareas completadas; T014, T036 y T037 permanecen abiertas por las limitaciones documentadas.
