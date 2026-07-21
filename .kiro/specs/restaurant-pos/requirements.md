# Requirements Document

## Introduction

El sistema **Camarones Louisiana** es una aplicación single-tenant de gestión de órdenes para un restaurante de mariscos en Cuenca, Ecuador. Digitaliza tres procesos hoy manuales: la **toma de orden**, el **flujo de cocina** (KDS complementado con la **comanda impresa** en una impresora térmica de red) y el **cuadre de caja**, con el fin de reducir errores de comunicación y de dinero.

La escala es pequeña: aproximadamente 5 mesas, 3 usuarios operativos más 1 administrador, y entre 10 y 15 órdenes diarias. El sistema cubre el ciclo de vida completo de una orden (desde su apertura hasta el cobro y cierre), el control de disponibilidad del menú, el registro auditable de todo movimiento de dinero en un modelo de caja de un fondo físico con dos libros, la autenticación con credenciales propias, y la actualización en tiempo casi real mediante polling.

Este documento define los requisitos funcionales y de calidad. Las decisiones de implementación (stack Next.js + TypeScript, Clean Architecture, Prisma, PostgreSQL en Neon, AWS Amplify y S3, facades de servicios) se abordan en el documento de diseño.

### Asunciones a confirmar

1. Un usuario puede tener múltiples roles asignados simultáneamente.
2. El campo `stockDelDia` se reinicia diariamente; el administrador carga el stock cada mañana.
3. El pago dividido (split) queda fuera del alcance de la versión 1.
4. La impresora de comandas es una térmica de red 3nstar de 80mm (compatible ESC/POS, TCP puerto 9100) ubicada en cocina; existe un único punto de impresión.
5. Los ítems agregados después del envío inicial (en `EN_PREPARACION` o `ENTREGADA`/running tab) generan un ticket de adición con solo los ítems nuevos; nunca se reimprime la comanda completa de forma automática (evita cocinar platos duplicados).
6. El Agente_Impresion corre en la PC de cocina (el mismo equipo donde se abre el KDS), conectada a la red local del restaurante junto con la impresora. *(Confirmada.)*

### Fuera de alcance (v1)

Microservicios; integración con WhatsApp Business API; pagos con tarjeta; facturación electrónica SRI; arquitectura multi-tenant; OCR de comprobantes; reportes complejos; pago dividido; impresión de precuenta o recibo para el cliente (solo se imprime la comanda de cocina); múltiples impresoras por estación.

## Glossary

