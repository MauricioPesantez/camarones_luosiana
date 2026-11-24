---
type: "planning_draft"
date: "2026-11-24T00:22:16.780699+00:00"
question: "mira entiendo, ahora bien, ya que a veces tengo ese problema, necesito que me ayudes con un nuevo desarrollo. Primero que nada guiate completamente utilizando graphify para que puedas entender como está todo esto. Despues, necesito que el mesero pueda ver en su lista de \"mis ordenes\" las ordenes que aun faltan de cobrar. Si quizá ya no debería llamarse asi, puedes buscar un mejor nombre para que lo resolvamos mejor. Entonces, esto de aqui me ayuda a solventar que pueda ver todas las ordenes pendientes de pagar, y esas serían las que son mesas de ella y las domicilio en efectivo. Ayudame primero planificando y revisando esto que te digo, luego, junto conmigo vamos a realizar la implementacion"
contributor: "graphify"
source_nodes: ["MeseroContenido()", "api/ordenes/route.ts", "collectOrderPayment()", "calcularSaldo()", "OrdenesDelDia.tsx", "navegacion.ts"]
---

# Q: mira entiendo, ahora bien, ya que a veces tengo ese problema, necesito que me ayudes con un nuevo desarrollo. Primero que nada guiate completamente utilizando graphify para que puedas entender como está todo esto. Despues, necesito que el mesero pueda ver en su lista de "mis ordenes" las ordenes que aun faltan de cobrar. Si quizá ya no debería llamarse asi, puedes buscar un mejor nombre para que lo resolvamos mejor. Entonces, esto de aqui me ayuda a solventar que pueda ver todas las ordenes pendientes de pagar, y esas serían las que son mesas de ella y las domicilio en efectivo. Ayudame primero planificando y revisando esto que te digo, luego, junto conmigo vamos a realizar la implementacion

## Answer

# Borrador: órdenes por cobrar del mesero

Estado actualizado (24/11/2026): implementado y verificado localmente. Se usaron domicilios en efectivo compartidos, pendientes de días anteriores y pedidos propios para llevar, según el alcance comunicado al iniciar la implementación. Véase docs/COBROS_SIN_COMANDA.md para uso y pruebas.

**Criterio arquitectónico solicitado por el usuario:** el servidor es responsable de seleccionar las órdenes, calcular los importes y decidir las acciones autorizadas. El navegador presenta el resultado y captura la intención del operador. No se descargan órdenes para aplicar en React los filtros de negocio, ni se trata una validación visual como autorización.

## Recorrido guiado por graphify

Expanded from original query via vocab: [ordenes, mesero, cobrar, cobro, pago, efectivo, domicilio, delivery, saldo, pendiente, navegacion, caja].
Se consultaron esos grupos con graphify query; después se usaron explain y path sobre MeseroContenido(), api/ordenes/route.ts, ordenesParaMesero(), OrdenesDelDia.tsx, collectOrderPayment(), canUserModifyOrder(), sePuedeEditar(), calcularSaldo(), estaPorCobrar() y shouldPrintPaymentQr(). Las ubicaciones identificadas por el grafo se contrastaron con el código vigente. El grafo advierte un esquema antiguo de identificadores: se resolvieron coincidencias ambiguas con los IDs completos, sin reconstruir el mapa ni asumir que una referencia documental demuestra una llamada ejecutable.

## Objetivo solicitado

El mesero debe encontrar desde su aplicación las órdenes pendientes de pago: sus mesas y los domicilios en efectivo. El caso principal, aclarado por el usuario, es un domicilio en efectivo cuya comanda no se imprimió: la mesera no tiene el QR físico y necesita localizar la orden y completar el cobro desde la lista. Consultar pendientes debe permitir actuar sobre ellos, no solo verlos. El monitoreo del agente de impresión es una necesidad anterior y queda fuera de este cambio.

### Flujo principal: cobrar sin comanda ni QR físico

1. Se crea un domicilio en efectivo y falla la impresión de la comanda.
2. La mesera abre Por cobrar y encuentra la orden por número, fecha o cliente dentro de la lista.
3. La tarjeta muestra el saldo y el botón Cobrar. La ausencia de impresión no bloquea este botón en un domicilio vigente y autorizado para cobrar.
4. El botón abre el formulario de cobro existente mediante la URL de la orden; no se exige escanear el QR, reimprimir ni esperar a que el agente vuelva a conectarse. Si la orden no tiene URL, se conserva el formulario de cobro por ID que la pantalla ya utiliza como alternativa.
5. La mesera confirma el cobro. La orden sale de pendientes al actualizarse la lista; las validaciones del servidor evitan cobrarla dos veces.

