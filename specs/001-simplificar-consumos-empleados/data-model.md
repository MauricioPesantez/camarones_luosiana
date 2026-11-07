# Modelo de datos: cambios de comportamiento y transición

## Entidades reutilizadas

| Entidad | Campos relevantes | Decisión |
|---|---|---|
| Producto | precioEmpleado, disponible, stock, requierePreparacionEmpleado | Se conservan precios y stock. La bandera heredada deja de controlar consumos; no se borra. |
| Orden | tipoOperacion, empleadoId, empleadoNombre, estado, total, recargo, consumoRequestId/hash, printRevision | Toda nueva orden interna nace entregada; clientes conservan sus estados. Las claves y revisiones siguen protegiendo repeticiones y concurrencia. |
| Item | productoId, nombreProducto, cantidad, precioCarta, precioUnitario, subtotal, nivelPicante | Conservar snapshots. La transición no cambia las líneas ni precios originales. |
| MovimientoCuentaEmpleado | empleadoId, secuencia, tipo, monto, origenClave, idempotencyKey, ordenId, fechaHecho, detalle | Un cargo inicial canónico por consumo; correcciones y traslados siguen siendo movimientos independientes y válidos. |
| Usuario | activo, cuentaActivadaAt, cuentaRevision, aperturaCuenta | Conservar elegibilidad de altas. La regularización no modifica activo ni apertura y solo incrementa revisión si añade un movimiento. |
| HistorialOrden | tipoAccion, datosAntes, datosDespues, usuarioNombre/rol, razon, createdAt | Conserva snapshot del comprobante y evidencia de regularización; no se reescribe la historia anterior. |
| PrintJob | type, ordenId, retiroId, liquidacionId, status, dedupeKey, payload | Ninguno nuevo al crear o regularizar consumo. Se usa EMPLOYEE_RECEIPT solo ante solicitud de impresión. Se conservan trabajos previos y su revisión. |
| LiquidacionEmpleado | snapshot y saldos anteriores/posteriores | Sin modificación. Los cargos tardíos afectan al saldo actual y al siguiente descuento, no al cierre ya firmado. |

## Invariantes del registro nuevo

- Scope: `tipoOperacion = CONSUMO_EMPLEADO`, modalidad local o para llevar.
- Datos completos y válidos; beneficiario activo y cuenta con apertura.
- Estado técnico inicial/final: `entregada`. No hace falta una transición de preparación ni un botón de entrega.
- `cobrada = false`, `montoPagado = 0`, sin Cobro ni enlace de cobro.
- Total exacto calculado en servidor; stock suficiente por cantidades agregadas de producto.
- Documento, descuento de stock, movimiento CONSUMO con clave `consumo:<ordenId>`, historial y snapshot se confirman juntos.
- No se crea trabajo de impresión ni se llama a impresora o notificación de nueva preparación.
- Reintento de misma clave/contenido recupera el original; contenido distinto produce conflicto.

## Evidencia de regularización

Se propone `tipoAccion = consumo_regularizado_entregado` y contenido versionado dentro de datosAntes/datosDespues. Campos mínimos: versión de regla, corte, clave/huella de solicitud, estado y revisión anteriores, beneficiario comprobado, cargo canónico encontrado o creado, importe histórico correspondiente, snapshot de comprobante si faltaba, fecha original y fecha real de regularización. El autor sale de la sesión administrativa. El motivo es obligatorio.

La fecha del hecho original se conserva separada de la contabilización actual. El comprobante reconstruido debe identificar la regularización y no inventar quién entregó físicamente en una fecha pasada.

## Reglas de cargo histórico

1. Sin correcciones ni cargo previo: conciliar total con precios y cantidades guardados y recargo original; crear un CONSUMO canónico.
2. Cargo previo válido: no añadir otro; preservar su autor, fechas y cadena de ajustes.
3. Correcciones, envases devueltos o traslados: reconstruir el remanente y la cadena de beneficiarios desde evidencia histórica; no sumar tipos de movimiento sin interpretar su origen.
4. Importe histórico remanente cero: registrar regularización sin un movimiento monetario de importe cero, que el libro prohíbe.
5. Beneficiario ausente, cargo ambiguo, snapshot irrecuperable o importe inconsistente: conflicto sin mutación del documento. No inferir datos desde el catálogo actual.
6. Cuenta sin apertura o usuario inactivo: permitir solo este cargo histórico administrativo, con evidencia explícita; conservar restricciones de nuevas entregas y apertura posterior aditiva.

## Estados y compatibilidad

- Nuevo consumo: formulario sin persistir → una confirmación → entregada.
- Consumo histórico válido: pendiente/en_preparacion/lista → regularización → entregada, sin volver a tocar stock.
- Anulados: fuera de la regularización. Ya entregados: no volver a cobrar.
- Correcciones y devoluciones no cambian la entrega original para borrar su pasado.
- Cocina no cambia estados de consumos internos; los pedidos de clientes conservan sus transiciones.
- Los campos pendientes de las respuestas de cuentas se mantienen durante compatibilidad; la interfaz normal deja de usarlos como flujo. Un conflicto de regularización se informa al administrador, no se disimula como completado.

## Evolución de esquema

No se prevén tablas, enum values o columnas nuevos para este cambio. No eliminar bandera o estado; no editar migraciones aplicadas. Los límites y claves únicos existentes siguen vigentes. La auditoría de datos real y las pruebas de concurrencia todavía deben ejecutarse durante implementación en un entorno controlado.
