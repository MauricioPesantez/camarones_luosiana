# Plan: consumos y cuentas de empleados

Fecha: 2026-11-03, America/Guayaquil.
Estado original: propuesta para aprobación, redactada el 2026-11-03.
Actualización 2026-11-04: el dueño aprobó el desarrollo en este chat y posteriormente autorizó aplicar la migración a la base activa de develop. La migración se aplicó y verificó sin dejar datos de prueba. Implementación, verificaciones y condiciones de activación documentadas en `docs/EMPLEADOS.md`; no se desplegó la aplicación ni se activaron cuentas automáticamente.
Base revisada: código local en `dd2e07d`. El grafo existente se usó para localizar flujos; el diagnóstico se contrastó con los archivos actuales.

## 1. Resultado esperado y decisiones del dueño

Crear una **cuenta por empleado** que reúna los adelantos de dinero y los productos entregados a cuenta del sueldo. El administrador podrá consultar el saldo actual, revisar sus movimientos y registrar cuánto descontó efectivamente al pagar el sueldo. Cada empleado tendrá cierres independientes, en las fechas en que realmente cobre.

Decisiones confirmadas en esta conversación:

- Cada producto tendrá un precio fijo para empleados, configurable únicamente por el administrador.
- Todos los empleados ya tienen un usuario individual. Se reutilizará esa identidad; no hace falta un catálogo separado de empleados.
- Los combos para llevar conservarán el recargo actual de **$1,25 por unidad**, adicional al precio especial.
- Este trabajo entrega únicamente el plan. El desarrollo empieza después del OK del dueño.

Recomendaciones que se someten a aprobación con este plan:

- Llamar al registro **Consumo de empleado**, y al módulo administrativo **Cuentas de empleados**.
- Autorizar al mesero y al administrador a registrar consumos con el precio ya configurado. No permitirles escribir un precio arbitrario. Esta política evita una aprobación individual de cada cola y mantiene el control del precio en el administrador.
- Cargar a la cuenta los productos cuando se confirma su entrega. Mostrar aparte los pedidos todavía en preparación y su importe previsto.
- Permitir descuentos de sueldo completos o parciales; conservar el pendiente y cualquier saldo a favor.
- Utilizar comprobantes impresos con firma física, siguiendo la operación actual. La firma física no equivale a una firma digital almacenada.

## 2. Lo que existe hoy

| Componente actual | Evidencia | Implicación para esta funcionalidad |
|---|---|---|
| Identidad individual y baja lógica | `prisma/schema.prisma`, modelo `Usuario`; `types/usuario.ts` | El beneficiario se vincula por ID, aunque cambie de nombre, rol o quede inactivo. |
| Adelanto dentro de un retiro de caja | `types/retiro.ts`; `app/api/retiros/route.ts` | Un retiro con categoría `adelanto` ya identifica al beneficiario y resta efectivo. Solo esta categoría debe generar deuda del empleado. |
| Registro inmediato de retiros | `app/api/retiros/route.ts`; `docs/superpowers/specs/2026-08-01-retiro-caja-design.md` | El servidor actual no tiene un estado de aprobación previa del adelanto. El mesero registra y el administrador puede anular. Conservar cualquier autorización física que ya se realice. |
| Ticket de adelanto | `lib/withdrawal-print.ts` | Se imprimen nombres, monto y espacios para firma de quien entrega y recibe. No se guarda una firma ni su verificación digital. |
| Idempotencia y anulación de retiro | `clientRequestId` en `RetiroCaja`; rutas de retiros | Reutilizar estos principios y acoplar el movimiento de la cuenta a la misma transacción. |
| Preparación, inventario y comanda | `app/api/ordenes/route.ts`; `app/api/ordenes/[id]/route.ts`; `lib/print-jobs.ts` | Reutilizar el circuito de cocina sin construir otra cocina ni otro agente. |
| Precio de carta y stock por producto | `Producto`, `Item`; `types/orden.ts` | Agregar el precio de empleado. El inventario actual descuenta productos completos, no ingredientes de recetas. |
| Recargo de envases | `types/orden.ts`, `calcularRecargoEnvases` | Conservar $1,25 por combo para llevar, también para empleados. |
| Caja y ventas derivados de órdenes/retiros | `lib/cuadre-server.ts`; `types/cuadre.ts`; `app/api/caja/route.ts` | Una orden interna debe excluirse explícitamente de ventas y cobros pendientes. No basta con no cobrarla. |
| Cobro centralizado y QR | `lib/order-payment.ts`; rutas de cobros | Rechazar consumos internos desde el servidor y no generarles enlaces de cobro. |
| Gestión administrativa de usuarios/productos | Rutas `app/api/usuarios/**` y `app/api/productos/**` | Sus mutaciones actuales no comprueban autorización administrativa. Protegerlas forma parte de asegurar las identidades y los precios de este módulo. |

