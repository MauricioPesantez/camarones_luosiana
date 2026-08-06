# Cobro mixto y multipago por orden

Fecha: 2026-08-05
Estado: aprobado para planificar

## Problema

Hoy una orden tiene un solo cobro con un solo metodo (`Cobro.ordenId` es `@unique`,
`Orden.metodoPago` es `efectivo` o `transferencia`). Eso deja fuera dos casos reales:

1. El cliente paga una parte en efectivo y otra por transferencia en el mismo acto.
2. El cliente paga la orden, y despues agrega un producto que quiere pagar con otro
   metodo. Hoy es imposible: una orden de domicilio con transferencia confirmada al
   crear nace `cobrada: true` (`app/api/ordenes/route.ts:312`) y modificar items de una
   orden cobrada responde 409 (`app/api/ordenes/[id]/items/route.ts:179`). El local lo
   resuelve a mano y el cuadre no se entera.

El caso 2 es el que manda el diseno: no es "un cobro con dos metodos", son **dos cobros
en momentos distintos sobre la misma orden**. El caso 1 es la version facil de eso.

## Decisiones tomadas

| Decision | Valor |
|---|---|
| Modelo | Pagos 1:N sobre la orden. Mixto = dos pagos en un mismo acto |
| Mixto en domicilio | Permitido, con regla unica de liquidacion del motorizado |
| Saldo pendiente deliberado | No se permite. Todo acto de cobro deja saldo en cero |
| Editar orden cobrada | Solo agregar items o subir cantidades. Nunca quitar ni bajar |
| Comprobante | Uno por cada pago de transferencia. No se bloquea esperando S3 |
| Envio a domicilio | Se calcula a nivel de orden, no de pago |
| Pago que cruza de dia | No ocurre por politica de cierre diario. El cuadre lo vigila |

## Regla unica de liquidacion del motorizado

> El envio se descuenta del efectivo que el motorizado cobro al cliente. Si sobra, el
> motorizado entrega la diferencia al local. Si falta, el local le completa.

En formula, por orden a domicilio:

```
liquidacion = costoEnvio - (efectivo total cobrado en la orden)
liquidacion > 0  ->  el local ENTREGA esa cantidad al motorizado
liquidacion < 0  ->  el motorizado ENTREGA esa cantidad al local
```

Reproduce los tres casos que hoy existen, asi que ningun cuadre historico se mueve:

| Caso | Efectivo cobrado | Envio | Liquidacion | Comportamiento actual |
|---|---|---|---|---|
| Transferencia pura | 0 | 3 | +3 el local entrega | el local entrega 3 |
| Efectivo puro (total 10) | 10 | 3 | -7 el motorizado entrega | el motorizado entrega 7 |
| Mixto: transferencia 8 + efectivo 5 | 5 | 3 | -2 el motorizado entrega | (caso nuevo) |

Fuera de domicilio la liquidacion siempre es 0.

## Modelo de datos

### `Cobro` pasa de "el cobro de la orden" a "un pago"

Se elimina `@unique` de `ordenId`.

| Campo | Cambio |
|---|---|
| `monto` | Nuevo. Importe de este pago. Backfill de filas existentes: `montoTotal` |
| `montoTotal` | Cambia de significado: snapshot del total de la orden al momento del pago |
| `metodoPago` | Sigue siendo `efectivo` o `transferencia`. Nunca `mixto` |
| `comprobanteTransferenciaKey` | Pasa a ser por pago |
| `idempotencyKey` | Ya es `@unique`. Ahora identifica un pago, no una orden |
| `estado` | `CONFIRMADO`, `REEMBOLSO_PENDIENTE`, `REEMBOLSADO`, por pago |
| `efectivoEntregado` | **Se elimina.** El envio deja de vivir en el pago (ver abajo) |

`efectivoRecibido` y `transferenciaRecibida` se conservan pero cambian de significado:
son lo que el cliente entrego en ese pago, sin descontar envio. Para un pago solo uno
de los dos es distinto de cero, asi que son redundantes con `monto` + `metodoPago`; se
mantienen porque el cuadre y los reportes ya los suman y quitar columnas obliga a tocar
mas codigo del necesario.

### El envio sale del pago

`efectivoEntregado` no puede vivir en el pago: en el caso real la transferencia entra
antes de que el motorizado salga, y la liquidacion ocurre despues. Modelarlo por pago
obligaria a escribir un `efectivoEntregado` negativo en el segundo pago para que la
suma cuadre.