- **Sistema**: El sistema completo de gestión de órdenes Camarones Louisiana.
- **Gestor_Ordenes**: Componente responsable del ciclo de vida de las órdenes, sus ítems y sus estados.
- **Gestor_Menu**: Componente responsable del catálogo de platos, precios, stock y disponibilidad.
- **Gestor_Caja**: Componente responsable de las sesiones de caja y los movimientos de dinero.
- **Gestor_Pagos**: Componente responsable del registro de cobros en efectivo y transferencia.
- **Gestor_Cocina**: Componente responsable de la pantalla de cocina (KDS) y el cambio de estado de preparación.
- **Servicio_Auth**: Componente responsable de autenticación, sesión y autorización por rol/permiso (facade `AuthService`).
- **Gestor_Usuarios**: Componente responsable de la administración de usuarios, roles y permisos.
- **Registro_Auditoria**: Componente que persiste un registro inmutable de acciones sensibles (quién, qué, cuándo).
- **Notificador_Realtime**: Componente que entrega actualizaciones al cliente mediante polling (facade `RealtimeNotifier`).
- **Servicio_Almacenamiento**: Componente que persiste archivos en almacenamiento de objetos (facade `StorageService`).
- **Proveedor_UI**: Componente de interfaz que expone confirmaciones modales y mensajes toast de forma consistente.
- **Servicio_Impresion**: Componente responsable de encolar, entregar y confirmar los trabajos de impresión de comandas (cola persistente `PrintJob`).
- **Agente_Impresion**: Proceso ligero en la red local del restaurante que consulta por polling los trabajos pendientes, los convierte a ESC/POS, los envía a la impresora térmica (TCP 9100) y confirma el resultado.
- **Comanda**: Ticket físico de cocina con el número de orden, canal, mesa o dirección, hora y los ítems con sus cantidades.
- **Ticket_Adicion**: Comanda parcial con encabezado "ADICIÓN" que contiene únicamente los ítems agregados a una orden ya enviada a cocina.
- **Trabajo_Impresion**: Entidad `PrintJob` que representa una comanda por imprimir (`orderId`, `tipo` `INICIAL`/`ADICION`/`REIMPRESION`, contenido, estado `PENDIENTE`/`IMPRESO`/`FALLIDO`, intentos, timestamps).
- **Orden**: Pedido de un cliente con uno o más ítems, un canal y un estado.
- **Item_Orden**: Línea de una orden que referencia un plato del menú con una cantidad.
- **Plato**: Entrada del menú (`MenuItem`) con nombre, categoría, precio, foto, `stockDelDia` y `disponible`.
- **Canal**: Modalidad de la orden: `SALON`, `DELIVERY` o `RETIRAR`.
- **Estado_Orden**: Uno de `ABIERTA`, `ENVIADA_A_COCINA`, `EN_PREPARACION`, `LISTA`, `ENTREGADA`, `COBRADA`, `CERRADA`, `CANCELADA`.
- **Running_Tab**: Cuenta abierta de una orden que continúa acumulando ítems tras ser entregada, hasta un único cobro final.
- **Recargo_Envases**: Cargo fijo de $0.50 aplicado a las órdenes de canal `DELIVERY` o `RETIRAR`.
- **Envio**: Valor variable de la carrera de delivery (también llamado carrera).
- **Sesion_Caja**: Entidad `CajaSession` que representa la jornada de caja (`fecha`, `fondoInicial`, `estado`, `efectivoContado`, `diferencia`, `firmadoPor`).
- **Movimiento_Caja**: Entidad `MovimientoCaja` que representa un evento de dinero (`tipo`, `libro`, `monto`, `orderId?`, `categoria?`, `esCarreraPassthrough`, `empleado`, `timestamp`, `nota`).
- **Libro**: Clasificación contable de un movimiento: `EFECTIVO` o `TRANSFERENCIA`.
- **Carrera_Passthrough**: Movimiento `PAGO_CARRERA` con `esCarreraPassthrough = true`, originado por una orden de delivery pagada por transferencia.
- **Permiso_Cobrar**: Permiso asignable que habilita a un usuario a registrar cobros, independiente del rol.
- **Accion_Sensible**: Acción restringida a administrador que afecta dinero o integridad: cancelar órdenes enviadas/cobradas, descuentos/cortesías/override de precio, y apertura/cierre/ajustes de caja.

## Requirements

### Requisito 1: Autenticación con credenciales propias

**Historia de Usuario:** Como usuario operativo del restaurante, quiero iniciar sesión con mi usuario y clave, para acceder a las funciones que me corresponden.

#### Criterios de Aceptación

1. WHEN un usuario envía una solicitud de login con usuario y clave válidos, THE Servicio_Auth SHALL emitir una sesión mediante cookie firmada y otorgar acceso.
2. IF la clave enviada no coincide con el hash almacenado del usuario, THEN THE Servicio_Auth SHALL rechazar el login y responder con un mensaje de credenciales inválidas.
3. IF el usuario indicado no existe, THEN THE Servicio_Auth SHALL rechazar el login y responder con un mensaje de credenciales inválidas.
4. THE Servicio_Auth SHALL almacenar las claves de usuario como hash con bcrypt o argon2.
5. WHEN un usuario sin sesión válida solicita una ruta protegida, THE Servicio_Auth SHALL denegar el acceso y redirigir a la pantalla de login.

### Requisito 2: Autorización por rol y permiso

**Historia de Usuario:** Como administrador, quiero que cada acción esté limitada por rol y permiso, para que cada usuario solo ejecute lo que le corresponde.

#### Criterios de Aceptación

