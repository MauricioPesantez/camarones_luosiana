# Comandas con verificación manual

Fecha: 2026-10-31. Estado: implementado y verificado localmente en los tres generadores. Pendientes despliegue en el local y prueba física.

## Objetivo y alcance

Reducir olvidos de productos adicionales e inconsistencias de salsa mediante una lista que cocina marque con esfero. Cada producto conserva su cantidad y nombre; su salsa e indicaciones tienen casillas independientes. Al terminar, la persona escribe su nombre en `Responsable: ________________`.

La marca confirma toda la cantidad del renglón: `[ ] 2x Combo Simple` significa revisar las dos unidades. La salsa se verifica para esas unidades, junto al producto al que pertenece. No se descomponen recetas ni se inventan componentes incluidos en un combo. Los extras y bebidas registrados como productos tienen su propio renglón. Un extra escrito en observaciones queda dentro de esa indicación; no se interpreta automáticamente el texto libre.

Es una comprobación manual con evidencia en papel. No bloquea el estado `lista`, no registra marcas ni firmas en la base de datos, y no garantiza que una persona haya realizado la revisión. Para auditar después se deben conservar las comandas marcadas y relacionarlas con el número de orden y fecha. El responsable de revisión no se completa automáticamente con el mesero ni con quien solicita una reimpresión.

## Flujo actual verificado

- `public/plantilla-impresiones.html`: ejemplos estáticos de órdenes iniciales y modificaciones. No es el archivo que consume la impresora; muestra el formato de referencia.
- `components/mesero/CrearOrden.tsx` y `types/orden.ts`: los combos requieren seleccionar un `nivelPicante`; las cantidades y extras son ítems del pedido.
- `app/api/ordenes/route.ts` y `app/api/ordenes/aprobacion/aprobar/route.ts`: crean trabajos de impresión iniciales. La creación también dispone de una ruta de impresión directa condicionada por configuración.
- `app/api/ordenes/[id]/items/route.ts`: genera modificaciones con cambios `ADD`, `UPDATE` y `REMOVE`, cantidad incremental y revisión.
- `lib/print-jobs.ts`: guarda el snapshot con nombre, cantidad, salsa, observaciones y cortesías. No hace falta ampliar el contrato para estas casillas.
- `print-agent/src/printer.ts`: genera texto y bytes ESC/POS para el agente Node.
- `print-agent-python/agent.py`: genera texto y bytes ESC/POS para el agente Python.
- `lib/printer.ts`: genera las comandas de impresión directa.

Existen tres generadores y deben conservar el mismo criterio visual. La presencia de estos archivos no confirma cuál está activo en el restaurante; verificar el servicio Ubuntu y las variables de despliegue antes de activar el cambio.

## Formato propuesto

```text
                ORDEN #123
Mesa: 8
Hora: 31/10/2026, 13:42:18
------------------------------------------
[ ] 1x Combo Mixto Small
  [ ] Salsa Louisiana: NATURAL
  [ ] Obs: Salsa aparte
[ ] 1x Chorizo
[ ] 1x Gaseosa Personal Coca
------------------------------------------
[ ] OBSERVACIONES:
    Incluir cubiertos.
------------------------------------------
TOTAL:                              $16.00
------------------------------------------

Responsable: ________________
==========================================
```

El logo y los bloques actuales de importes, motivo, solicitante y QR siguen donde corresponden. El ejemplo de precios procede del catálogo de `prisma/seed.ts`; no representa una consulta al catálogo desplegado.

Reglas de formato:

- Usar `[ ]` ASCII para evitar que el saneamiento de texto transforme un símbolo Unicode en `?`. Casillas vacías, sin relleno negro.
- Mantener el nivel de salsa destacado en video inverso. Al añadir `[ ]`, adaptar los patrones que hoy reconocen `Salsa Louisiana:` en los tres generadores; la casilla debe quedar fuera del resaltado.
- Salsa solo cuando existe un nivel válido. No asumir `Natural` cuando falta el dato. Mantener la compatibilidad actual con salsa global de órdenes antiguas, con su casilla global cuando corresponda.
- Mantener cortesías y observaciones existentes. Las indicaciones generales se comprueban como un bloque; las indicaciones de producto quedan asociadas a él.
- Reservar espacio vertical para escribir el nombre. No añadir casillas a montos, teléfonos, QR, motivo o solicitante.
- Respetar 42 columnas: descontar el prefijo `[ ] `, envolver nombres/indicaciones largos e indentar las continuaciones. No repetir la casilla en cada continuación ni perder texto. Validar la altura de línea para poder marcar con esfero en papel real.

## Órdenes iniciales, modificaciones y reimpresiones

1. `ORDER`: lista completa del snapshot; casillas por producto, salsa e indicaciones; responsable al final.
2. `AMENDMENT`: solo cambios de esa revisión. Aumentos se imprimen con `+` y su cantidad incremental. Reducciones y eliminaciones llevan `RETIRAR / NO PREPARAR` y su cantidad con `-`; marcar significa confirmar que esas unidades se retiraron. Si incluyen salsa u observaciones, mantenerlas como contexto del producto retirado, sin casillas adicionales que puedan interpretarse como preparación. No reimprimir productos sin cambios ni reutilizar la salsa global como tarea de preparación de productos no modificados.
3. `REPRINT`: lista completa del snapshot y casillas nuevamente vacías; conservar `REIMPRESION`, motivo y solicitante. Operativamente sustituye una copia para revisión: no es una nueva orden de preparación ni recupera las marcas del papel anterior.

