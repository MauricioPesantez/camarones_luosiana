# Feature Specification: Consumos de empleados con entrega inmediata

**Feature Branch**: `develop` (rama actual; no se creó otra rama)

**Created**: 2026-11-04

**Status**: Clarified — impresión bajo solicitud y regularización de consumos anteriores definidas; preparada para planificación.

**Input**: User description: "Simplificar los consumos de empleados para registrarlos directamente como entregados, sin gestión de estados, preservando stock, saldos, historial y ventas a clientes."

## Clarifications

### Session 2026-11-04

- Q: ¿Qué debe imprimirse al registrar un consumo de empleado que ya queda entregado? → A: Opción C: sin impresión automática; permitir solicitar el comprobante después, sin registrar otra entrega ni cargo.
- Q: ¿Qué hacemos con los consumos que ya existen como pendientes, en preparación o listos? → A: Opción B: considerarlos todos entregados y registrar únicamente los cargos que falten, sin volver a descontar stock.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar lo entregado en una sola confirmación (Priority: P1)

Como mesero o administrador, quiero seleccionar empleado, productos y cantidades y confirmar lo que ya entregué, para registrar el descuento pendiente sin administrar preparación ni confirmar otra entrega después.

**Why this priority**: Resuelve la necesidad del dueño: registrar productos entregados con su precio especial y sin una gestión operativa adicional.

**Independent Test**: Registrar una bebida, un combo y un consumo mixto. En cada caso una sola confirmación deja registrada la entrega y su cargo completo.

**Acceptance Scenarios**:

1. **Given** un empleado habilitado y productos con stock y precio especial, **When** el operador confirma un consumo, **Then** queda registrado como entregado y el saldo refleja inmediatamente el importe completo.
2. **Given** un producto que antes requería preparación, **When** se registra para un empleado, **Then** sigue la misma entrega inmediata que una bebida, sin preparación o entrega posterior que gestionar.
3. **Given** un formulario sin confirmar, **When** se agregan, quitan o cambian productos o beneficiario, **Then** no se modifica stock ni saldo.
4. **Given** un registro confirmado, **When** se revisa la lista, **Then** aparecen empleado, fecha, productos e importe, sin controles ni filtros de pendiente, en preparación o listo para los consumos nuevos.

---

### User Story 2 - Conservar stock y saldo ante errores y reintentos (Priority: P1)

Como dueño, quiero que cada entrega produzca exactamente un cargo y una salida de productos, y que los rechazos no dejen efectos parciales.

**Why this priority**: La simplificación debe conservar dinero e inventario aunque se repita una confirmación o dos personas utilicen la última unidad.

**Independent Test**: Registrar envases, repetir una confirmación cuya respuesta se perdió y competir por una última unidad; conciliar documentos, cargos y existencias.

**Acceptance Scenarios**:

1. **Given** una operación confirmada cuya respuesta no llegó, **When** se reintenta con los mismos datos, **Then** se recupera el registro original sin otro cargo ni salida de stock; ni el registro inicial ni su reintento imprimen automáticamente.
2. **Given** una confirmación ya utilizada, **When** se intenta reutilizar con otros datos, **Then** se rechaza sin modificar la operación original.
3. **Given** stock insuficiente, precio especial desactualizado, empleado inactivo o cuenta sin apertura, **When** se confirma el consumo, **Then** se rechaza con un mensaje concreto y no queda entrega, cargo ni salida parcial de stock.
4. **Given** dos intentos para la última unidad disponible, **When** ambos se confirman, **Then** solo uno puede registrarse y las existencias no quedan negativas por este flujo.
5. **Given** dos colas a $0,75 y un combo a $4 para llevar, **When** se confirma el consumo, **Then** se cargan $6,75, incluidos $1,25 de envase; con un adelanto previo de $30 el saldo total es $36,75.

---

### User Story 3 - Corregir entregas conservando la evidencia (Priority: P2)

Como administrador, quiero conservar los documentos originales y corregir una entrega equivocada sin borrar la historia ni volver a descontar productos.

**Why this priority**: Un error posterior al registro necesita una corrección trazable, distinta de abandonar un formulario sin confirmar.

**Independent Test**: Registrar una entrega, devolver algunas unidades, reasignar un cargo y consultar el comprobante original antes y después de un descuento de sueldo.

**Acceptance Scenarios**:

