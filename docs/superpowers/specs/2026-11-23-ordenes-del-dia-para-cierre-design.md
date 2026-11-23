# Órdenes del día para quien cierra caja — diseño corto

Aprobado el 2026-11-23, con la plantilla mostrada en la conversación.

## Por qué

Cuando el conteo a ciegas no cuadra, el mesero necesita revisar qué se vendió y cómo se
cobró. Fondo + efectivo − salidas da el esperado: la lista sirve para hallar el error,
nunca para volver a contar.

## Contexto

Hay un solo turno de meseros. El cierre calcula el día completo al cerrar, así que una
corrección hecha antes del cierre ajusta sola la diferencia.

## Objetivos

- El admin habilita una lista corta y de solo lectura para quien entregó el conteo.
- El admin puede corregir un cobro registrado con el método equivocado.
- Desde que se habilita, nadie entrega otro conteo ni se anula el que hay.
- El admin ve qué se movió después del conteo; el resumen de WhatsApp lo informa.

**No objetivos:** cambiar cálculos o pantallas de turnos; quitar productos de una orden
pagada; corregir pagos mixtos; solicitud o marcas del mesero en el POS.

**Anti-objetivos:** que la lista llegue sin permiso; que traiga montos que no debe
mostrar (aunque la pantalla los oculte); datos de clientes.

## Enfoques

- **A — Corregir sin volver a contar (elegido).** El admin cuenta y cierra.
- B — Segundo conteo del mesero junto al admin: descartado, ya no es a ciegas.
- C — Lista sin montos: descartado, no deja ver un valor mal cobrado.

## Qué ve el mesero (decidido por el usuario)

Todos los productos de cada orden, para saber si vendió de más o de menos. En domicilio
por transferencia, solo el envío entregado al motorizado, sin precios ni total.

| Caso | Productos | Línea final |
|---|---|---|
| Mesa o para llevar | cantidad, nombre, precio | Cobrado |
| Domicilio en efectivo | cantidad, nombre, precio | Recibido del motorizado (sin envío) |
| Domicilio por transferencia | cantidad, nombre | Envío entregado al motorizado |
| Mixto | cantidad, nombre, precio | transferencia y efectivo por separado |
| Sin cobrar | cantidad, nombre, precio | Por cobrar |
| Anulada, rechazada, sin aprobar, cuenta de empleado | cantidad, nombre | ninguna |

Envases, descuento y cortesías solo si existen. Al final, salidas sin motivo ni
beneficiario. Sin cliente, teléfono, dirección, picante, observaciones ni historial.

## Reglas

- Habilitar: admin, caja de hoy abierta, con un conteo vigente. No se puede deshacer;
  termina al cerrar la caja. Se guarda quién y cuándo.
- Lista: solo el mesero del último conteo vigente, con la caja abierta.
- Corregir cobro: admin, con motivo, caja del día del cobro abierta, un solo pago
  confirmado, orden no anulada, no rechazada y no a cuenta de empleado. Conserva la hora
  del cobro y el comprobante. Queda en el historial y en las novedades del resumen.
- El mesero deja de recibir en `/api/ordenes` las órdenes que su pantalla ya ocultaba.

## Decisiones del implementador, corregibles

El admin cuenta al final; solo ve la lista quien entregó; no se oculta antes de cerrar;
un domicilio sin cobrar acordado por transferencia tampoco muestra precios.