Conservar cálculos y reglas de local, para llevar y domicilio. Las modificaciones muestran solo ajustes de productos y, cuando aplique, el delta de envases; no se vuelve a cobrar envío ni el recargo completo.

## Implementación y puesta en servicio

1. Completado: vista previa de los ocho ejemplos, con cantidades agrupadas, casillas y responsable.
2. Completado: formato aplicado en `lib/printer.ts`, `print-agent/src/printer.ts` y `print-agent-python/agent.py`, sin cambios de base de datos, API, cola, estados o inventario.
3. Completado: pruebas en `lib/printer.test.ts`, `print-agent/src/printer.test.ts` y `print-agent-python/test_agent.py` para verificar texto, ajuste de líneas y resaltado.
4. Completado: pruebas de impresión directa, compilación y pruebas del agente Node, 15 pruebas Python, pruebas del contrato de trabajos y QR, ESLint de los cuatro archivos TypeScript modificados y `git diff --check`. Las pruebas construyen tickets y simulan la impresora directa; no envían comandas a una impresora.
5. Pendiente: verificar el agente realmente activo y actualizarlo. Revisar primero con `DRY_RUN=true`; después realizar una prueba física coordinada con cocina, conservando un solo mecanismo de impresión activo.

Para actualizar Ubuntu desde una copia del repositorio con estos cambios, primero identificar el ejecutable del servicio (no muestra el token):

```bash
sudo systemctl show restaurant-print-agent -p ExecStart
```

Conservar una copia de la instalación activa para poder volver atrás. Detener el servicio durante la actualización y mantener la configuración existente. En `/etc/restaurant-print-agent.env`, poner temporalmente `DRY_RUN=true`; no cambiar token, dominio, fecha de corte o mecanismos activos por este cambio de formato.

- Si `ExecStart` apunta a `/opt/restaurant-print-agent-python/agent.py`: ejecutar `sudo bash print-agent-python/scripts/install-ubuntu.sh` desde la raíz del repositorio actualizado.
- Si apunta a `/opt/restaurant-print-agent/dist/index.js`: ejecutar `sudo bash print-agent/scripts/install-ubuntu.sh` desde la raíz del repositorio actualizado.
- Si se usa impresión directa: desplegar la aplicación actualizada; instalar agentes adicionales no es necesario.

Después de instalar el agente activo, iniciarlo y revisar estado/heartbeat. `DRY_RUN=true` no reclama trabajos y no permite comprobar la apariencia del papel. Coordinar esta pausa fuera de la operación: los pedidos en cola siguen envejeciendo y pueden requerir revisión según la ventana automática vigente. Revisar esa cola antes de restaurar el modo de operación anterior y reiniciar para una prueba física controlada. No iniciar un segundo agente. Si el formato no resulta legible, detener el servicio y restaurar la instalación anterior.

## Criterios de aceptación

- Combo + extra + bebida tienen tres casillas de producto; la salsa e indicaciones tienen las suyas, junto al combo correcto.
- Con dos combos de distintos niveles ya registrados, cada renglón conserva su nivel y casilla. Este cambio no amplía la captura actual de variantes del mismo producto.
- Un renglón `2x` mantiene su cantidad y una sola casilla de producto; la regla de revisión de todas las unidades está documentada.
- Sin salsa o indicaciones no se generan casillas vacías sin contenido; se mantiene el comportamiento compatible con payloads antiguos.
- Nombres largos, acentos y cortesías no pierden información al añadir prefijos. Las líneas no superan el ancho objetivo y las casillas quedan en blanco.
- El nivel seleccionado sigue invertido en los bytes ESC/POS; la casilla no queda invertida.
- Una adición imprime solo lo agregado. Una reducción o eliminación se identifica como retiro y no induce a preparar de nuevo.
- La reimpresión conserva su identificación y nunca implica que las verificaciones anteriores estén completadas.
- Hay exactamente un espacio de responsable por ticket; los montos y el comportamiento del QR permanecen iguales.
- En impresora real se leen salsa, extra y cantidad, se marca cómodamente con esfero y el corte deja espacio para el nombre. Esta comprobación física queda pendiente hasta implementar y probar en el local.

## Validación

La primera etapa actualizó la vista previa y documentó el plan. La implementación posterior modifica los tres generadores y sus pruebas. No se ha desplegado en Ubuntu ni se han enviado comandas a la impresora. La revisión visual del HTML y las comprobaciones de bytes no reemplazan la prueba física ESC/POS.

Vista previa: muestra local inspeccionada visualmente en navegador y comprobación del DOM de los ocho ejemplos, con un responsable por ticket y sin desbordamiento horizontal al ancho mostrado.

Implementación: las suites existentes pasaron antes del cambio. Las aserciones del nuevo formato fallaron antes de añadir las casillas y pasan con la implementación. Se cubren extras/bebidas, salsa por producto y global antigua, observaciones vacías, textos largos con y sin espacios, cortesías, aumentos/reducciones/eliminaciones y copias de reimpresión. Se conservan las pruebas de importes, logo y QR.