1. THE Servicio_Auth SHALL asociar a cada usuario uno o más roles del conjunto {mesero, cocina, operador, admin}.
2. WHEN un usuario solicita una acción para la cual ninguno de sus roles ni permisos está autorizado, THE Servicio_Auth SHALL denegar la acción y responder con un error de autorización.
3. WHERE un usuario tiene el Permiso_Cobrar asignado, THE Gestor_Pagos SHALL permitir a ese usuario registrar cobros.
4. WHERE un usuario no tiene el Permiso_Cobrar asignado, THE Gestor_Pagos SHALL impedir a ese usuario registrar cobros.
5. WHEN un usuario solicita ejecutar una Accion_Sensible sin el rol admin, THE Servicio_Auth SHALL denegar la acción.
6. THE Gestor_Usuarios SHALL permitir al administrador asignar y revocar roles y el Permiso_Cobrar de cualquier usuario.

### Requisito 3: Gestión del menú y disponibilidad

**Historia de Usuario:** Como administrador, quiero gestionar el menú y su disponibilidad diaria, para reflejar lo que realmente se puede vender.

#### Criterios de Aceptación

1. THE Gestor_Menu SHALL permitir al administrador crear, editar y eliminar Platos con nombre, categoría, precio, foto, `stockDelDia` y `disponible`.
2. WHEN el administrador define el `stockDelDia` de un Plato, THE Gestor_Menu SHALL registrar el valor entero indicado para ese Plato.
3. WHEN se confirma la adición de un Item_Orden, THE Gestor_Menu SHALL decrementar el `stockDelDia` del Plato correspondiente en la cantidad pedida.
4. WHEN el `stockDelDia` de un Plato alcanza 0, THE Gestor_Menu SHALL establecer `disponible = false` para ese Plato.
5. WHERE un Plato tiene `disponible = false`, THE Gestor_Ordenes SHALL impedir agregar ese Plato a una orden.
6. THE Gestor_Menu SHALL permitir al administrador establecer manualmente `disponible` y `stockDelDia` de cualquier Plato.
7. WHEN inicia un nuevo día operativo, THE Gestor_Menu SHALL reiniciar el `stockDelDia` de los Platos según la carga del administrador. *(Sujeto a confirmación de Asunción 2.)*

### Requisito 4: Creación de órdenes por canal

**Historia de Usuario:** Como mesero u operador, quiero crear una orden indicando su canal, para registrar el pedido del cliente correctamente.

#### Criterios de Aceptación

1. WHEN un usuario autorizado crea una orden de canal `SALON`, THE Gestor_Ordenes SHALL registrar la orden con el número de mesa y estado inicial `ABIERTA`.
2. WHEN un usuario autorizado crea una orden de canal `DELIVERY`, THE Gestor_Ordenes SHALL registrar la orden con los datos de dirección del cliente y estado inicial `ABIERTA`.
3. WHEN un usuario autorizado crea una orden de canal `RETIRAR`, THE Gestor_Ordenes SHALL registrar la orden con estado inicial `ABIERTA`.
4. IF un usuario crea una orden de canal `SALON` sin número de mesa, THEN THE Gestor_Ordenes SHALL rechazar la creación y solicitar el número de mesa.
5. IF un usuario crea una orden de canal `DELIVERY` sin datos de dirección del cliente, THEN THE Gestor_Ordenes SHALL rechazar la creación y solicitar la dirección.

### Requisito 5: Gestión de ítems de la orden

**Historia de Usuario:** Como mesero u operador, quiero agregar y quitar ítems de una orden, para reflejar lo que el cliente pide.

#### Criterios de Aceptación

1. WHERE una Orden está en estado `ABIERTA` o `EN_PREPARACION`, THE Gestor_Ordenes SHALL permitir agregar y quitar Items_Orden.
2. WHEN un usuario quita un Item_Orden que había decrementado stock, THE Gestor_Menu SHALL incrementar el `stockDelDia` del Plato en la cantidad correspondiente.
3. WHEN un usuario agrega un Item_Orden, THE Proveedor_UI SHALL mostrar un toast con el texto "{plato} agregado".
4. WHEN un usuario quita un Item_Orden, THE Proveedor_UI SHALL mostrar un toast sutil con el texto "{plato} quitado".
5. WHERE una Orden está en estado `ENTREGADA`, THE Gestor_Ordenes SHALL permitir agregar Items_Orden manteniendo la misma Orden abierta como Running_Tab hasta el cobro.

### Requisito 6: Ciclo de vida de la orden

**Historia de Usuario:** Como equipo del restaurante, quiero que la orden siga una máquina de estados definida, para que el flujo de trabajo sea consistente y trazable.