Este flujo requiere conexión de la mesera con la aplicación y caja abierta. No depende de la conectividad del agente de impresión.

## Hallazgos verificados

- app/mesero/page.tsx:63 y :129: Mis órdenes carga /api/ordenes y vuelve a filtrar por mesero === usuario.nombre, excluyendo estados cobrada y cancelada. El botón de mesa se limita a estado lista.
- app/api/ordenes/route.ts:23: para el mesero el servidor restringe por creadorId (con nombre como respaldo histórico), día actual de Ecuador y exclusión del estado cobrada/cancelada. Por eso un cambio solo visual no resuelve el alcance nuevo.
- types/orden.ts:130: calcularSaldo ya calcula total menos montoPagado en centavos y evita saldos negativos. Debe reutilizarse.
- lib/order-payment.ts:37, :44 y :104: cobrar no depende del creador; editar sí. El cobro ya valida sesión, caja abierta, revisión, saldo y conflictos concurrentes.
- app/ordenes/cobrar/[token]/page.tsx y components/cobros/CobrarOrdenClient.tsx: ya existe la página de cobro que la lista abre mediante cobroUrl. No requiere escanear el papel.
- lib/payment-link.ts:22: el QR de domicilio se emite para efectivo y depende del saldo.
- lib/ordenes-mesero.ts:155 y app/api/caja/ordenes/route.ts: la lista del cierre de caja es otra función, con acceso habilitado por admin tras el conteo. No debe reutilizarse para exponer información de caja durante la operación.
- lib/navegacion.ts:77: la etiqueta Mis órdenes está definida en la navegación por rol y también en el título de la página.
- components/cobros/CobrarOrdenClient.tsx:95 y app/mesero/page.tsx:84: además de la selección de órdenes, existen cálculos de saldo, envío y reparto mixto en el cliente. El plan debe cubrir también el formulario al que conduce la lista; trasladar solamente el filtro no satisface el criterio solicitado.
- El cliente Prisma instalado expone orden.fields.montoPagado. Se verificó localmente, sin conectar a ninguna base, que permite expresar una comparación entre columnas en el filtro. La consulta candidata se comprobará contra PostgreSQL de prueba antes de darla por validada.
- La API general /api/ordenes es consumida por mesero, Digital y cocina. Una respuesta nueva con acciones y montos calculados no debe sustituir su contrato para todos los consumidores.

## Propuesta funcional

Nombre recomendado: Por cobrar. Es adecuado si la lista incluye pedidos creados por otras personas.

Mostrar órdenes vigentes de venta a cliente con saldo positivo. El estado operativo y el estado del pago se muestran por separado: una orden puede seguir en preparación y estar pendiente de pago. La impresión no es un requisito para aparecer.

Alcance provisional para validar:
1. Mesas propias por creadorId; nombre solo como respaldo de órdenes antiguas sin creadorId.
2. Todos los domicilios con metodoPagoPrevisto efectivo, incluidos Digital/WhatsApp/otros creadores, si el usuario confirma la visibilidad compartida.
3. Mantener pedidos propios para llevar si el usuario lo confirma, para no retirar esa función por un cambio de nombre.
4. Mantener pendientes anteriores hasta resolverlos, si el usuario lo confirma; mostrar fecha junto al número para evitar confundir números diarios repetidos.

Excluir de Por cobrar: pagadas sin saldo, anuladas, canceladas, pendientes de aprobación de stock, consumos/cuentas de empleados y domicilios por transferencia. Si se decide mantener visible el seguimiento de solicitudes de stock, conservarlo claramente fuera del conjunto cobrable, sin habilitar su pago.

Una orden que recibió pago y luego creció vuelve a aparecer por el saldo nuevo, aunque conserve estado cobrada. Resolver esto con el saldo y los indicadores de pago existentes, sin migrar estados ni datos históricos como parte de esta entrega.

Tarjeta: número y fecha de orden, mesa o cliente de domicilio, creador cuando corresponda, estado operativo, modalidad prevista, saldo y acción de cobro. En domicilio distinguir saldo del cliente y monto a recibir del motorizado; el envío se liquida una sola vez. Ejemplo primer cobro: total $18 y envío $2 implica recibir $16 del motorizado. Una orden reabierta cobra su saldo nuevo sin descontar el envío otra vez.

