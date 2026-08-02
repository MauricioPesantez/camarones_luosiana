# Retiro de caja por empleados

Fecha: 2026-08-01
Rama base: `claude/employee-cash-withdrawal-1b479a`

## Problema

El local paga gastos menores con la plata de la caja (comprar un implemento,
adelantar dinero a un empleado). Hoy ese dinero sale sin registro, así que el
cuadre del día miente: `efectivoEnCaja` dice que debe haber X y físicamente hay
menos, sin ninguna explicación en el sistema.

Estado del código relevante:

- `calcularResumenCuadre` (`types/cuadre.ts:40`) es una función pura que deriva
  la caja **únicamente de las órdenes**. No hay ninguna entidad de egreso.
- `GET /api/admin/cuadre` devuelve las órdenes del día (rango horario de
  `America/Guayaquil`) y el panel admin filtra y recalcula en el cliente
  (`app/admin/page.tsx:308`).
- El dinero se guarda como `Decimal(10,2)` y se calcula en centavos enteros
  dentro de la función pura. Ese patrón se respeta.
- Las validaciones de entrada viven en módulos puros con tests
  (`lib/admin-validaciones.ts`, `lib/cuadre.test.ts`).

El retiro introduce la **segunda fuente de verdad del efectivo**. Ese es el
cambio estructural: la caja deja de ser una proyección de las órdenes y pasa a
ser `ventas − egresos`.

## Decisiones tomadas por el dueño del proyecto

1. **Registro directo con anulación del admin.** El retiro descuenta de caja al
   instante. No hay flujo de aprobación previa. El admin lo ve en el cuadre y
   puede anularlo con razón obligatoria. Nunca se edita ni se borra.
2. **Siempre efectivo.** El retiro solo resta de `efectivoEnCaja`. No hay campo
   de método de pago.
3. **Campos:** categoría de catálogo + motivo en texto libre obligatorio. La
   categoría `adelanto` habilita un selector de usuario beneficiario. Sin tope
   máximo de negocio y sin número de comprobante.
4. **Solo rol `mesero` registra retiros** (por ahora). El admin anula.

## Alcance

Dentro:

- Modelo `RetiroCaja` persistido, inmutable, con anulación lógica.
- API de creación, consulta y anulación.
- Extensión de `calcularResumenCuadre` para restar retiros del efectivo.
- Pantalla del mesero para registrar y ver sus retiros del día.
- Sección del admin en el cuadre para ver y anular.
- Validación pura con tests.

Fuera:

- Autenticación de servidor (ver "Riesgo asumido").
- Fondo inicial de caja / saldo real. `efectivoEnCaja` sigue siendo "lo que
  debe haber por la operación del día", no un saldo contable.
- Impresión de comprobante. `PrintJob` tiene FK obligatoria a `Orden`; imprimir
  un retiro exige tocar el esquema de impresión y su worker.
- Adelantos como entidad de nómina (saldo acumulado por empleado, descuentos).
  Aquí `adelanto` es solo una categoría de egreso.
- Retiros por rol `admin` o `digital`. Es un cambio de una línea cuando se
  quiera.

## Riesgo asumido

Igual que en el diseño de menú y usuarios: **esta feature no arregla la
autenticación**. `lib/auth.ts` lee `localStorage` en el cliente y ninguna ruta
`/api/*` valida sesión.

Consecuencia concreta y nueva: cualquiera con acceso de red puede hacer
`POST /api/retiros` con un `usuarioId` válido y fabricar una salida de dinero a
nombre de un mesero. No es peor estructuralmente que poder crear o cobrar
órdenes hoy, pero es la primera ruta cuyo único efecto es **reducir el dinero
que se le exige a la caja** — es decir, la que sirve directamente para tapar un
faltante.

Mitigaciones que sí entran en esta feature, todas de servidor:

1. `usuarioId` se verifica contra la base: debe existir, estar `activo` y tener
   rol `mesero`. No se confía en el cliente.
2. El nombre y el rol se toman de la base, nunca del body. El body no puede
   inventar autoría.
3. Registro inmutable: no hay `PUT` ni `DELETE`. Solo `anular` con razón,
   ejecutable únicamente por un usuario con rol `admin` verificado en servidor.
4. `clientRequestId` único: el doble clic o el reintento de red no duplican un
   egreso.

