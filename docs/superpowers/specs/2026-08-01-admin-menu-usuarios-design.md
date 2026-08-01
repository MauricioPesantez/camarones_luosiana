# Gestión de menú y usuarios desde el panel admin

Fecha: 2026-08-01
Rama base: `feature/print`

## Problema

El panel de administración no permite dar de alta productos ni usuarios. Para
agregar un plato al menú o registrar a un empleado nuevo hay que entrar a la
base de datos a mano. Lo único que existe hoy es el ajuste de stock en
`/admin/productos`.

Estado del código relevante:

- `POST /api/productos` existe pero solo guarda `nombre`, `categoria`, `precio`
  y `descripcion`; ignora `stock`, `stockMinimo`, `tiempoPreparacion` y
  `disponible`. No valida nada.
- `POST /api/usuarios` existe pero descarta el campo `password` sin avisar: todo
  usuario creado por ahí queda sin contraseña, y el login solo pide clave a
  quien tiene una.
- No hay ninguna interfaz de usuarios.
- `GET /api/productos` filtra `disponible: true`, así que desactivar un producto
  ya es el mecanismo para sacarlo del menú.

## Alcance

Dentro:

- CRUD de productos sin borrado físico (crear, editar, activar/desactivar).
- CRUD de usuarios sin borrado físico, incluyendo fijar, cambiar y quitar
  contraseña.
- Pantallas nuevas dentro del panel admin.
- Validación compartida con pruebas.

Fuera:

- Cambios al esquema de autenticación (ver "Riesgo asumido").
- Borrado físico de productos o usuarios.
- Categorías como entidad propia: siguen siendo texto libre en `Producto`.
- Pruebas de componentes: el proyecto no tiene infraestructura para eso.

## Riesgo asumido

Decisión explícita del dueño del proyecto: esta feature no modifica la
autenticación. Consecuencias que quedan en pie:

1. Todas las rutas bajo `/api/*` son públicas. No hay sesión de servidor:
   `lib/auth.ts` lee `localStorage` en el cliente. Cualquiera con acceso de red
   a la aplicación puede llamar a `POST /api/usuarios` y crearse una cuenta con
   rol `admin`. Esta feature amplía la superficie porque agrega escritura de
   precios y de usuarios por API.
2. Las contraseñas se guardan y comparan en texto plano
   (`app/api/auth/login/route.ts` hace `usuario.password === password`). Las
   claves que se creen desde el panel se guardarán igual, porque hashearlas
   rompería el login actual.
3. Un usuario sin contraseña entra al sistema con solo elegir su nombre en la
   pantalla de login.

El guard de rol admin en las pantallas nuevas es de interfaz, no de seguridad:
evita accidentes, no ataques.

Si más adelante se decide endurecer esto, el camino es: cookie httpOnly firmada
emitida en el login, validación de rol en el servidor para las rutas admin, y
bcrypt con migración de las claves viejas al primer login. Nada del diseño de
abajo estorba ese cambio.

## Datos

Sin migración de Prisma. `Producto` y `Usuario` ya tienen todos los campos
necesarios.

Constante nueva en `types/usuario.ts`:

```ts
export const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'mesero', label: 'Mesero' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'digital', label: 'Canal digital' },
] as const;
```

Son los cuatro roles que `lib/auth.ts` ya reconoce en `rolRedirects`.

## API

### `GET /api/productos`

Acepta `?vista=admin`. Sin el parámetro sigue devolviendo solo
`disponible: true`, que es lo que consumen mesero, cocina y digital. Con el
parámetro devuelve todos, ordenados igual.

### `GET /api/usuarios`

Acepta el mismo `?vista=admin`: devuelve activos e inactivos, cada uno con un
booleano `tienePassword` en lugar de la contraseña. Sin el parámetro responde
exactamente como hoy (solo activos, sin `tienePassword`), porque la pantalla de
login consume este endpoint y no debe cambiar.

### `POST /api/productos`

Pasa por `validarProducto`. Cuerpo:

```
nombre*, categoria*, precio*, descripcion?, tiempoPreparacion?,
stock?, stockMinimo?, disponible?
```

Respuestas: `201` con el producto, `400` con `{ error }` si la validación falla,
`409` si ya existe un producto con el mismo nombre (comparación
case-insensitive).

### `PATCH /api/productos/[id]`

Archivo nuevo. Acepta los mismos campos, todos opcionales; solo se escriben los
presentes. `404` si el producto no existe, `400` y `409` igual que en el POST.
Desactivar un producto es `PATCH { disponible: false }`.

### `POST /api/usuarios`

Pasa por `validarUsuario`. Cuerpo: `nombre*`, `rol*`, `password?`, `activo?`.
Una `password` vacía o ausente se guarda como `null`. `409` si ya existe un
usuario activo con el mismo nombre, comparado sin distinguir mayúsculas. La
respuesta nunca incluye `password`.

### `PATCH /api/usuarios/[id]`

Se agrega al archivo existente `app/api/usuarios/[id]/route.ts`. Campos
opcionales `nombre`, `rol`, `activo`, `password`. Semántica de la clave:

- Campo ausente: no se toca.
- String no vacío: se reemplaza.
- `null` explícito: se borra la clave y el usuario pasa a entrar sin contraseña.

`404` si no existe, y `409` si el `nombre` nuevo choca con otro usuario activo.
La respuesta nunca incluye `password`; igual que el `GET` actual, expone solo un
booleano que indica si tiene clave.

El mismo chequeo de duplicado por nombre aplica al renombrar un producto.

### Validación

`lib/admin-validaciones.ts`, funciones puras que no tocan Prisma y devuelven
`{ ok: true, data }` o `{ ok: false, error }`:

- `validarProducto(body, { parcial })`
- `validarUsuario(body, { parcial })`

Reglas:

- `nombre` y `categoria`: string no vacío tras `trim`.
- `precio`: número finito mayor que 0, redondeado a 2 decimales para calzar con
  `Decimal(10, 2)`.
- `stock`, `stockMinimo`, `tiempoPreparacion`: enteros mayores o iguales a 0.
- `rol`: uno de `ROLES`.
- `disponible`, `activo`: booleanos.
- `password`: string; vacío se normaliza a `null`.

El modo `parcial` es el que usan los PATCH: valida solo las claves presentes y
no exige las obligatorias.

La detección de duplicados vive en las rutas, no en las funciones puras, porque
necesita consultar la base.

## UI

### `/admin/productos` con pestañas

La página actual tiene 371 líneas dedicadas al stock. Se extraen sin cambios de
comportamiento a `components/admin/GestionStock.tsx`, y la página queda como
shell con dos pestañas: **Stock** (por defecto, para no alterar el flujo actual)
y **Menú**. El estado de la pestaña es local; no se refleja en la URL.

### Pestaña Menú

Vive en `components/admin/GestionMenu.tsx`, igual que la pestaña de stock vive
en su propio componente. Carga `GET /api/productos?vista=admin`; es la única
vista que muestra
productos desactivados. Mismo patrón responsive que el resto del panel:
tarjetas en móvil, tabla en escritorio con las columnas Producto, Categoría,
Precio, Estado y Acciones. Badge Activo/Inactivo con el estilo de los badges de
stock existentes. Botón **+ Nuevo producto** arriba de la lista. Por fila,
**Editar** y **Activar/Desactivar**.

### `/admin/usuarios`

Ruta nueva, enlazada con un botón `👥 Usuarios` en el header de `/admin`, junto
a Reportes y Productos. Lista con nombre, rol, estado y si tiene contraseña.
Acciones por fila: **Editar** y **Activar/Desactivar**.

### Modales

- `components/admin/ModalFormulario.tsx`: solo el envoltorio (overlay, título,
  botón de cerrar).
- `components/admin/FormularioProducto.tsx`: nombre, categoría, precio,
  descripción, tiempo de preparación, stock mínimo y checkbox *Disponible en el
  menú*. La categoría es un `input` con `datalist` alimentado por las categorías
  existentes, para evitar que "Bebidas" y "bebidas" convivan como categorías
  distintas. **Stock inicial solo se muestra al crear**: si también se editara
  aquí habría dos pantallas escribiendo el mismo campo, y la pestaña Stock ya
  tiene la lógica de agregar contra establecer.
- `components/admin/FormularioUsuario.tsx`: nombre, rol (select con `ROLES`) y
  clave opcional. Al editar, el campo de clave vacío significa "no cambiar", y
  hay un botón aparte de **Quitar clave**. Cuando el usuario queda sin clave, el
  formulario lo dice de forma explícita: entra al sistema sin contraseña.

Cada formulario recibe un registro para editar o nada para crear; esa es la
única diferencia entre ambos modos.

### Protecciones de interfaz

- El guard existente: `usuario.rol !== "admin"` muestra "Acceso denegado".
- No puedes desactivarte a ti mismo ni quitarte tu propio rol admin. Es la
  manera fácil de quedar fuera del panel sin forma de volver a entrar.

### Errores y estados

Los errores del API se muestran dentro del modal, junto al botón de guardar, no
con `alert()`: el mensaje del `400` o `409` es específico y conviene leerlo al
lado del campo que lo causó. Los errores de las acciones de lista
(activar/desactivar) siguen usando `alert()`, como el resto de la página. Al
guardar con éxito, se recarga la lista y se cierra el modal.

## Pruebas

`lib/admin-validaciones.test.ts`, con `node:assert/strict` y un `run()` al
final, igual que `lib/printer.test.ts`. Se agrega
`test:admin-validaciones` a los scripts de `package.json`.

Casos:

- Producto válido: normaliza `trim` en nombre y categoría, redondea el precio a
  dos decimales.
- Precio cero, negativo o no numérico: rechazado.
- Nombre o categoría vacíos o solo espacios: rechazados.
- Stock, stock mínimo o tiempo negativos o no enteros: rechazados.
- Modo parcial: acepta un cuerpo con solo `precio` y no exige nombre.
- Usuario con rol fuera de `ROLES`: rechazado.
- `password: ""` se normaliza a `null`; `password` ausente en modo parcial no
  aparece en el resultado.

Verificación manual antes de dar por cerrado: crear un producto y confirmar que
aparece en la pantalla del mesero; desactivarlo y confirmar que desaparece de
ahí pero sigue en la pestaña Menú; crear un usuario con clave y entrar con él;
quitarle la clave y confirmar que entra sin ella.

## Archivos

Nuevos:

- `types/usuario.ts`
- `lib/admin-validaciones.ts`
- `lib/admin-validaciones.test.ts`
- `app/api/productos/[id]/route.ts`
- `app/admin/usuarios/page.tsx`
- `components/admin/GestionStock.tsx`
- `components/admin/GestionMenu.tsx`
- `components/admin/ModalFormulario.tsx`
- `components/admin/FormularioProducto.tsx`
- `components/admin/FormularioUsuario.tsx`

Modificados:

- `app/api/productos/route.ts`
- `app/api/usuarios/route.ts`
- `app/api/usuarios/[id]/route.ts`
- `app/admin/productos/page.tsx`
- `app/admin/page.tsx` (botón Usuarios en el header)
- `package.json` (script de pruebas)