Mantener edición solo para pedidos propios aunque el usuario pueda cobrar un domicilio ajeno. No mostrar totales de caja, ventas ya cobradas ni el efectivo esperado para el conteo.

## Arquitectura propuesta: consulta y decisiones en servidor

### 1. Consulta dedicada y autorizada

Propuesta: GET /api/ordenes/por-cobrar, con sesión de mesero validada en servidor. El alcance se construye con el usuario autenticado; no se admite que el cliente elija otro mesero. El endpoint general /api/ordenes conserva su contrato para cocina, Digital y las otras vistas existentes.

Crear lib/ordenes-por-cobrar.ts como módulo de servidor de esta consulta, siguiendo los módulos de consulta ya existentes. No agregar repositorios genéricos, capas nuevas ni dependencias.

La condición SQL de pertenencia a pendientes es total > montoPagado, junto a vigencia, VENTA_CLIENTE y exclusión de canceladas, consumos/cuentas de empleado y aprobación pendiente. cobrada y estado no sustituyen la comparación de importes. La autoría y modalidad se aplican en la misma consulta: mesas propias y domicilios con metodoPagoPrevisto efectivo según el alcance acordado. impresa, PrintJob y el heartbeat del agente no participan en el filtro ni se usan como requisito para cobrar.

Expresar la comparación con las referencias de campo de Prisma verificadas localmente, para que PostgreSQL descarte las filas sin saldo. No recuperar todas las órdenes para luego usar Array.filter en Node o React. Usar consultas parametrizadas si alguna parte requiere SQL explícito; nunca interpolar parámetros del navegador en SQL.

Los domicilios antiguos cuyo metodoPagoPrevisto sea null no se clasifican automáticamente como efectivo: son un dato desconocido que debe identificarse en pruebas y acordarse antes de ampliar el filtro.

Aplicar select con los campos que las tarjetas y sus acciones realmente necesitan. No devolver el hash del token de cobro, historial de pagos, comprobantes, retiros, campos administrativos ni objetos completos de productos por reutilizar ORDEN_INCLUDE. Si la edición propia necesita detalle adicional, cargarlo mediante una lectura autorizada al abrir el editor; conservar su comportamiento y no habilitarlo en pedidos ajenos.

### 2. Contrato preparado para presentar

La respuesta incluye ordenes, totalPendientes, siguienteCursor y consultadoAt. Cada orden incluye identificación (id, número diario con su fecha, tipo, mesa/cliente), estado operativo y los siguientes valores calculados por servidor:

- saldoPendiente.
- importeARecibirEnEfectivo para el método previsto y la situación actual de pagos, neteando el envío solo cuando corresponde.
- puedeCobrar, motivoBloqueoCobro y destinoCobro interno.
- puedeEditar según autoría y reglas de edición existentes.
- printRevision requerida por el flujo de confirmación, cuando corresponde.

No devolver como importe a recibir una cantidad negativa sin explicar su sentido: si la liquidación requiere entregar dinero al motorizado, representarla con la dirección y etiqueta que ya usa la lógica existente. La suma histórica del efectivo y el cálculo de envío se resuelven en servidor; no se recalculan a partir del total en el navegador.

El front puede formatear moneda y fechas y manejar carga, selección y foco. No decide quién ve cada orden, qué saldo existe, si puede cobrar o editar ni cuánto corresponde al motorizado. El contador sale del servidor; no se deriva de la cantidad de tarjetas de una página.

### 3. Importes y reglas reutilizados

Reutilizar calcularSaldo, montoACobrarEnCaja, montoARepartirEnMixto, partesDeCobroMixto y calcularLiquidacionDomicilio desde un módulo de servidor para los usos afectados. Mantener la aritmética exacta en centavos o Decimal; el navegador no envía un total definitivo como fuente de verdad.

La misma función de presentación de cobro prepara la tarjeta, la página existente de cobro por URL y la alternativa de cobro por ID. Extraer de validateOrderCanBePaid solo los criterios que deban compartirse con puedeCobrar; no copiar una segunda tabla de estados en el front. Conservar la distinción real entre cobro por enlace y cobro interno: el parámetro de navegación origen=lista actualmente controla el retorno de la página y no debe confundirse con input.origen de collectOrderPayment.

Cubrir el formulario común CobrarOrdenClient y la alternativa del mesero sin URL; mover solo la lógica afectada por este flujo. Las otras pantallas que consumen el contrato actual de cobro mantienen compatibilidad y se verifican si cambia un helper o componente compartido.