Lo que queda pendiente y debería ser el siguiente trabajo: sesión de servidor
firmada, de la que se derive el usuario en vez de recibirlo por body.

## Modelo de datos

```prisma
model RetiroCaja {
  id                 String    @id @default(cuid())
  monto              Decimal   @db.Decimal(10, 2)
  categoria          String    // ver CATEGORIAS_RETIRO
  motivo             String
  // Quien saca el dinero. Snapshot igual que Orden.creadorRol: el rol del
  // usuario puede cambiar y el cuadre historico no debe moverse.
  usuarioId          String
  usuario            Usuario   @relation("RetirosRegistrados", fields: [usuarioId], references: [id])
  usuarioNombre      String
  usuarioRol         String
  // Solo para categoria "adelanto": a quien se le entrega.
  beneficiarioId     String?
  beneficiario       Usuario?  @relation("AdelantosRecibidos", fields: [beneficiarioId], references: [id], onDelete: SetNull)
  beneficiarioNombre String?
  estado             String    @default("registrado") // "registrado" | "anulado"
  anuladoPorId       String?
  anuladoPor         Usuario?  @relation("RetirosAnulados", fields: [anuladoPorId], references: [id])
  anuladoPorNombre   String?
  razonAnulacion     String?
  anuladoAt          DateTime?
  /** Idempotencia: el mismo envio reintentado no duplica el egreso. */
  clientRequestId    String    @unique
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([createdAt])
  @@index([usuarioId, createdAt])
}
```

`Usuario` suma tres relaciones inversas (`retirosRegistrados`,
`adelantosRecibidos`, `retirosAnulados`). Son aditivas, no tocan nada existente.

Decisión: **no se guarda `fechaLocal`.** `Orden.fechaNumeroDiario` existe por la
restricción única del contador diario, no para agrupar. El cuadre ya define "el
día" como un rango sobre `createdAt` en `America/Guayaquil`; duplicar esa noción
en una columna denormalizada crea dos verdades que pueden divergir. Los retiros
se consultan con exactamente el mismo rango que las órdenes.

Trade-off: si algún día el volumen crece, un índice sobre una columna `fecha`
sería más barato que un rango sobre `createdAt`. A decenas de filas por día no
se nota, y la consistencia vale más.

### Catálogo (`types/retiro.ts`)

```ts
export const CATEGORIAS_RETIRO = [
  { value: 'insumos',       label: 'Insumos / mercadería' },
  { value: 'limpieza',      label: 'Limpieza' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'transporte',    label: 'Transporte' },
  { value: 'adelanto',      label: 'Adelanto a empleado' },
  { value: 'otro',          label: 'Otro' },
] as const;
```

Mismo patrón que `ROLES`, `NIVELES_PICANTE` y `METODOS_PAGO`: constante con
`esCategoriaRetiro()` como type guard y `obtenerEtiquetaCategoriaRetiro()`.
`adelanto` es el único valor que exige `beneficiarioId`; esa regla vive en la
validación pura, no repartida por la UI.

## Cálculo del cuadre

`types/cuadre.ts` extiende la función pura, sin cambiar su naturaleza:

Se apoya sobre la corrección del envío, que ya está aplicada: `ResumenCuadre`
ahora expone `ventasTotales`, `ventasCobradas`, `ventasSinCobrar`,
`transferenciasVentas`, `depositosRecibidos` y `enviosMotorizados`, y ninguna
cifra de venta contiene el costo de envío.

```ts
export interface RetiroParaCuadre {
  monto: number | string;
  estado: string;
}

export interface ResumenCuadre {
  // ...campos actuales
  retirosEfectivo: number;   // suma de retiros en estado "registrado"
  cantidadRetiros: number;
  efectivoEnCaja: number;    // ahora: ventas + motorizados − entregas − retiros
}

export function calcularResumenCuadre(
  ordenes: readonly OrdenParaCuadre[],
  retiros: readonly RetiroParaCuadre[] = [],
): ResumenCuadre
```

Puntos del diseño:

- Segundo parámetro **opcional con default `[]`**: todo call site existente
  sigue compilando y, sin retiros, el número es idéntico al de hoy.
- Los retiros anulados se excluyen de la suma pero se devuelven al admin para
  que la anulación sea visible. Nunca desaparecen.
- La suma se hace en centavos enteros con los helpers `aCentavos`/`aDolares` ya
  presentes. Sin floats.