1. **Given** un consumo registrado, **When** hay una devolución o beneficiario incorrecto, **Then** el administrador puede aplicar las correcciones existentes con motivo y referencia al original, conservando precios e importes históricos.
2. **Given** una devolución, **When** se confirma su corrección, **Then** solo se repone producto recuperable y el abono no supera las unidades e importes aún corregibles.
3. **Given** un consumo ya descontado del sueldo, **When** se registra un abono posterior, **Then** el cierre previo no cambia y la cuenta refleja el ajuste actual, incluido un eventual saldo a favor.
4. **Given** una entrega cuya impresión solicitada falló, **When** se vuelve a solicitar su comprobante, **Then** se recupera desde el registro existente sin otra entrega ni otro cargo.
5. **Given** una entrega confirmada que nunca se imprimió, **When** el operador solicita su comprobante, **Then** se puede imprimir por primera vez sin registrar otro consumo ni modificar su stock o saldo.

---

### User Story 4 - Preservar clientes e historia durante la transición (Priority: P1)

Como dueño, quiero simplificar únicamente los consumos de empleados, conservando la preparación y cobro de pedidos de clientes y la evidencia de operaciones anteriores.

**Why this priority**: Existen órdenes, movimientos y trabajos de impresión que no deben cambiar de significado por introducir este flujo.

**Independent Test**: Comparar ventas, caja, stock, cuentas, cierres y documentos antes y después del cambio; regularizar los consumos antiguos sin entrega y repetir la regularización para demostrar que no duplica sus efectos.

**Acceptance Scenarios**:

1. **Given** pedidos de clientes, **When** se introduce la entrega inmediata para empleados, **Then** sus estados, cocina, cobros y comprobantes conservan el comportamiento anterior.
2. **Given** un consumo nuevo, **When** se revisan caja y ventas a clientes, **Then** no genera efectivo, transferencia, enlace de cobro ni deuda comercial de un cliente.
3. **Given** adelantos, descuentos de sueldo y consumos ya entregados, **When** se introduce el cambio, **Then** se conservan sus movimientos, documentos, autores, fechas e importes históricos; solo los cargos faltantes de consumos previos regularizados pueden modificar el saldo actual, sin reescribir cierres anteriores.
4. **Given** consumos antiguos no anulados pendientes, en preparación o listos, **When** se ejecuta la regularización del cambio, **Then** se consideran entregados y se registran únicamente sus cargos faltantes por el importe histórico correspondiente, sin volver a descontar stock.
5. **Given** una regularización completada o interrumpida, **When** se vuelve a ejecutar, **Then** no se duplican cargos ni existencias y se identifican los registros completados y cualquier conflicto sin resolver.
6. **Given** un cierre de sueldo anterior, un empleado inactivo o una cuenta sin apertura, **When** corresponde regularizar un consumo previo suyo, **Then** se conserva el beneficiario original y el cargo histórico faltante afecta al saldo actual sin reescribir el cierre, reactivar al empleado ni habilitar nuevos consumos.
7. **Given** un consumo nuevo confirmado o uno previo regularizado, **When** se consulta cocina, **Then** no aparece como preparación pendiente ni genera impresión automática de comanda o comprobante.

### Edge Cases