#### Criterios de Aceptación

1. WHEN un usuario autorizado envía una Orden en estado `ABIERTA` a cocina, THE Gestor_Ordenes SHALL cambiar el Estado_Orden a `ENVIADA_A_COCINA`.
2. WHEN cocina inicia la preparación de una Orden en estado `ENVIADA_A_COCINA`, THE Gestor_Cocina SHALL cambiar el Estado_Orden a `EN_PREPARACION`.
3. WHEN cocina marca lista una Orden en estado `EN_PREPARACION`, THE Gestor_Cocina SHALL cambiar el Estado_Orden a `LISTA`.
4. WHEN un usuario autorizado entrega o despacha una Orden en estado `LISTA`, THE Gestor_Ordenes SHALL cambiar el Estado_Orden a `ENTREGADA`.
5. WHEN se registra el cobro de una Orden en estado `ENTREGADA`, THE Gestor_Ordenes SHALL cambiar el Estado_Orden a `COBRADA`.
6. WHEN se ejecuta el cierre de una Orden en estado `COBRADA`, THE Gestor_Ordenes SHALL cambiar el Estado_Orden a `CERRADA`.
7. IF un usuario solicita una transición de estado no contemplada por la máquina de estados, THEN THE Gestor_Ordenes SHALL rechazar la transición y conservar el Estado_Orden actual.
8. WHEN un usuario autorizado cancela una Orden en estado `ABIERTA`, THE Gestor_Ordenes SHALL cambiar el Estado_Orden a `CANCELADA`.

### Requisito 7: Cancelación de órdenes enviadas o cobradas

**Historia de Usuario:** Como administrador, quiero ser el único que pueda cancelar órdenes ya enviadas o cobradas, para controlar las fugas de dinero.

#### Criterios de Aceptación

1. WHEN el administrador cancela una Orden en estado `ENVIADA_A_COCINA` o `EN_PREPARACION`, THE Gestor_Ordenes SHALL cambiar el Estado_Orden a `CANCELADA`.
2. IF un usuario sin rol admin solicita cancelar una Orden en estado `ENVIADA_A_COCINA`, `EN_PREPARACION` o `COBRADA`, THEN THE Servicio_Auth SHALL denegar la acción.
3. WHEN el administrador cancela una Orden, THE Registro_Auditoria SHALL persistir un registro con el usuario, la acción de cancelación, la orden afectada y la marca de tiempo.

### Requisito 8: Cálculo de montos de la orden

**Historia de Usuario:** Como cajero, quiero que el total de la orden se calcule de forma exacta, para cobrar el monto correcto.

#### Criterios de Aceptación

1. THE Gestor_Ordenes SHALL calcular el `subtotal` de una Orden como la suma del precio por cantidad de todos sus Items_Orden.
2. WHERE el Canal de una Orden es `DELIVERY` o `RETIRAR`, THE Gestor_Ordenes SHALL aplicar un Recargo_Envases de $0.50.
3. WHERE el Canal de una Orden es `SALON`, THE Gestor_Ordenes SHALL aplicar un Recargo_Envases de $0.00.
4. WHERE el Canal de una Orden es `DELIVERY`, THE Gestor_Ordenes SHALL permitir registrar un Envio de valor variable.
5. THE Gestor_Ordenes SHALL calcular el `total` de una Orden como `subtotal` + Recargo_Envases + Envio.

### Requisito 9: Registro de cobro

**Historia de Usuario:** Como usuario con permiso de cobro, quiero registrar el pago de una orden en efectivo o transferencia, para cerrar la venta.

#### Criterios de Aceptación

1. THE Gestor_Pagos SHALL aceptar como método de pago únicamente `EFECTIVO` o `TRANSFERENCIA`.
2. WHEN un usuario con Permiso_Cobrar registra el cobro de una Orden en estado `ENTREGADA`, THE Gestor_Pagos SHALL registrar el cobro por el `total` de la Orden y cambiar el Estado_Orden a `COBRADA`.
3. WHEN un usuario registra un cobro por `TRANSFERENCIA`, THE Servicio_Almacenamiento SHALL almacenar el comprobante de transferencia subido y asociarlo a la Orden.
4. WHEN un usuario confirma el cobro, THE Proveedor_UI SHALL solicitar confirmación con el mensaje "¿Registrar el cobro de $X en {método}?" y, al confirmar, mostrar un toast "Cobro registrado · orden #N".
5. WHEN un usuario sube un comprobante de transferencia, THE Proveedor_UI SHALL mostrar un toast con el texto "Comprobante cargado".

