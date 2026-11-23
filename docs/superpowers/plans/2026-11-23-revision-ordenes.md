# Bitácora de revisión de órdenes — plan

> **Para quien ejecuta:** usar superpowers:executing-plans o superpowers:subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Goal:** el admin revisa las órdenes del día una por una, anota errores con botones y los consulta en una bitácora, sin cambiar órdenes ni cálculos.

**Architecture:** una tabla nueva guarda una revisión por orden con la foto de lo que el sistema decía. Funciones puras en `types/revision.ts` deciden qué marca sigue vigente; las usan servidor y pantalla. Las revisiones se agregan en la ruta del cuadre, nunca en `obtenerDatosCuadre`.

**Tech Stack:** Next.js 16, React 19, Prisma 5 / PostgreSQL, Tailwind 4, ts-node + `node:assert`. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-23-revision-ordenes-design.md`

## Global Constraints

- La bitácora solo escribe en `RevisionOrden`. Nunca en `Orden`, `Item`, `Cobro`, `Producto`, `SesionCaja`, `PrintJob`, `WhatsappSalida` ni `HistorialOrden`.
- `lib/cuadre-server.ts`, `types/cuadre.ts`, `lib/resumen-cierre.ts` y `lib/ordenes-mesero.ts` no se modifican.
- Las tres rutas exigen admin en el servidor: 401 sin sesión, 403 con otro rol.
- Textos exactos: "Está mal", "Quitar error", "Faltó un producto", "Lo demás está bien", "Todo está bien", "Marcar revisada", "Quitar revisada", "No iba en la orden", "Se guarda solo. No cambia la orden ni la caja.".
- Límites: cantidad real 0 a 99; faltantes hasta 50 líneas, cantidad 1 a 99, una por producto; diferencia mayor que 0 y hasta 9999.99, dos decimales.
- Contraste 4.5:1, botones de 44 px, sin desbordes desde 320 px, foco conservado al marcar.
- Las fechas son de Ecuador (`obtenerRangoEcuador`, `obtenerFechaEcuador`).
- No se aplica la migración a ninguna base desde aquí. No hay commit sin que el usuario lo pida. No tocar `graphify-out/` ni `whatsapp-agent/docker-compose.yml`, ya modificados.

## Review Focus

- La respuesta del guardado se pierde y se reintenta: éxito, no "otro guardó primero" (Task 2).
- La orden cambió con la pantalla abierta: 409; nunca se aprueba algo que el admin no vio (Task 2).
- Toques rápidos con red lenta: gana el último toque y los envíos no se cruzan (Task 4).
- Orden de ayer pagada hoy, vista en ambos días: la misma revisión sigue vigente (Task 1).
- Producto quitado después de revisar, incluso una cortesía de $0: vuelve a "sin revisar" (Task 1).

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `types/revision.ts` | Tipos y reglas puras |
| `prisma/schema.prisma`, migración, `lib/db.ts` | Tabla |
| `app/api/admin/ordenes/[id]/revision/route.ts` | Guardar |
| `app/api/admin/cuadre/route.ts` | Entregar revisiones del día |
| `lib/bitacora-revision.ts`, `app/api/admin/reportes/revision/route.ts` | Reporte |
| `components/admin/revision/cola-guardado.ts` | Guardado en orden |
| `components/admin/revision/RevisionOrdenes.tsx` | Pantalla: lista, avance, navegación |
| `components/admin/revision/OrdenEnRevision.tsx` | Una orden: productos, cobro, total, pie |
| `components/admin/reportes/BitacoraErrores.tsx` | Pestaña del reporte |

---

### Task 1: Reglas puras

**Files:** Create `types/revision.ts`. Test `types/revision.test.ts`. Modify `package.json` (`test:revision`, mismo formato que `test:cuadre`).

**Interfaces — Produces** (importa solo `./orden` y `./cobro`, con ruta relativa):

```ts
export type MarcaProducto =
  | { itemId: string; estado: "bien" }
  | { itemId: string; estado: "mal"; cantidadReal: number };
export type MarcaCobro = "bien" | "efectivo" | "transferencia" | "mixto" | null;
export type MarcaTotal =
  | { estado: "bien" }
  | { estado: "de_mas" | "de_menos"; diferencia: number }
  | null;
