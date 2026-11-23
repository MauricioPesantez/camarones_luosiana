# Bitácora de revisión de órdenes — diseño

Estado: aprobado por el usuario el 2026-11-23, con prototipo.

## Por qué

Con la caja ya cerrada, el admin repasa las órdenes una por una. Quiere marcar las que ya
vio, como "Viewed" en un PR de GitHub, y dejar anotado con botones qué estaba mal. Sirve
para **saber qué errores está teniendo el equipo**. Son comentarios: no corrige órdenes.

## Objetivos

- Marcar por separado cada producto, el cobro y el total.
- Anotar el error sin escribir texto: faltó una cola, fue efectivo, cobró $3 de más.
- Marcar la orden como revisada y ver cuántas faltan en el día.
- Leer la bitácora de varios días: qué errores hay y de quién son las órdenes.

**No objetivos:** cambiar la orden, el cobro o el stock; explicar la diferencia del cierre;
WhatsApp; avisar o descontar al empleado; bloquear el cierre.

**Anti-objetivos:** que una anotación mueva cualquier cifra de caja o de otro reporte; que
otro rol la reciba; que una orden siga como revisada después de cambiar.

## Regla principal (decidida por el usuario)

La bitácora **no impacta ningún cálculo**. Solo escribe en su propia tabla: nunca en `Orden`,
`Item`, `Cobro`, `Producto`, `SesionCaja`, `PrintJob`, `WhatsappSalida` ni `HistorialOrden`.
Está pensada para después del cierre, pero no depende de si la caja está abierta o cerrada.

El botón "Corregir cobro" que ya existe sí mueve la caja. Se queda en Resumen, aparte.

## Enfoques

- **A — Marcar y usar las herramientas actuales:** descartado; editan la orden de verdad.
- **B — Corrección propia que cambia la orden y el cobro:** elegido primero y descartado por
  el usuario, porque no quiere editar ni mover la caja.
- **B ajustado — Bitácora aparte (elegido):** queda el dato, sin efectos. A cambio, el resto
  del sistema sigue mostrando el valor original.

## Qué ve el admin

**Órdenes del día.** Número de orden, avance y un botón "Revisar órdenes" que abre la revisión.

**Pantalla Revisión**, a pantalla completa y aparte del detalle, donde están los botones que
sí cambian la orden. En escritorio, la lista a la izquierda y la orden a la derecha; en
celular, una orden a la vez con "Ver lista". Validada en prototipo.

```text
12 de 40 revisadas · 3 con errores ▓▓▓░░░░░░        [Salir]
────────────────┬──────────────────────────────────────────
Todas Sin Errores│ #34 · Mesa 5                      $21.00
✓ #33 Mesa 1     │ 7:42 p. m. · Creó Ana · Cobró Luis
○ #34 Mesa 5     │ Productos
! #32 Ana        │ [✓] 2 × Combo Simple     $19.00  Está mal
                 │ [!] 1 × Cerveza           $2.00  Quitar error
                 │     No iba en la orden   [−] 0 [+]
                 │ + Faltó un producto
                 │ Cobro
                 │ [ ] Transferencia        $21.00  Está mal
                 │ Total
                 │ [ ] Total cobrado        $21.00  Está mal
                 ├──────────────────────────────────────────
                 │ Faltan 2 por marcar
                 │ [Lo demás está bien]   [Marcar revisada]
```

**Reportes → Bitácora de errores.** Para un rango de fechas: cuántas órdenes se revisaron,
errores por tipo, errores por persona y la lista, cada línea con fecha, número y error.

```text
Faltó producto 9 · No iba 2 · Otra cantidad 3 · Método 5 · Total 4
Ana    12 errores: faltó producto 7, método 5
23/11  #34  Faltó 1× Cola                     Ana
23/11  #34  Registrada transferencia, fue efectivo   Luis
```

## Reglas

**Qué se revisa.** Ventas a clientes que no estén anuladas, rechazadas ni esperando
aprobación. Las que son a cuenta de un empleado no tienen parte de cobro, ni las de $0 sin
pagos. Una orden sin cobrar sí se revisa: "Está por cobrar" o, si está mal, el método con que
sí se cobró.

**Una sola mecánica.** Producto, cobro y total funcionan igual: tocar la fila la marca bien;
"Está mal" abre ahí mismo las opciones; "Quitar error" la deja sin marcar.

**Guardado.** Cada marca se guarda sola, en orden. Si falla, se dice y se ofrece "Reintentar"
sin perder lo marcado; no se pasa a la siguiente orden con marcas sin guardar.

**Lo demás está bien** marca bien solo lo que falta; nunca cambia un error anotado. Dice
"Todo está bien" si aún no se ha marcado nada. No marca la orden como revisada.

**Marcar revisada** exige una respuesta en cada producto, en el cobro y en el total, y los
datos de cada error. Si falta algo, dice qué y lleva hasta ahí. Con errores también se puede:
significa "ya la vi". Pasa a la próxima sin revisar y ofrece "Deshacer" sin límite de tiempo
hasta la siguiente acción. Se puede quitar sin perder anotaciones; mientras tanto, sus errores
no salen en la bitácora. Si una orden revisada queda incompleta, vuelve a sin revisar.