### Requisito 10: Apertura de caja

**Historia de Usuario:** Como administrador, quiero abrir la caja con un fondo inicial, para iniciar la jornada con el efectivo registrado.

#### Criterios de Aceptación

1. WHEN el administrador abre la caja con un fondo inicial, THE Gestor_Caja SHALL crear una Sesion_Caja con estado `ABIERTA`, la fecha y el `fondoInicial` indicado.
2. WHEN el administrador abre la caja, THE Gestor_Caja SHALL registrar un Movimiento_Caja de tipo `APERTURA` con signo positivo en el Libro `EFECTIVO` por el valor del `fondoInicial`.
3. IF un usuario sin rol admin solicita abrir la caja, THEN THE Servicio_Auth SHALL denegar la acción.
4. IF el administrador solicita abrir una caja mientras existe una Sesion_Caja en estado `ABIERTA`, THEN THE Gestor_Caja SHALL rechazar la apertura.

### Requisito 11: Registro de movimientos de caja

**Historia de Usuario:** Como administrador, quiero que todo evento de dinero quede registrado como movimiento de caja, para tener un libro mayor auditable.

#### Criterios de Aceptación

1. WHEN se registra una venta en efectivo, THE Gestor_Caja SHALL crear un Movimiento_Caja de tipo `VENTA_EFECTIVO` con signo positivo en el Libro `EFECTIVO`.
2. WHEN se registra una venta por transferencia, THE Gestor_Caja SHALL crear un Movimiento_Caja de tipo `VENTA_TRANSFERENCIA` con signo positivo en el Libro `TRANSFERENCIA`.
3. WHEN el administrador registra un pago a proveedor, THE Gestor_Caja SHALL crear un Movimiento_Caja de tipo `PAGO_PROVEEDOR` con signo negativo en el Libro `EFECTIVO`.
4. WHEN el administrador registra una compra menor, THE Gestor_Caja SHALL crear un Movimiento_Caja de tipo `COMPRA_MENOR` con signo negativo en el Libro `EFECTIVO`.
5. WHEN el administrador registra un ingreso manual, THE Gestor_Caja SHALL crear un Movimiento_Caja de tipo `INGRESO_MANUAL` con signo positivo en el Libro `EFECTIVO`.
6. WHEN el administrador registra un retiro manual, THE Gestor_Caja SHALL crear un Movimiento_Caja de tipo `RETIRO_MANUAL` con signo negativo en el Libro `EFECTIVO`.
7. THE Gestor_Caja SHALL registrar en cada Movimiento_Caja el empleado, la marca de tiempo y, cuando aplique, el `orderId` asociado.

### Requisito 12: Lógica de carrera passthrough en delivery

**Historia de Usuario:** Como administrador, quiero que la carrera de un delivery pagado por transferencia se contabilice correctamente entre libros, para que el cuadre de caja refleje la realidad.

#### Criterios de Aceptación

1. WHEN se despacha una Orden de Canal `DELIVERY` pagada por `TRANSFERENCIA`, THE Gestor_Caja SHALL crear un Movimiento_Caja de tipo `VENTA_TRANSFERENCIA` con signo positivo en el Libro `TRANSFERENCIA` por el `total` de la Orden.
2. WHEN se despacha una Orden de Canal `DELIVERY` pagada por `TRANSFERENCIA`, THE Gestor_Caja SHALL crear un Movimiento_Caja de tipo `PAGO_CARRERA` con signo negativo en el Libro `EFECTIVO` por el valor del Envio, con `esCarreraPassthrough = true`.
3. WHEN se despacha una Orden de Canal `DELIVERY` pagada por `EFECTIVO`, THE Gestor_Caja SHALL crear un Movimiento_Caja de tipo `VENTA_EFECTIVO` con signo positivo en el Libro `EFECTIVO` por el valor de `subtotal` + Recargo_Envases, sin registrar la carrera en la caja.

### Requisito 13: Cierre de caja