Pasa a ser una funcion pura de la orden, `calcularLiquidacionDomicilio(orden, pagos)`,
que aplica la regla unica. Se reconoce en el cuadre en la fecha del pago que deja la
orden en saldo cero.

### `Orden`

| Campo | Cambio |
|---|---|
| `montoPagado` | Nuevo, `Decimal @default(0)`. Materializado para no agregar en cada listado |
| `cobrada` | Pasa a ser derivado materializado: `montoPagado >= total`. Se recalcula al pagar y al modificar items. Se conserva porque lo usan los `updateMany` condicionales y varios filtros |
| `metodoPago` | Solo para UI y reportes. Materializado por `resumirMetodoPago(pagos)`, que devuelve `efectivo`, `transferencia` o `mixto`. El cuadre deja de leerlo |
| `cobradaPor`, `cobradaPorId`, `origenCobro`, `fechaCobro` | Pasan a significar "el ultimo pago". Se materializan; la verdad esta en las filas `Cobro` |
| `comprobanteTransferenciaKey` | Queda como legado de ordenes previas. Los pagos nuevos guardan el suyo en `Cobro` |

Las filas existentes ya son una por orden, asi que la migracion es aditiva: ninguna
orden historica cambia de estado ni de cifra.

## Modulos y responsabilidades

### `types/cobro.ts` — aritmetica del dinero

- `calcularMovimientosPago({ metodoPago, monto })`: lo que entra al local por un pago.
  No sabe de envios ni de ordenes.
- `resumirMetodoPago(pagos)`: `efectivo` | `transferencia` | `mixto`.
- `validarActoDeCobro({ saldo, partes })`: rechaza si las partes no suman exacto el
  saldo, o si alguna parte es cero.

### `types/orden.ts` — reglas de la orden

- `calcularLiquidacionDomicilio(orden, pagos)`: reescrita sobre la regla unica. Firma
  nueva porque ahora necesita los pagos. Devuelve `null` fuera de domicilio.
- `calcularSaldo(orden)`: `total - montoPagado`.

### `lib/order-payment.ts` — el acto de cobro

`collectOrderPayment` acepta una o dos partes en vez de un `metodoPago` suelto:

```ts
collectOrderPayment({
  orderId, expectedRevision, idempotencyKey, origen, user,
  partes: Array<{
    metodoPago: MetodoPago;
    monto: number;
    comprobanteTransferenciaKey?: string | null;
  }>,
})
```

Invariantes, todas dentro de una `$transaction`:

1. `Σ partes.monto === saldo` exacto (en centavos, no en floats).
2. Ninguna parte con monto cero, y como maximo una parte por metodo.
3. `expectedRevision` coincide con `printRevision`.
4. Se crea una fila `Cobro` por parte, con `idempotencyKey` derivada:
   `${base}:${metodoPago}`.
5. Se actualiza `Orden.montoPagado`, y `cobrada` se recalcula.
6. Se escribe un `HistorialOrden` por acto, no por parte.

El retry con la misma `idempotencyKey` base devuelve el estado guardado sin duplicar,
igual que hoy.

### `lib/items` — la orden que crece

`app/api/ordenes/[id]/items/route.ts` deja de rechazar `cobrada`, con restricciones:

- Sobre una orden cobrada solo se aceptan `agregar` y `modificar` al alza.
- `eliminar`, bajar cantidades y marcar cortesia se rechazan: bajarian el total y
  generarian saldo negativo, que es un flujo de reembolso que no existe.
- `editableStatuses` incorpora `cobrada`.
- Tras el cambio se recalcula `cobrada` desde `montoPagado >= total`. Si el total
  subio, la orden vuelve a `cobrada: false` con saldo.
- El estado operativo vuelve a `en_preparacion` con la misma regla que hoy
  (`wasReady && hasNewPreparation`), extendida a ordenes que estaban en `cobrada`.
- El ticket de MODIFICACION se emite sin cambios: ya imprime deltas referenciados a
  `ORDEN #N REV r`.

### `types/cuadre.ts` — reconocimiento

`calcularResumenCuadre` se parte en dos fuentes:

- **Dinero que entro** (`efectivoVentasDirectas`, `transferenciasVentas`,
  `depositosRecibidos`, `efectivoCobradoMotorizados`): suma **pagos con fecha en el
  rango**, no ordenes. Los montos de los pagos son brutos, sin descontar envio.
- **Liquidacion de motorizados** (`efectivoEntregadoMotorizados` y su contraparte
  cuando el motorizado entrega al local): **no** sale de los pagos. Se calcula por
  orden a domicilio con `calcularLiquidacionDomicilio`, y se reconoce en la fecha del
  pago que dejo la orden en saldo cero. Es el unico lugar donde el envio toca el
  cuadre, y de ahi salen tambien las cifras de venta propia de domicilio.