- Bebidas, combos y consumos mixtos siguen una misma confirmación de entrega, independientemente de su clasificación anterior de preparación.
- Productos repetidos con distinta salsa conservan su detalle y acumulan cantidades para validar existencias.
- Un precio especial cambiado antes de confirmar exige revisar el importe actualizado; una entrega registrada mantiene su precio histórico.
- Las cuentas sin apertura y los empleados inactivos siguen rechazando nuevos registros de consumo. La regularización autorizada de un consumo anterior no abre cuentas ni reactiva empleados; conserva su deuda histórica sin habilitar nuevas entregas.
- Ante doble clic, respuesta perdida o reintento no se duplican cargos ni stock; registrar y reintentar no provoca impresión automática.
- Un fallo durante la confirmación revierte sus efectos dependientes. El documento confirmado queda disponible para impresión solo si un operador la solicita expresamente.
- La impresión pendiente y la evidencia de correcciones no se confunden con los estados de preparación retirados del consumo nuevo.
- Los consumos previos no vuelven a descontar stock reservado ni a generar cargos ya registrados.
- Los consumos anteriores no anulados pendientes, en preparación o listos se consideran entregados durante la regularización y reciben solo el cargo histórico que falte. Los anulados se excluyen y los ya entregados no se cargan nuevamente.
- Si falta un beneficiario válido, hay un importe incompatible o no se puede demostrar si existe su cargo, se identifica el conflicto y no se inventan valores ni se fuerza una regularización parcial del documento.
- La regularización conserva fecha y datos originales y registra por separado su fecha, responsable y motivo de transición; no inventa una entrega retroactiva.
- La regularización no genera impresiones automáticas; las comandas previas aún sin enviar dejan de solicitar preparación para esos consumos. Lo ya enviado o impreso se conserva como evidencia.
- Las devoluciones mantienen las reglas actuales de producto recuperable, cantidades disponibles y abono de envases.
- Las entregas cercanas a medianoche conservan fechas coherentes con la hora de Ecuador.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mesero y administrador DEBEN poder registrar un consumo de empleado como entrega completa mediante una sola confirmación del registro.
- **FR-002**: Todos los productos DEBEN seguir esa modalidad para empleados, incluidos combos y productos previamente clasificados para preparación.
- **FR-003**: Seleccionar o modificar un formulario sin confirmar NO DEBE crear documentos, cargos, movimientos de stock ni trabajos de impresión.
- **FR-004**: Al confirmar, el consumo DEBE quedar entregado y cargar inmediatamente al beneficiario su total a precio especial, con los recargos vigentes de envases.
- **FR-005**: Entrega, cargo, stock e historial DEBEN confirmarse como una operación completa o no aplicarse. El contenido del comprobante DEBE conservarse con el registro, sin iniciar impresión automática ni exigir impresión para confirmar la entrega.
- **FR-006**: El formulario y los listados de consumos nuevos NO DEBEN exigir elegir estados, seguir preparación, distinguir entrega directa frente a cocina ni confirmar una entrega después del registro.
- **FR-007**: El consumo nuevo NO DEBE permanecer en pendientes de cocina ni depender de una acción de cocina para afectar la cuenta.
- **FR-008**: Se DEBEN conservar precios especiales administrados, revisión de precios, validación de existencias, salsa cuando corresponda y el recargo de $1,25 por unidad de combo para llevar.
- **FR-009**: Se DEBE exigir beneficiario habilitado y apertura completada para nuevas entregas, manteniendo los permisos de registro y consulta vigentes.
- **FR-010**: Reintentar la misma operación DEBE recuperar el registro existente; reutilizar su confirmación con datos distintos DEBE rechazarse, sin nuevos efectos.
- **FR-011**: La competencia por existencias DEBE impedir entregar más unidades que las disponibles. Los importes DEBEN conservar exactitud de centavos.
- **FR-012**: Se DEBE conservar un comprobante con beneficiario, artículos, cantidades, precios, envases, total, autor y fecha. La primera impresión y las copias DEBEN iniciarse únicamente por solicitud expresa de un operador autorizado sobre el consumo ya registrado, sin otro cargo ni salida de stock. Registrar un consumo NO DEBE imprimir automáticamente comprobante ni comanda.
- **FR-013**: Un fallo al solicitar impresión DEBE comunicarse como un problema del comprobante de una operación ya registrada; debe poder reintentarse sin registrar otra entrega ni modificar su stock o saldo.
- **FR-014**: Los errores posteriores a un registro nuevo DEBEN resolverse mediante correcciones administrativas vigentes, con motivo y referencia al original, sin borrar ni reescribir la entrega histórica.
- **FR-015**: Devoluciones, abonos de envases y reasignaciones DEBEN conservar los límites actuales, sin duplicaciones ni reposición automática de productos irrecuperables.
- **FR-016**: La transición DEBE considerar entregados todos los consumos anteriores no anulados pendientes, en preparación o listos y registrar exclusivamente los cargos históricos faltantes en la cuenta del beneficiario original. NO DEBE volver a descontar stock, duplicar cargos, recalcular precios, reescribir cierres anteriores ni modificar los datos originales. Cada regularización DEBE conservar fecha, responsable y motivo propios; debe poder reintentarse sin repetir efectos e informar cualquier conflicto que impida completarla.
- **FR-017**: Adelantos, aperturas, descuentos de sueldo completos o parciales, sus reversos y saldos a favor DEBEN mantener el comportamiento vigente.
- **FR-018**: Las ventas a clientes DEBEN conservar preparación, entrega, pago, aprobación y reportes. Los consumos de empleados DEBEN mantenerse separados de sus cifras comerciales.
- **FR-019**: La simplificación NO DEBE ampliar permisos ni exponer cuentas ajenas. El administrador conserva su consulta histórica y cada empleado la de su propia cuenta.
- **FR-020**: Los registros y correcciones DEBEN conservar evidencia legible de qué ocurrió, quién lo registró y cuándo, usando hora de Ecuador en operación y presentación.