No existe todavía una cuenta acumulada por beneficiario, un registro de descuentos de sueldo ni un cierre individual de esos descuentos. La consulta diaria de retiros se organiza por quien registra, no por una cuenta mensual de quien recibe.

## 3. Alternativas consideradas

| Alternativa | Ventaja | Problema | Decisión |
|---|---|---|---|
| Una venta normal con precio rebajado y cobro pendiente | Reutiliza la pantalla existente | Mezcla deuda del empleado con deuda de clientes y ventas normales; podría mostrar QR o bloquear cierres. | Descartada. |
| Registrar productos como retiros de caja | Aprovecha los adelantos | Haría parecer que salió efectivo cuando salió una cola; tampoco representa bien cocina ni stock. | Descartada. |
| Un contador editable por empleado | Muy simple al principio | Pierde el origen y permite borrar deuda con un reset; no resuelve cierres parciales ni correcciones. | Descartada. |
| Consumos internos vinculados a cuenta y movimientos auditables | Separa el dinero, los productos y el descuento posterior | Requiere integrar explícitamente órdenes, caja, impresión y cuenta. | Recomendada. |

La orden interna reutiliza productos, líneas, preparación, numeración y comanda. La cuenta registra la deuda y su recuperación. No se crea un módulo de nómina ni se replica el circuito de cocina.

La separación de reportes aquí es operativa: la clasificación contable o tributaria de estas entregas no se redefine en esta implementación.

## 4. Reglas del saldo y del cierre

```text
Saldo firmado = saldo de apertura revisado
              + adelantos nuevos registrados
              + consumos entregados
              + ajustes de cargo / reversos de descuentos
              - descuentos de sueldo confirmados
              - anulaciones, devoluciones y correcciones de abono

Pendiente por descontar = máximo(saldo firmado, 0)
Saldo a favor          = máximo(-saldo firmado, 0)
```

El saldo se calcula desde movimientos persistidos. No se mantiene un contador independiente que pueda desincronizarse. Importes en `Decimal(10,2)` y cálculos exactos en centavos o Decimal, respetando el patrón del proyecto.

**Ejemplo:** adelanto $30 + dos colas a $0,75 + combo $4 + envase $1,25 = **$36,75 pendientes**. Si el dueño descuenta $36,75 del sueldo, se registra un movimiento de -$36,75 y queda saldo cero. Si descuenta $20, quedan **$16,75 pendientes**. Un consumo posterior de $2 deja $18,75.

El botón debe llamarse **Registrar descuento de sueldo**, con una confirmación que muestre empleado, saldo revisado, monto a descontar y saldo resultante. No debe llamarse simplemente “Reset”. Confirmar significa que ese descuento se realizó realmente; consultar o imprimir una previsualización no cambia el saldo.

- El cierre es individual y manual; no se reinicia por mes ni por día calendario.
- La fecha real del descuento y la fecha de registro quedan separadas. Una fecha declarada anterior no cambia el orden de los movimientos ni reescribe un cierre anterior.
- El cierre usa el saldo actual revisado, hasta una secuencia de movimientos concreta. No permite seleccionar un intervalo arbitrario y presentarlo como toda la deuda.
- Cada comprobante conserva saldo anterior, detalle considerado, monto aplicado y saldo posterior. En un cierre parcial, el pendiente se arrastra expresamente al siguiente.
- La recuperación parcial se aplica a la cuenta global. Esta versión no distribuye cuotas de sueldo por cada cola o adelanto individual ni etiqueta una línea como pagada sin esa información.
- Todos los cargos y descuentos siguen disponibles en el estado de cuenta. El detalle de cada cierre permite saber qué movimientos y qué saldo anterior se consideraron.

## 5. Flujos de uso

### 5.1 Configurar precios

El administrador edita un campo **Precio para empleados** dentro del producto existente. Un valor vacío significa “no habilitado para consumo de empleados”, nunca “usar automáticamente el precio de carta”. Se exige precio mayor a cero y no superior al precio de carta; una cortesía gratuita es otra operación y no debe disfrazarse como deuda.

El precio aplicado se obtiene en el servidor. El formulario puede mostrar una previsualización, pero no imponer precios, totales ni autorías. Si cambia el precio entre la previsualización y la confirmación, se solicita revisar el importe actualizado antes de registrar.