- **Conteos y venta** (`ordenesCobradas`, `ordenesSinCobrar`, `ventasTotales`,
  `ventasSinCobrar`): siguen siendo por orden.
- **Fallback historico**: una orden cobrada sin filas `Cobro` se sigue leyendo por
  `orden.metodoPago`, con la logica actual intacta.

Se agrega al resumen `ordenesConSaldoPendiente` (conteo y monto): la red que evita que
una orden reabierta cruce el cierre del dia sin que nadie la vea.

## Flujo de interfaz

### Cobro mixto en un acto

En `components/cobros/CobrarOrdenClient.tsx` se agrega una tercera opcion junto a
Efectivo y Transferencia:

1. Se pide el monto en efectivo.
2. El resto se autocalcula como la parte de transferencia y se muestra.
3. Se exige la foto del comprobante para la parte de transferencia.
4. Confirmar queda deshabilitado mientras `efectivo + transferencia != saldo`, o si
   alguna parte es cero.
5. En domicilio se muestra la liquidacion resultante con el motorizado, con el signo
   explicito: "el motorizado te entrega $2" o "entregas $3 al motorizado".

### Orden con saldo pendiente

- Badge `SALDO $X` en la lista de ordenes por cobrar.
- El acto de cobro cobra el saldo, no el total.
- `shouldPrintPaymentQr` vuelve a `true` cuando hay saldo, para que la orden reabierta
  se pueda cobrar por enlace.

## Edge cases

| # | Caso | Resolucion |
|---|---|---|
| 1 | QR de pago en orden reabierta | `shouldPrintPaymentQr` mira saldo, no `cobrada` |
| 2 | Modal de cobro abierto mientras otro agrega un producto | Cubierto por `expectedRevision`; el modal de mixto debe enviarlo igual que el simple |
| 3 | Retry del cobro mixto a media transaccion | Las dos filas van en una sola `$transaction`; el retry con la misma clave base devuelve el estado guardado |
| 4 | Pago que cae en otro dia | No ocurre por politica de cierre diario. `ordenesConSaldoPendiente` en el cuadre lo hace visible antes de cerrar |
| 5 | Rechazo por stock sobre orden ya pagada | `aprobacion/rechazar/route.ts:81` debe marcar `REEMBOLSO_PENDIENTE` en **todos** los pagos de la orden, no en uno |
| 6 | Campos de cobro en `Orden` con N pagos | Materializan el ultimo pago; la verdad esta en `Cobro` |
| 7 | Mixto con una parte en cero | Se rechaza: eso es un cobro simple |
| 8 | Agregar item a orden en estado `cobrada` | `editableStatuses` incorpora `cobrada`; vuelve a `en_preparacion` si hay preparacion nueva |
| 9 | Cortesia sobre orden ya pagada | Se bloquea: bajaria el total y generaria saldo negativo |
| 10 | Reportes admin y `DetalleOrdenModal` | Muestran el desglose de pagos, no un `metodoPago` plano |
| 11 | Redondeo de la parte en efectivo | Toda la aritmetica del acto de cobro va en centavos enteros, nunca en floats |
| 12 | Dos cobradores cobrando la misma orden a la vez | El `updateMany` condicional sobre `printRevision` y `montoPagado` deja pasar uno solo; el otro recibe 409 |

## Pruebas

Se extienden los suites que ya existen, con el mismo estilo de `ts-node`:

- `lib/cuadre.test.ts`: pagos multiples en el rango, orden reabierta, fallback de
  ordenes historicas sin `Cobro`, `ordenesConSaldoPendiente`.
- Nuevo `types/cobro.test.ts`: `validarActoDeCobro` con partes que no suman, parte en
  cero, mas de una parte por metodo; aritmetica en centavos.
- Nuevo `lib/order-payment.test.ts`: idempotencia del acto mixto, conflicto por
  revision, saldo que no cuadra.
- Casos de la regla unica de liquidacion: los tres historicos mas el mixto, para que la
  reescritura no mueva ningun numero previo.

## Fuera de alcance

- Reembolsos y devoluciones parciales. Quitar items de una orden pagada sigue
  prohibido.
- Subida real del comprobante a S3. Se mantiene el plan
  `docs/superpowers/plans/2026-08-03-comprobantes-s3.md` como trabajo aparte.
- Metodos de pago adicionales (tarjeta). El modelo 1:N los admite sin cambio de forma.
- Abonos y pagos parciales deliberados.