Para el reparto mixto, que depende de lo que escribe el operador, el cliente envía la selección y el efectivo introducido a una previsualización autenticada y sin escritura financiera. El servidor devuelve los importes y partes resultantes; el cliente los presenta para confirmar. Implementar esta previsualización para los accesos por token y por ID con la misma función de negocio y los permisos de lectura del acceso correspondiente; conocer un ID no otorga acceso a una mesa ajena. Consultar al terminar de introducir el dato o al solicitar la revisión, sin una petición por cada tecla; una respuesta antigua no puede habilitar la confirmación de una intención nueva. La vista previa nunca confirma el pago ni reserva el saldo. No sustituir esta operación por otra fórmula de reparto en React.

### 4. Confirmación y concurrencia

Reutilizar collectOrderPayment. Al confirmar, el servidor vuelve a leer saldo y revisión y verifica sesión, permiso, caja abierta, estado vigente y suma de las partes. No confía en puedeCobrar, saldoPendiente ni en una previsualización anterior enviados por el cliente.

Preservar la transacción que guarda cobros, orden e historial, la comparación de montoPagado/revisión y las claves de idempotencia. En el cliente, mantener la misma clave al reintentar el mismo acto tras una respuesta incierta; cambiar la intención de pago requiere una nueva clave. Si la orden cambió, responder conflicto y mostrar datos actualizados para una nueva confirmación, sin cobrar silenciosamente otro importe.

Después del cobro, volver a consultar la lista del servidor. No eliminar filas con un filtro de negocio local ni mostrar éxito antes de la confirmación. Un timeout puede ocurrir después de guardar: mostrar que no se pudo confirmar el resultado y resolver el reintento con idempotencia.

### 5. Rendimiento de consulta

Orden estable por createdAt e id, de más antigua a más reciente. Paginación en servidor por cursor si el conjunto puede crecer; página inicial propuesta de 50 filas con Cargar más y siguienteCursor, sin ocultar pendientes por un límite silencioso. Validar cursor y límite y aplicar siempre el alcance autorizado. Si el contador y la página deben representar el mismo instante, leerlos con una instantánea consistente de PostgreSQL.

Evitar consultas por cada orden: lectura de órdenes y relaciones seleccionadas en lote. El historial de todos los pagos no se descarga para resolver el listado; usar los importes materializados de la orden y agregaciones de servidor solo si la liquidación lo exige.

Medir el plan de consulta con EXPLAIN (ANALYZE, BUFFERS) en un PostgreSQL de pruebas con datos representativos: órdenes cobradas, pendientes de varios días y distintos creadores. Comparar la consulta autorizada completa, incluidos OR, orden y paginación. Revisar los índices existentes (creadorId y tipoOperacion/empleadoId/createdAt) y agregar un índice parcial o compuesto únicamente si la medición lo justifica. No prometer mejoras de latencia ni una migración innecesaria antes de medir. No ejecutar este análisis en producción dentro de esta planificación.

### 6. Interfaz y errores

Renombrar Mis órdenes a Por cobrar en título y navegación. Renderizar los campos y acciones devueltos por el servidor; conservar la ruta de regreso tras cobrar. Mantener Actualizar y refrescar al regresar del formulario. La paginación o actualización no debe mover el foco de quien está operando.

Gestionar explícitamente carga inicial, vacío confirmado, error, sesión vencida y datos desactualizados. Una petición fallida no se presenta como cero deudas. Si se conservan tarjetas mientras se actualiza, indicar que corresponden a la última consulta exitosa. Cancelar o descartar respuestas de cargas anteriores para que no reemplacen un resultado más nuevo.

## Skill solicitada: Modern Web Guidance

Instalada desde https://github.com/GoogleChrome/modern-web-guidance en /Users/mauriciopesantezg/.codex/skills/modern-web-guidance. SKILL.md leído. El catálogo de Codex la reconocerá en el próximo turno; en esta planificación ya se ejecutaron search y retrieve mediante su CLI usando Node 22 existente. No se cambiaron dependencias ni la versión de Node del proyecto.

Guías consultadas: accessibility y forms. Aplicación prevista al código de este flujo:

- Lista semántica de pendientes, acciones con nombre que identifique la orden, foco visible y navegación por teclado.
- Resultados de cobro y errores anunciados; no anunciar repetidamente cada recarga transitoria.
- Formulario con etiquetas persistentes, validaciones de formato para experiencia de uso y errores de servidor asociados al campo o resumen. La seguridad y la integridad siguen en el servidor.
- Confirmación explícita con el importe calculado por el servidor, y protección visual contra envíos repetidos mientras la petición está en curso, además de la idempotencia real del backend.
- Si se modifica el modal alternativo, usar el patrón accesible recomendado y verificar foco al abrir/cerrar. No modernizar modales ajenos a esta entrega.
- Revisar compatibilidad y fallbacks de las APIs nuevas que realmente se adopten. No añadir APIs, animaciones ni polyfills sin necesidad funcional.

Esta skill cubre plataforma web, formularios y accesibilidad; no prescribe la arquitectura SQL ni sustituye las reglas del negocio. Antes de implementar la interfaz, repetir la búsqueda relevante según SKILL.md y verificar el resultado contra las guías recuperadas.

## Plan de implementación propuesto

1. Cerrar alcance funcional: domicilios compartidos, días anteriores y pedidos propios para llevar. Mantener pendiente de aprobación fuera del conjunto cobrable y preservar su seguimiento si se requiere.
2. Definir el contrato de lectura y las reglas compartidas de servidor. Probar autoría por ID con respaldo histórico, saldo positivo, exclusiones y acciones; los permisos de respuesta no reemplazan las validaciones de escritura.
3. Implementar la consulta GET dedicada, proyección mínima, conteo y paginación. Probar la comparación de columnas y los predicados contra PostgreSQL aislado. Medir el plan de ejecución antes de proponer índices.
4. Preparar los importes de cobro en servidor y adaptar el formulario común y la alternativa sin URL. Implementar previsualización de mixto solo como cálculo de servidor sin mutaciones, conservando el contrato actual de confirmación y sus consumidores.
5. Actualizar la vista del mesero y navegación. Retirar los filtros de negocio, aritmética monetaria y decisiones de permisos del cliente de este flujo. Usar los campos y acciones calculados por el servidor y aplicar las guías accessibility/forms.
6. Verificar el caso principal extremo a extremo: crear domicilio efectivo, simular que no se imprime, encontrarlo con sesión de mesero, abrir cobro sin QR, confirmar, refrescar y comprobar un único registro de pago. Repetir con concurrencia y respuesta perdida.
7. Ejecutar pruebas de consulta/servidor, cobros, liquidación, navegación y fronteras de empleados/cierre afectadas; tipos y lint de archivos cambiados. Revisar teclado, foco y vista móvil con datos de prueba. No desplegar ni migrar una base activa como parte de la planificación.

### Archivos y consumidores que debe cubrir la implementación

| Área | Alcance propuesto |
| --- | --- |
| Consulta nueva | app/api/ordenes/por-cobrar/route.ts y lib/ordenes-por-cobrar.ts: autenticación, alcance SQL, proyección, conteo y cursor. |
| Contrato | Tipos de respuesta compartidos entre consulta y pantalla, siguiendo la carpeta types existente. |
| Importes y acciones | Un módulo de servidor lib/presentacion-cobro.ts reutiliza los helpers existentes y prepara importes/acciones. lib/order-payment.ts comparte los criterios necesarios y conserva la confirmación transaccional. |
| Lectura de detalle propio | Si el editor necesita campos que ya no trae la lista, agregar GET autorizado a app/api/ordenes/[id]/route.ts, preservando PATCH/DELETE. No abrir detalle ajeno por tener acceso a un domicilio compartido. |
| Reparto introducido por operador | POST de previsualización en app/api/cobros/[token]/previsualizar/route.ts y app/api/ordenes/[id]/previsualizar-cobro/route.ts: envoltorios de la misma función, sin escribir cobros. La lectura por token conserva sus validaciones y la lectura por ID aplica el alcance permitido. |
| Formulario de cobro | app/ordenes/cobrar/[token]/page.tsx entrega la presentación calculada en servidor a components/cobros/CobrarOrdenClient.tsx. La alternativa sin URL en app/mesero/page.tsx consume el mismo cálculo de servidor. |
| Lista y menú | app/mesero/page.tsx y lib/navegacion.ts: presentación, nombre Por cobrar, contador recibido y actualización. |
| Pruebas nuevas | Consulta y proyección de servidor, comparación de columnas en PostgreSQL aislado, permisos de lectura/previsualización, componente con DTO preparado y flujo sin comanda. Usar node:assert y los patrones de pruebas del repositorio. |
| Regresión existente | lib/cobro.test.ts, types/cobro.test.ts, lib/order-payment-validaciones.test.ts, lib/liquidacion-domicilio.test.ts, lib/payment-link.test.ts, lib/navegacion.test.ts y fronteras de ventas/empleados/cierre que resulten afectadas. |