export interface MarcasRevision {
  productos: MarcaProducto[];
  faltantes: { productoId: string; cantidad: number }[];
  cobro: MarcaCobro;
  total: MarcaTotal;
}
export interface OrdenRevisable {
  tipoOperacion?: string; empleadoId?: string | null; anulada: boolean; estado: string;
  total: number | string; montoPagado: number | string;
  items: { id: string; cantidad: number; nivelPicante?: string | null;
    precioUnitario: number | string; esCortesia?: boolean;
    nombreProducto?: string | null; producto: { nombre: string } }[];
  pagos?: readonly { metodoPago: string; monto: number | string; estado?: string | null }[]; // ausente = []
}
export interface DetalleRevision { /* productos, faltantes, cobro, total según "Datos" del spec;
  productos, cobro y total pueden faltar mientras no se marquen */ }
export interface RevisionGuardada {
  ordenId: string; detalle: DetalleRevision; revisada: boolean; conErrores: boolean;
  version: number; revisadaPorNombre: string | null; revisadaAt: string | null;
}
export interface SolicitudRevision {
  marcas: MarcasRevision; revisada: boolean; version: number; huella: string;
}
export type TipoError = "falto" | "no_iba" | "cantidad" | "metodo" | "total";
export interface ErrorRevision { tipo: TipoError; texto: string; de: "creador" | "cobrador" }

export function sePuedeRevisar(orden: OrdenRevisable): boolean;
export function llevaCobro(orden: OrdenRevisable): boolean;
export function metodoRegistrado(orden: OrdenRevisable): MetodoPago | "mixto" | null;
export function huellaOrden(orden: OrdenRevisable): string;
export function validarSolicitud(raw: unknown):
  | { ok: true; data: SolicitudRevision } | { ok: false; error: string };
export function construirDetalle(orden: OrdenRevisable, marcas: MarcasRevision,
  catalogo: ReadonlyMap<string, { nombre: string; precio: number | string }>):
  | { ok: true; detalle: DetalleRevision } | { ok: false; error: string };
export function marcasVigentes(orden: OrdenRevisable, detalle: DetalleRevision | null):
  { marcas: MarcasRevision; cambios: string[] };
export function pendientes(orden: OrdenRevisable, marcas: MarcasRevision):
  { productos: string[]; cobro: boolean; total: boolean; cuantos: number };
export function erroresDe(detalle: DetalleRevision): ErrorRevision[];
export function estadoRevision(orden: OrdenRevisable, revision: RevisionGuardada | null):
  "sin_revisar" | "cambio" | "bien" | "con_errores";
