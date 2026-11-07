# Guía de validación e implementación

El código de entrega directa y regularización está implementado localmente. Los resultados ejecutados y las limitaciones se detallan al final; esta guía no acredita despliegue, concurrencia PostgreSQL ni impresión física. No usar credenciales productivas ni imprimir durante pruebas automatizadas.

## Preparación

- Instalar dependencias del repositorio y generar cliente Prisma con el flujo habitual. No actualizar versiones para esta funcionalidad.
- Base PostgreSQL de prueba con el esquema actual; fixtures de clientes, empleados activos/inactivos, cuentas abiertas/sin apertura y consumos en estados anteriores.
- Impresión directa y cola deshabilitadas en pruebas de negocio; simulaciones específicas para probar que no se invocan automáticamente aun cuando se configuren activas.
- Ensayar respaldo/restauración en un entorno aislado antes de una transición productiva.
- Revisar [contratos](contracts/consumos.md) y [modelo](data-model.md). La operación administrativa está implementada, pero no se ha ejecutado sobre los datos activos.

## Controles del repositorio

Desde la raíz:

```sh
npm run test:employee-consumption-service
npm run test:employee-consumption-route
npm run test:employee-consumption-validation
npm run test:employee-account
npm run test:employee-account-routes
npm run test:employee-receipts-server
npm run test:employee-print
npm run test:employee-sales-boundaries
npm run test:employee-envio
npm run test:order-creation
npm run test:cuadre
npm run test:cobro
npm run test:cobro-validaciones
npm run test:withdrawal-print
npm run test:admin-validaciones
npm run test:navegacion
npx prisma validate
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Pruebas añadidas para este cambio:

```sh
npm run test:employee-consumption-regularization
npm run test:employee-consumption-regularization-route
# Requiere una conexión explícita a una base cuyo nombre contenga test:
npm run test:employee-consumption-postgres
```

`EMPLOYEE_TEST_DATABASE_URL` debe definirse externamente. El arnés crea y elimina un esquema aleatorio propio; no recurre a la conexión activa ni hace reset/truncate global. La falta de esta variable es un rechazo deliberado, no una prueba PostgreSQL aprobada.

Para compatibilidad de tickets, sin hardware:

```sh
npm test --prefix print-agent
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s print-agent-python -p 'test_*.py'
```

Si el build falla por descarga de Google Fonts, reportar ese bloqueo tal como ocurra; no cambiar fuentes para declarar el cambio validado. No asumir que un resultado anterior sigue probando el código futuro.

## Escenarios de aceptación

1. **Registro único**: bebida, combo configurado previamente para preparación y consumo mixto nacen entregados al confirmar. Seleccionar sin confirmar no escribe. No existe un segundo botón de entrega ni entrada en cocina.
2. **Dinero**: dos colas de $0,75 y combo de $4 para llevar cargan $6,75. Con adelanto previo de $30, el saldo es $36,75; el efectivo esperado y las ventas a clientes no cambian.
3. **Cero impresión automática**: con ambos modos de impresión configurados en escenarios separados, registrar y reintentar crea cero trabajos y ejecuta cero llamadas a impresora. El contenido del recibo sí se conserva.
4. **Impresión manual**: solicitar primer comprobante, repetir mientras está activo y recuperar fallo de impresión. Se conserva el snapshot sin cargos o descuentos de stock adicionales.
5. **Rechazos**: cuenta sin apertura, empleado inactivo, precio cambiado y stock insuficiente rechazan alta sin efectos parciales. Nueva clave con datos diferentes es otra operación; reutilizar la misma con contenido distinto se rechaza.
6. **Concurrencia PostgreSQL**: competir por última unidad y confirmar dos veces la misma operación; solo una salida/cargo. Probar cierre frente a regularización y corrección frente a regularización, con revisiones obsoletas detectadas.
7. **Análisis de transición**: candidatos de todos los días, montos y conflictos se listan sin escrituras; anulados y ya entregados se excluyen. No se consulta el catálogo actual para fijar importes anteriores.
8. **Regularización**: pendiente/en_preparacion/lista pasan entregados; stock queda idéntico y solo se añaden cargos faltantes. Repetir y reanudar lote interrumpido agrega cero cargos a documentos ya completados.
9. **Casos históricos**: cargo existente, devoluciones anteriores, traslado de beneficiario, importe remanente cero, falta de snapshot y cargo ambiguo. Aplicar solo documentos cuya evidencia concilie; ningún conflicto deja medio documento actualizado.
10. **Cuentas históricas**: regularizar con empleado inactivo o apertura incompleta sin habilitar nuevas entregas; apertura posterior conserva esos movimientos. Con cierre de sueldo anterior, su snapshot no cambia y el cargo se refleja en saldo actual.
11. **Cola previa**: detener comandas de empleados aún no enviadas durante el corte, conservar evidencia de impresas y resolver PROCESSING inciertos. Comandas de clientes y recibos solicitados expresamente conservan sus reglas.
12. **Privacidad y clientes**: roles sin permiso no regularizan ni consultan cuentas ajenas; clientes conservan preparación, cobro, QR, caja y reportes anteriores.
13. **Móvil**: registrar, consultar y solicitar comprobante desde 390 px sin selector de preparación, segunda entrega ni mensajes de fallo de impresión cuando nadie la pidió.

## Corte y recuperación

1. Generar análisis de lectura y fijar alcance/corte. No se considera una aprobación de código ni un despliegue.
2. Desplegar la modalidad única en todos los procesos; coordinar pausa breve de consumos de empleados y de sus trabajos antiguos que aún podrían preparar productos. Mantener clientes operativos en la medida que el mecanismo actual lo permita.
3. Ejecutar regularización administrativa por lotes y reconciliar resumen, libro, stock y documentos. Resolver incidencias antes de declarar terminada la transición.
4. Habilitar la operación normal sin estados visibles de preparación; no reactivar procesos viejos que creen pendientes.
5. Ante fallo, pausar consumos y reanudar por evidencia. No borrar movimientos, vaciar saldos, editar la migración aplicada ni recalcular cierres. Una vuelta de código no debe reactivar preparación o impresión automática de documentos ya regularizados.

## Implementación: línea base 2026-11-04

Antes de editar comportamiento, pasaron 14 scripts: `test:employee-account`, `test:employee-account-validation`, `test:employee-consumption-validation`, `test:employee-print`, `test:employee-consumption-service`, `test:employee-account-routes`, `test:employee-sales-boundaries`, `test:employee-envio`, `test:employee-consumption-route`, `test:employee-receipts-server`, `test:order-creation`, `test:print-jobs`, `test:cobro`, `test:cuadre`. Son pruebas con dobles o validaciones locales; no acreditan concurrencia real ni impresión física. Se conservan los cambios locales anteriores (cuentas, consumos, reportes, impresión y migración ya existente). No se modificó la migración aplicada ni se regularizaron datos activos.

El entorno inicial no define `EMPLOYEE_TEST_DATABASE_URL`; no se encontró PostgreSQL local y Docker no respondió con un servidor disponible. Las pruebas PostgreSQL requieren una base aislada explícita y deben reportarse pendientes si ese recurso continúa ausente.

## Resultados de la simplificación — 2026-11-04

- Pasaron los 31 scripts `test:*` sin PostgreSQL de `package.json`, incluyendo las pruebas nuevas de regularización y su ruta. Las pruebas de servicio pasaron 23 escenarios; antes de implementar fallaban entrega directa, ausencia de impresión y doble clic. Se repitieron las pruebas focalizadas de regularización después de la revisión financiera.
- Pasaron TypeScript (`--noEmit --incremental false`), ESLint completo, `prisma validate`, las pruebas y compilación del agente Node y las 17 pruebas Python. No se modificó el esquema ni una migración aplicada.
- El build normal se ejecutó y falló al descargar **Inter** de Google Fonts (`fonts.googleapis.com`). No se cambiaron las fuentes ni se presenta ese build como aprobado.
- `test:employee-consumption-postgres` se intentó: se detuvo antes de conectar por ausencia de `EMPLOYEE_TEST_DATABASE_URL`. Por tanto, las pruebas reales de último stock, repetición concurrente, cierre/corrección simultáneos, rollback y ensayo de corte/recuperación siguen pendientes. El arnés contiene esos escenarios, junto con apertura posterior aditiva, cadena de traslado válida y protección de comandas antiguas frente a RETRY; TypeScript/ESLint no prueban la semántica SQL.
- La revisión financiera independiente encontró y corrigió aceptación de precios negativos, recargo no sustentado por envases, traslados superiores al remanente y metadatos nulos que abortaban el análisis. Sus reproducciones ahora devuelven conflictos sin mutaciones.
- La auditoría de regularización conserva el identificador y la clave canónica del cargo encontrado o creado, además del importe, actor, motivo y fechas.
- La cola de impresión excluye comandas ORDER/AMENDMENT/REPRINT internas al reclamar trabajos, incluso si un PROCESSING anterior vuelve a RETRY. Mantiene comprobantes manuales y pedidos de clientes; no promete cancelar un envío físico ya iniciado.

### Evidencia visual con fixtures

Se validaron escritorio de 1280 px y móvil de 390×844 mediante copia temporal de la aplicación y proxy que interceptó **todas** las rutas `/api`; no se enviaron solicitudes a la API real. Seleccionar combo/salsa/envases generó cero POST; confirmar generó un POST y mensaje de entrega/cargo, sin impresión automática. Solicitar comprobante mostró estado en cola.

La regularización mostró diagnóstico de solo lectura, resultado HTTP 200 con un documento regularizado y otro en conflicto, importe añadido, pendientes, paginación con corte/cursor constantes y reanálisis. Un 500 mantuvo corte/motivo/lote congelados y permitió recuperar el mismo envío sin otra clave. Cuentas conservó saldo $36,75 y antecedentes por regularizar sin exponer un flujo de preparación. Producto mantuvo precio especial y tiempo de preparación de clientes, sin el control heredado de empleados. En móvil no se observó desbordamiento horizontal.

Capturas temporales de esta ejecución: `/tmp/consumos-registro-mobile390.png`, `/tmp/consumos-regularizacion-desktop.png`, `/tmp/consumos-regularizacion-mobile390.png`, `/tmp/consumos-producto-desktop.png` y `/tmp/consumos-producto-mobile390.png`. Son evidencia de interfaz simulada; no demuestran persistencia ni papel impreso. Los servidores y pestañas temporales se cierran después de cada comprobación.

### Pendientes para completar validación operativa

1. Proporcionar una base PostgreSQL aislada explícita y ejecutar el arnés, incluida conciliación y reanudación de lotes. No sustituirla por la base develop activa.
2. Repetir el build en un entorno con acceso a la fuente configurada.
3. Realizar UAT con persistencia e impresión física del comprobante solicitado. No se desplegó ni se aplicó regularización en la base activa durante esta implementación.

### Límite de la revisión visual adicional

T036 queda parcial: faltó observar la pantalla con rol mesero y abrir el detalle de correcciones administrativas. Tras completar los escenarios principales, el navegador IAB dejó de estar disponible; la alternativa nativa devolvió `Computer Use was not approved to use Google Chrome`. No se forzó acceso ni se instalaron herramientas. Las pruebas de backend de permisos/correcciones sí pasaron, pero no sustituyen esta observación visual. Se detuvieron las sesiones temporales y se verificó que los puertos 3117/3118/3119 no tuvieran listeners.