No cambiar los endpoints actuales de confirmación ni exigir a Digital/Administración adoptar el contrato de la nueva consulta. Si se extraen helpers compartidos, conservar sus firmas o adaptar todos sus consumidores y verificar los recorridos usados por esos roles. La separación solicitada se implementa en el listado del mesero y en el formulario al que conduce; una migración general de otras pantallas requiere un alcance separado.

## Casos de aceptación

- Mesa propia impaga aparece; mesa de otro mesero no aparece.
- Domicilio efectivo de Digital/WhatsApp aparece si se aprueba el alcance compartido.
- Domicilio por transferencia ya pagado no aparece.
- Pedido en preparación con deuda permanece visible; no se confunde visible con autorizado para cobrar.
- Caso principal: un domicilio en efectivo no impreso aparece en Por cobrar y su botón permite completar el cobro sin escanear ni reimprimir el QR y sin esperar al agente. Tras confirmar, desaparece de pendientes y se registra un solo cobro.
- Una orden sin cobroUrl conserva la alternativa de cobro por ID ya existente; no queda bloqueada por la ausencia de QR o de URL.
- Pedido de ayer aparece si se aprueba mantener históricos pendientes.
- Pedido pagado que crece reaparece con el saldo adicional.
- Orden anulada, cancelada, sin aprobar o de empleado no entra al conjunto cobrable.
- Cobro confirmado retira la orden; si otro usuario ya la cobró, se informa el conflicto y se actualiza la lista sin duplicar dinero.
- Ver domicilio ajeno no habilita editarlo.
- Primer cobro y saldo adicional respetan la liquidación del envío.
- Las restricciones de la vista de cierre y las consultas de otros roles siguen vigentes.
- El endpoint devuelve únicamente filas autorizadas con saldo positivo; cambiar parámetros, cursor o ID en el navegador no amplía permisos.
- El cliente presenta saldo, liquidación y acciones recibidas, sin filtros de negocio ni fórmulas monetarias propias; el contador sigue siendo correcto al paginar.
- La previsualización y el cobro real coinciden en primer pago y saldo adicional; cambiar el saldo entre ambos obliga a revisar la confirmación.
- Los importes manipulados en el navegador se rechazan y no alteran los movimientos de caja.
- Las cargas fuera de orden y los fallos de red no muestran una lista vacía falsa ni revierten una consulta más nueva.
- Un SQL de prueba valida los resultados con registros reales de PostgreSQL; mocks de Prisma por sí solos no prueban el filtro entre columnas.

## Resultado de implementación

- Consulta SQL y proyección de servidor: lib/ordenes-por-cobrar.ts y GET /api/ordenes/por-cobrar.
- Lista del mesero renombrada a Por cobrar, sin filtros de negocio ni fórmulas monetarias en el cliente.
- Página de cobro por token reutilizada y alternativa autenticada por ID para pedidos sin URL.
- Importes y previsualización de mixto resueltos en servidor; confirmación transaccional existente conservada.
- PostgreSQL 16 en Docker, base restaurant_pos_test y conexión privada en .env.test.local. Migraciones aplicadas solo a la base local.
- Pruebas de unidad y PostgreSQL: permisos, comparación entre columnas, idempotencia, cobros simultáneos, liquidación y paginación. Se midió SQL con 5.000 órdenes históricas, sin añadir índices especulativos.
- Flujo HTTP real probado con un domicilio creado por Digital y dejado en cola sin impresión; el mesero lo encontró y cobró sin duplicar al reintentar.
- Navegador: lista en móvil, acceso sin QR, confirmación nativa y reparto mixto calculado por servidor.
- Tipos, lint de los archivos afectados y compilación Next.js con webpack pasaron. La instancia temporal de pruebas fue detenida; PostgreSQL permanece sano en Docker.
- No se desplegó la aplicación ni se modificó producción; no se verificó impresión física. El monitoreo del agente sigue fuera de esta entrega.

## Source Nodes

- MeseroContenido()
- api/ordenes/route.ts
- collectOrderPayment()
- calcularSaldo()
- OrdenesDelDia.tsx
- navegacion.ts