### Key Entities *(include if feature involves data)*

- **Consumo de empleado**: Constancia de una entrega completa efectuada, con beneficiario, autor, fecha, modalidad local o para llevar, productos, cantidades, precios históricos, envases y total. Los registros nuevos no requieren una progresión de preparación.
- **Cuenta de empleado**: Relación entre la persona y sus movimientos, con apertura revisada, saldo pendiente y posible saldo a favor.
- **Movimiento de cuenta**: Cargo o abono trazable asociado a entrega, adelanto, descuento o corrección. Una nueva entrega origina exactamente un cargo inicial.
- **Existencias del producto**: Unidades disponibles que disminuyen una sola vez por lo entregado y se reponen solo por devolución recuperable autorizada.
- **Comprobante e historial**: Evidencia conservada del original y sus correcciones, independiente de cambios posteriores de catálogo o beneficiario.
- **Consumo previo regularizado**: Documento anterior no anulado que estaba pendiente, en preparación o listo y que, por decisión del dueño, pasa a considerarse entregado. Conserva datos y stock previos, su cargo histórico único y evidencia de cuándo y por qué se regularizó.
- **Pedido de cliente**: Operación comercial cuya preparación y cifras permanecen independientes del consumo de empleados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar una bebida, un combo o un consumo mixto requiere exactamente una confirmación de registro y cero acciones posteriores para quedar entregado y cargado a la cuenta.
- **SC-002**: El 100 % de los consumos nuevos confirmados figura entregado e incorporado al saldo, sin entradas pendientes de preparación por esos consumos.
- **SC-003**: En pruebas de repetición y concurrencia, cada entrega válida produce exactamente un cargo y una salida por la cantidad entregada; los intentos rechazados producen cero efectos financieros y de inventario.
- **SC-004**: Dos colas a $0,75 y un combo a $4 para llevar generan $6,75 de cargo, sin diferencias de centavos; con $30 de adelanto previo el saldo es $36,75.
- **SC-005**: En el 100 % de los registros y reintentos de consumos nuevos se producen cero impresiones automáticas. Solicitar el comprobante por primera vez, una copia o recuperar una impresión fallida produce cero cambios de stock, cantidad de consumos o saldo.
- **SC-006**: En los pedidos de clientes utilizados para validar el cambio, cantidades, importes, cobros y cambios de preparación coinciden con el comportamiento anterior.
- **SC-007**: Para el 100 % de consumos previos no anulados pendientes, en preparación o listos con datos válidos, la regularización deja la entrega y exactamente un cargo histórico registrado, sin nuevas salidas de stock. Repetirla agrega cero cargos y cero salidas; los cierres previos permanecen idénticos y cualquier conflicto queda enumerado sin efectos parciales.
- **SC-008**: Se aceptan cero operaciones para roles sin permiso y cero accesos a cuentas ajenas de empleados sin autorización.

## Assumptions

- Registrar como entregado significa confirmar que los productos ya se entregaron. Seleccionar opciones solo prepara el formulario; no registra automáticamente cada producto al tocarlo.
- Se conservan permisos: mesero y administrador registran; las correcciones administrativas permanecen reservadas al administrador.
- Se mantienen apertura de cuentas, precios especiales y reglas financieras actuales. La simplificación no pretende eliminar el rechazo de una cuenta sin apertura.
- Decisión confirmada: registrar un consumo nuevo no solicita preparación a cocina ni imprime automáticamente una comanda o comprobante. Se conserva su documento para imprimirlo únicamente cuando un operador autorizado lo solicite.
- Decisión confirmada: la transición considera entregados todos los consumos anteriores no anulados pendientes, en preparación o listos y registra sus cargos históricos faltantes. No solicita revisión individual de si se entregaron; sí valida su integridad y evita repetir stock o cargos. Los cargos de regularización se incorporan al saldo actual y no modifican cierres de sueldo anteriores.
- Quitar gestión de preparación no elimina evidencia de correcciones, devoluciones ni seguimiento de impresión. No se exige borrar representaciones históricas para simplificar la operación.
- El alcance es únicamente el consumo de empleados. No incluye nuevas reglas de nómina, pagos inmediatos, adelantos, precios, sucursales ni preparación de clientes.
- La continuidad depende de conservar las cuentas y documentos actuales sin descontar de nuevo stock reservado ni cargos ya registrados.
- Esta especificación y su aclaración no aplican cambios de datos ni autorizan por sí solas un despliegue. El plan posterior debe delimitar implementación, transición y evidencia de preservación.