**Historia de Usuario:** Como administrador, quiero cerrar y firmar el día con un cuadre legible en segundos, para conciliar el efectivo físico contra lo esperado.

#### Criterios de Aceptación

1. THE Gestor_Caja SHALL calcular el `efectivoEsperado` como la suma de los montos con signo de todos los Movimientos_Caja del Libro `EFECTIVO` de la Sesion_Caja.
2. WHEN el administrador ingresa el `efectivoContado`, THE Gestor_Caja SHALL calcular la `diferencia` como `efectivoContado` − `efectivoEsperado`.
3. THE Gestor_Caja SHALL calcular el monto puente como la suma de los Movimientos_Caja de tipo `PAGO_CARRERA` con `esCarreraPassthrough = true` de la Sesion_Caja.
4. WHEN el administrador firma y cierra la Sesion_Caja, THE Gestor_Caja SHALL cambiar el estado de la Sesion_Caja a `CERRADA`, registrar `efectivoContado`, `diferencia` y `firmadoPor`, y crear un Movimiento_Caja de tipo `CIERRE`.
5. WHILE una Sesion_Caja está en estado `CERRADA`, THE Gestor_Caja SHALL impedir la edición de los Movimientos_Caja de esa sesión.
6. IF un usuario sin rol admin solicita cerrar la caja, THEN THE Servicio_Auth SHALL denegar la acción.
7. WHEN el administrador confirma el cierre del día, THE Proveedor_UI SHALL solicitar confirmación con el mensaje "No podrás editar los movimientos después de cerrar. ¿Confirmar?" y, al confirmar, mostrar un toast "Día cerrado y firmado".

### Requisito 14: Actualización en tiempo casi real de cocina

**Historia de Usuario:** Como cocina, quiero ver las órdenes activas actualizadas automáticamente, para no depender de avisos manuales.

#### Criterios de Aceptación

1. WHILE la pantalla de cocina está activa, THE Notificador_Realtime SHALL solicitar las órdenes activas en un intervalo de entre 3 y 5 segundos.
2. THE Gestor_Cocina SHALL mostrar de forma persistente la cola visual de órdenes pendientes sin depender de una señal de audio.
3. WHEN una Orden pendiente no ha sido atendida, THE Gestor_Cocina SHALL mostrar un badge destacado para esa Orden.
4. THE Gestor_Cocina SHALL exponer un control inicial para activar el sonido mediante un gesto del usuario.
5. WHILE la pantalla de cocina está activa, THE Gestor_Cocina SHALL mantener la pantalla encendida mediante la Screen Wake Lock API.
6. IF una solicitud de polling falla, THEN THE Notificador_Realtime SHALL reintentar la solicitud automáticamente.

### Requisito 15: Marcar orden lista en cocina

**Historia de Usuario:** Como cocina, quiero marcar una orden completa como lista, para avisar que está terminada.

#### Criterios de Aceptación

1. THE Gestor_Cocina SHALL marcar como `LISTA` la Orden completa, sin estaciones parciales.
2. WHEN cocina solicita marcar lista una Orden, THE Proveedor_UI SHALL solicitar confirmación con el mensaje "¿Deseas marcar la orden #N como terminada?".
3. WHEN cocina confirma marcar lista una Orden, THE Proveedor_UI SHALL mostrar un toast con el texto "Orden #N lista".

### Requisito 16: Registro de auditoría de acciones sensibles

**Historia de Usuario:** Como administrador, quiero un registro inmutable de las acciones sensibles, para saber quién hizo qué y cuándo.

#### Criterios de Aceptación

1. WHEN un administrador ejecuta una Accion_Sensible, THE Registro_Auditoria SHALL persistir un registro con el usuario, el tipo de acción, la entidad afectada y la marca de tiempo.
2. THE Registro_Auditoria SHALL incluir en su alcance las cancelaciones de órdenes enviadas o cobradas, los descuentos, cortesías y override de precio, y la apertura, cierre y ajustes de caja.
3. WHERE un usuario tiene rol admin, THE Registro_Auditoria SHALL permitir consultar el historial de registros de auditoría.
4. WHEN un usuario sin rol admin solicita consultar el Registro_Auditoria, THE Servicio_Auth SHALL denegar el acceso.

### Requisito 17: Convenciones de confirmación y accesibilidad de la interfaz

