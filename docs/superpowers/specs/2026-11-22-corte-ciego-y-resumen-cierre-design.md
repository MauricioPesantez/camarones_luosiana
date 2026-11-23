# Corte de turno a ciegas y resumen del cierre — diseño corto

Dos partes en este orden: la segunda informa los cortes anulados de la primera.

## Por qué

El mesero ve cuánto debía haber y cuánto falta al entregar su turno, y puede repetir
el corte sin límite: en el segundo intento puede escribir el número esperado sin contar.
Un adelanto registrado tarde deja −$20 en un corte y +$20 en el siguiente, aunque el día
cuadre. Al cerrar, el dueño quiere recibir por WhatsApp todo lo que pasó en el día.

## Objetivos

- El mesero no ve ni recibe el esperado ni la diferencia.
- Las salidas de dinero se revisan antes de contar.
- Un conteo entregado solo lo corrige el admin, y queda registro.
- El cierre encola el detalle del día al chat del operador digital.

**No objetivos:** cambiar las fórmulas del cuadre; registrar quién recibe el turno;
bloquear la anulación de adelantos con caja cerrada (ya decidido); reenviar el resumen.

**Anti-objetivos:** que un fallo de WhatsApp impida cerrar la caja; que el esperado siga
llegando al celular del mesero aunque no se muestre; crear un turno falso al corregir.

## Enfoques

Corrección de un conteo:
- **A — Solo el admin anula el último corte (elegido por el usuario).** Depende de que
  el admin esté disponible.
- B — Un reconteo propio a ciegas: no depende del admin, pero alguien puede avisarle antes.
- C — Sin corrección: descartado, un error de tecleo queda como faltante.

Envío del resumen:
- **Cola `WhatsappSalida` (única razonable).** Ya reintenta, evita duplicados y deja los
  fallos a la vista del admin.
- Llamar a OpenWA desde el POS: descartado, corre en la computadora Windows del local.

## Parte 1 — Corte a ciegas

- **Servidor:** para todo rol distinto de admin, `/api/caja` omite `montoEsperadoCierre`,
  `montoCierre`, `diferenciaCierre` y, en cada corte, `montoEsperado` y `diferencia`
  (incluidas las respuestas 409 de apertura). `POST /api/caja/corte` responde solo
  número, contado y hora. El cálculo se sigue guardando igual.
- **Pantalla:** tres pasos.
  1. Salidas de todos desde el último corte vigente: hora, categoría, monto y quién la
     registró. Sin beneficiario ni motivo. Botón a Retiro y botón "Están todas, continuar".
  2. Conteo, revisión del monto escrito y confirmación.
  3. "Conteo entregado", igual cuadre o no.
- **Una entrega por turno:** si el último corte vigente es del mismo mesero, 409 "Ya
  entregaste tu turno. Si hay un error, pide al administrador que anule el conteo."
- **Se mantiene** "Turno N · recibió $X de Ana" y los montos contados del historial.
- **Anular corte:** solo admin, solo el último vigente, solo con caja abierta, con motivo
  y bajo el mismo candado de la caja. Migración: `anuladoPorNombre`, `razonAnulacion`,
  `anuladoAt` en `CorteTurno`. El número no se reutiliza; el cálculo usa el último vigente.
- **Admin:** en "Cambios de turno" los anulados salen tachados con motivo y autor. El
  botón que ofrece el último conteo ignora los anulados.

## Parte 2 — Resumen del cierre por WhatsApp

- **Cuándo:** después de confirmarse el cierre, con los mismos datos del cierre. Si el
  encolado falla, la caja queda cerrada y la pantalla lo avisa.
- **Destino:** el remitente del pedido más reciente entre los `WHATSAPP_OPERATOR_IDS`
  vigentes; así se usa la forma (`@lid` o `@c.us`) que funciona hoy y nunca un número viejo.
  Si no hay ninguno, no se envía y se avisa.
- **Cola:** tipo `RESUMEN_CIERRE`, clave `cierre:<fecha>:<n>`, vigencia 24 h (la de 30 min
  por defecto lo perdería si el agente está fuera de horario). `disponibleAt` escalonado
  para conservar el orden; cada mensaje dice "1/5".
- **Mensajes** (se parten si pasan de 3.500 caracteres; secciones vacías se omiten):
  1. **Cierre:** quién abrió y cerró, la cuenta del efectivo como suma, contado,
     diferencia, vendido, cobrado, falta cobrar, banco, envíos y reembolsos pendientes.
  2. **Turnos:** cada corte con mesero, hora, recibió, debía haber, contó y diferencia;
     anulados con motivo; diferencia del último tramo hasta el cierre.
  3. **Salidas:** cada retiro o adelanto con hora, monto, motivo, quién y para quién;
     anulados aparte; consumos de empleados.
  4. **Novedades:** órdenes anuladas con motivo, descuentos, cortesías, productos
     eliminados, cambios de método de pago, aprobaciones sin stock y órdenes sin cobrar.
  5. **Órdenes y productos:** una línea por orden (número, hora, tipo, quién, total, pago)
     y unidades vendidas por producto.
- **Privacidad:** sin teléfonos, direcciones ni nombres de clientes.
- **Cierre de un día anterior:** el resumen es de esa fecha.

## Pruebas

- Serializado para mesero: no contiene esperado ni diferencia; para admin sí.
- Corte repetido por el mismo mesero: rechazado; permitido tras anular o tras otro mesero.
- Adelanto tardío: corte −20, anulado, se registra el adelanto, nuevo corte = 0.
- Textos del resumen: día normal, día sin movimientos, mensaje largo partido, sin datos
  de clientes; la diferencia coincide con la guardada.
- Encolado fallido o sin operador: la caja queda cerrada.

## Decisiones mías, corregibles

Texto de los mensajes, límite de 3.500 caracteres, vigencia de 24 h, qué omite la lista de
salidas y mantener visible lo recibido del turno anterior.