Cada línea conserva nombre, precio de carta y precio especial aplicados en ese momento. Cambiar el catálogo no altera consumos anteriores, pedidos ya confirmados ni comprobantes. La diferencia frente al precio de carta es informativa; la deuda es únicamente el importe especial más los envases.

### 5.2 Entregar una cola u otro producto directo

1. Mesero o administrador abre **Consumo de empleado** y selecciona un empleado activo.
2. Agrega productos, cantidades y modalidad en el local/para llevar. Ve el precio especial y el recargo correspondiente.
3. Confirma **Entregar y cargar a cuenta**.
4. Una sola transacción valida disponibilidad, descuenta stock, crea la orden interna entregada, registra el cargo y encola el comprobante cuando hay cola activa.
5. La respuesta diferencia “registro confirmado” de “comprobante pendiente/error de impresión”. Reintentar una impresión nunca crea otro cargo.

La entrega directa se configura por producto con un indicador simple de preparación; no debe deducirse solo de que el tiempo de preparación sea cero. El administrador define qué productos requieren cocina. La clasificación inicial del catálogo se revisa antes de habilitar el flujo.

### 5.3 Un combo que requiere cocina

1. Registrar el consumo con precio y empleado congelados.
2. Reservar/descontar stock con el mismo criterio de las órdenes actuales. Todavía no generar deuda definitiva.
3. Mostrar en cocina con distintivo **EMPLEADO** y datos necesarios de preparación. No mostrar saldos ni adelantos.
4. Mantener `pendiente → en_preparacion → lista`. Cocina prepara; mesero o administrador confirma la entrega al empleado.
5. La confirmación de entrega cambia el estado y crea el cargo una sola vez, en la misma transacción. Imprime el comprobante para firma.

La comanda sirve para preparar; el comprobante sirve para acreditar lo entregado. El monitor/listado de entrega debe permitir encontrar pendientes de días anteriores, para que cruzar medianoche no los vuelva inaccesibles.

Un pedido mixto de cola y combo se entrega completo y genera un solo cargo. Si la cola se entrega antes, se registra como otro consumo. No introducir entregas parciales de una misma orden en esta versión.

### 5.4 Registrar un adelanto

Conservar el flujo actual de retiro de efectivo y la identificación de quien recibe. Dentro de la misma transacción que crea el `RetiroCaja`, crear un cargo asociado a su `beneficiarioId`. Autor y beneficiario son personas distintas conceptualmente, aunque coincidan.

El adelanto afecta dos registros por una misma causa:

- Caja: disminuye el efectivo, como hoy.
- Cuenta del beneficiario: aumenta lo pendiente por descontar.

No duplicar el retiro ni crear otra salida de caja al consultar o cerrar la cuenta. La anulación del retiro también genera su contramovimiento en la cuenta, de forma atómica.

Si la cuenta del beneficiario aún no fue activada/revisada, impedir el nuevo adelanto y los nuevos consumos con un mensaje concreto que pida al administrador completar la apertura. Evitar que haya operaciones nuevas fuera del seguimiento durante la transición.

### 5.5 Consultar y descontar del sueldo

En **Administración → Equipo → Cuentas de empleados**:

- Lista de empleados con pendiente, saldo a favor y último cierre; incluir inactivos que tengan saldo.
- Ficha con estado de cuenta, adelantos y consumos desglosados, autor, fecha, ajustes y enlaces al origen.
- Pedidos en preparación/listos para entrega e importe previsto, separados del saldo descontable.
- Historial de cierres y sus comprobantes.
- Previsualización de descuento completo o parcial y confirmación explícita del importe realmente aplicado.

Cada empleado puede consultar **Mis descuentos**, únicamente su propia cuenta. El mesero que entrega a otro empleado ve el comprobante de esa operación; eso no le concede acceso a los demás adelantos o saldos del beneficiario.

No hace falta guardar sueldo ni día de pago para resolver esta necesidad. El dueño cierra la cuenta cuando efectivamente paga a cada persona.

## 6. Efecto sobre caja, ventas e inventario

| Hecho | Caja del día | Stock | Cuenta del empleado | Reportes de ventas a clientes |
|---|---|---|---|---|
| Adelanto de $20 | -$20 de efectivo, retiro existente | Sin cambio | +$20 | Sin cambio |
| Consumo directo entregado de $2 | Sin cambio | Descuenta una vez | +$2 | No se suma |
| Combo solicitado, no entregado | Sin cambio | Reserva/descuenta una vez | Sin cargo; previsto separado | No se suma |
| Entrega de ese combo | Sin cambio | No vuelve a descontar | Cargo por su total congelado | No se suma |
| Descuento de $22 del sueldo | Sin cambio | Sin cambio | -$22 | Sin cambio |
| Corrección de un consumo | Sin cambio | Solo restitución explícita si corresponde | Contramovimiento trazable | Sin cambio |