**Historia de Usuario:** Como usuario del sistema, quiero confirmaciones claras para acciones consecuentes y feedback inmediato, en una interfaz accesible, para operar con confianza y sin errores.

#### Criterios de Aceptación

1. WHEN un usuario solicita una acción consecuente o irreversible, THE Proveedor_UI SHALL presentar un modal de confirmación antes de ejecutar la acción.
2. WHEN un usuario solicita cancelar una Orden, THE Proveedor_UI SHALL presentar un modal de confirmación de tipo danger con el mensaje "Se cancelará y quedará en el historial de auditoría. ¿Continuar?".
3. WHEN un usuario solicita enviar una Orden a cocina, THE Proveedor_UI SHALL presentar un modal con el mensaje "Se enviarán N ítems a cocina. ¿Continuar?" y, al confirmar, mostrar un toast "Orden enviada a cocina".
4. WHILE un modal de confirmación está abierto, THE Proveedor_UI SHALL gestionar el foco en el modal, cerrarlo con la tecla Escape y exponerlo con `role="dialog"` y `aria-modal`.
5. THE Proveedor_UI SHALL presentar los toasts en una región `aria-live="polite"` con cierre automático en aproximadamente 2.6 segundos.
6. THE Proveedor_UI SHALL cumplir los criterios de accesibilidad WCAG 2.1 AA aplicables, incluyendo contraste de color, objetivos táctiles de al menos 44 píxeles y navegación por teclado.

### Requisito 18: Impresión de comanda en cocina

**Historia de Usuario:** Como cocina, quiero que al enviarse una orden se imprima automáticamente la comanda con todos sus ítems en la impresora de red, para tener el ticket físico sin depender solo de la pantalla.

#### Criterios de Aceptación

1. WHEN una Orden transiciona al estado `ENVIADA_A_COCINA`, THE Servicio_Impresion SHALL encolar exactamente un Trabajo_Impresion de tipo `INICIAL` con la Comanda de la Orden: número, canal, mesa o dirección según canal, hora, y todos los Items_Orden iniciales con nombre y cantidad.
2. THE Servicio_Impresion SHALL entregar los Trabajos_Impresion en estado `PENDIENTE` al Agente_Impresion mediante polling autenticado, en orden de creación (FIFO).
3. WHEN el Agente_Impresion confirma la impresión exitosa de un Trabajo_Impresion, THE Servicio_Impresion SHALL cambiar su estado a `IMPRESO` y registrar la marca de tiempo.
4. IF el Agente_Impresion reporta un fallo de impresión, THEN THE Servicio_Impresion SHALL incrementar el contador de intentos y mantener el Trabajo_Impresion como `PENDIENTE` hasta un máximo de 3 intentos, tras lo cual SHALL marcarlo como `FALLIDO`.
5. WHERE un Trabajo_Impresion está en estado `FALLIDO` o lleva más de 60 segundos en `PENDIENTE`, THE Gestor_Cocina SHALL mostrar en el KDS una alerta visible de comanda no impresa para esa Orden.
6. WHEN un usuario de cocina o administrador solicita reimprimir una Comanda, THE Servicio_Impresion SHALL encolar un nuevo Trabajo_Impresion de tipo `REIMPRESION` para esa Orden y THE Proveedor_UI SHALL mostrar un toast "Comanda enviada a impresión · orden #N".
7. IF el encolado o la impresión de la Comanda falla, THEN THE Gestor_Ordenes SHALL completar de todos modos el envío de la Orden a cocina o la adición del ítem; la impresión nunca bloquea ni revierte la operación de negocio (el KDS es la fuente de verdad).
8. THE Servicio_Impresion SHALL garantizar idempotencia: el envío inicial de una Orden a cocina genera a lo sumo un Trabajo_Impresion de tipo `INICIAL` aunque la operación se reintente.
9. WHEN se agregan Items_Orden a una Orden en estado `EN_PREPARACION` o `ENTREGADA`, THE Servicio_Impresion SHALL encolar un Trabajo_Impresion de tipo `ADICION` que contenga únicamente los ítems agregados, con encabezado "ADICIÓN" y el número de la Orden; THE Servicio_Impresion SHALL NOT reimprimir automáticamente la Comanda completa.