- `efectivoEnCaja` puede quedar negativo si se retira más de lo vendido. Es un
  dato real, no un error: se muestra tal cual, en rojo.
- `lib/cuadre.test.ts` se rompe a propósito (la aserción `deepEqual` del resumen
  gana dos campos). Es la señal correcta: cambió el contrato del cuadre.

## API

Todo bajo `app/api/retiros/`. Validación en `lib/retiros-validaciones.ts`,
copiando el estilo de `lib/admin-validaciones.ts` (`ErrorValidacion`, `ejecutar`,
`ResultadoValidacion<T>`), de modo que las reglas se testean sin base de datos.

### `POST /api/retiros`

Body: `{ usuarioId, categoria, motivo, monto, beneficiarioId?, clientRequestId }`

Validación pura:

- `monto` numérico finito, `> 0`, redondeado a 2 decimales igual que `precio()`.
  Techo duro de sanidad `9999.99` — no es un tope de negocio, es el límite de
  `Decimal(10,2)` y un freno a errores de tipeo (`5000` en vez de `50.00`).
- `categoria` dentro del catálogo.
- `motivo` texto no vacío, recortado.
- `beneficiarioId` obligatorio si y solo si `categoria === 'adelanto'`; se
  rechaza si viene con cualquier otra categoría. Un mesero puede ser su propio
  beneficiario.
- `clientRequestId` obligatorio, texto no vacío.

Validación contra base:

- `usuarioId` → existe, `activo`, `rol === 'mesero'`. Si no: `403`.
- `beneficiarioId` → existe y `activo`. Si no: `400`.
- Snapshot de `usuarioNombre`, `usuarioRol`, `beneficiarioNombre` desde la base.

Idempotencia: si el `create` choca con la unicidad de `clientRequestId`
(Prisma `P2002`), se devuelve el registro existente con `200` en vez de un
error. Mismo espíritu que `dedupeKey` en `PrintJob`.

### `GET /api/retiros?fecha=YYYY-MM-DD&usuarioId=<id>`

Devuelve los retiros del día usando el mismo rango horario. `usuarioId` es
opcional: la pantalla del mesero lo envía para ver solo los suyos.

### `PATCH /api/retiros/[id]/anular`

Body: `{ adminId, razon }`.

- `adminId` → existe, `activo`, `rol === 'admin'`. Si no: `403`.
- `razon` obligatoria.
- Anulación optimista con el patrón ya usado en cobrar:
  `updateMany({ where: { id, estado: 'registrado' } })` y verificación de
  `count === 1`; si no, `409` ("el retiro ya fue anulado").

### `GET /api/admin/cuadre` (extensión)

Devuelve `{ fecha, zonaHoraria, ordenes, retiros }`. Los retiros se traen en el
mismo `Promise.all` y con el mismo rango. Un solo viaje, una sola noción de día.

`obtenerRangoEcuador` se extrae de `app/api/admin/cuadre/route.ts` a
`lib/fecha-ecuador.ts` para que la ruta de retiros use exactamente la misma
función, con test propio (incluida la validación de fechas imposibles tipo
`31/02` que ya contempla).

## Filtros del panel admin

Aquí está la trampa fácil de pasar por alto. El admin filtra por rol creador,
usuario creador, tipo de orden y estado de cobro
(`app/admin/page.tsx:297-308`). Los retiros no tienen tipo de orden ni estado de
cobro. Si se suman ciegamente, el admin puede ver un `efectivoEnCaja` que mezcla
*un subconjunto* de ventas con *todos* los retiros: un número sin significado.

Regla:

| Filtro activo | Efecto sobre los retiros |
|---|---|
| Rol que creó / Usuario creador | **Se aplica** (contra `usuarioRol` / `usuarioNombre` del retiro) |
| Tipo de orden ≠ todos | Los retiros se **excluyen** del cálculo |
| Estado de cobro ≠ todos | Los retiros se **excluyen** del cálculo |

Cuando quedan excluidos, la tarjeta de efectivo muestra el aviso "Retiros
excluidos por los filtros de orden aplicados", para que nadie lea el número como
si fuera la caja completa.

## Interfaz

**Mesero** (`app/mesero/page.tsx`): tercera pestaña `💸 Retiro de caja` junto a
`➕ Crear Orden` y `📋 Mis Órdenes`, siguiendo el mismo `vistaActiva`. Componente
nuevo `components/mesero/RetiroCaja.tsx`:

- Formulario: monto, categoría (select), beneficiario (select de usuarios
  activos, visible solo con `adelanto`), motivo (textarea).
- El `clientRequestId` se genera con `crypto.randomUUID()` al montar el
  formulario y se renueva tras un envío exitoso.
- Botón deshabilitado mientras se envía; el servidor sigue siendo la garantía.
- Debajo, lista de los retiros del día del propio usuario, con hora, categoría,
  monto y estado. Los anulados se ven tachados con la razón. El mesero no puede
  anular ni editar.

**Admin** (`app/admin/page.tsx`): sección "Retiros de caja" inmediatamente bajo
el Cuadro de caja. Tabla: hora, usuario, categoría, beneficiario, motivo, monto,
estado, acción. Botón "Anular" abre un modal con razón obligatoria, reutilizando
el patrón visual del modal de aprobación de stock.

En el Cuadro de caja se agrega una tarjeta `🧾 Retiros de caja` con
`−$retirosEfectivo` y el conteo, en la fila de desglose junto a "Cobrado a
motorizados" y "Entregado a motorizados", donde ya se leen sumas y restas.

## Tests

Siguiendo la convención del repo (`node:assert/strict` + `ts-node`, un script
por archivo en `package.json`):

- `lib/cuadre.test.ts` (extendido): retiros restan del efectivo; los anulados no
  cuentan; sin error de punto flotante (`0.1 + 0.2`); lista vacía produce el
  resultado actual; efectivo negativo se reporta tal cual.
- `lib/retiros-validaciones.test.ts` (nuevo): monto `0`, negativo, no numérico,
  con tres decimales, sobre el techo; categoría fuera del catálogo; motivo
  vacío; `adelanto` sin beneficiario; beneficiario con categoría que no es
  `adelanto`; `clientRequestId` ausente.
- `lib/fecha-ecuador.test.ts` (nuevo): el rango cubre el día local completo;
  rechaza formato inválido y fechas imposibles.

Scripts: `test:retiros-validaciones`, `test:fecha-ecuador`, y `test:cuadre` ya
existe.

## Migración

Un solo archivo SQL escrito a mano, `prisma/migrations/<ts>_add_retiro_caja/`:
`CREATE TABLE "RetiroCaja"`, el índice único de `clientRequestId`, los dos
índices de consulta y las tres FKs a `Usuario`. **Sin backfill** — no hay
historia que recuperar. Es puramente aditiva: ninguna tabla ni columna existente
se toca, así que no puede romper el cuadre histórico ni la impresión.

## Plan de ejecución

Cada fase deja el repo compilando y con tests en verde.

1. `types/retiro.ts` (catálogo + guards), `schema.prisma`, migración SQL.
2. `lib/fecha-ecuador.ts` extraído + test; `app/api/admin/cuadre/route.ts` pasa
   a usarlo (refactor sin cambio de comportamiento).
3. `lib/retiros-validaciones.ts` + tests.
4. `POST`/`GET /api/retiros` y `PATCH /api/retiros/[id]/anular`.
5. `calcularResumenCuadre` con retiros + tests; `GET /api/admin/cuadre` devuelve
   `retiros`.
6. UI mesero (`components/mesero/RetiroCaja.tsx` + pestaña).
7. UI admin (tarjeta, tabla, modal de anulación, regla de filtros).

## Qué revisaría cuando el sistema crezca

- **Sesión de servidor.** Es la pieza que convierte todos estos guards de rol en
  seguridad real. Mientras no exista, el registro inmutable y la auditoría son
  la defensa: no impiden el fraude, lo dejan visible.
- **Adelantos como entidad propia.** Si empiezan a necesitar saldo acumulado por
  empleado y descuento en el pago, `RetiroCaja` deja de alcanzar y `adelanto`
  debería migrar a su propio modelo, dejando aquí solo el egreso de efectivo.
- **Fondo inicial de caja.** Hoy `efectivoEnCaja` es un delta de la operación
  del día, no un saldo. El día que se registre una base inicial, los retiros ya
  encajan sin cambios en el modelo.
- **Retiros por otros roles.** El guard de rol está en un solo punto de la
  validación de servidor; ampliarlo es cambiar una constante.