El cierre de cuenta no representa un ingreso de efectivo. Tampoco representa el pago del sueldo completo desde la caja: si el negocio retira dinero de caja para pagar sueldos, esa salida se registra por su mecanismo propio y no se inventa al cerrar descuentos.

Las órdenes internas no generan `Cobro`, QR, comprobante de transferencia, deuda de clientes ni liquidación de motorizado. No se simula que están cobradas estableciendo `montoPagado = total`: su cierre operativo depende de la entrega y su deuda vive en la cuenta.

El stock actual es por producto. No prometer descuento de ingredientes, desglose de componentes de combos ni cálculo de margen: no hay recetas o costos suficientes en el modelo actual.

## 7. Casos excepcionales y comportamiento esperado

| Escenario | Tratamiento propuesto |
|---|---|
| Producto sin precio especial | Bloquear ese producto y explicar que el administrador debe configurarlo. |
| Producto deshabilitado | No permitir consumos nuevos. Conservar los anteriores. |
| Precio, nombre o rol cambia después | Consultar los valores históricos guardados, manteniendo la relación por ID. |
| Dos empleados con nombres similares | Selección por identidad individual; nunca agrupar deuda por nombre. |
| Doble clic, pérdida de respuesta o reintento | Misma clave + mismo contenido devuelve el registro original; misma clave con otro contenido devuelve conflicto. |
| Dos registros para el último producto | Descuento condicional agregado por producto dentro de transacción; solo uno puede consumir el stock restante. |
| Mismo producto repetido con distinto picante | Conservar líneas de preparación, sumar cantidades para validar stock y descontar una vez por cantidad total. |
| Stock insuficiente | Bloquear consumos internos en esta primera versión. Ajustar/verificar stock antes de registrar; no reutilizar la aprobación comercial que puede permitir stock negativo. |
| Caja cerrada | Mantener la restricción actual para adelantos. El consumo a cuenta y el descuento de sueldo no requieren caja abierta porque no mueven efectivo. |
| Producto nunca entregado | No genera deuda. Cancelación administrativa conserva el pedido y registra qué pasó con el stock. |
| Pedido ya en preparación al cancelar | No devolver automáticamente stock de comida preparada o desperdiciada. El administrador decide y registra el tratamiento. |
| Cancelación antes de preparación | Permitir liberar reserva mediante restitución explícita y auditada; nunca dos veces por reintentos. |
| Empleado equivocado | Antes de entrega: cancelar y registrar correctamente. Después: reverso administrativo del cargo y cargo vinculado a la persona correcta, atómicos y sin volver a descontar stock. |
| Error de productos/cantidad | Antes de entrega: cancelar y recrear, sin editor especial complejo. Después: corrección enlazada al origen, sin editar la entrega histórica. |
| Devolución parcial de varias unidades | Registrar unidades devueltas y abono con precios históricos, con tope en lo entregado y no devuelto. Stock solo si se recibió producto utilizable. |
| Envase ya utilizado y devolución del combo | No devolver automáticamente su importe; el administrador confirma qué parte corresponde abonar y queda desglosada. |
| Adelanto anulado | Contramovimiento único por el mismo beneficiario; conservar el origen. La devolución física del efectivo debe concordar con la operación existente. |
| Anulación después de descontar del sueldo | Mantener el cierre anterior; generar abono actual y, si corresponde, saldo a favor. No reescribir meses anteriores. |
| Corrección superior a lo originalmente cargado | Rechazar el excedente. No permitir que sucesivos ajustes abonen dos veces el mismo cargo. |
| Descuento parcial | Registrar únicamente lo recuperado; arrastrar el resto y mostrarlo en el siguiente cierre. |
| Saldo mayor que lo que se puede descontar hoy | Mostrarlo y permitir monto parcial. No descontar automáticamente por conocer la fecha de pago. |
| Intento de descontar más que el saldo positivo | Bloquear. Un anticipo o ajuste distinto necesita su propio registro. |
| Saldo a favor tras una corrección | Mostrarlo sin truncar el saldo real. Compensa futuros cargos; una devolución física de dinero queda fuera del cierre de sueldo. |
| Cierre equivocado | Solo administrador puede revertirlo con motivo. Crear movimiento opuesto una sola vez y conservar ambos comprobantes relacionados. |
| Dos administradores cierran a la vez | Bloqueo de cuenta y revisión esperada: el segundo recibe conflicto y debe revisar el saldo actualizado. |
| Nuevo cargo entre previsualizar y cerrar | No aceptarlo silenciosamente: invalidar la revisión y pedir nueva confirmación. |
| Entrega mientras se cierra cuenta | Serializar por empleado. La entrega pertenece inequívocamente al saldo revisado o al siguiente, según el orden confirmado. |
| Impresora sin papel, desconectada o con reintento | El registro no se repite. Mostrar estado y permitir copia identificada. No garantizar exactamente una impresión física. |
| Ticket firmado se pierde | Reimprimir copia identificada del mismo registro. No afirmar que el sistema conserva la firma física. |
| Operación sin conexión | No confirmar movimientos locales como guardados. Mantener el envío para reintento con la misma clave al reconectar. |
| Empleado inactivo o que sale del negocio | Bloquear nuevas entregas/adelantos; conservar consulta, correcciones y cierre de saldo. Si hay pedido pendiente, resolverlo administrativamente. |
| Operación cruza medianoche | Presentación en America/Guayaquil y secuencia de cuenta independiente del día; pendientes operativos recuperables. |
| Usuario intenta acceder a otro empleado | Responder 403 desde el servidor, también al consultar IDs, imprimir y exportar detalle. |
| Consumo para llevar a la familia | Sigue asociado al empleado responsable; no crear cuentas para familiares. |
| Consumo gratis | No generar deuda ficticia. Mantenerlo fuera de este flujo y del saldo descontable. |
| Desea pagar inmediatamente en efectivo/transferencia | Fuera del primer alcance. Requiere un ingreso real de caja/banco enlazado a la cuenta; no usar “descuento de sueldo” para simularlo. |
| Anticipo entregado fuera de caja o por transferencia | Fuera del flujo actual de retiros en efectivo. No inventar una salida de efectivo para registrarlo. |