```

`huellaOrden` es `JSON.stringify` de items ordenados por id (id, cantidad, picante, precio en centavos), pagos sin los `REEMBOLSADO` ordenados (método, centavos) y total en centavos. Todo dinero se compara en centavos: Prisma entrega texto y la pantalla, número.

- [ ] **Step 1: Test que falla.** Fixture `base`: 2 Combo Simple leve a 9.50 (`i1`), 1 Cerveza a 2.00 (`i2`), total 21, un pago de transferencia de 21. Aserciones:
  - `sePuedeRevisar`: base sí; `anulada`, estados `cancelada` y `pendiente_aprobacion_stock`, y `CONSUMO_EMPLEADO`, no; con `empleadoId` y por cobrar, sí.
  - `llevaCobro`: base sí; con `empleadoId` no; total 0 sin pagos no; por cobrar de $14 sí.
  - `metodoRegistrado`: `transferencia`; dos métodos → `mixto`; sin pagos → `null`; un pago `REEMBOLSADO` no cuenta.
  - `huellaOrden(base)` es igual con `"21.00"` y `21`, y con items o pagos en otro orden; distinta si cambia cantidad, picante, pago o total.
  - `pendientes(base, vacías).cuantos === 4`; con todo marcado `0`; con `empleadoId` no pide cobro.
  - `validarSolicitud` rechaza: `cantidadReal` -1, 100 y 1.5; `itemId` repetido; 51 faltantes; faltante con cantidad 0 o repetido; diferencia 0, 10000 y 1.001; cobro `tarjeta`; `version` -1; `huella` vacía; `revisada` que no es booleano; cuerpo `null`.
  - `construirDetalle` rechaza item de otra orden, `cantidadReal` igual a la registrada, cobro real igual a `metodoRegistrado` (también mixto con mixto), cobro en una orden sin cobro y faltante fuera del catálogo; guarda nombre, precio y total de la orden, no los del cliente.
  - `marcasVigentes`: sin cambios devuelve lo mismo y `cambios` vacío. Cambia cantidad de `i2` → solo `i2` sin marca y `cambios` la nombra. Cambia picante de `i1` → solo `i1`. Pago pasa a efectivo → solo cobro. Total 23 → solo total. Producto nuevo → queda pendiente y se nombra. Item de $0 quitado → `cambios` lo nombra.
  - Misma orden con `cobrada: false` y `metodoPago: null` (vista en otro día): sin cambios.
  - `erroresDe`: textos exactos `Faltó 1× Cola` (creador), `No iba: 1× Cerveza` (creador), `Combo Simple: registrado 2, real 1` (creador), `Transferencia registrada, fue efectivo` (cobrador), `Sin cobrar, pero se cobró en efectivo` (cobrador), `Cobró $3.00 de más` (cobrador).
  - `estadoRevision`: los cuatro valores; revisada con cambios → `cambio`.
- [ ] **Step 2:** `npm run test:revision` → falla por módulo inexistente.
- [ ] **Step 3:** Implementar `types/revision.ts`.
- [ ] **Step 4:** `npm run test:revision` → `revision: ok`.

### Task 2: Tabla y guardado

**Files:** Modify `prisma/schema.prisma`, `lib/db.ts`, `package.json` (`test:revision-route`). Create `prisma/migrations/20261124000000_revision_orden/migration.sql`, `app/api/admin/ordenes/[id]/revision/route.ts`. Test `lib/revision-route.test.ts` (cargador `loadModule` de `lib/corregir-cobro-route.test.ts`).

**Interfaces:**
- Consumes: Task 1.
- Produces: `PUT /api/admin/ordenes/[id]/revision`, cuerpo `SolicitudRevision`, respuesta `{ revision: RevisionGuardada }`. Errores `{ error }` con 400, 401, 403, 404 y 409; los 409 añaden `code: "ORDEN_CAMBIO" | "REVISION_CAMBIO" | "NO_SE_REVISA"`.

Modelo:

```prisma
/// Bitácora del admin sobre una orden. No participa en ningún cálculo.
model RevisionOrden {
  id                String    @id @default(cuid())
  ordenId           String    @unique
  orden             Orden     @relation(fields: [ordenId], references: [id], onDelete: Cascade)
  detalle           Json
  revisada          Boolean   @default(false)
  conErrores        Boolean   @default(false)
  version           Int       @default(1)
  revisadaPorId     String?
  revisadaPorNombre String?
  revisadaAt        DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

`Orden` gana `revision RevisionOrden?`. `Cascade` como `HistorialOrden`. `lib/db.ts` añade `cachedPrisma?.revisionOrden` a la comprobación del cliente en caché.

- [ ] **Step 1: Test que falla.** Base simulada con `orden.findUnique`, `producto.findMany` y `revisionOrden.{findUnique,create,updateMany}`; cualquier otra propiedad lanza `Escritura no permitida`. Aserciones:
  - Guardar cada tipo de error y marcar revisada → 200, sin llamadas fuera de la lista.
  - Primera vez (`version: 0`) → `version: 1`; siguiente → `2`; `revisada: true` guarda nombre y fecha del admin; al quitarla quedan en `null` y las marcas se conservan.
  - 401 sin sesión; 403 mesero, digital y cocina; 404 inexistente; 409 `NO_SE_REVISA` anulada; 400 JSON roto; 400 `revisada: true` con un producto sin marcar; 400 item ajeno.
  - `revisada: false` incompleta → 200.
  - Huella vieja → 409 `ORDEN_CAMBIO`, sin escribir.
  - `version` vieja → 409 `REVISION_CAMBIO`; creación simultánea (`P2002`) → 409 `REVISION_CAMBIO`; `updateMany` con `count: 0` → 409.
  - Reintento: misma solicitud con `version` una menor que la guardada, mismo `detalle`, misma `revisada` y mismo admin → 200 con la guardada, sin escribir. Se compara con `isDeepStrictEqual`: JSONB cambia el orden de las claves, y el test lo simula.
  - Faltante con `disponible: false` → 200.
- [ ] **Step 2:** `npm run test:revision-route` → falla.
- [ ] **Step 3:** Modelo, migración solo con `CREATE TABLE`, índice único y llave foránea; `npx prisma validate && npx prisma generate`. Implementar `PUT`. `producto.findMany` busca solo los ids de faltantes, sin filtrar `disponible`.
- [ ] **Step 4:** `npm run test:revision-route` → `revision-route: ok`.

### Task 3: Revisiones del día y bitácora

**Files:** Modify `app/api/admin/cuadre/route.ts`, `components/admin/orden-admin.ts`, `package.json` (`test:bitacora-revision`). Create `lib/bitacora-revision.ts`, `app/api/admin/reportes/revision/route.ts`. Test `lib/bitacora-revision.test.ts`.

**Interfaces — Produces:**

```ts
// /api/admin/cuadre añade: revisiones: RevisionGuardada[]
// OrdenAdmin añade: numeroDiario: number | null; items[].id: string; items[].esCortesia?: boolean;
//                   items[].nombreProducto?: string | null
export interface FilaBitacora {
  orden: OrdenRevisable & { id: string; numeroDiario: number | null; createdAt: Date;
    creadorNombre: string; cobradaPor: string | null };
  revision: RevisionGuardada;
}
export interface Bitacora {
  ordenesRevisadas: number;
  porTipo: Record<TipoError, number>;
  porPersona: { nombre: string; total: number; porTipo: Record<TipoError, number> }[];
  errores: { ordenId: string; fecha: string; numeroDiario: number | null; tipo: TipoError;
    texto: string; persona: string; cambio: boolean }[];
}
export function armarBitacora(filas: readonly FilaBitacora[]): Bitacora;
// GET /api/admin/reportes/revision?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD → Bitacora
```

- [ ] **Step 1: Test que falla.** `armarBitacora`: conteo por tipo y persona, personas de mayor a menor, errores del más reciente al más antiguo; orden sin cobrador → creador; `cambio: true` si la foto ya no coincide; `2026-11-24T02:30:00Z` sale como `2026-11-23`. Ruta: 401, 403, 400 con fecha inválida o rango invertido; consulta `revisada: true`, `anulada: false` y `createdAt` desde el inicio de la primera fecha hasta el fin de la última. Cuadre: agrega `revisiones` y el resto de la respuesta es idéntico. Privacidad: los textos de `lib/ordenes-mesero.ts`, `lib/resumen-cierre.ts`, `lib/cuadre-server.ts`, `app/api/ordenes/route.ts` y `app/api/ordenes/[id]/historial/route.ts` no contienen `revisionOrden`.
- [ ] **Step 2:** `npm run test:bitacora-revision` → falla.
- [ ] **Step 3:** Implementar. El cuadre consulta `revisionOrden.findMany` por los ids ya obtenidos.
- [ ] **Step 4:** `npm run test:bitacora-revision` → `bitacora-revision: ok`; `npm run test:cuadre` y `npm run test:ordenes-mesero` siguen pasando.

### Task 4: Pantalla de revisión

**Files:** Create `components/admin/revision/cola-guardado.ts`, `RevisionOrdenes.tsx`, `OrdenEnRevision.tsx`. Modify `app/admin/page.tsx`, `components/admin/OrdenesDia.tsx`, `components/admin/DetalleOrdenModal.tsx`, `package.json` (`test:cola-guardado`). Test `components/admin/revision/cola-guardado.test.ts`.

**Interfaces:**
- Consumes: Tasks 1 a 3.
- Produces:

```ts
export type EstadoGuardado = "guardado" | "guardando" | "error" | "conflicto";
export function crearColaGuardado<T>(opciones: {
  enviar: (valor: T) => Promise<"ok" | "error" | "conflicto">;
  alCambiar: (estado: EstadoGuardado) => void;
}): { poner(valor: T): void; reintentar(): void; vaciar(): Promise<boolean> };
// RevisionOrdenes: { fecha, ordenes: OrdenAdmin[], revisiones: RevisionGuardada[],
//   ordenInicial: string | null, onGuardada(r: RevisionGuardada): void,
//   onRecargar(): Promise<void>, onSalir(): void }
```

- [ ] **Step 1: Test de la cola que falla.** Tres `poner` seguidos con el primero en curso → dos envíos, el segundo con el último valor; nunca dos a la vez; tras `error` no envía más hasta `reintentar`, que manda el último; `vaciar` devuelve `true` al terminar y `false` con error o conflicto; tras `conflicto`, `reintentar` no envía.
- [ ] **Step 2:** `npm run test:cola-guardado` → falla. **Step 3:** implementar. **Step 4:** pasa.
- [ ] **Step 5: Pantalla**, según el prototipo aprobado y las Reglas del spec:
  - `/admin?tab=revision` abre `RevisionOrdenes` como diálogo `fixed inset-0` a pantalla completa; Atrás la cierra. `OrdenesDia` gana "Revisar órdenes" con el avance, y por fila el número, el estado y "Revisar".
  - Órdenes de la más antigua a la más reciente; filtros Todas, Sin revisar y Con errores. Desde 900 px, lista a la izquierda; menos, "Ver lista" / "Ver orden".
  - Un componente `Linea` para producto, cobro y total. "Está mal" en producto empieza en la cantidad registrada menos 1 y los botones saltan la registrada. "Está mal" en cobro o total manda la marca en `null` hasta que se elija opción y monto.
  - Observaciones, picante y "Cortesía" visibles. "Ver comprobante" por cada transferencia con archivo, con `abrirComprobanteFirmado`.
  - "Faltó un producto": `/api/productos?vista=admin`, búsqueda con `normalizarNombre`.
  - Pie: pendientes o resumen, estado del guardado, "Lo demás está bien" y "Marcar revisada". Esta llama a `vaciar()` antes de avanzar; si falta algo, lo dice con `role="alert"` y enfoca ese punto.
  - `error`: "No se guardó el último cambio." con "Reintentar"; Salir ofrece "Salir sin guardar"; `beforeunload` avisa. `conflicto`: "La orden o su revisión cambió." con "Recargar".
  - Orden `cambio`: aviso con los textos de `cambios`.
  - Tras marcar: franja "Orden #34 revisada" con "Deshacer" hasta la siguiente acción; foco al título de la siguiente. Al final: "Terminaste la revisión" con "Ver bitácora de errores".
- [ ] **Step 6: Arreglos.** En `DetalleOrdenModal`, "Orden Cobrada" muestra `🔀 Mixto` cuando el método es `mixto`, y el título lleva el número de orden.
- [ ] **Step 7:** `npx tsc --noEmit` y `npx eslint` sobre los archivos tocados → sin errores.

### Task 5: Reporte y verificación

**Files:** Create `components/admin/reportes/BitacoraErrores.tsx`. Modify `app/admin/reportes/page.tsx`, `lib/navegacion.ts`, `lib/navegacion.test.ts`.

- [ ] **Step 1: Test que falla** en `lib/navegacion.test.ts`: los hijos de `reportes` son `modificaciones`, `cortesias`, `bitacora`; el último apunta a `/admin/reportes?tab=bitacora`.
- [ ] **Step 2:** `npm run test:navegacion` → falla. **Step 3:** agregar `{ id: "bitacora", label: "Bitácora de errores", emoji: "📒" }`. **Step 4:** pasa.
- [ ] **Step 5:** `BitacoraErrores({ fechaInicio, fechaFin, recarga })` carga su propia ruta y muestra conteos, personas y lista según el spec, con estados de carga, error con "Reintentar" y vacío ("No hay errores anotados en estas fechas."). La página reutiliza sus filtros de fecha; el título y `activoId` usan `bitacora`.
- [ ] **Step 6: Regresión.** Los cuatro tests nuevos y `test:cuadre`, `test:corte-turno`, `test:resumen-cierre`, `test:ordenes-mesero`, `test:corregir-cobro`, `test:navegacion`; `npx tsc --noEmit`; eslint; `npm run build`.
- [ ] **Step 7: En navegador**, con datos simulados o una base local descartable: revisar sin errores, con cada error, salir y retomar, fallo de red y reintento, deshacer, quitar revisada, orden que cambia, comprobante, bitácora; a 1280, 375 y 320 px; solo teclado; consola sin errores. Comparar las cifras del cuadre antes y después: iguales.

**Al desplegar:** aplicar la migración antes de publicar la app. Solo crea una tabla; la versión anterior sigue funcionando con ella.
