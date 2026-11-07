# Contratos afectados: consumos con entrega inmediata

Las formas descritas son el contrato objetivo de la implementación futura. Todas las acciones validan sesión, rol y pertenencia; no se confía en autor, precio o estado enviados por el navegador.

## Crear consumo

`POST /api/consumos-empleados`

Entrada existente: clientRequestId, empleadoId, tipoOrden, items con productoId/cantidad/precioEsperado y nivelPicante cuando corresponda; observaciones opcionales.

- Roles: admin o mesero. La cuenta debe estar abierta para consumos y el empleado activo.
- No se acepta una elección de estado o preparación como autoridad.
- Éxito 201; reintento válido 200. `orden.estado = entregada`, cargo y stock confirmados.
- Se conservan campos de respuesta durante compatibilidad: replay, printJobQueued=false, impresion=null, impresionComanda=null. No significan un error de impresora; no se intentó imprimir.
- Rechazo 400 para datos inválidos; 401 sin sesión; 403 sin permiso; 409 para cuenta no abierta, precio/stock cambiado o reutilización incompatible de clave.
- Un rechazo no deja efectos parciales. La forma de productos mantiene temporalmente la bandera heredada, pero el servidor no la usa para preparar consumos.

## Listar y consultar cuentas

`GET /api/consumos-empleados` y `?catalogo=1` conservan permisos y formas principales. No hay filtro operativo de preparación en la interfaz nueva. La consulta administrativa de transición alcanza todos los anteriores al corte, no solamente los últimos 30 días.

`GET /api/empleados/cuentas` y `GET /api/empleados/[id]/cuenta` conservan campos de compatibilidad para pendientes. Una regularización exitosa los vacía para sus documentos. El saldo se deriva del libro, con cargos históricos nuevos y cierres originales conservados.

## Impresión solicitada

`POST /api/consumos-empleados/[id]/imprimir`

Conservar acceso de administrador, creador y personas autorizadas por la pertenencia histórica. Reutilizar snapshot guardado y EMPLOYEE_RECEIPT, tanto para primera impresión física como para copia. No recalcular documento desde producto actual. Ninguna llamada de creación o regularización invoca esta acción de forma implícita.

Respuesta existente: impresionEnCola, impresionEnviada, impresionError y estadoImpresion cuando corresponda. Reutilizar un trabajo activo; fallos recuperables permiten nueva revisión según las reglas existentes. No modificar libro ni stock. La etiqueta de copia refiere al documento digital original y no acredita una impresión física previa.

## Acciones heredadas y correcciones

- `/api/consumos-empleados/[id]/entregar`: mantener entrada y autenticación mientras existan clientes antiguos. Para documentos ya entregados devolver confirmación sin nuevo cargo, stock o impresión; para pendientes heredados devolver 409 indicando regularización administrativa. Conservar idempotencia y rechazo de contenido o revisión incompatible; no restaurar estados de cocina.
- `/anular`: no se ofrece como acción de preparación de registros nuevos. Mantener compatibilidad y guardas actuales para antecedentes mientras se regularizan; una anulación concurrente invalida su análisis y queda excluida.
- `/corregir`: mantener motivos, límites de cantidades/importes y permisos. Es la vía de devolución o reasignación de registros entregados.
- `PATCH /api/ordenes/[id]`: rechazar cambios de estado de consumos internos; mantener el camino de clientes.
- `GET /api/ordenes`: cocina consulta solo ventas de clientes; no devolver preparaciones internas por fechas antiguas.

## Operación administrativa de transición

Interfaz propuesta, acotada a este cambio:

`GET /api/admin/consumos-empleados/regularizacion`

Solo admin. Análisis de lectura con corte y cursor; máximo 50 candidatos por lote. Devuelve documentos elegibles, descartados, cargos existentes, cargos faltantes, suma exacta e incidencias. Cada candidato incluye ordenId, expectedRevision y fingerprint de datos relevantes: estado, anulación, beneficiario, líneas, recargo, historial, movimientos y snapshot. No escribe, imprime ni activa cuentas.

`POST /api/admin/consumos-empleados/regularizacion`

Solo admin. Entrada: clientRequestId, motivo, corte y candidatos con ordenId/expectedRevision/fingerprint obtenidos de la revisión. Responsable desde sesión. Los límites y la elegibilidad se vuelven a comprobar; el fingerprint detecta cambios y no concede permisos.

- Cada documento se procesa en su propia transacción con orden de bloqueo Orden → Usuario, sin productos ni caja.
- La clave canónica del cargo y la evidencia del lote hacen seguros reintentos. Reutilizar una clave con otro contenido se rechaza.
- Respuesta 200 con resultado por documento: regularizado, ya_regularizado, excluido o conflicto, más suma de cargos realmente añadidos y cantidad de pendientes. Una respuesta 200 de lote no acredita que todos se hayan completado: la interfaz debe mostrar los conflictos.
- Una revisión desactualizada produce conflicto de ese documento y exige nuevo análisis. No completar silenciosamente estados o dinero con evidencia ambigua.
- Reanudar no requiere borrar registros. Si solo hubo rechazos sin escritura, se puede corregir la solicitud y enviar una nueva clave.
- La cuenta puede estar inactiva o sin apertura únicamente para conservar la obligación histórica autorizada. El navegador no puede enviar un permiso para eludir las restricciones de consumos nuevos.
- No emite impresión automática ni modifica precios, stock, cobros de clientes, aperturas o liquidaciones.

## Interfaz visible

Consumos: una confirmación con mensaje de entrega/cargo, lista de documentos, acceso a comprobante y correcciones autorizadas. Retirar selector de estados, confirmación posterior de entrega, textos cocina/entrega directa y configuración específica de preparación de empleados. No retirar datos de salsa, precio especial o envases.

Administración: acceso de transición separado del trabajo diario para ver resumen, ejecutar los lotes autorizados y revisar conflictos. No exige aprobar individualmente la realidad de cada entrega: se aplica la decisión B a los documentos válidos. Conserva una constancia del resultado y limita acceso a admin.