Las devoluciones y correcciones son acciones administrativas vinculadas al origen. No se incluye un formulario genérico para crear multas u otros descuentos de importe libre.

## 8. Modelo de datos propuesto

Mantener Prisma/PostgreSQL y las capas actuales de tipos, validaciones puras, servicios de servidor y rutas. No agregar dependencias para esta funcionalidad.

### Extensiones de entidades existentes

- `Producto`: `precioEmpleado` opcional y bandera de preparación para el consumo interno. Los productos existentes quedan deshabilitados para empleados hasta configurar precio y revisar preparación.
- `Orden`: discriminador `tipoOperacion = VENTA_CLIENTE | CONSUMO_EMPLEADO`, por defecto `VENTA_CLIENTE`; `empleadoId`, nombre histórico y clave idempotente de creación interna. Conservar `tipoOrden` para local/para llevar, sin domicilio de empleado en esta versión.
- `Item`: nombre histórico y precio de carta de referencia para el consumo interno; `precioUnitario` y `subtotal` conservan el precio especial real. Campos nuevos compatibles con filas antiguas.
- `Usuario`: marca de cuenta activada y revisión/secuencia de cuenta para concurrencia. No guardar el saldo como un número editable.
- `PrintJob`: soporte de comprobante de consumo/cuenta y relación al cierre cuando corresponda; conservar tipos y payloads ya existentes.

### `MovimientoCuentaEmpleado`

Registro inmutable del efecto financiero: empleado, secuencia por empleado, tipo, importe firmado, fecha de registro, fecha del hecho si se declara, autor/nombre/rol históricos, motivo, clave idempotente y referencia al origen.

Tipos acotados: apertura revisada, adelanto, consumo entregado, descuento de sueldo, corrección/reverso de un movimiento. Las correcciones conservan la referencia al movimiento y las líneas/cantidades afectadas cuando corresponda.

Un cargo inicial por retiro y uno por consumo entregado, garantizados con referencias únicas o claves de origen únicas. Los ajustes pueden ser varios, pero sus cantidades e importes acumulados no superan el origen. El reverso de un cierre solo puede ocurrir una vez.

### `LiquidacionEmpleado`

Documento inmutable de un descuento realizado: empleado, número/referencia, autor, fecha real del descuento, fecha de registro, secuencia de corte, revisión esperada, saldo anterior, importe aplicado, saldo posterior y detalle histórico suficiente para reproducir el comprobante.

La liquidación genera **un solo movimiento negativo**. Su importe no se resta además en otra fórmula. El saldo se deriva exclusivamente de `MovimientoCuentaEmpleado`.

