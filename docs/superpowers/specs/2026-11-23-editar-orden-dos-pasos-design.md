# Editar una orden en dos pasos

**Por qué:** mesero y digital editan con una ventana que en celular se sale de la
pantalla, agrega productos de a uno desde una lista desplegable sin buscador, no
muestra qué cambió y falla al guardar por reglas que no enseña.

**Meta:** corregir productos, cantidades y picante sin instrucciones, viendo
siempre el total y lo que cambió.

**No entra:** mesa, cliente, teléfono ni envío (decidido por el usuario); las
ediciones del admin (descuento, cortesía).

**Fracaso aunque funcione:** que se pierda lo editado por un error, o que se pueda
guardar algo que descuadre el dinero.

## Enfoques

1. **Dos pasos en la misma ventana** (aprobado sobre prototipo): editar y
   confirmar. Un toque más, a cambio de ver el resumen antes de avisar a cocina.
2. Página aparte: pierde el contexto de la lista.
3. Arreglar la ventana actual: sigue larga y sin resumen.

## Diseño

- **Editar:** en celular y tablet, pestañas La orden / Agregar; en escritorio, menú
  a la izquierda y orden a la derecha. Total siempre visible abajo.
- **Confirmar:** lista de cambios, razón en botones y aviso de lo que pasará.
- **Guardado:** dice si cocina recibió la comanda; si no se imprimió, lo advierte.
- Lo bloqueado se ve con candado y motivo antes de tocarlo.

## Reglas

- **Lista o con algún pago:** se puede agregar, no quitar ni bajar ni cambiar picante.
- **Cortesía:** solo la cambia el admin, también en el servidor. Agregar el mismo
  producto crea una línea pagada.
- **Picante:** `modificar` acepta `nivelPicante`. Conserva precio y nota; la comanda
  sale como retirar y agregar, que el agente ya imprime.
- **Nota:** solo en productos nuevos; texto de hasta 200 caracteres.
- **Botón Editar:** solo en estados que el servidor acepta.
- **Orden de los cambios:** primero lo que libera stock, después lo que lo usa.