**Productos.** "Está mal" pide la cantidad real, de 0 a 99 y distinta a la registrada; 0 es
"No iba en la orden". "Faltó un producto" busca en el catálogo completo, incluidos los no
disponibles (hasta 50 líneas, cantidad 1 a 99, una línea por producto).

**Cobro.** "Está mal" pide el método real entre los distintos al registrado. Mixto no pide
montos.

**Total.** "Está mal" pide de más o de menos y el monto, mayor que $0 y hasta $9.999,99, con
punto o coma.

**De quién es el error.** Productos: quien creó la orden. Cobro y total: quien la cobró; si
nadie la cobró, quien la creó. Se guarda quién era al anotarlo: si después cobra otra persona,
el error no cambia de nombre. Es una referencia para el admin, no una culpa comprobada.

**Si la orden cambia después**, solo se desmarca lo que cambió, se explica qué fue y la orden
vuelve a "sin revisar". Lo demás se conserva. Los errores ya anotados de lo que cambió pasan a
"Errores anteriores" y **se conservan aunque la orden se vuelva a revisar** (decidido por el
usuario). Salen en la bitácora con la nota "la orden cambió". El admin puede quitarlos uno por
uno. El mismo error vuelto a anotar no se cuenta dos veces. Un producto que faltó no depende de
lo que cambie: sigue anotado hasta que el admin lo quite.

**Dos admins a la vez.** Si otro guardó primero, el segundo recibe un aviso y recarga.
Solo existe la última versión de cada revisión.

## Datos

Tabla nueva, solo agrega: `RevisionOrden` con `ordenId` único, `detalle` Json, `revisada`,
`conErrores`, `version`, `revisadaPorId`, `revisadaPorNombre`, `revisadaAt` y fechas.

`detalle` guarda la foto de lo que el sistema decía al marcar:

- `productos[]`: `itemId`, `nombre`, `cantidad`, `precioUnitario`, `nivelPicante`,
  `estado` (`bien` | `mal`), `cantidadReal?` (0 es "no iba").
- `faltantes[]`: `productoId`, `nombre`, `cantidad`, `precio`.
- `cobro`: `sistema[]` (`metodoPago`, `monto`), `estado` (`bien` | `efectivo` |
  `transferencia` | `mixto`).
- `total`: `sistema`, `estado` (`bien` | `de_mas` | `de_menos`), `diferencia?`.
- `itemsVistos[]`: todos los productos de la orden al guardar.
- `anteriores[]?`: `clave`, `tipo`, `texto`, `de`, `persona?`. Los calcula el servidor.
- `personas?`: de quién es cada error, por su clave, desde que se anotó.

Nombres, precios y valores del sistema los pone el servidor desde la base.

## Servidor

- `PUT /api/admin/ordenes/[id]/revision`: solo admin. Recibe las marcas, `revisada` y la
  `version` que vio. 400 marca inválida, o incompleta con `revisada`, 404 orden inexistente, 409 si la orden
  no se revisa, o si la orden o la revisión cambiaron desde que se abrieron.
- `GET /api/admin/cuadre` agrega las revisiones **en esa ruta**. `obtenerDatosCuadre` no se
  toca: la comparten el cierre, el corte y la lista del mesero.
- `GET /api/admin/reportes/revision`: solo admin, por fecha de la orden en hora de Ecuador.
- Una función pura compara cada marca con la orden actual para decidir si sigue vigente; la usan
  pantalla y servidor. Compara con los pagos, no con `metodoPago`, porque el cuadre oculta el
  método cuando el cobro fue en otra fecha.

## Arreglos necesarios para revisar bien

- Mostrar el número de orden en la lista y en el detalle.
- El cuadro "Orden Cobrada" muestra un cobro mixto como "Transferencia"; debe decir Mixto.

## Accesibilidad

Contraste mínimo 4.5:1; botones de 44 px o más; estado con icono y texto, no solo color; uso
completo con teclado sin perder el foco al marcar; filas como casillas con nombre; avisos
anunciados al lector de pantalla; sin desbordes desde 320 px.

## Pruebas

- **Sin efectos:** guardar cada tipo de error con una base simulada que falla ante cualquier
  escritura fuera de `RevisionOrden`.
- Permisos y rechazos: sin sesión, otro rol, orden inexistente o anulada, marcas incompletas,
  inválidas o de otro producto, versión vieja.
- Vigencia: cambia cantidad, picante, producto agregado o quitado, pago o total.
- Bitácora: conteo por tipo y persona, orden sin cobrador, límite del día en Ecuador,
  revisión desmarcada fuera del conteo.
- Privacidad: mesero, digital, cocina y el resumen de cierre no reciben anotaciones.
- Guardado: toques rápidos en orden, fallo de red y reintento, versión vieja.
- En la app: revisar, salir y retomar, marcar, deshacer, desmarcar, teclado y celular.

## Decisiones mías, corregibles

Guardado en cada toque; "siguiente" es la próxima sin revisar del día; las anuladas no se revisan; "fue mixto" sin montos; a quién se asigna cada error.

## Queda para quien construye

Nombres internos, reparto en componentes, colores y textos menores, siguiendo los patrones
actuales del panel de admin.