El detalle congelado puede conservarse como snapshot JSON versionado, siguiendo el patrón de impresión/historial del proyecto: referencia al cierre anterior, saldo arrastrado y movimientos del tramo con importes y origen. No hace falta una tabla de cuotas por línea para cierres de cuenta globales. Las tablas de origen y movimientos siguen siendo la evidencia primaria.

### Integridad

- Claves foráneas con conservación de historia; impedir borrado físico del beneficiario con cuenta.
- Índices por `(empleadoId, secuencia)` y `(empleadoId, createdAt)`, origen y claves idempotentes únicas.
- Validar coherencia del tipo con el signo y la referencia; un consumo interno exige empleado y no admite pagos de cliente.
- Las mutaciones de origen, cuenta e impresión en cola se confirman juntas cuando corresponden. Las notificaciones SSE se emiten después del commit.
- Toda mutación de cuenta bloquea al mismo empleado antes de asignar secuencia/calcular saldo. Operaciones que también usan caja/orden/stock mantienen un orden de bloqueos documentado y común para evitar interbloqueos; si transfieren entre empleados, bloquear IDs en orden estable.
- La revisión de una cuenta debe cambiar con cualquier movimiento, incluso con ajustes que dejen el mismo saldo total. Comparar solo el importe no detecta todos los cambios concurrentes.
- La creación de una operación interna no se habilita añadiendo campos al POST público de ventas: tiene validación y permisos propios.

## 9. Integración con los flujos actuales

1. Crear filtros explícitos separados para órdenes de cliente y consumos internos. **No cambiar `ORDENES_VIGENTES` para que excluya siempre empleados**, porque cocina debe seguir viéndolos.
2. Cuadre y reportes de clientes excluyen consumos internos tanto al consultar como al resumir importes. Mostrar una sección informativa propia de consumos sin sumarla al efectivo ni a las ventas.
3. Todos los accesos de cobro, QR y comprobantes comerciales rechazan órdenes internas desde el servidor. La creación interna no genera token/URL.
4. Las listas de cobro del mesero/digital excluyen órdenes internas. Su estado final es entregada, aunque `cobrada` permanezca falso.
5. Cocina y comanda incorporan el distintivo interno. Cocina puede preparar/marcar lista; el mesero/admin confirma entrega y cargo por la ruta específica. No permitir eludir ese paso usando el PATCH genérico de órdenes.
6. Rutas genéricas de editar ítems, cortesía, aprobación sin stock, rechazo y anulación detectan órdenes internas: deben rechazarlas o dirigir al servicio interno previsto. No dejar una vía que cambie el total sin su ajuste de cuenta.
7. Usar la cola y agentes existentes para nuevos comprobantes; extender la negociación de tipos soportados y desplegar soporte en agentes antes de empezar a encolarlos.
8. Mantener exclusión entre impresión directa y cola para esta operación. Si está configurada la ruta directa, ejecutarla después del commit y sin revertir el registro por un error de papel/red.
9. Proteger mutaciones y consultas administrativas de usuarios/productos, incluyendo `vista=admin` y detalle por ID. Mantener la forma mínima del listado público que usa el login, y excluir precios especiales/saldos de respuestas no autorizadas mediante `select` explícito. El selector de beneficiarios autenticado solo recibe los campos mínimos necesarios.

## 10. API y pantallas previstas

Nombres orientativos, a concretar conservando convenciones del repositorio:

- `GET /api/empleados/cuentas`: resumen de cuentas, solo admin.
- `GET /api/empleados/[id]/cuenta`: movimientos paginados, saldo e historial; admin o el propio empleado.
- `GET /api/empleados/[id]/liquidaciones/[liquidacionId]`: comprobante persistido; verificar que pertenece al empleado y que el solicitante puede verlo.
- `POST /api/consumos-empleados`: crear consumo; mesero/admin.
- `POST /api/consumos-empleados/[id]/entregar`: confirmar entrega; mesero/admin, con autorización sobre la operación y revisión.
- `POST /api/consumos-empleados/[id]/anular` y `/corregir`: cancelación, devolución o corrección con origen, solo admin.
- `POST /api/empleados/[id]/liquidaciones`: confirmar descuento, solo admin.
- `POST /api/empleados/[id]/liquidaciones/[liquidacionId]/revertir`: reverso motivado, solo admin.
- Rutas de imprimir/copia para consumo y liquidación con los mismos permisos de sus documentos.

La ficha distingue fecha de consulta/filtro de historial del **saldo total actual**. Filtrar noviembre no debe ocultar deuda que viene de octubre. No enviar la historia completa de todos los empleados para calcular sumas en el navegador.

