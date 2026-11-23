# Pantalla principal del admin en tres pestañas

**Por qué:** el admin no sabe qué es cada bloque. Hoy son 10 bloques en 5.560 px,
con 13 tarjetas de dinero del mismo peso y tres nombres parecidos
(cuadre, cuadro, jornada).

**Meta:** abrir la pantalla y responder, sin desplazarse: cuánto se vendió, cuánto
falta cobrar, dónde está el dinero y qué requiere acción.

**No entra:** cambiar las fórmulas de la caja, la API ni el resto del menú.

**Fracaso aunque funcione:** que se pierda una acción que hoy existe o que un
filtro vuelva a alterar la cifra con la que se cierra la caja.

## Enfoques

1. **Tres pestañas en `/admin?tab=`** (elegido por el usuario): corta cada tarea
   y sigue el patrón de `/admin/reportes` y `/admin/productos`.
2. Una sola página reagrupada: no hay que cambiar de pestaña, pero sigue larga.
3. Páginas separadas en el menú: descartado, ya tiene 9 entradas.

## Diseño

- **Encabezado fijo a las tres:** fecha con día anterior/siguiente, estado de la
  caja, actualizar.
- **Resumen:** Vendido = Cobrado + Falta cobrar; efectivo en caja y banco; lista
  "Requiere tu atención" que solo muestra lo que tiene algo pendiente.
- **Órdenes:** filtros, total de lo filtrado y lista compacta con las mismas
  acciones (detalle, cobrar, comprobante, anular, reimprimir).
- **Cierre de caja:** la cuenta escrita como suma, conteo con diferencia en vivo
  y confirmación, cortes de turno, retiros, banco y lo que queda fuera.

## Errores que se corrigen

1. El conteo ya no viene llenado con el último corte: se ofrece como botón, se ve
   la diferencia y se confirma antes de cerrar.
2. Los datos llevan su fecha: si no coincide con la elegida no se muestran, y un
   fallo de carga se avisa.
3. "Falta cobrar" descuenta los abonos (`ventaPorCobrar` en `ResumenCuadre`).
4. El color de texto se fija en `AppShell`, que ya fijaba el fondo claro.
