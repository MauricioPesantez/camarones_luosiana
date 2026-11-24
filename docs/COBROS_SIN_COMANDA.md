# Cobrar desde la lista sin comanda

El mesero entra a **Por cobrar**, localiza el pedido y pulsa **Cobrar**. El enlace abre el formulario existente; no hace falta escanear ni reimprimir el QR.

La lista incluye mesas y pedidos para llevar propios, además de domicilios en efectivo de cualquier creador. Los pendientes de días anteriores permanecen hasta resolverlos. No incluye órdenes sin saldo, anuladas, canceladas, pendientes de aprobación, consumos de empleados ni domicilios por transferencia. Una orden que vuelve a tener saldo tras agregar productos reaparece aunque conserve el estado operativo `cobrada`.

La consulta SQL, el saldo, la liquidación del envío y los permisos se resuelven en el servidor. El mesero puede cobrar un domicilio compartido pero solo editar productos de sus propias órdenes. La caja debe estar abierta para cobrar. Esta vista no muestra el esperado de caja ni reemplaza la revisión de cierre habilitada por el administrador.

## Flujo y contratos

- `GET /api/ordenes/por-cobrar`: sesión de mesero, comparación SQL `total > montoPagado`, proyección mínima y páginas de 50 órdenes. Devuelve `totalPendientes`, `siguienteCursor` y la fecha de consulta; no se recortan silenciosamente los resultados.
- La tarjeta recibe saldo, importe en efectivo, explicación de envío y acciones preparadas. La consulta no depende de `impresa`, trabajos de impresión o conexión del agente.
- Si existe URL de cobro válida, abre la página por token; en órdenes antiguas sin URL abre `/ordenes/[id]/cobrar` con el mismo formulario y un alcance de lectura autorizado.
- Los importes del formulario y el reparto mixto se calculan en servidor. Los POST de `previsualizar` por token y de `previsualizar-cobro` por ID no registran pagos.
- La confirmación sigue usando los endpoints y la transacción existentes: valida otra vez saldo, revisión y caja, y conserva la idempotencia. Un resultado de previsualización no autoriza un pago.
- Los domicilios antiguos sin modalidad prevista no se suponen en efectivo. Revisar esos datos antes de ampliar el alcance.

## PostgreSQL local de pruebas

Se preparó un contenedor separado:

- Nombre: `restaurant-pos-postgres-test`.
- Imagen oficial: `postgres:16-alpine`.
- Base: `restaurant_pos_test`.
- Usuario: `restaurant_test`.
- Puerto: `127.0.0.1:55432` (solo acceso local).
- Volumen exclusivo: `restaurant-pos-postgres-test-data`.
- Conexión privada: `EMPLOYEE_TEST_DATABASE_URL` en `.env.test.local`, excluido de Git. No publicar ese archivo.

El `.env` del negocio no se modifica. Para iniciar o detener esta base:

```sh
docker --context desktop-linux start restaurant-pos-postgres-test
docker --context desktop-linux stop restaurant-pos-postgres-test
```

Para consultar por consola dentro del contenedor:

```sh
docker --context desktop-linux exec -it restaurant-pos-postgres-test psql -U restaurant_test -d restaurant_pos_test
```

Las migraciones actuales fueron aplicadas únicamente a esta base local. No hay una migración nueva para la funcionalidad ni cambios en la configuración de impresión.

## Validación

```sh
npm run test:por-cobrar
npm run test:por-cobrar-postgres
```

Las pruebas PostgreSQL solo aceptan un destino local cuyo nombre contenga `test`. Cada ejecución aplica las migraciones en un esquema aleatorio propio y elimina solo ese esquema al terminar; no borra los datos del esquema público ni carga el `.env` del negocio.

Cubren la selección SQL por autoría y saldo, permisos, órdenes anteriores y reabiertas, cobro sin impresión/QR, liquidación del envío una sola vez, idempotencia, cobros simultáneos y paginación estable. Incluyen una medición con `EXPLAIN (ANALYZE, BUFFERS)` y 5.000 órdenes históricas. El resultado local no garantiza la misma latencia en producción; no se añadió un índice sin evidencia que lo justificara.

Además se verificó por HTTP la creación de un domicilio por Digital con comanda pendiente, su lectura con sesión de mesero, la apertura del formulario y el pago con reintento sin duplicados. Los usuarios y pedidos con prefijo `prueba-` en la base local son sintéticos.