Pantallas: ampliar menú de producto; agregar formulario/listado de consumos; agregar cuentas en Equipo y consulta propia; incorporar distintivo de cocina, entrega y sección informativa del cuadre. Reutilizar AppShell, modales y estilos existentes.

## 11. Apertura de cuentas y adelantos históricos

No importar automáticamente todos los adelantos existentes como deuda: algunos podrían haber sido descontados fuera del sistema.

Procedimiento previo a activación:

1. Generar un reporte de revisión, sin mutaciones, por empleado: adelantos registrados/anulados, fechas, montos, beneficiario y problemas de identidad.
2. El administrador indica cuáles siguen pendientes y cuánto queda de cada uno. No se deduce esa respuesta de la fecha del mes.
3. Registrar apertura por cada deuda histórica pendiente, con vínculo único al retiro, importe original, parte ya descontada y restante confirmado. Conservar también un comprobante/snapshot de la revisión de apertura con los registros considerados ya saldados y las exclusiones.
4. Adelantos anulados no generan deuda. Beneficiarios nulos o ambiguos quedan para resolución explícita; no asignar por parecido de nombre.
5. Activar la cuenta en un corte controlado y registrar autor/fecha/manifiesto de revisión. Si no hay deuda, guardar apertura con saldo cero como evidencia documental, sin generar un cargo monetario ficticio.
6. Desde el corte, cada adelanto nuevo genera su movimiento automáticamente. Los importados no se vuelven a sumar mediante una consulta paralela a `RetiroCaja`.
7. El procedimiento debe poder reintentarse sin duplicaciones y detectar registros que aparezcan durante la revisión. Breve pausa operativa de nuevos adelantos al confirmar cada apertura, o validación de versión equivalente.

Anular un retiro parcialmente saldado antes de la apertura exige distinguir la parte recuperada históricamente y el pendiente importado: revertir solo el movimiento importado no acredita automáticamente dinero recuperado antes del sistema. Cualquier devolución de esa parte necesita corrección administrativa expresamente documentada. Mostrar esta limitación en el documento de apertura.

## 12. Fases de implementación y puertas de salida

| Fase | Trabajo | Evidencia para darla por terminada |
|---|---|---|
| 0. Reglas y apertura | Aprobar este plan, revisar catálogo/preparación y diseñar reporte de históricos. | Decisiones operativas y conjunto de aceptación acordados. Ninguna deuda histórica presumida. |
| 1. Persistencia y permisos | Migración aditiva, movimientos/liquidaciones, validación monetaria, índices, autorización de usuarios/productos y API propia. | Esquema compatible y pruebas de permisos, signo, saldo e idempotencia. |
| 2. Adelantos y cuenta | Movimiento al registrar/anular retiro, lectura por beneficiario y consulta propia. | Retiro y cargo atómicos; gastos del local no crean deuda; no se altera dos veces la caja. |
| 3. Consumos | Precio empleado, orden interna, stock, preparación, entrega, cancelación/corrección y comprobante. | Cola y combo completos; sin QR/cobro, sin stock doble y sin cargo antes de entregar. |
| 4. Descuento e historial | Previsualización, cierre total/parcial, reverso, snapshot y ticket. | Cierres independientes, historial reproducible y conflictos concurrentes controlados. |
| 5. Integración y validación | Cuadre/reportes, navegación, agentes, regresión y UAT. | Ventas/caja normales conservadas; formatos validados en ambos agentes y equipo realmente utilizado. |
| 6. Activación | Respaldo, migración revisada, agentes compatibles, apertura por empleado y habilitación. | Saldos iniciales confirmados por el dueño y conciliación de las primeras operaciones. |

Las fases son orden de construcción, no módulos que se activen incompletos en producción. Habilitar el circuito cuando estén verificadas sus dependencias.

## 13. Pruebas y criterios de aceptación

Pruebas automatizadas centradas en dinero, permisos, inventario y concurrencia:

- Cálculo exacto: ejemplo de $36,75; precios/cantidades inválidos; recargo por unidad; cambio de precio antes y después de confirmar.
- Solo beneficiario correcto: autor diferente, cambio de nombre/rol e inactividad.
- Adelanto y movimiento en un commit; fallo de uno revierte ambos; insumos/limpieza/etc. no crean cargos.
- Entrega directa descuenta stock/carga una vez; preparación no genera deuda hasta entrega; mezcla se entrega completa.
- Claves iguales con contenido igual/distinto; reintentos de entrega, cierre, devolución, reverso y copia.
- Saldos tras descuento completo/parcial, nuevo cargo, anulación posterior y crédito a favor. Un filtro de fecha no elimina arrastres.
- Snapshot de cierre reproduce el ticket aunque cambie el catálogo o se corrija un cargo después.
- Correcciones/devoluciones no superan importes ni unidades entregados; reasignación entre empleados no descuenta stock otra vez.
- Consumir no genera efectivo, transferencia, `Cobro`, QR, ventas de clientes, pendiente comercial ni bloqueo de cierre diario.
- Acceso ajeno/rol no permitido rechazado en lectura, escritura, impresión e identificadores anidados; campos de precios internos fuera del listado público.
- Rutas genéricas no modifican/cobran consumos internos saltándose el servicio de cuenta.
- PostgreSQL real de pruebas: último stock concurrente, dos cierres concurrentes, entrega frente a cierre, anulación de adelanto frente a cierre y corrección frente a corrección.
- Apertura repetible, retiros antiguos parcialmente saldados, anulados, beneficiario ausente y cambios ocurridos durante revisión.
- Payloads y formatos de consumo/liquidación en agente Node y Python; un agente antiguo no reclama tipos nuevos.

Ejecutar las pruebas nuevas y las regresiones relevantes ya existentes: retiros, caja, cuadre, creación, cobro/multipago, validaciones, navegación e impresión. Ejecutar TypeScript, lint y build con las condiciones del entorno documentadas. Un fallo previo o de infraestructura debe distinguirse de una regresión de la funcionalidad.

UAT con el dueño:

1. Configurar cola y combo, registrar entrega directa y combo para llevar, comprobar ticket, firma física, stock y cocina.
2. Registrar adelanto y comprobar efectivo de caja y saldo del beneficiario.
3. Cerrar completamente un empleado y parcialmente otro en fechas diferentes.
4. Registrar después un nuevo consumo y comprobar saldo arrastrado y nuevo período.
5. Corregir un consumo ya descontado y verificar crédito a favor sin alterar el cierre anterior.
6. Desconectar impresora/reintentar respuesta y comprobar que no aparece un segundo cargo.
7. Verificar que caja y ventas a clientes conservan sus totales y que un consumo no ofrece cobro QR.
8. Revisar una apertura histórica antes de habilitar la cuenta.

## 14. Despliegue y recuperación

- Migraciones aditivas: todas las órdenes existentes quedan como ventas de cliente; no reinterpretar importes anteriores ni borrar datos.
- Probar migración y respaldo/restauración en un entorno de ensayo; ningún comando de reset de base de datos forma parte del despliegue.
- Desplegar soporte de comprobantes en agentes antes de habilitar su emisión. Ensayar con `DRY_RUN=true`, luego validar físicamente el agente usado por el local.
- Habilitar cuentas tras revisar la apertura y comprobar saldo por empleado contra el reporte aprobado.
- Si hay un problema, detener nuevas operaciones del módulo y conservar datos para conciliación. No resolverlo vaciando saldos o eliminando movimientos.
- Volver a una versión anterior requiere bloquear adelantos nuevos o asegurar su posterior conciliación: la versión vieja no generaría movimientos de cuenta y crearía una divergencia. No presentar un simple rollback de código como suficiente.

## 15. Límites de la primera versión y asuntos resueltos por la propuesta

Se incluyen entrega a cuenta, adelantos existentes en efectivo, saldo, cierres de sueldo completos/parciales, correcciones vinculadas, historia, comprobantes y consulta propia. La autorización de precios se hace al configurar el catálogo; no se añade una aprobación individual nueva a todos los adelantos o consumos.

Se dejan fuera sueldo base, cálculo de nómina, horas extra, multas, cuotas por movimiento, pagos inmediatos de consumos, adelantos por banco/fuera de caja, devolución física de saldos a favor, recetas/ingredientes, sucursales, automatización por fecha y firma digital/archivo de la firma física. Si el dueño exige alguno de esos casos en la primera entrega, ajustar el plan antes de empezar.

Para resolver un error de importe entregado se registra su corrección, con motivo y referencia. No se añade una facultad de modificar libremente cualquier saldo. La cuenta informa el importe pendiente; el descuento efectivo siempre lo confirma el administrador.

## 16. Estado al redactar el plan (2026-11-03)

Solo se ha inspeccionado el repositorio y redactado este plan. No se ha consultado la base productiva, ejecutado migraciones, cambiado lógica de aplicación ni enviado trabajos a la impresora. Las pruebas listadas son condiciones de implementación y no resultados ejecutados en esta etapa.
