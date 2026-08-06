# Cobro mixto y multipago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una orden pasa a admitir N pagos, de modo que el cliente pueda pagar parte en efectivo y parte por transferencia, y pueda agregar productos a una orden ya pagada y pagar el saldo con otro metodo.

**Architecture:** `Cobro` deja de ser 1:1 con `Orden` y pasa a representar un pago suelto. `Orden.montoPagado` se materializa y `Orden.cobrada` se deriva de `montoPagado >= total`. El costo de envio sale de la fila de pago y pasa a calcularse a nivel de orden con una regla unica de liquidacion del motorizado. El cuadre deja de leer `Orden.metodoPago` y suma pagos.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 5.22 sobre PostgreSQL, TypeScript, Tailwind 4. Tests: ficheros `*.test.ts` ejecutados con `ts-node` via scripts de `package.json`, usando `node:assert/strict`. No hay framework de test (ni jest ni vitest): un test es un script que revienta con `AssertionError` si algo falla.

**Spec:** `docs/superpowers/specs/2026-08-05-cobro-mixto-multipago-design.md`

## Global Constraints

- Toda aritmetica de dinero se hace en **centavos enteros**, nunca sumando floats. Convertir con `Math.round(Number(x) * 100)` y volver dividiendo entre 100.
- `Cobro.metodoPago` solo admite `'efectivo'` o `'transferencia'`. **Nunca** `'mixto'`. Mixto es la forma agregada de dos filas y solo existe en `Orden.metodoPago` como dato de presentacion.
- Sobre una orden ya pagada solo se permite **agregar** items o **subir** cantidades. Eliminar, bajar cantidades y marcar cortesia se rechazan.
- Todo acto de cobro deja saldo exactamente en cero. No existen abonos parciales deliberados.
- Ninguna cifra de venta incluye el costo de envio. El envio nunca es ingreso del local.
- Los comentarios y mensajes de usuario van en espanol, sin tildes en los comentarios de codigo (el repo ya sigue esa convencion). Los mensajes de error visibles al usuario **si** llevan tildes.
- Los mensajes de commit van en ingles, formato Conventional Commits, como el resto del repo.
- Las migraciones de Prisma se escriben a mano en `prisma/migrations/<timestamp>_<nombre>/migration.sql`. El timestamp sigue el formato `YYYYMMDDHHMMSS` de las migraciones existentes.

---

## Nota de reconciliacion (post-Task-5)

Este plan se escribio leyendo una version desactualizada del repositorio: para
cuando se redacto, ya estaba mergeada en `develop` una feature completa de
comprobantes por transferencia via S3 (subida real, compresion de imagen,
verificacion `parseComprobanteKey`/`objectExists` con degradacion si el storage
falla, visor firmado para el admin) que la exploracion original nunca vio.

Los sintomas aparecieron a mitad de la Task 5: el implementador seguia el
brief al pie de la letra y estuvo a punto de borrar logica real de produccion
porque el brief mismo no la mencionaba. Se encontraron y repararon dos
regresiones ya cometidas (Task 1 habia borrado `montoACobrarEnCaja`, usada por
cuatro paginas; Task 5 iba a borrar la verificacion S3) y se identificaron
cuatro ficheros afectados que las Tasks 10-12 originales no conocian:
`components/cobros/CobrarOrdenClient.tsx` (+198 lineas: flujo de subida real),
`app/ordenes/cobrar/[token]/page.tsx` (+2: prop `storageDisponible`),
`app/mesero/page.tsx` (+22: usa `montoACobrarEnCaja`), `app/admin/page.tsx` y
`components/admin/DetalleOrdenModal.tsx` (+43/+31: badge y visor de
comprobante). Se sumo un quinto fichero que este plan nunca habia contemplado,
`app/digital/page.tsx`, que tambien llama al endpoint de cobro con el
contrato viejo (Task 13, nueva).

Las Tasks 2, 3, 4, 6, 7, 8, 9 se verificaron sin diferencias contra el
repositorio real (`git diff --stat` vacio contra el merge de comprobantes-s3)
y se mantienen tal como estaban escritas. Las Tasks 10, 11 y 12 de aqui en
adelante estan reescritas contra el codigo real; sus versiones originales ya
no aplican.

---

## File Structure

**Nuevos:**

| Fichero | Responsabilidad |
|---|---|
| `lib/cobro.test.ts` | Tests de la aritmetica de pagos de `types/cobro.ts` |
| `lib/liquidacion-domicilio.test.ts` | Tests de la regla unica de liquidacion del motorizado |
| `lib/order-payment-validaciones.ts` | Validacion pura del acto de cobro, separada del acceso a base de datos para poder testearla sin Prisma |
| `lib/order-payment-validaciones.test.ts` | Tests de lo anterior |
| `prisma/migrations/20260805000000_pagos_multiples/migration.sql` | Migracion del modelo |

**Modificados:**

| Fichero | Cambio |
|---|---|
| `prisma/schema.prisma` | `Cobro` pierde `@unique` en `ordenId` y `efectivoEntregado`, gana `monto`. `Orden` gana `montoPagado` |
| `types/cobro.ts` | `calcularMovimientosCobro` se reemplaza por `calcularMovimientosPago`; se agrega `resumirMetodoPago` |
| `types/orden.ts` | `calcularLiquidacionDomicilio` reescrita sobre la regla unica; se agrega `calcularSaldo` |
| `types/cuadre.ts` | Suma pagos en vez de leer `orden.metodoPago`; agrega `ordenesConSaldoPendiente` |
| `lib/order-payment.ts` | `collectOrderPayment` acepta N partes |
| `lib/payment-link.ts` | `shouldPrintPaymentQr` mira saldo, no `cobrada` |
| `app/api/ordenes/[id]/cobrar/route.ts` | Acepta `partes` |
| `app/api/cobros/[token]/route.ts` | Acepta `partes` |
| `app/api/ordenes/route.ts` | Usa `calcularMovimientosPago` y setea `montoPagado` |
| `app/api/ordenes/aprobacion/aprobar/route.ts` | Igual que el anterior |
| `app/api/ordenes/[id]/items/route.ts` | Permite crecer una orden cobrada |
| `app/api/admin/cuadre/route.ts` | Envia los pagos de cada orden al resumen |
| `components/cobros/CobrarOrdenClient.tsx` | Opcion de cobro mixto |
| `app/mesero/page.tsx` | Badge de saldo y cobro mixto |
| `app/admin/page.tsx` | Desglose de pagos y fila de saldo pendiente |
| `components/admin/DetalleOrdenModal.tsx` | Desglose de pagos |
| `lib/cuadre.test.ts` | Casos nuevos |
| `package.json` | Scripts de los tests nuevos |

---

## Task 1: Aritmetica de pagos

**Files:**
- Modify: `types/cobro.ts` (reemplaza el contenido completo)
- Create: `lib/cobro.test.ts`
- Modify: `package.json` (script `test:cobro`)

**Interfaces:**
- Consumes: `esMetodoPago`, `MetodoPago` de `types/orden.ts` (ya existen)
- Produces:
  - `aCentavos(valor: number | string | null | undefined): number`
  - `aDolares(centavos: number): number`
  - `interface PartePago { metodoPago: MetodoPago; monto: number; comprobanteTransferenciaKey?: string | null }`
  - `interface MovimientosPago { efectivoRecibido: number; transferenciaRecibida: number }`
  - `calcularMovimientosPago(parte: { metodoPago: MetodoPago | string; monto: number | string }): MovimientosPago`
  - `resumirMetodoPago(pagos: readonly { metodoPago: string }[]): 'efectivo' | 'transferencia' | 'mixto' | null`

**Contexto para quien implementa:** `types/cobro.ts` hoy exporta `calcularMovimientosCobro`, que devuelve tres campos (`efectivoRecibido`, `efectivoEntregado`, `transferenciaRecibida`) y mete la logica del envio a domicilio dentro del pago. Esa funcion desaparece: el envio pasa a la Task 2 y los movimientos del pago quedan brutos, es decir, lo que el cliente entrego sin descontar nada. Sus tres llamadores se migran en las Tasks 4 y 6.

- [ ] **Step 1: Write the failing test**

Crear `lib/cobro.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  aCentavos,
  aDolares,
  calcularMovimientosPago,
  resumirMetodoPago,
} from "../types/cobro";

// Los movimientos de un pago son brutos: lo que el cliente entrego, sin
// descontar el envio. El envio se liquida a nivel de orden, no de pago.
assert.deepEqual(calcularMovimientosPago({ metodoPago: "efectivo", monto: 30 }), {
  efectivoRecibido: 30,
  transferenciaRecibida: 0,
});
assert.deepEqual(
  calcularMovimientosPago({ metodoPago: "transferencia", monto: 40 }),
  { efectivoRecibido: 0, transferenciaRecibida: 40 },
);

// Un metodo desconocido no inventa dinero.
assert.deepEqual(calcularMovimientosPago({ metodoPago: "cheque", monto: 10 }), {
  efectivoRecibido: 0,
  transferenciaRecibida: 0,
});

// Los montos llegan como Decimal serializado a string desde Prisma.
assert.deepEqual(
  calcularMovimientosPago({ metodoPago: "efectivo", monto: "12.35" }),
  { efectivoRecibido: 12.35, transferenciaRecibida: 0 },
);

// Centavos: la suma de tres tercios de centavo no se escapa.
assert.equal(aCentavos("0.1") + aCentavos("0.2"), aCentavos("0.3"));
assert.equal(aDolares(aCentavos(19.99)), 19.99);
assert.equal(aCentavos(null), 0);
assert.equal(aCentavos(undefined), 0);

// El resumen del metodo es dato de presentacion de la orden.
assert.equal(resumirMetodoPago([]), null);
assert.equal(resumirMetodoPago([{ metodoPago: "efectivo" }]), "efectivo");
assert.equal(
  resumirMetodoPago([{ metodoPago: "transferencia" }]),
  "transferencia",
);
assert.equal(
  resumirMetodoPago([{ metodoPago: "efectivo" }, { metodoPago: "transferencia" }]),
  "mixto",
);
// Dos pagos del mismo metodo no son mixto.
assert.equal(
  resumirMetodoPago([{ metodoPago: "efectivo" }, { metodoPago: "efectivo" }]),
  "efectivo",
);
// Un metodo invalido se ignora en el resumen.
assert.equal(
  resumirMetodoPago([{ metodoPago: "cheque" }, { metodoPago: "efectivo" }]),
  "efectivo",
);
assert.equal(resumirMetodoPago([{ metodoPago: "cheque" }]), null);

console.log("cobro.test.ts OK");
```

- [ ] **Step 2: Add the npm script**

En `package.json`, dentro de `scripts`, justo despues de la linea de `test:cuadre`:

```json
    "test:cobro": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/cobro.test.ts",
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:cobro
```

Expected: FAIL. `types/cobro.ts` no exporta `aCentavos` ni `calcularMovimientosPago`, asi que TypeScript aborta con `TS2305: Module '"../types/cobro"' has no exported member 'aCentavos'`.

- [ ] **Step 4: Write the implementation**

Reemplazar el contenido completo de `types/cobro.ts`:

```ts
import { esMetodoPago, type MetodoPago } from './orden';

export interface MovimientosPago {
  /** Lo que el cliente entrego en efectivo en este pago, en bruto. */
  efectivoRecibido: number;
  /** Lo que el cliente transfirio en este pago, en bruto. */
  transferenciaRecibida: number;
}

export interface PartePago {
  metodoPago: MetodoPago;
  monto: number;
  comprobanteTransferenciaKey?: string | null;
}

export function aCentavos(valor: number | string | null | undefined): number {
  return Math.round(Number(valor ?? 0) * 100);
}

export function aDolares(centavos: number): number {
  return centavos / 100;
}

/**
 * Movimientos de un pago suelto. Deliberadamente NO sabe de envios ni de
 * ordenes: guarda lo que el cliente entrego, en bruto. La liquidacion del
 * envio con el motorizado vive en `calcularLiquidacionDomicilio`, porque
 * depende de la orden completa y no de un pago en particular.
 */
export function calcularMovimientosPago(input: {
  metodoPago: MetodoPago | string;
  monto: number | string;
}): MovimientosPago {
  if (!esMetodoPago(input.metodoPago)) {
    return { efectivoRecibido: 0, transferenciaRecibida: 0 };
  }

  const monto = aDolares(aCentavos(input.monto));
  return input.metodoPago === 'efectivo'
    ? { efectivoRecibido: monto, transferenciaRecibida: 0 }
    : { efectivoRecibido: 0, transferenciaRecibida: monto };
}

/**
 * Dato de presentacion que se materializa en `Orden.metodoPago`. El cuadre no
 * lo usa: el dinero se cuenta sumando las filas de `Cobro`.
 */
export function resumirMetodoPago(
  pagos: readonly { metodoPago: string }[],
): MetodoPago | 'mixto' | null {
  const metodos = new Set(
    pagos
      .map((pago) => pago.metodoPago)
      .filter((metodo): metodo is MetodoPago => esMetodoPago(metodo)),
  );

  if (metodos.size === 0) return null;
  if (metodos.size > 1) return 'mixto';
  return [...metodos][0];
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:cobro
```

Expected: PASS, imprime `cobro.test.ts OK`.

Nota: `npx tsc --noEmit` todavia va a fallar en este punto, porque los tres llamadores de `calcularMovimientosCobro` quedaron sin funcion. Se arreglan en las Tasks 4 y 6. No intentes arreglarlos aqui.

- [ ] **Step 6: Commit**

```bash
git add types/cobro.ts lib/cobro.test.ts package.json
git commit -m "feat(cobros): payment arithmetic for a single payment row

The delivery fee leaves the payment row: a payment now records what the
customer handed over, gross. Settlement moves to order level in the next
commit."
```

---

## Task 2: Regla unica de liquidacion del motorizado

**Files:**
- Modify: `types/orden.ts:98-139` (reemplaza `calcularLiquidacionDomicilio`)
- Create: `lib/liquidacion-domicilio.test.ts`
- Modify: `package.json` (script `test:liquidacion`)

**Interfaces:**
- Consumes: `obtenerCostoEnvio` de `types/orden.ts` (ya existe), `aCentavos` / `aDolares` de `types/cobro.ts` (Task 1)
- Produces:
  - `interface LiquidacionDomicilio { entregaElLocal: number; entregaElMotorizado: number }`
  - `calcularLiquidacionDomicilio(orden: { tipoOrden?: string | null; costoEnvio?: number | string | null }, efectivoCobrado: number | string): LiquidacionDomicilio | null`
  - `calcularSaldo(orden: { total: number | string; montoPagado?: number | string | null }): number`

**Contexto:** la `calcularLiquidacionDomicilio` actual (`types/orden.ts:98`) esta **muerta**: se exporta pero no la importa nadie. Se puede reescribir con firma nueva sin romper ningun llamador. Su firma vieja tomaba `metodoPagoPrevisto` y `metodoPago` porque asumia un solo metodo; la nueva toma el efectivo total cobrado en la orden.

Cuidado con el import: `types/orden.ts` no importa hoy de `types/cobro.ts`, y `types/cobro.ts` si importa de `types/orden.ts`. Importar en la otra direccion crea un ciclo. Para evitarlo, **duplica las dos funciones de centavos localmente en `types/orden.ts`** en vez de importarlas; son tres lineas y `types/cuadre.ts` ya hace exactamente eso (`aCentavos` / `aDolares` privadas, `types/cuadre.ts:46-52`).

- [ ] **Step 1: Write the failing test**

Crear `lib/liquidacion-domicilio.test.ts`:

```ts
import assert from "node:assert/strict";
import { calcularLiquidacionDomicilio, calcularSaldo } from "../types/orden";

// Regla unica: el envio se descuenta del efectivo que el motorizado cobro al
// cliente. Si sobra, el motorizado entrega la diferencia al local; si falta,
// el local le completa.

// Transferencia pura: el motorizado no cobro efectivo, el local le entrega el envio.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: 3 }, 0),
  { entregaElLocal: 3, entregaElMotorizado: 0 },
);

// Efectivo puro: cobro el total de 10, se queda 3 de envio y entrega 7.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: 3 }, 10),
  { entregaElLocal: 0, entregaElMotorizado: 7 },
);

// Mixto, el caso real: transferencia de 8 que ya incluia el envio, mas 5 en
// efectivo por un producto agregado. El motorizado entrega 5 - 3 = 2.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: 3 }, 5),
  { entregaElLocal: 0, entregaElMotorizado: 2 },
);

// El efectivo cubre el envio exacto: nadie entrega nada.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: 3 }, 3),
  { entregaElLocal: 0, entregaElMotorizado: 0 },
);

// Fuera de domicilio no hay liquidacion.
assert.equal(calcularLiquidacionDomicilio({ tipoOrden: "local" }, 25), null);
assert.equal(
  calcularLiquidacionDomicilio({ tipoOrden: "para_llevar", costoEnvio: 3 }, 15),
  null,
);

// Domicilio sin envio configurado: no hay nada que liquidar, pero sigue siendo
// domicilio, asi que devuelve ceros y no null.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: null }, 20),
  { entregaElLocal: 0, entregaElMotorizado: 20 },
);

// Centavos, no floats.
assert.deepEqual(
  calcularLiquidacionDomicilio({ tipoOrden: "domicilio", costoEnvio: "2.50" }, "10.10"),
  { entregaElLocal: 0, entregaElMotorizado: 7.6 },
);

// Saldo.
assert.equal(calcularSaldo({ total: 25, montoPagado: 0 }), 25);
assert.equal(calcularSaldo({ total: 25, montoPagado: 25 }), 0);
assert.equal(calcularSaldo({ total: 30, montoPagado: "25.50" }), 4.5);
// Una orden que nunca se pago no trae el campo.
assert.equal(calcularSaldo({ total: 25 }), 25);
// El saldo nunca es negativo: pagar de mas no genera credito, se bloquea antes.
assert.equal(calcularSaldo({ total: 25, montoPagado: 30 }), 0);

console.log("liquidacion-domicilio.test.ts OK");
```

- [ ] **Step 2: Add the npm script**

En `package.json`, dentro de `scripts`, justo despues de `test:cobro`:

```json
    "test:liquidacion": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/liquidacion-domicilio.test.ts",
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:liquidacion
```

Expected: FAIL con `TS2554: Expected 1 arguments, but got 2` en la primera llamada, porque la firma vieja recibe un solo objeto.

- [ ] **Step 4: Write the implementation**

En `types/orden.ts`, borrar el bloque completo desde el comentario `/** Liquidación con el motorizado...` hasta el cierre de `calcularLiquidacionDomicilio` (lineas 87-139) y poner en su lugar:

```ts
function aCentavosOrden(valor: number | string | null | undefined): number {
  return Math.round(Number(valor ?? 0) * 100);
}

export interface LiquidacionDomicilio {
  /** Efectivo que el local le entrega al motorizado. */
  entregaElLocal: number;
  /** Efectivo que el motorizado le entrega al local. */
  entregaElMotorizado: number;
}

/**
 * Liquidacion con el motorizado, regla unica:
 *
 *   El envio se descuenta del efectivo que el motorizado cobro al cliente.
 *   Si sobra, el motorizado entrega la diferencia al local.
 *   Si falta, el local le completa.
 *
 * Reproduce los dos casos que existian antes del multipago (transferencia pura
 * y efectivo puro) y ademas resuelve el mixto, donde el envio ya venia dentro
 * de una transferencia y el efectivo llego despues.
 *
 * `efectivoCobrado` es la suma del efectivo de TODOS los pagos de la orden, no
 * el de un pago suelto: el envio se liquida una sola vez.
 *
 * Devuelve `null` fuera de domicilio, donde no hay motorizado.
 */
export function calcularLiquidacionDomicilio(
  orden: { tipoOrden?: string | null; costoEnvio?: number | string | null },
  efectivoCobrado: number | string,
): LiquidacionDomicilio | null {
  if (orden.tipoOrden !== 'domicilio') return null;

  const envio = aCentavosOrden(obtenerCostoEnvio(orden));
  const efectivo = aCentavosOrden(efectivoCobrado);
  const diferencia = envio - efectivo;

  return diferencia > 0
    ? { entregaElLocal: diferencia / 100, entregaElMotorizado: 0 }
    : { entregaElLocal: 0, entregaElMotorizado: -diferencia / 100 };
}

/** Lo que falta por cobrar. Nunca negativo. */
export function calcularSaldo(orden: {
  total: number | string;
  montoPagado?: number | string | null;
}): number {
  const pendiente = aCentavosOrden(orden.total) - aCentavosOrden(orden.montoPagado);
  return pendiente > 0 ? pendiente / 100 : 0;
}
```

`obtenerCostoEnvio` ya esta definida mas arriba en el mismo fichero (`types/orden.ts:58`) y ya devuelve 0 fuera de domicilio, asi que no hace falta volver a comprobar el tipo.

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:liquidacion
```

Expected: PASS, imprime `liquidacion-domicilio.test.ts OK`.

- [ ] **Step 6: Commit**

```bash
git add types/orden.ts lib/liquidacion-domicilio.test.ts package.json
git commit -m "feat(cobros): single settlement rule for delivery riders

One formula replaces the per-method branch: the fee comes off the cash the
rider collected, and the sign says who pays whom. Reproduces both existing
cases and resolves the mixed one."
```

---

## Task 3: Migracion del modelo

**Files:**
- Modify: `prisma/schema.prisma:41-115`
- Create: `prisma/migrations/20260805000000_pagos_multiples/migration.sql`

**Interfaces:**
- Produces: `Cobro.monto`, `Orden.montoPagado`. `Cobro.ordenId` deja de ser unico. `Cobro.efectivoEntregado` desaparece.

**Contexto:** hoy `Cobro` tiene `ordenId String @unique`, lo que impide mas de un pago por orden. Las columnas `efectivoRecibido`, `efectivoEntregado` y `transferenciaRecibida` se escriben pero **no las lee nadie** (verificado: los unicos `grep` fuera de `types/` son cifras del resumen del cuadre, que se calculan aparte). Por eso se les puede cambiar el significado a bruto sin romper consumidores.

- [ ] **Step 1: Edit the schema**

En `prisma/schema.prisma`, en el modelo `Orden`, agregar despues de la linea `total` (linea 70):

```prisma
  /// Suma de los pagos confirmados. Materializado: `cobrada` se deriva de
  /// `montoPagado >= total` y los listados filtran por el sin agregar.
  montoPagado                    Decimal          @default(0) @db.Decimal(10, 2)
```

En el modelo `Cobro`, aplicar tres cambios:

1. Linea 94, quitar `@unique` y agregar indice. Cambiar:
   ```prisma
     ordenId                     String   @unique
   ```
   por:
   ```prisma
     ordenId                     String
   ```

2. Agregar despues de `metodoPago` (linea 96):
   ```prisma
     /// Importe de ESTE pago. `montoTotal` es el total de la orden al momento
     /// de pagarlo, que con varios pagos ya no coincide con el importe.
     monto                       Decimal  @db.Decimal(10, 2)
   ```

3. Borrar la linea 101 completa:
   ```prisma
     efectivoEntregado           Decimal  @default(0) @db.Decimal(10, 2)
   ```

4. En el bloque de indices al final del modelo (lineas 113-114), agregar:
   ```prisma
     @@index([ordenId])
   ```

En el modelo `Orden`, la relacion `cobro Cobro?` (linea 85) pasa a lista. Cambiar:

```prisma
  cobro                          Cobro?
```

por:

```prisma
  pagos                          Cobro[]
```

Y en `Cobro`, la relacion inversa (linea 95) mantiene el nombre del campo pero cambia de lado, queda igual:

```prisma
  orden                       Orden    @relation(fields: [ordenId], references: [id], onDelete: Restrict)
```

- [ ] **Step 2: Write the migration SQL**

Crear `prisma/migrations/20260805000000_pagos_multiples/migration.sql`:

```sql
-- Cobro pasa de "el cobro de la orden" a "un pago". Una orden puede tener varios.
DROP INDEX "Cobro_ordenId_key";
CREATE INDEX "Cobro_ordenId_idx" ON "Cobro"("ordenId");

-- Importe de cada pago. Las filas existentes son una por orden, asi que el
-- importe del pago es el total de la orden.
ALTER TABLE "Cobro" ADD COLUMN "monto" DECIMAL(10,2);
UPDATE "Cobro" SET "monto" = "montoTotal";
ALTER TABLE "Cobro" ALTER COLUMN "monto" SET NOT NULL;

-- El envio deja de vivir en el pago: pasa a calcularse a nivel de orden.
ALTER TABLE "Cobro" DROP COLUMN "efectivoEntregado";

-- Los movimientos del pago pasan a ser brutos. La unica combinacion que
-- guardaba un valor neto era domicilio en efectivo, que restaba el envio.
UPDATE "Cobro" c
SET "efectivoRecibido" = c."montoTotal"
FROM "Orden" o
WHERE o."id" = c."ordenId"
  AND c."metodoPago" = 'efectivo'
  AND o."tipoOrden" = 'domicilio';

-- Saldo materializado en la orden.
ALTER TABLE "Orden" ADD COLUMN "montoPagado" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "Orden" o
SET "montoPagado" = COALESCE(
  (SELECT SUM(c."monto") FROM "Cobro" c
   WHERE c."ordenId" = o."id" AND c."estado" <> 'REEMBOLSADO'),
  0
);

-- Ordenes cobradas antes de que existiera la tabla Cobro: no tienen filas de
-- pago, pero estan pagadas. Sin esto quedarian con saldo pendiente.
UPDATE "Orden"
SET "montoPagado" = "total"
WHERE "cobrada" = true AND "montoPagado" = 0;
```

- [ ] **Step 3: Apply the migration**

```bash
npx prisma migrate dev --name pagos_multiples
```

Si Prisma avisa de que ya existe el directorio de la migracion, es lo esperado: la escribimos a mano. Confirma que la aplica sin generar una segunda.

Expected: `Your database is now in sync with your schema` y el cliente regenerado.

- [ ] **Step 4: Verify the backfill**

```bash
npx prisma studio
```

Comprobar a mano en la tabla `Orden`: toda orden con `cobrada = true` tiene `montoPagado = total`, y ninguna orden con `cobrada = false` tiene `montoPagado > 0`. Cerrar Studio despues.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260805000000_pagos_multiples
git commit -m "feat(db): allow multiple payments per order

Drops the unique constraint on Cobro.ordenId, adds Cobro.monto and
Orden.montoPagado, and rewrites delivery cash payments to gross amounts so
the settlement can be computed once at order level."
```

---

## Task 4: Validacion pura del acto de cobro

**Files:**
- Create: `lib/order-payment-validaciones.ts`
- Create: `lib/order-payment-validaciones.test.ts`
- Modify: `package.json` (script `test:cobro-validaciones`)

**Interfaces:**
- Consumes: `aCentavos` de `types/cobro.ts` (Task 1), `esMetodoPago` de `types/orden.ts`
- Produces:
  - `class ActoDeCobroInvalido extends Error`
  - `validarActoDeCobro(input: { saldo: number | string; partes: readonly PartePago[] }): void` — lanza `ActoDeCobroInvalido` o no devuelve nada
  - `derivarClaveIdempotencia(base: string, metodoPago: MetodoPago): string`

**Contexto:** la validacion vive en su propio modulo y no dentro de `lib/order-payment.ts` porque ese fichero importa `@/lib/db`, y los tests del repo corren con `ts-node` sin base de datos: un test no puede importar nada que arrastre Prisma. `lib/retiros-validaciones.ts` y `lib/admin-validaciones.ts` siguen exactamente ese patron y por eso el fichero se llama igual.

- [ ] **Step 1: Write the failing test**

Crear `lib/order-payment-validaciones.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  ActoDeCobroInvalido,
  derivarClaveIdempotencia,
  validarActoDeCobro,
} from "./order-payment-validaciones";

const efectivo = (monto: number) => ({ metodoPago: "efectivo" as const, monto });
const transferencia = (monto: number) => ({
  metodoPago: "transferencia" as const,
  monto,
  comprobanteTransferenciaKey: "comprobantes/abc.jpg",
});

// Un cobro simple que cuadra pasa.
assert.doesNotThrow(() =>
  validarActoDeCobro({ saldo: 25, partes: [efectivo(25)] }),
);

// Un cobro mixto que cuadra pasa.
assert.doesNotThrow(() =>
  validarActoDeCobro({ saldo: 25, partes: [efectivo(10), transferencia(15)] }),
);

// Las partes deben sumar EXACTO el saldo.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(10), transferencia(14)] }),
  ActoDeCobroInvalido,
);
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(10), transferencia(16)] }),
  ActoDeCobroInvalido,
);

// Los centavos cuadran sin arrastrar error de float.
assert.doesNotThrow(() =>
  validarActoDeCobro({ saldo: 0.3, partes: [efectivo(0.1), transferencia(0.2)] }),
);

// Ninguna parte puede ser cero: eso es un cobro simple disfrazado de mixto.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(25), transferencia(0)] }),
  ActoDeCobroInvalido,
);

// Ni negativa.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(30), transferencia(-5)] }),
  ActoDeCobroInvalido,
);

// Como maximo una parte por metodo.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [efectivo(10), efectivo(15)] }),
  ActoDeCobroInvalido,
);

// Sin partes no hay cobro.
assert.throws(
  () => validarActoDeCobro({ saldo: 25, partes: [] }),
  ActoDeCobroInvalido,
);

// Un metodo invalido se rechaza.
assert.throws(
  () =>
    validarActoDeCobro({
      saldo: 25,
      partes: [{ metodoPago: "cheque" as never, monto: 25 }],
    }),
  ActoDeCobroInvalido,
);

// Una orden sin saldo no se puede volver a cobrar.
assert.throws(
  () => validarActoDeCobro({ saldo: 0, partes: [efectivo(0)] }),
  ActoDeCobroInvalido,
);

// La parte de transferencia exige comprobante.
assert.throws(
  () =>
    validarActoDeCobro({
      saldo: 25,
      partes: [{ metodoPago: "transferencia", monto: 25 }],
    }),
  ActoDeCobroInvalido,
);

// Claves de idempotencia derivadas: una por metodo, estables.
assert.equal(
  derivarClaveIdempotencia("abc123def456ghi7", "efectivo"),
  "abc123def456ghi7:efectivo",
);
assert.equal(
  derivarClaveIdempotencia("abc123def456ghi7", "transferencia"),
  "abc123def456ghi7:transferencia",
);

console.log("order-payment-validaciones.test.ts OK");
```

- [ ] **Step 2: Add the npm script**

En `package.json`, despues de `test:liquidacion`:

```json
    "test:cobro-validaciones": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/order-payment-validaciones.test.ts",
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:cobro-validaciones
```

Expected: FAIL con `TS2307: Cannot find module './order-payment-validaciones'`.

- [ ] **Step 4: Write the implementation**

Crear `lib/order-payment-validaciones.ts`:

```ts
// Import relativo: este modulo se ejecuta con ts-node en los tests, donde el
// alias @/ no aplica. Mismo criterio que lib/print-jobs.ts.
import { aCentavos, type PartePago } from '../types/cobro';
import { esMetodoPago, type MetodoPago } from '../types/orden';

export class ActoDeCobroInvalido extends Error {}

/**
 * Un acto de cobro deja el saldo exactamente en cero. No existen abonos
 * parciales: si las partes no suman el saldo, el cobro no se registra.
 */
export function validarActoDeCobro(input: {
  saldo: number | string;
  partes: readonly PartePago[];
}): void {
  const saldo = aCentavos(input.saldo);
  if (saldo <= 0) {
    throw new ActoDeCobroInvalido('Esta orden no tiene saldo pendiente');
  }
  if (input.partes.length === 0) {
    throw new ActoDeCobroInvalido('Se requiere al menos una forma de pago');
  }

  const metodosVistos = new Set<MetodoPago>();
  let suma = 0;

  for (const parte of input.partes) {
    if (!esMetodoPago(parte.metodoPago)) {
      throw new ActoDeCobroInvalido('Método de pago inválido');
    }
    if (metodosVistos.has(parte.metodoPago)) {
      throw new ActoDeCobroInvalido(
        'No se puede registrar dos veces el mismo método de pago',
      );
    }
    metodosVistos.add(parte.metodoPago);

    const monto = aCentavos(parte.monto);
    if (monto <= 0) {
      throw new ActoDeCobroInvalido(
        'Cada forma de pago debe tener un monto mayor a cero',
      );
    }
    if (
      parte.metodoPago === 'transferencia' &&
      !parte.comprobanteTransferenciaKey?.trim()
    ) {
      throw new ActoDeCobroInvalido(
        'La transferencia requiere el comprobante',
      );
    }
    suma += monto;
  }

  if (suma !== saldo) {
    throw new ActoDeCobroInvalido(
      `El pago debe sumar exactamente $${(saldo / 100).toFixed(2)}`,
    );
  }
}

/**
 * Cada parte de un acto de cobro necesita su propia clave unica, porque cada
 * una es una fila de `Cobro`. Se derivan de una sola clave que manda el
 * cliente, para que reintentar el acto completo no duplique nada.
 */
export function derivarClaveIdempotencia(
  base: string,
  metodoPago: MetodoPago,
): string {
  return `${base}:${metodoPago}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:cobro-validaciones
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/order-payment-validaciones.ts lib/order-payment-validaciones.test.ts package.json
git commit -m "feat(cobros): validate a collection act against the order balance

Kept free of Prisma imports so it runs under the repo's ts-node test scripts,
matching lib/retiros-validaciones.ts."
```

---

## Task 5: `collectOrderPayment` acepta N partes

**Files:**
- Modify: `lib/order-payment.ts` (reemplaza `collectOrderPayment` completa, lineas 69-239)
- Modify: `types/orden.ts` (interfaz `CobrarOrdenRequest`, lineas 217-225)

**Interfaces:**
- Consumes: `validarActoDeCobro`, `derivarClaveIdempotencia`, `ActoDeCobroInvalido` (Task 4); `calcularMovimientosPago`, `resumirMetodoPago`, `aCentavos`, `aDolares` (Task 1); `calcularSaldo` (Task 2)
- Produces:
  - `collectOrderPayment(input: { orderId: string; partes: readonly PartePago[]; expectedRevision: number; idempotencyKey: string; origen: 'qr' | 'lista'; user: AuthenticatedUser }): Promise<Orden & { items: ... }>`
  - `interface CobrarOrdenRequest { partes: PartePago[]; expectedRevision: number; idempotencyKey: string }`

- [ ] **Step 1: Update the request type**

En `types/orden.ts`, reemplazar la interfaz `CobrarOrdenRequest` (lineas 217-225) por:

```ts
export interface CobrarOrdenRequest {
  /**
   * Formas de pago del acto. Una sola parte es un cobro simple; dos, un cobro
   * mixto. Deben sumar exactamente el saldo de la orden.
   */
  partes: {
    metodoPago: MetodoPago;
    monto: number;
    comprobanteTransferenciaKey?: string;
  }[];
  /** Evita cobrar un total que cambió mientras el modal estaba abierto. */
  expectedRevision: number;
  /** Permite reintentar la misma confirmación sin duplicar el movimiento. */
  idempotencyKey: string;
}
```

Agregar tambien a `OrdenConStock` (linea 198, junto a `total`):

```ts
  montoPagado: number;
```

- [ ] **Step 2: Rewrite collectOrderPayment**

En `lib/order-payment.ts`, reemplazar los imports de cabecera (lineas 1-6) por:

```ts
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  ActoDeCobroInvalido,
  derivarClaveIdempotencia,
  validarActoDeCobro,
} from '@/lib/order-payment-validaciones';
import { canCollectPayments, type AuthenticatedUser } from '@/lib/session';
import {
  aCentavos,
  aDolares,
  calcularMovimientosPago,
  resumirMetodoPago,
  type PartePago,
} from '@/types/cobro';
import { calcularSaldo } from '@/types/orden';
```

Reemplazar `validateOrderCanBePaid` (lineas 36-67) por esta version, que suma `'cobrada'` a los estados cobrables de mesa (una orden pagada a la que se le agregaron productos vuelve con saldo):

```ts
function validateOrderCanBePaid(
  order: {
    estado: string;
    tipoOrden: string;
    printRevision: number;
    total: Prisma.Decimal;
    montoPagado: Prisma.Decimal;
  },
  expectedRevision: number,
  origen: 'qr' | 'lista',
): void {
  if (calcularSaldo({ total: order.total.toString(), montoPagado: order.montoPagado.toString() }) <= 0) {
    throw new PaymentConflictError('Esta orden ya fue cobrada');
  }
  if (order.estado === 'cancelada') {
    throw new PaymentValidationError('No se puede cobrar una orden cancelada');
  }
  if (order.estado === 'pendiente_aprobacion_stock') {
    throw new PaymentValidationError(
      'La orden debe ser aprobada por stock antes de poder cobrarla',
    );
  }
  if (order.printRevision !== expectedRevision) {
    throw new PaymentConflictError(
      'La orden cambió. Recárgala y confirma el total actualizado.',
    );
  }
  // El cobro por enlace (QR) puede cerrar el pago en cualquier estado operativo:
  // basta con que la orden exista, tenga saldo y no este cancelada ni pendiente
  // de stock. El cobro desde la lista interna mantiene la regla de mesa
  // lista/entregada, ahora con `cobrada` incluida: una orden pagada a la que se
  // le agregaron productos conserva ese estado y vuelve a tener saldo.
  if (origen === 'lista') {
    const esLocal = !order.tipoOrden || order.tipoOrden === 'local';
    if (esLocal && !['lista', 'entregada', 'cobrada'].includes(order.estado)) {
      throw new PaymentValidationError(
        'Las órdenes de mesa solo se pueden cobrar cuando estén listas o entregadas',
      );
    }
  }
}
```

Reemplazar `collectOrderPayment` completa (desde la linea 69 hasta el final del fichero) por:

```ts
export async function collectOrderPayment(input: {
  orderId: string;
  partes: readonly PartePago[];
  expectedRevision: number;
  idempotencyKey: string;
  origen: 'qr' | 'lista';
  user: AuthenticatedUser;
}) {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new PaymentValidationError('La revisión esperada es requerida');
  }
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey)) {
    throw new PaymentValidationError('La clave de idempotencia no es válida');
  }

  const claves = input.partes
    .filter((parte) => parte.metodoPago === 'efectivo' || parte.metodoPago === 'transferencia')
    .map((parte) => derivarClaveIdempotencia(input.idempotencyKey, parte.metodoPago));

  // Reintento del mismo acto: las claves derivadas ya existen y apuntan a esta
  // orden. Se devuelve el estado guardado sin volver a cobrar.
  const yaRegistradas = claves.length
    ? await prisma.cobro.findMany({
        where: { idempotencyKey: { in: claves } },
        select: { ordenId: true },
      })
    : [];
  if (yaRegistradas.length > 0) {
    if (yaRegistradas.some((cobro) => cobro.ordenId !== input.orderId)) {
      throw new PaymentConflictError('La clave de cobro ya fue utilizada');
    }
    return prisma.orden.findUniqueOrThrow({
      where: { id: input.orderId },
      include: ORDER_WITH_ITEMS,
    });
  }

  const existing = await prisma.orden.findUnique({ where: { id: input.orderId } });
  if (!existing) throw new PaymentNotFoundError('Orden no encontrada');
  if (!canUserCollectOrder(input.user)) {
    throw new PaymentForbiddenError('Tu rol no puede cobrar órdenes');
  }
  validateOrderCanBePaid(existing, input.expectedRevision, input.origen);

  const saldo = calcularSaldo({
    total: existing.total.toString(),
    montoPagado: existing.montoPagado.toString(),
  });
  try {
    validarActoDeCobro({ saldo, partes: input.partes });
  } catch (error) {
    if (error instanceof ActoDeCobroInvalido) {
      throw new PaymentValidationError(error.message);
    }
    throw error;
  }

  const nuevoMontoPagado = aDolares(
    aCentavos(existing.montoPagado.toString()) + aCentavos(saldo),
  );
  const nuevoEstado =
    input.origen === 'qr' ||
    ['lista', 'entregada', 'cobrada'].includes(existing.estado)
      ? 'cobrada'
      : existing.estado;
  const estadosCobrables =
    input.origen === 'qr'
      ? ['pendiente', 'en_preparacion', 'lista', 'entregada', 'cobrada']
      : !existing.tipoOrden || existing.tipoOrden === 'local'
        ? ['lista', 'entregada', 'cobrada']
        : ['pendiente', 'en_preparacion', 'lista', 'entregada', 'cobrada'];

  try {
    return await prisma.$transaction(async (tx) => {
      // El filtro por `montoPagado` es el candado optimista del dinero: si otro
      // cobrador cerro el saldo entre la lectura y esta escritura, no coincide.
      const updated = await tx.orden.updateMany({
        where: {
          id: input.orderId,
          printRevision: input.expectedRevision,
          montoPagado: existing.montoPagado,
          estado: { in: estadosCobrables },
        },
        data: {
          montoPagado: nuevoMontoPagado,
          cobrada: true,
          fechaCobro: new Date(),
          cobradaPor: input.user.nombre,
          cobradaPorId: input.user.id,
          origenCobro: input.origen,
          estado: nuevoEstado,
        },
      });
      if (updated.count !== 1) {
        throw new PaymentConflictError(
          'La orden fue cobrada o modificada al mismo tiempo.',
        );
      }

      for (const parte of input.partes) {
        await tx.cobro.create({
          data: {
            ordenId: input.orderId,
            metodoPago: parte.metodoPago,
            monto: parte.monto,
            montoTotal: existing.total,
            costoEnvio: existing.costoEnvio ?? 0,
            ...calcularMovimientosPago(parte),
            cobradoPorId: input.user.id,
            cobradoPorNombre: input.user.nombre,
            cobradoPorRol: input.user.rol,
            origen: input.origen,
            idempotencyKey: derivarClaveIdempotencia(
              input.idempotencyKey,
              parte.metodoPago,
            ),
            comprobanteTransferenciaKey:
              parte.comprobanteTransferenciaKey ?? null,
          },
        });
      }

      // `Orden.metodoPago` es dato de presentacion: resume TODOS los pagos de la
      // orden, no solo los de este acto.
      const pagos = await tx.cobro.findMany({
        where: { ordenId: input.orderId },
        select: { metodoPago: true },
      });
      const metodoResumido = resumirMetodoPago(pagos);
      await tx.orden.update({
        where: { id: input.orderId },
        data: { metodoPago: metodoResumido },
      });

      const detallePartes = input.partes
        .map((parte) => `${parte.metodoPago} $${Number(parte.monto).toFixed(2)}`)
        .join(' + ');
      await tx.historialOrden.create({
        data: {
          ordenId: input.orderId,
          tipoAccion: 'orden_cobrada',
          descripcion: `Cobro de $${saldo.toFixed(2)} por ${input.user.nombre}: ${detallePartes}`,
          datosAntes: {
            montoPagado: Number(existing.montoPagado),
            metodoPago: existing.metodoPago,
          },
          datosDespues: {
            montoPagado: nuevoMontoPagado,
            metodoPago: metodoResumido,
            total: Number(existing.total),
            costoEnvio: Number(existing.costoEnvio ?? 0),
            partes: input.partes.map((parte) => ({
              metodoPago: parte.metodoPago,
              monto: Number(parte.monto),
            })),
          },
          usuarioNombre: input.user.nombre,
          usuarioRol: input.user.rol,
          diferenciaTotal: 0,
        },
      });

      return tx.orden.findUniqueOrThrow({
        where: { id: input.orderId },
        include: ORDER_WITH_ITEMS,
      });
    });
  } catch (error) {
    if (
      error instanceof PaymentConflictError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002')
    ) {
      // Carrera resuelta por el otro lado: si las claves derivadas ya existen y
      // son de esta orden, el acto si se registro.
      const retry = await prisma.cobro.findMany({
        where: { idempotencyKey: { in: claves } },
        select: { ordenId: true },
      });
      if (retry.length > 0 && retry.every((cobro) => cobro.ordenId === input.orderId)) {
        return prisma.orden.findUniqueOrThrow({
          where: { id: input.orderId },
          include: ORDER_WITH_ITEMS,
        });
      }
      if (error instanceof PaymentConflictError) throw error;
      throw new PaymentConflictError('La orden ya fue cobrada');
    }
    throw error;
  }
}
```

Nota sobre el override de metodo previsto: la version anterior escribia un
`tipoAccion: 'metodo_pago_override'` cuando el metodo real no coincidia con
`metodoPagoPrevisto`. Con multipago esa comparacion ya no es binaria, asi que se
retira: la descripcion del historial ahora lista las partes reales y
`metodoPagoPrevisto` sigue guardado en la orden para compararlo en los reportes.

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: los unicos errores restantes deben estar en los ficheros que aun no se migran (`app/api/ordenes/[id]/cobrar/route.ts`, `app/api/cobros/[token]/route.ts`, `app/api/ordenes/route.ts`, `app/api/ordenes/aprobacion/aprobar/route.ts`, `components/cobros/CobrarOrdenClient.tsx`, `app/mesero/page.tsx`). Cualquier error dentro de `lib/order-payment.ts` hay que arreglarlo ahora.

- [ ] **Step 4: Commit**

```bash
git add lib/order-payment.ts types/orden.ts
git commit -m "feat(cobros): collect a payment act made of N parts

Each part becomes its own Cobro row with a derived idempotency key, so a
retried act never double-charges. montoPagado doubles as the optimistic lock
on the money, alongside printRevision on the contents."
```

---

## Task 6: Rutas de cobro y creacion automatica

**Files:**
- Modify: `app/api/ordenes/[id]/cobrar/route.ts:26-40`
- Modify: `app/api/cobros/[token]/route.ts:37-49`
- Modify: `app/api/ordenes/route.ts:26, 427-447`
- Modify: `app/api/ordenes/aprobacion/aprobar/route.ts:10, 128-148`

**Interfaces:**
- Consumes: `collectOrderPayment` (Task 5), `calcularMovimientosPago` (Task 1)

**Contexto:** las dos rutas de cobro validan hoy `esMetodoPago(body.metodoPago)` antes de llamar. Esa validacion se retira porque ahora vive en `validarActoDeCobro`. Las dos rutas de creacion automatica (`ordenes/route.ts` cuando el domicilio nace pagado, y `aprobacion/aprobar` cuando el admin aprueba uno pendiente de stock) crean una fila `Cobro` a mano y hay que darles `monto` y actualizar `Orden.montoPagado`.

- [ ] **Step 1: Update the list collection route**

En `app/api/ordenes/[id]/cobrar/route.ts`, quitar el import de `esMetodoPago` (linea 11) y reemplazar el bloque de lineas 26-40 por:

```ts
    const { id } = await params;
    const body = await request.json();

    const orden = await collectOrderPayment({
      orderId: id,
      partes: Array.isArray(body.partes) ? body.partes : [],
      expectedRevision: body.expectedRevision,
      idempotencyKey: body.idempotencyKey,
      origen: 'lista',
      user: usuario,
    });
    return NextResponse.json(orden);
```

- [ ] **Step 2: Update the link collection route**

En `app/api/cobros/[token]/route.ts`, quitar el import de `esMetodoPago` (linea 12) y reemplazar el bloque de lineas 37-49 por:

```ts
    const body = await request.json();
    const actualizada = await collectOrderPayment({
      orderId: orden.id,
      partes: Array.isArray(body.partes) ? body.partes : [],
      expectedRevision: body.expectedRevision,
      idempotencyKey: body.idempotencyKey,
      origen: 'qr',
      user: usuario,
    });
    return NextResponse.json(actualizada);
```

- [ ] **Step 3: Update order creation**

En `app/api/ordenes/route.ts`, cambiar el import de la linea 26:

```ts
import { calcularMovimientosPago } from '@/types/cobro';
```

Agregar `montoPagado` al `tx.orden.create` que empieza en la linea 321, junto a `cobrada: cobradaAlCrear` (linea 340):

```ts
          montoPagado: cobradaAlCrear ? totalFinal : 0,
```

Y reemplazar el bloque de lineas 428-447 por:

```ts
        const movimientos = calcularMovimientosPago({
          metodoPago: 'transferencia',
          monto: totalFinal,
        });
        await tx.cobro.create({
          data: {
            ordenId: nuevaOrden.id,
            metodoPago: 'transferencia',
            monto: totalFinal,
            montoTotal: totalFinal,
            costoEnvio,
            ...movimientos,
            cobradoPorId: creador.id,
            cobradoPorNombre: creador.nombre,
            cobradoPorRol: creador.rol,
            origen: 'creacion_domicilio_transferencia',
            idempotencyKey: `auto_${nuevaOrden.id}`,
          },
        });
```

- [ ] **Step 4: Update stock approval**

En `app/api/ordenes/aprobacion/aprobar/route.ts`, cambiar el import de la linea 10:

```ts
import { calcularMovimientosPago } from '@/types/cobro';
```

Agregar `montoPagado` al bloque condicional del `updateMany` (linea 78-84), dentro del objeto `...(pagarTransferencia && { ... })`, junto a `cobrada: true`:

```ts
            montoPagado: orden.total,
```

Y reemplazar el bloque de lineas 129-148 por:

```ts
        const movimientos = calcularMovimientosPago({
          metodoPago: 'transferencia',
          monto: orden.total.toString(),
        });
        await tx.cobro.create({
          data: {
            ordenId,
            metodoPago: 'transferencia',
            monto: orden.total,
            montoTotal: orden.total,
            costoEnvio: orden.costoEnvio ?? 0,
            ...movimientos,
            cobradoPorId: orden.creadorId,
            cobradoPorNombre: orden.mesero,
            cobradoPorRol: orden.creadorRol ?? 'desconocido',
            origen: 'aprobacion_domicilio_transferencia',
            idempotencyKey: `auto_${ordenId}`,
          },
        });
```

- [ ] **Step 5: Confirm the rejection path already handles N payments**

`app/api/ordenes/aprobacion/rechazar/route.ts:81` marca el reembolso con `tx.cobro.updateMany({ where: { ordenId, estado: 'CONFIRMADO' }, ... })`. Al ser `updateMany` sobre `ordenId`, ya alcanza a todos los pagos de la orden sin cambio alguno. **No lo toques**: esta linea se lee como si solo afectara a una fila y es facil "corregirla" a un `update` singular, que romperia el reembolso de un cobro mixto. Solo verifica que sigue siendo `updateMany`.

- [ ] **Step 6: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: sin errores en ninguno de los cuatro ficheros de esta task. Siguen fallando solo la UI (`components/cobros/CobrarOrdenClient.tsx`, `app/mesero/page.tsx`, `app/digital/page.tsx`), que se migra en las Tasks 10, 11 y 13.

- [ ] **Step 7: Commit**

```bash
git add app/api/ordenes app/api/cobros
git commit -m "feat(api/cobros): accept a list of payment parts

Method validation moves into validarActoDeCobro, so the routes stop
duplicating it. The two automatic payment paths now write monto and keep
Orden.montoPagado in sync."
```

---

## Task 7: La orden que crece despues de pagada

**Files:**
- Modify: `app/api/ordenes/[id]/items/route.ts:179-199, 529-549`

**Interfaces:**
- Consumes: `calcularSaldo` de `types/orden.ts` (Task 2)

**Contexto:** hoy este endpoint rechaza con 409 cualquier orden `cobrada` (linea 179) y solo acepta los estados `pendiente`, `en_preparacion` y `lista` (linea 193). Ese rechazo es lo que hace imposible el caso real. Se levanta la prohibicion, pero solo para cambios que suben el total: bajar el total generaria saldo negativo, que es un reembolso y esta fuera de alcance.

- [ ] **Step 1: Replace the paid-order rejection**

En `app/api/ordenes/[id]/items/route.ts`, reemplazar el bloque de lineas 179-199 por:

```ts
        const saldo = calcularSaldo({
          total: order.total.toString(),
          montoPagado: order.montoPagado.toString(),
        });
        const yaPagada = saldo <= 0;

        // Una orden ya pagada puede CRECER: el cliente agrega algo y paga el
        // saldo despues, con el metodo que quiera. Lo que no puede es
        // encoger, porque eso obligaria a devolver dinero y el reembolso es
        // un flujo que no existe.
        if (yaPagada) {
          const reduceElTotal = body.items.some((change) => {
            if (change.accion === 'eliminar') return true;
            if (change.accion !== 'modificar') return false;

            const original = order.items.find((item) => item.id === change.itemId);
            return original ? change.cantidad < original.cantidad : true;
          });
          if (reduceElTotal) {
            throw new ModificationRequestError(
              'No se puede quitar productos ni reducir cantidades de una orden ya pagada.',
              400,
            );
          }
        }

        if (order.printRevision !== body.expectedRevision) {
          throw new ModificationRequestError(
            'La orden cambió mientras estaba abierta. Recárgala e intenta nuevamente.',
            409,
          );
        }

        const editableStatuses = [
          'pendiente',
          'en_preparacion',
          'lista',
          'cobrada',
        ];
        if (!editableStatuses.includes(order.estado)) {
          throw new ModificationRequestError(
            'Solo se pueden modificar órdenes activas',
            400,
          );
        }
```

- [ ] **Step 2: Add the import**

En la cabecera de `app/api/ordenes/[id]/items/route.ts`, agregar `calcularSaldo` al import que ya existe de `@/types/orden` (lineas 12-19):

```ts
import {
  calcularRecargoEnvases,
  calcularSaldo,
  esCategoriaCombo,
  esNivelPicante,
  RECARGO_RECIPIENTES,
  type NivelPicante,
  type TipoOrden,
} from '@/types/orden';
```

- [ ] **Step 3: Extend the ready-order guard**

La linea 201 (`const wasReady = order.estado === 'lista';`) tambien tiene que cubrir la orden pagada, para que vuelva a cocina. Reemplazarla por:

```ts
        // Una orden ya lista o ya cobrada regresa a preparacion si el cambio
        // trae comida nueva.
        const wasReady = order.estado === 'lista' || order.estado === 'cobrada';
```

Y borrar el bloque de lineas 202-219 (el `if (wasReady) { ... }` con `invalidChange`), porque la regla equivalente ya quedo cubierta arriba para el caso pagado. Para el caso `lista` sin pagar hay que conservarla, asi que en su lugar poner:

```ts
        if (order.estado === 'lista') {
          const invalidChange = body.items.some((change) => {
            if (change.accion === 'eliminar') return true;
            if (change.accion !== 'modificar') return false;

            const original = order.items.find((item) => item.id === change.itemId);
            return original ? change.cantidad < original.cantidad : true;
          });

          if (invalidChange) {
            throw new ModificationRequestError(
              'No se pueden eliminar items ni reducir cantidades de una orden ya lista.',
              400,
            );
          }
        }
```

- [ ] **Step 4: Recompute `cobrada` after the change**

Reemplazar el `tx.orden.updateMany` de lineas 529-543 por:

```ts
        // `cobrada` es derivado: si el total subio por encima de lo pagado, la
        // orden vuelve a tener saldo y reaparece en la lista de cobros.
        const siguePagada =
          calcularSaldo({
            total: newTotal,
            montoPagado: order.montoPagado.toString(),
          }) <= 0;

        const orderUpdate = await tx.orden.updateMany({
          where: {
            id,
            printRevision: body.expectedRevision,
          },
          data: {
            total: newTotal,
            recargo: newSurcharge > 0 ? newSurcharge : null,
            tiempoEstimado: newEstimatedTime,
            modificada: true,
            cobrada: siguePagada,
            printRevision: body.expectedRevision + 1,
            ...(newStatus ? { estado: newStatus } : {}),
          },
        });
```

El filtro `cobrada: false` del `where` desaparece: ahora una orden pagada tambien se puede modificar, y `printRevision` sigue siendo el candado.

- [ ] **Step 5: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: sin errores nuevos en este fichero.

- [ ] **Step 6: Manual verification**

Levantar el servidor y comprobar el caso real de punta a punta:

```bash
npm run dev
```

1. Crear una orden a domicilio con transferencia confirmada al crear. Debe nacer pagada.
2. Agregar un producto a esa orden desde el modal de edicion.
3. Comprobar que responde 200, que la orden vuelve a aparecer como no cobrada, y que `montoPagado` sigue siendo el total viejo mientras `total` subio.
4. Intentar quitar un producto de esa misma orden. Debe responder 400 con el mensaje de orden ya pagada.

- [ ] **Step 7: Commit**

```bash
git add app/api/ordenes/\[id\]/items/route.ts
git commit -m "feat(ordenes): let a paid order grow

Adding items to a paid order reopens its balance instead of being rejected
outright. Shrinking one stays blocked: that would owe the customer money, and
refunds are out of scope."
```

---

## Task 8: El QR de pago mira el saldo

**Files:**
- Modify: `lib/payment-link.ts:22-33`
- Modify: `lib/print-jobs.ts:65-84` (campo nuevo en `PrintOrderSource`)

**Interfaces:**
- Produces: `shouldPrintPaymentQr(order: { tipoOrden?: string | null; metodoPagoPrevisto?: string | null; total?: number | string; montoPagado?: number | string | null; cobrada?: boolean; cobroUrl?: string | null }): boolean`

**Contexto:** `shouldPrintPaymentQr` devuelve `false` si `order.cobrada`. Una orden reabierta tiene `cobrada: false` desde la Task 7, asi que tecnicamente ya funcionaria; el cambio es hacerlo explicito sobre el saldo para que no dependa de que otro sitio mantenga el booleano.

- [ ] **Step 1: Rewrite the predicate**

Reemplazar la funcion en `lib/payment-link.ts` (lineas 22-33) por:

```ts
export function shouldPrintPaymentQr(order: {
  tipoOrden?: string | null;
  metodoPagoPrevisto?: string | null;
  cobrada?: boolean;
  total?: number | string;
  montoPagado?: number | string | null;
  cobroUrl?: string | null;
}): boolean {
  if (!order.cobroUrl) return false;

  // Manda el saldo, no el booleano: una orden que crecio despues de pagada
  // vuelve a necesitar su QR. `cobrada` solo decide cuando no hay total, que
  // pasa en los payloads de impresion antiguos.
  const hayTotal = order.total !== undefined && order.total !== null;
  const conSaldo = hayTotal
    ? Math.round(Number(order.total) * 100) -
        Math.round(Number(order.montoPagado ?? 0) * 100) >
      0
    : !order.cobrada;
  if (!conSaldo) return false;

  if (order.tipoOrden === 'domicilio') {
    return order.metodoPagoPrevisto === 'efectivo';
  }
  return true;
}
```

- [ ] **Step 2: Pass the new fields through the print payload**

En `lib/print-jobs.ts`, agregar a la interfaz `PrintOrderSource` (despues de `cobrada?: boolean;`, linea 79):

```ts
  montoPagado?: NumericValue | null;
```

La llamada de `buildOrderSnapshot` (linea 337) hoy pasa el objeto entero. Hay que convertir los dos numericos antes, porque en `PrintOrderSource` llegan como `Prisma.Decimal` y `Number(decimal)` no es fiable. Reemplazar:

```ts
  const paymentUrl = shouldPrintPaymentQr(order)
    ? normalizeOptionalText(order.cobroUrl)
    : null;
```

por:

```ts
  const paymentUrl = shouldPrintPaymentQr({
    ...order,
    total: toNumber(order.total),
    montoPagado: toNumber(order.montoPagado),
  })
    ? normalizeOptionalText(order.cobroUrl)
    : null;
```

`toNumber` ya existe en el fichero (linea 247) y sabe desenvolver un `Decimal` de Prisma.

- [ ] **Step 3: Run the print job tests**

```bash
npm run test:print-jobs && npm run test:printer && npm run test:print-config
```

Expected: PASS los tres. Si alguno falla, es porque un payload de prueba dejaba de imprimir el QR: revisa que el caso de prueba traiga `total` y `montoPagado` coherentes.

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/payment-link.ts lib/print-jobs.ts
git commit -m "fix(impresion): print the payment QR whenever a balance is due

A reopened order needs its QR back. The predicate now reads the balance and
falls back to the cobrada flag only for legacy payloads with no total."
```

---

## Task 9: El cuadre suma pagos

**Files:**
- Modify: `types/cuadre.ts` (reemplaza `OrdenParaCuadre`, `ResumenCuadre` y `calcularResumenCuadre`)
- Modify: `app/api/admin/cuadre/route.ts:60-122`
- Modify: `lib/cuadre.test.ts` (casos nuevos al final)

**Interfaces:**
- Consumes: `calcularLiquidacionDomicilio`, `obtenerCostoEnvio`, `calcularSaldo` de `types/orden.ts` (Task 2); `esMetodoPago`
- Produces:
  - `interface PagoParaCuadre { metodoPago: string; monto: number | string; enRango: boolean }`
  - `OrdenParaCuadre` gana `pagos?: readonly PagoParaCuadre[]` y `montoPagado?: number | string | null`
  - `ResumenCuadre` gana `ordenesConSaldoPendiente: number` y `montoSaldoPendiente: number`

**Contexto y formulas.** El cuadre pasa a tener dos fuentes. El dinero que entro sale de sumar pagos; la liquidacion del motorizado sale de la orden. Las formulas, verificadas contra los tres casos historicos:

Para cada orden a domicilio cobrada en el rango, con `efectivoCobrado` = suma del efectivo de todos sus pagos:

```
efectivoCobradoMotorizados   += liquidacion.entregaElMotorizado
efectivoEntregadoMotorizados += liquidacion.entregaElLocal
depositosRecibidos           += suma de las transferencias de la orden
transferenciasVentas         += depositos de la orden - liquidacion.entregaElLocal
```

Para el resto de ordenes cobradas en el rango:

```
efectivoVentasDirectas += suma del efectivo
transferenciasVentas   += suma de las transferencias
depositosRecibidos     += suma de las transferencias
```

Comprobacion de que reproduce lo de hoy:

| Caso | Envio | Efectivo | Transferencia | cobradoMot | entregadoMot | transferenciasVentas |
|---|---|---|---|---|---|---|
| Domicilio efectivo, total 30 | 5 | 30 | 0 | 25 | 0 | 0 |
| Domicilio transferencia, total 40 | 6 | 0 | 40 | 0 | 6 | 34 |
| Mixto real, total 13 | 3 | 5 | 8 | 2 | 0 | 8 |

En los tres, `cobradoMot + transferenciasVentas` da la venta propia (25, 34, 10). Y la invariante que ya asserta el test, `depositosRecibidos - transferenciasVentas === efectivoEntregadoMotorizados`, se mantiene.

- [ ] **Step 1: Write the failing test**

Anadir al final de `lib/cuadre.test.ts`:

```ts
// --- Multipago ---------------------------------------------------------

const pago = (metodoPago: string, monto: number) => ({
  metodoPago,
  monto,
  enRango: true,
});

// Los cuatro casos historicos, ahora expresados como pagos, deben dar
// exactamente las mismas cifras que el primer bloque de este fichero.
const conPagos = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 25,
    montoPagado: 25,
    pagos: [pago("efectivo", 25)],
  },
  {
    cobrada: true,
    tipoOrden: "para_llevar",
    total: 15,
    montoPagado: 15,
    pagos: [pago("transferencia", 15)],
  },
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 30,
    costoEnvio: 5,
    montoPagado: 30,
    pagos: [pago("efectivo", 30)],
  },
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 40,
    costoEnvio: 6,
    montoPagado: 40,
    pagos: [pago("transferencia", 40)],
  },
  { cobrada: false, tipoOrden: "local", total: 100, montoPagado: 0, pagos: [] },
]);

assert.equal(conPagos.efectivoVentasDirectas, 25);
assert.equal(conPagos.efectivoCobradoMotorizados, 25);
assert.equal(conPagos.efectivoEntregadoMotorizados, 6);
assert.equal(conPagos.transferenciasVentas, 49);
assert.equal(conPagos.depositosRecibidos, 55);
assert.equal(conPagos.ventasCobradas, 99);
assert.equal(conPagos.efectivoEnCaja, 44);

// El caso real: domicilio de 13 con envio de 3, pagado 8 por transferencia y
// 5 en efectivo. El motorizado entrega 5 - 3 = 2 al local.
const mixtoDomicilio = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 13,
    costoEnvio: 3,
    montoPagado: 13,
    pagos: [pago("transferencia", 8), pago("efectivo", 5)],
  },
]);
assert.equal(mixtoDomicilio.efectivoCobradoMotorizados, 2);
assert.equal(mixtoDomicilio.efectivoEntregadoMotorizados, 0);
assert.equal(mixtoDomicilio.depositosRecibidos, 8);
assert.equal(mixtoDomicilio.transferenciasVentas, 8);
assert.equal(mixtoDomicilio.ventasCobradas, 10);
assert.equal(mixtoDomicilio.efectivoEnCaja, 2);
assert.equal(
  mixtoDomicilio.depositosRecibidos - mixtoDomicilio.transferenciasVentas,
  mixtoDomicilio.efectivoEntregadoMotorizados,
);

// Mixto sin motorizado: las dos partes son venta propia y caja directa.
const mixtoLocal = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 25,
    montoPagado: 25,
    pagos: [pago("efectivo", 10), pago("transferencia", 15)],
  },
]);
assert.equal(mixtoLocal.efectivoVentasDirectas, 10);
assert.equal(mixtoLocal.transferenciasVentas, 15);
assert.equal(mixtoLocal.depositosRecibidos, 15);
assert.equal(mixtoLocal.ventasCobradas, 25);

// Un pago fuera del rango no entra en el dinero del dia.
const pagoDeOtroDia = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "local",
    total: 25,
    montoPagado: 25,
    pagos: [
      { metodoPago: "efectivo", monto: 10, enRango: false },
      { metodoPago: "efectivo", monto: 15, enRango: true },
    ],
  },
]);
assert.equal(pagoDeOtroDia.efectivoVentasDirectas, 15);

// Fallback historico: una orden cobrada sin filas de pago se lee por
// `metodoPago`, con la logica de siempre.
const historica = calcularResumenCuadre([
  {
    cobrada: true,
    tipoOrden: "domicilio",
    total: 40,
    costoEnvio: 6,
    metodoPago: "transferencia",
  },
]);
assert.equal(historica.transferenciasVentas, 34);
assert.equal(historica.depositosRecibidos, 40);
assert.equal(historica.efectivoEntregadoMotorizados, 6);

// La red que evita que una orden reabierta cruce el cierre del dia.
const conSaldo = calcularResumenCuadre([
  {
    cobrada: false,
    tipoOrden: "local",
    total: 30,
    montoPagado: 25,
    pagos: [pago("efectivo", 25)],
  },
  { cobrada: true, tipoOrden: "local", total: 10, montoPagado: 10, pagos: [pago("efectivo", 10)] },
]);
assert.equal(conSaldo.ordenesConSaldoPendiente, 1);
assert.equal(conSaldo.montoSaldoPendiente, 5);
// El efectivo ya recibido si cuenta, aunque la orden no este cerrada.
assert.equal(conSaldo.efectivoVentasDirectas, 35);

console.log("cuadre.test.ts multipago OK");
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:cuadre
```

Expected: FAIL. El primer bloque del fichero sigue pasando (usa la forma vieja), pero el bloque nuevo revienta con `TS2353: Object literal may only specify known properties, and 'pagos' does not exist in type 'OrdenParaCuadre'`.

- [ ] **Step 3: Write the implementation**

En `types/cuadre.ts`, reemplazar los imports y las interfaces de cabecera (lineas 1-44) por:

```ts
import {
  calcularLiquidacionDomicilio,
  calcularSaldo,
  esMetodoPago,
  obtenerCostoEnvio,
} from "./orden";
import { ESTADO_RETIRO_ANULADO } from "./retiro";

export interface PagoParaCuadre {
  metodoPago: string;
  monto: number | string;
  /** Si la fecha del pago cae dentro del rango del cierre. Lo decide la ruta. */
  enRango: boolean;
}

export interface OrdenParaCuadre {
  cobrada: boolean;
  tipoOrden?: string | null;
  total: number | string;
  costoEnvio?: number | string | null;
  montoPagado?: number | string | null;
  /** Metodo resumido. Solo se usa como fallback de ordenes sin filas de pago. */
  metodoPago?: string | null;
  estadoCobro?: string | null;
  pagos?: readonly PagoParaCuadre[];
}

export interface RetiroParaCuadre {
  monto: number | string;
  estado: string;
}

export interface ResumenCuadre {
  totalOrdenes: number;
  ordenesCobradas: number;
  ordenesSinCobrar: number;
  /** Venta del local: totales sin el envio, cobradas y no cobradas. */
  ventasTotales: number;
  ventasSinCobrar: number;
  ventasCobradas: number;
  efectivoVentasDirectas: number;
  efectivoCobradoMotorizados: number;
  efectivoEntregadoMotorizados: number;
  efectivoEnCaja: number;
  /** Venta propia cobrada por transferencia, sin el envio. */
  transferenciasVentas: number;
  /** Lo que realmente llego al banco: incluye el envio que se devuelve. */
  depositosRecibidos: number;
  /** Dinero del motorizado que paso por las ordenes cobradas. No es ingreso. */
  enviosMotorizados: number;
  /** Efectivo que los empleados sacaron de la caja. Los anulados no cuentan. */
  retirosEfectivo: number;
  cantidadRetiros: number;
  /**
   * Deuda con el cliente, no una venta: es lo que el cliente pago y todavia hay
   * que devolverle, asi que va en bruto e incluye el envio.
   */
  montoReembolsoPendiente: number;
  /**
   * Ordenes que recibieron algun pago pero todavia deben. Aparecen cuando una
   * orden ya pagada crece. No se puede cerrar el dia con ninguna: es la red
   * que evita que un cobro cruce a la caja del dia siguiente.
   */
  ordenesConSaldoPendiente: number;
  montoSaldoPendiente: number;
}
```

Reemplazar el cuerpo del `reduce` dentro de `calcularResumenCuadre` (lineas 76-140) por:

```ts
  const resumen = ordenes.reduce(
    (acumulado, orden) => {
      const total = aCentavos(orden.total);
      const costoEnvio = aCentavos(obtenerCostoEnvio(orden));
      const ventaPropia = total - costoEnvio;
      const pagos = orden.pagos ?? [];

      acumulado.ventasTotales += ventaPropia;

      // Una orden con algun pago pero todavia con deuda es una orden que
      // crecio despues de cobrada. Se cuenta aparte, aunque no este cerrada.
      const saldo = aCentavos(
        calcularSaldo({ total: orden.total, montoPagado: orden.montoPagado }),
      );
      if (saldo > 0 && aCentavos(orden.montoPagado) > 0) {
        acumulado.ordenesConSaldoPendiente += 1;
        acumulado.montoSaldoPendiente += saldo;
      }

      // El dinero que entro se cuenta pago a pago, este la orden cerrada o no:
      // el efectivo de una orden a medio pagar ya esta en la caja.
      const pagosEnRango = pagos.filter((pago) => pago.enRango);
      const efectivoEnRango = pagosEnRango
        .filter((pago) => pago.metodoPago === "efectivo")
        .reduce((suma, pago) => suma + aCentavos(pago.monto), 0);
      const transferenciaEnRango = pagosEnRango
        .filter((pago) => pago.metodoPago === "transferencia")
        .reduce((suma, pago) => suma + aCentavos(pago.monto), 0);

      if (pagos.length > 0) {
        if (orden.tipoOrden === "domicilio") {
          // El envio se liquida una sola vez, sobre TODO el efectivo de la
          // orden, no sobre el de un pago suelto.
          const efectivoTotal = pagos
            .filter((pago) => pago.metodoPago === "efectivo")
            .reduce((suma, pago) => suma + aCentavos(pago.monto), 0);
          const liquidacion = calcularLiquidacionDomicilio(
            orden,
            aDolares(efectivoTotal),
          );
          const entregaElLocal = aCentavos(liquidacion?.entregaElLocal ?? 0);
          const entregaElMotorizado = aCentavos(
            liquidacion?.entregaElMotorizado ?? 0,
          );

          acumulado.efectivoCobradoMotorizados += entregaElMotorizado;
          acumulado.efectivoEntregadoMotorizados += entregaElLocal;
          acumulado.depositosRecibidos += transferenciaEnRango;
          acumulado.transferenciasVentas += transferenciaEnRango - entregaElLocal;
        } else {
          acumulado.efectivoVentasDirectas += efectivoEnRango;
          acumulado.transferenciasVentas += transferenciaEnRango;
          acumulado.depositosRecibidos += transferenciaEnRango;
        }
      }

      if (!orden.cobrada) {
        acumulado.ordenesSinCobrar += 1;
        acumulado.ventasSinCobrar += ventaPropia;
        return acumulado;
      }

      acumulado.ordenesCobradas += 1;
      acumulado.ventasCobradas += ventaPropia;
      acumulado.enviosMotorizados += costoEnvio;

      // El reembolso es lo que hay que devolverle al cliente: va en bruto,
      // porque el cliente pago el envio junto con el pedido.
      if (orden.estadoCobro === "REEMBOLSO_PENDIENTE") {
        acumulado.montoReembolsoPendiente += total;
      }

      // Fallback historico: ordenes cobradas antes de que existieran las filas
      // de pago. Se leen por `metodoPago` con la logica de siempre.
      if (pagos.length > 0 || !esMetodoPago(orden.metodoPago)) {
        return acumulado;
      }

      if (orden.tipoOrden === "domicilio") {
        if (orden.metodoPago === "efectivo") {
          acumulado.efectivoCobradoMotorizados += ventaPropia;
        } else {
          acumulado.transferenciasVentas += ventaPropia;
          acumulado.depositosRecibidos += total;
          acumulado.efectivoEntregadoMotorizados += costoEnvio;
        }
        return acumulado;
      }

      if (orden.metodoPago === "efectivo") {
        acumulado.efectivoVentasDirectas += ventaPropia;
      } else {
        acumulado.transferenciasVentas += ventaPropia;
        acumulado.depositosRecibidos += ventaPropia;
      }

      return acumulado;
    },
    {
      ordenesCobradas: 0,
      ordenesSinCobrar: 0,
      ventasTotales: 0,
      ventasSinCobrar: 0,
      ventasCobradas: 0,
      efectivoVentasDirectas: 0,
      efectivoCobradoMotorizados: 0,
      efectivoEntregadoMotorizados: 0,
      transferenciasVentas: 0,
      depositosRecibidos: 0,
      enviosMotorizados: 0,
      montoReembolsoPendiente: 0,
      ordenesConSaldoPendiente: 0,
      montoSaldoPendiente: 0,
    },
  );
```

Y en el objeto de retorno (lineas 150-176), agregar antes del cierre:

```ts
    ordenesConSaldoPendiente: resumen.ordenesConSaldoPendiente,
    montoSaldoPendiente: aDolares(resumen.montoSaldoPendiente),
```

Ojo: el primer bloque de `lib/cuadre.test.ts` hace `assert.deepEqual` contra el resumen completo, asi que hay que anadirle los dos campos nuevos con valor 0 para que siga pasando.

- [ ] **Step 4: Update the existing deepEqual assertion**

En `lib/cuadre.test.ts`, dentro del `assert.deepEqual(resumen, { ... })` de la linea 41, agregar antes del cierre:

```ts
  ordenesConSaldoPendiente: 0,
  montoSaldoPendiente: 0,
```

Repetir en cualquier otro `deepEqual` contra un `ResumenCuadre` completo que exista mas abajo en el fichero.

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:cuadre
```

Expected: PASS, imprime `cuadre.test.ts multipago OK`.

- [ ] **Step 6: Feed the payments from the route**

En `app/api/admin/cuadre/route.ts`, cambiar el `include` del `findMany` de ordenes (lineas 60-72) para traer los pagos completos:

```ts
        include: {
          pagos: {
            select: {
              createdAt: true,
              estado: true,
              metodoPago: true,
              monto: true,
            },
          },
          creador: {
            select: { id: true, nombre: true, rol: true },
          },
          items: {
            include: {
              producto: true,
            },
          },
        },
```

El `where` (lineas 48-57) tambien cambia, porque `cobro` paso a llamarse `pagos` y de uno a muchos:

```ts
            {
              pagos: {
                some: {
                  createdAt: {
                    gte: rango.inicio,
                    lt: rango.fin,
                  },
                },
              },
            },
```

Y reemplazar el `map` de `ordenesConCreador` (lineas 94-122) por:

```ts
    const ordenesConCreador = ordenes.map((orden) => {
      const creadorInferido = usuariosPorNombre.get(
        normalizarNombre(orden.mesero),
      );
      const cobradaEnFecha = isConfirmedPaymentInRange(orden, rango);
      const {
        cobroTokenHash: _privateTokenHash,
        pagos: _privatePayments,
        ...safeOrder
      } = orden;
      void _privateTokenHash;
      return {
        ...safeOrder,
        // El cuadre es por fecha del movimiento, no por el estado actual. Asi una
        // orden creada ayer y cobrada hoy no aparece cobrada en ambos cierres.
        cobrada: cobradaEnFecha,
        metodoPago: cobradaEnFecha ? orden.metodoPago : null,
        fechaCobro: cobradaEnFecha ? orden.fechaCobro : null,
        estadoCobro:
          _privatePayments.find((pago) => pago.estado !== 'CONFIRMADO')?.estado ??
          _privatePayments[0]?.estado ??
          null,
        // Cada pago dice si cae en el rango. El resumen suma solo los que si.
        pagos: _privatePayments
          .filter((pago) => pago.estado !== 'REEMBOLSADO')
          .map((pago) => ({
            metodoPago: pago.metodoPago,
            monto: Number(pago.monto),
            enRango:
              pago.createdAt >= rango.inicio && pago.createdAt < rango.fin,
          })),
        creadorNombre:
          orden.creador?.nombre ?? creadorInferido?.nombre ?? orden.mesero,
        creadorRol:
          orden.creadorRol ??
          orden.creador?.rol ??
          creadorInferido?.rol ??
          'desconocido',
      };
    });
```

- [ ] **Step 7: Update `isConfirmedPaymentInRange`**

`lib/cuadre-date.ts` lee hoy `payment.cobro`, que ya no existe. Reemplazar el fichero completo por:

```ts
export function isConfirmedPaymentInRange(
  payment: {
    cobrada: boolean;
    fechaCobro?: Date | null;
    pagos?: readonly { createdAt: Date; estado: string }[] | null;
  },
  range: { inicio: Date; fin: Date },
): boolean {
  if (!payment.cobrada) return false;

  const pagos = payment.pagos ?? [];
  // Con multipago la orden cuenta como cobrada en la fecha del pago que la
  // cerro, es decir el ultimo. Un pago reembolsado no cierra nada.
  const vigentes = pagos.filter((pago) =>
    ['CONFIRMADO', 'REEMBOLSO_PENDIENTE'].includes(pago.estado),
  );
  if (pagos.length > 0 && vigentes.length === 0) return false;

  const movementDate = vigentes.length
    ? vigentes.reduce((ultimo, pago) =>
        pago.createdAt > ultimo.createdAt ? pago : ultimo,
      ).createdAt
    : payment.fechaCobro;

  return Boolean(
    movementDate && movementDate >= range.inicio && movementDate < range.fin,
  );
}
```

Comprobar que compila:

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add types/cuadre.ts app/api/admin/cuadre/route.ts lib/cuadre.test.ts lib/cuadre-date.ts
git commit -m "feat(cuadre): count money from payments instead of order method

Cash and transfers now come from the payment rows; the rider settlement stays
at order level, computed once from the order's total cash. Orders paid before
the Cobro table existed keep the old path. Adds the pending-balance figure so
no reopened order crosses the daily close unnoticed."
```

---

## Task 10: Cobro mixto en la pantalla de cobro

**Reescrita tras la reconciliacion**: la version original de esta task se
escribio contra un componente de 270 lineas que no tenia subida real de
comprobante. El componente real tiene 425 lineas, con un flujo de subida a S3
ya en produccion (`comprimirImagen`, `POST /api/cobros/[token]/comprobante`,
reintento/fallback si falla, `storageDisponible`). Esta version reutiliza esa
maquinaria en vez de reemplazarla.

**Files:**
- Modify: `components/cobros/CobrarOrdenClient.tsx`
- Modify: `app/ordenes/cobrar/[token]/page.tsx` (pasar `montoPagado`)

**Interfaces:**
- Consumes: la API de la Task 6 (`{ partes, expectedRevision, idempotencyKey }`), `montoACobrarEnCaja` de `types/cobro.ts`

**Contexto:** hoy el componente tiene dos botones (Efectivo, Transferencia) y
manda `{ metodoPago, comprobanteTransferenciaKey? }`. Pasa a tener tres, y el
saldo (`orden.total - orden.montoPagado`) reemplaza al total como cifra a
cobrar.

**Punto critico — que va en `parte.monto`:** `validarActoDeCobro` exige que
las partes sumen EXACTO el saldo de la orden. `parte.monto` es siempre la
cifra bruta que se descuenta del saldo (para efectivo puro o transferencia
pura, el saldo completo; en mixto, lo que el usuario teclea mas el resto).
`montoACobrarEnCaja` en cambio es una cifra de **presentacion**: para
domicilio+efectivo, resta el envio porque ese dinero nunca llega a la caja
(se lo queda el motorizado). Nunca se manda `montoACobrarEnCaja(...)` como
`parte.monto` — eso rompe el cuadre de `validarActoDeCobro` y le resta al
saldo un monto que el cliente no reconoce como pagado.

- [ ] **Step 1: Pass the balance from the server component**

En `app/ordenes/cobrar/[token]/page.tsx`, agregar al `select` de la orden, justo despues de `total: true,` (linea 51):

```ts
      montoPagado: true,
```

Y en `serializableOrder` (linea 88), despues de `total: Number(orden.total),`:

```ts
    montoPagado: Number(orden.montoPagado),
```

La guarda `if (orden.cobrada) redirect(...)` de la linea 74 se queda tal cual: una orden reabierta tiene `cobrada: false` desde la Task 7, asi que ya deja pasar el cobro del saldo.

- [ ] **Step 2: Add the balance to the component contract**

En `components/cobros/CobrarOrdenClient.tsx`, agregar a la interfaz `CobroOrder` (despues de `total: number;`, linea 28):

```ts
  montoPagado: number;
```

- [ ] **Step 3: Add the saldo and a generic "acto de cobro" type**

Despues de los imports (linea 13), agregar el tipo que viaja al backend:

```ts
interface ParteDePago {
  metodoPago: MetodoPago;
  monto: number;
  comprobanteTransferenciaKey?: string;
}
```

Reemplazar el bloque de calculos de montos (lineas 84-101, desde `// Lo que entra a caja...` hasta el cierre de `montoTransferencia`) por:

```ts
  // El saldo es lo que falta por cobrar, no el total: una orden reabierta
  // (crecio despues de pagada) solo debe el resto.
  const saldoCentavos = Math.max(
    0,
    Math.round(orden.total * 100) - Math.round(orden.montoPagado * 100),
  );
  const saldo = saldoCentavos / 100;
  // El envio solo se neta la PRIMERA vez que se cobra la orden: para una
  // orden reabierta ya se liquido con el motorizado en el pago anterior, asi
  // que el saldo se muestra tal cual, sin volver a restarlo.
  const esPrimerPago = orden.montoPagado <= 0;
  const montoEfectivo = esPrimerPago
    ? montoACobrarEnCaja({
        tipoOrden: orden.tipoOrden,
        total: saldo,
        costoEnvio: orden.costoEnvio,
        metodoPago: "efectivo",
      })
    : saldo;
  const montoTransferencia = esPrimerPago
    ? montoACobrarEnCaja({
        tipoOrden: orden.tipoOrden,
        total: saldo,
        costoEnvio: orden.costoEnvio,
        metodoPago: "transferencia",
      })
    : saldo;
  const esDomicilio = orden.tipoOrden === "domicilio";
```

- [ ] **Step 4: Generalize `cobrar` to N parts**

Reemplazar la funcion `cobrar` (lineas 108-149) por:

```ts
  const cobrar = async (
    partes: ParteDePago[],
    etiqueta: string,
  ): Promise<boolean> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/cobros/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partes,
          expectedRevision: orden.printRevision,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo registrar el cobro");
      if (!cerrarAlFinalizar) {
        router.replace(successUrl);
        router.refresh();
        return true;
      }
      // El cobro llegó desde el enlace/QR, en una pestaña dedicada. Se muestra la
      // confirmación y se pide cerrarla. El navegador solo permite `close()` si la
      // pestaña la abrió un script o si no acumuló historial (p. ej. no pasó por el
      // login): cuando lo bloquea, esta misma pantalla queda como salida manual.
      setCobrado(etiqueta);
      window.close();
      return true;
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "No se pudo registrar el cobro",
      );
      return false;
    } finally {
      setLoading(false);
    }
  };
```

El tipo de `cobrado` (linea 82, `useState<MetodoPago | null>(null)`) pasa a `useState<string | null>(null)`, para admitir la etiqueta `"mixto"`.

- [ ] **Step 5: Generalize the upload-then-charge flow**

Aqui es donde vive la logica que la version original de esta task iba a
borrar: la subida real a S3 con reintento y fallback. Se generaliza para que
sirva tanto para transferencia pura como para la parte de transferencia de un
mixto, sin duplicar el manejo de errores.

Agregar el estado del modo mixto justo despues de `estadoTransferencia`
(linea 79):

```ts
  const [modoActivo, setModoActivo] = useState<"transferencia" | "mixto" | null>(null);
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState("");
```

`showTransfer` (linea 69) se elimina: su rol pasa a `modoActivo !== null`.

Despues de los calculos de montos del Step 3, agregar los calculos del split
mixto:

```ts
  const efectivoMixtoCentavos = Math.round(Number(montoEfectivoMixto || 0) * 100);
  const transferenciaMixtoCentavos = saldoCentavos - efectivoMixtoCentavos;
  const mixtoValido = efectivoMixtoCentavos > 0 && transferenciaMixtoCentavos > 0;

  // Que partes arma este acto de cobro segun el modo activo. `objectKey` es
  // el resultado (posiblemente null) de la subida a S3.
  const partesDelModo = (objectKey: string | null): ParteDePago[] =>
    modoActivo === "mixto"
      ? [
          { metodoPago: "efectivo", monto: efectivoMixtoCentavos / 100 },
          {
            metodoPago: "transferencia",
            monto: transferenciaMixtoCentavos / 100,
            ...(objectKey ? { comprobanteTransferenciaKey: objectKey } : {}),
          },
        ]
      : [
          {
            metodoPago: "transferencia",
            monto: saldo,
            ...(objectKey ? { comprobanteTransferenciaKey: objectKey } : {}),
          },
        ];
```

Reemplazar `subirYCobrar` (lineas 155-199) por:

```ts
  const subirComprobante = async (): Promise<string | null> => {
    const comprimida = await comprimirImagen(photo!);
    const formData = new FormData();
    formData.append(
      "archivo",
      new File([comprimida], "comprobante.jpg", { type: "image/jpeg" }),
    );
    const respuesta = await fetch(
      `/api/cobros/${encodeURIComponent(token)}/comprobante`,
      { method: "POST", body: formData },
    );
    let datos: { error?: string; objectKey?: string };
    try {
      datos = await respuesta.json();
    } catch {
      // Un proxy o gateway puede responder con HTML (o nada) en vez de JSON, por
      // ejemplo un 413 que corta la subida antes de que la app la vea: sin esto el
      // error mostrado sería "Unexpected token '<'" en vez de un texto legible.
      datos = {
        error:
          respuesta.status === 413
            ? "La foto es muy pesada, repítela"
            : "No se pudo subir el comprobante",
      };
    }
    if (!respuesta.ok) throw new Error(datos.error || "No se pudo subir el comprobante");
    return datos.objectKey ?? null;
  };

  // Sube primero y cobra despues, con la key ya validada. Si el storage falla, el
  // cobro no se bloquea: la pantalla ofrece reintentar o registrar sin
  // comprobante, y el cuadre marca despues esa transferencia. El estado de fallo
  // se activa tanto si falla la subida como si falla el cobro posterior. Sirve
  // tanto para transferencia pura como para la parte de transferencia de un
  // mixto: la diferencia esta en `partesDelModo`.
  const subirYCobrar = async () => {
    if (!photo) return;
    setEstadoTransferencia("subiendo");
    setError("");
    try {
      const objectKey = await subirComprobante();
      setEstadoTransferencia("cobrando");
      const ok = await cobrar(partesDelModo(objectKey), modoActivo ?? "transferencia");
      setEstadoTransferencia(ok ? "idle" : "fallo");
    } catch (subidaError) {
      setEstadoTransferencia("fallo");
      setError(
        subidaError instanceof Error
          ? subidaError.message
          : "No se pudo subir el comprobante",
      );
    }
  };
```

- [ ] **Step 6: Update the success screen**

Reemplazar el bloque de monto en la pantalla de exito (lineas 208-213) por:

```tsx
            <strong>
              $
              {(cobrado === "mixto"
                ? saldo
                : cobrado === "efectivo"
                  ? montoEfectivo
                  : montoTransferencia
              ).toFixed(2)}
            </strong>{" "}
            en {cobrado}.
```

- [ ] **Step 7: Update the total/balance display**

Reemplazar el bloque `Total que paga el cliente` / `Recibes en caja` (lineas
283-300) por:

```tsx
            <div className={`flex justify-between border-t pt-2 ${esDomicilio ? "font-semibold" : "text-2xl font-bold"}`}>
              <span>{esDomicilio ? "Total que paga el cliente" : "Total cliente"}</span>
              <span className={esDomicilio ? "" : "text-emerald-700"}>${orden.total.toFixed(2)}</span>
            </div>
            {orden.montoPagado > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Ya pagado</span>
                <span>-${orden.montoPagado.toFixed(2)}</span>
              </div>
            )}
            {esDomicilio && (
              <div className="flex justify-between border-t pt-2 text-2xl font-bold">
                <span>{orden.montoPagado > 0 ? "Saldo a cobrar" : "Recibes en caja"}</span>
                <span className="text-emerald-700">
                  ${montoEfectivo.toFixed(2)}
                  {montoTransferencia !== montoEfectivo && (
                    <span className="block text-right text-sm font-semibold text-slate-500">
                      o ${montoTransferencia.toFixed(2)} por transferencia
                    </span>
                  )}
                </span>
              </div>
            )}
            {!esDomicilio && orden.montoPagado > 0 && (
              <div className="flex justify-between border-t pt-2 text-2xl font-bold">
                <span>Saldo a cobrar</span>
                <span className="text-emerald-700">${saldo.toFixed(2)}</span>
              </div>
            )}
```

- [ ] **Step 8: Add the third button and update the existing two**

Reemplazar la seccion de botones (lineas 312-329) por:

```tsx
        <section className="grid gap-3 sm:grid-cols-3">
          <button
            onClick={() => { setModoActivo(null); setConfirmCash(true); }}
            disabled={loading || estadoTransferencia === "subiendo" || estadoTransferencia === "cobrando"}
            className="rounded-2xl bg-emerald-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-emerald-700 disabled:bg-slate-400"
          >
            💵 Efectivo
            <span className="block text-2xl">${montoEfectivo.toFixed(2)}</span>
          </button>
          <button
            onClick={() => { setConfirmCash(false); setModoActivo("transferencia"); }}
            disabled={loading || estadoTransferencia === "subiendo" || estadoTransferencia === "cobrando"}
            className="rounded-2xl bg-blue-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-blue-700 disabled:bg-slate-400"
          >
            🏦 Transferencia
            <span className="block text-2xl">${montoTransferencia.toFixed(2)}</span>
          </button>
          <button
            onClick={() => { setConfirmCash(false); setModoActivo("mixto"); }}
            disabled={loading || estadoTransferencia === "subiendo" || estadoTransferencia === "cobrando"}
            className="rounded-2xl bg-amber-600 px-5 py-5 text-lg font-bold text-white shadow hover:bg-amber-700 disabled:bg-slate-400"
          >
            🔀 Mixto
            <span className="block text-2xl">${saldo.toFixed(2)}</span>
          </button>
        </section>
```

- [ ] **Step 9: Update the transfer panel to cover both transferencia and mixto**

Reemplazar el bloque `{showTransfer && ( ... )}` completo (lineas 331-401)
por:

```tsx
        {modoActivo && (
          <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow">
            <h2 className="text-lg font-bold">
              {modoActivo === "mixto" ? "Cobro mixto" : "Comprobante de transferencia"}
            </h2>

            {modoActivo === "mixto" && (
              <>
                <p className="mt-1 text-sm text-slate-600">
                  Escribe cuánto paga en efectivo. El resto se cobra por transferencia.
                </p>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Monto en efectivo
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max={saldo}
                    value={montoEfectivoMixto}
                    onChange={(event) => setMontoEfectivoMixto(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-2xl font-bold"
                    placeholder="0.00"
                  />
                </label>
                <div className="mt-4 space-y-1 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between"><span>Efectivo</span><span className="font-semibold">${(efectivoMixtoCentavos / 100).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Transferencia</span><span className="font-semibold">${(transferenciaMixtoCentavos / 100).toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-bold"><span>Saldo</span><span>${saldo.toFixed(2)}</span></div>
                </div>
                {transferenciaMixtoCentavos <= 0 && efectivoMixtoCentavos > 0 && (
                  <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                    El efectivo cubre todo el saldo. Usa el botón de Efectivo.
                  </p>
                )}
                {esDomicilio && efectivoMixtoCentavos > 0 && (
                  <p className="mt-3 rounded-lg bg-purple-50 p-3 text-sm text-purple-900">
                    {efectivoMixtoCentavos >= Math.round(orden.costoEnvio * 100)
                      ? `El motorizado te entrega $${((efectivoMixtoCentavos - Math.round(orden.costoEnvio * 100)) / 100).toFixed(2)}.`
                      : `Le entregas $${((Math.round(orden.costoEnvio * 100) - efectivoMixtoCentavos) / 100).toFixed(2)} al motorizado.`}
                  </p>
                )}
              </>
            )}

            <p className="mt-4 text-sm text-slate-600">Toma una foto clara del comprobante mostrado por el cliente.</p>
            <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-blue-400 p-5 text-center font-bold text-blue-700 hover:bg-blue-50">
              📷 Tomar foto
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              />
            </label>
            {photo && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Foto seleccionada: <strong>{photo.name}</strong>
              </div>
            )}
            {!storageDisponible && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                El almacenamiento de comprobantes no está configurado en este
                entorno. Puedes registrar el cobro, pero la foto no se guardará.
              </div>
            )}
            {estadoTransferencia === "fallo" ? (
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => void subirYCobrar()}
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => void cobrar(partesDelModo(null), modoActivo)}
                  disabled={loading}
                  className="w-full rounded-xl border border-amber-400 bg-amber-50 py-3 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {loading ? "Registrando…" : "Registrar sin comprobante"}
                </button>
              </div>
            ) : (
              <button
                onClick={() =>
                  storageDisponible
                    ? void subirYCobrar()
                    : void cobrar(partesDelModo(null), modoActivo)
                }
                disabled={
                  loading ||
                  estadoTransferencia === "subiendo" ||
                  estadoTransferencia === "cobrando" ||
                  (storageDisponible && !photo) ||
                  (modoActivo === "mixto" && !mixtoValido)
                }
                className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {estadoTransferencia === "subiendo"
                  ? "Subiendo comprobante…"
                  : loading
                    ? "Registrando…"
                    : modoActivo === "mixto"
                      ? `Confirmar $${saldo.toFixed(2)} mixto`
                      : "Confirmar transferencia"}
              </button>
            )}
          </section>
        )}
```

- [ ] **Step 10: Update the cash confirmation modal**

Dentro de `{confirmCash && ( ... )}` (lineas 404-421), el texto de
confirmacion y el boton usan `montoEfectivo` (ya calculado sobre el saldo por
el Step 3) en vez de `orden.total`, y `cobrar` recibe una sola parte:

```tsx
            <p className="mt-2 text-slate-600">¿Confirmas que recibiste <strong>${montoEfectivo.toFixed(2)}</strong> en efectivo?</p>
            {esDomicilio && orden.costoEnvio > 0 && (
              <p className="mt-2 text-sm text-slate-500">
                El cliente pagó ${saldo.toFixed(2)}; el motorizado conserva
                ${orden.costoEnvio.toFixed(2)} del envío.
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={() => void cobrar([{ metodoPago: "efectivo", monto: saldo }], "efectivo")} disabled={loading} className="flex-1 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:bg-slate-400">{loading ? "Procesando…" : "Aceptar"}</button>
              <button onClick={() => setConfirmCash(false)} disabled={loading} className="flex-1 rounded-xl bg-slate-200 py-3 font-bold text-slate-800">Cancelar</button>
            </div>
```

Notese que `parte.monto` es `saldo` (el bruto), no `montoEfectivo` (el neto de
presentacion) — ver el punto critico al inicio de esta task.

- [ ] **Step 11: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: sin errores en `components/cobros/CobrarOrdenClient.tsx` ni en
`app/ordenes/cobrar/[token]/page.tsx`.

- [ ] **Step 12: Verify in the browser**

```bash
npm run dev
```

Comprobar en la pantalla de cobro por enlace, con `S3_BUCKET` sin configurar
(desarrollo local tipico) para probar el camino `storageDisponible === false`:
1. Con una orden sin pagos, los tres botones aparecen y el saldo es igual al total.
2. En Mixto, escribir un monto menor al saldo: la transferencia se autocalcula, aparece el aviso de liquidacion con el motorizado si es domicilio, y "Registrar" queda habilitado sin foto (storage no configurado).
3. Escribir un monto igual o mayor al saldo: sale el aviso de usar el boton de Efectivo.
4. Confirmar un mixto y comprobar en `npx prisma studio` que se crearon **dos** filas en `Cobro`, con `idempotencyKey` terminadas en `:efectivo` y `:transferencia`, y que `Orden.montoPagado` quedo igual a `total`.
5. Si es posible configurar `S3_BUCKET` localmente: repetir con `storageDisponible === true` y confirmar que la parte de transferencia del mixto sube una foto real y el `Cobro.comprobanteTransferenciaKey` de esa fila queda con la key real (no null).

- [ ] **Step 13: Commit**

```bash
git add components/cobros/CobrarOrdenClient.tsx app/ordenes/cobrar
git commit -m "feat(cobros): mixed payment option on the collection screen

Reuses the existing upload-then-charge flow (compress, POST, retry, degrade
without a receipt) for the transfer half of a mixed payment instead of
introducing a second, weaker path. The cash amount is typed and the transfer
is the remainder, so the two parts always sum to the balance exactly."
```

---

## Task 11: Saldo y mixto en la lista del mesero

**Files:**
- Modify: `app/mesero/page.tsx:31-34, 102-130, 340-450`

**Contexto:** la lista del mesero tiene su propio modal de cobro con dos botones y llama a `/api/ordenes/:id/cobrar`. Hay que darle el mismo tratamiento que a la pantalla de enlace, y mostrar el badge de saldo en las tarjetas.

- [ ] **Step 1: Extend the order type**

En la interfaz de orden del fichero (alrededor de la linea 31), agregar:

```ts
  montoPagado: number;
```

- [ ] **Step 2: Update the collect call**

Reemplazar `cobrarOrden` (lineas 102-130) por:

```tsx
  const cobrarOrden = async (
    partes: Array<{ metodoPago: string; monto: number; comprobanteTransferenciaKey?: string }>,
  ) => {
    if (!ordenACobrar) return;
    setLoadingCobrar(true);
    try {
      const res = await fetch(`/api/ordenes/${ordenACobrar.id}/cobrar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partes,
          expectedRevision: ordenACobrar.printRevision,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (res.ok) {
        setOrdenACobrar(null);
        setMetodoPagoSeleccionado("efectivo");
        setMontoEfectivoMixto("");
        await cargarOrdenes();
      } else {
        const error = await res.json();
        alert(error.error || "Error al cobrar la orden");
      }
    } catch (error) {
      console.error("Error al cobrar:", error);
      alert("Error al cobrar la orden");
    } finally {
      setLoadingCobrar(false);
    }
  };
```

Agregar el estado del monto mixto junto a `metodoPagoSeleccionado` (linea 67):

```tsx
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState("");
```

Y ampliar el tipo de `metodoPagoSeleccionado` para admitir `"mixto"`.

- [ ] **Step 3: Show the balance badge**

En la tarjeta de cada orden, junto al bloque que hoy pinta `!orden.cobrada` (linea 362), agregar antes del boton de cobrar:

```tsx
                        {orden.montoPagado > 0 && orden.total > orden.montoPagado && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
                            SALDO ${(orden.total - orden.montoPagado).toFixed(2)}
                          </span>
                        )}
```

- [ ] **Step 4: Show the balance instead of the total in the modal**

La linea 401 pinta el total. Reemplazarla por el saldo:

```tsx
            <p className="text-2xl font-bold text-green-600 mb-5">
              ${(
                (Math.round(Number(ordenACobrar.total) * 100) -
                  Math.round(Number(ordenACobrar.montoPagado) * 100)) /
                100
              ).toFixed(2)}
              {ordenACobrar.montoPagado > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  saldo de ${Number(ordenACobrar.total).toFixed(2)}
                </span>
              )}
            </p>
```

- [ ] **Step 5: Add the third method button**

Insertar dentro del `<div className="flex gap-3 mb-6">` (lineas 407-428), despues del boton de Transferencia:

```tsx
              <button
                onClick={() => setMetodoPagoSeleccionado("mixto")}
                className={`flex-1 py-3 rounded-lg font-bold border-2 transition-colors ${
                  metodoPagoSeleccionado === "mixto"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
                }`}
              >
                🔀 Mixto
              </button>
```

- [ ] **Step 6: Add the mixed amount input**

Insertar justo despues de ese `</div>` de cierre (linea 428), antes del aviso de `metodoPagoPrevisto`:

```tsx
            {metodoPagoSeleccionado === "mixto" && (
              <div className="mb-6 space-y-2 rounded-lg bg-gray-50 p-4">
                <label className="block text-sm font-semibold text-gray-700">
                  Monto en efectivo
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={montoEfectivoMixto}
                    onChange={(event) => setMontoEfectivoMixto(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-xl font-bold"
                    placeholder="0.00"
                  />
                </label>
                <div className="flex justify-between text-sm">
                  <span>Transferencia</span>
                  <span className="font-semibold">
                    $
                    {Math.max(
                      0,
                      (Math.round(
                        (Number(ordenACobrar.total) - Number(ordenACobrar.montoPagado)) * 100,
                      ) -
                        Math.round(Number(montoEfectivoMixto || 0) * 100)) /
                        100,
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
```

- [ ] **Step 7: Build the parts on confirm**

El aviso de `metodoPagoPrevisto` (lineas 430-440) compara contra un metodo simple. Envolverlo para que no salga en mixto: cambiar la condicion de apertura por

```tsx
            {metodoPagoSeleccionado !== "mixto" &&
              ordenACobrar.metodoPagoPrevisto &&
              metodoPagoSeleccionado !== ordenACobrar.metodoPagoPrevisto && (
```

Y reemplazar el `onClick` del boton de confirmar (linea 444) por:

```tsx
                onClick={() => {
                  const saldoCentavos =
                    Math.round(Number(ordenACobrar.total) * 100) -
                    Math.round(Number(ordenACobrar.montoPagado) * 100);

                  if (metodoPagoSeleccionado !== "mixto") {
                    void cobrarOrden([
                      {
                        metodoPago: metodoPagoSeleccionado,
                        monto: saldoCentavos / 100,
                        ...(metodoPagoSeleccionado === "transferencia"
                          ? { comprobanteTransferenciaKey: "pendiente:cobro-en-lista" }
                          : {}),
                      },
                    ]);
                    return;
                  }

                  const efectivoCentavos = Math.round(
                    Number(montoEfectivoMixto || 0) * 100,
                  );
                  const transferenciaCentavos = saldoCentavos - efectivoCentavos;
                  if (efectivoCentavos <= 0 || transferenciaCentavos <= 0) {
                    alert(
                      "En un cobro mixto las dos partes deben ser mayores a cero.",
                    );
                    return;
                  }
                  void cobrarOrden([
                    { metodoPago: "efectivo", monto: efectivoCentavos / 100 },
                    {
                      metodoPago: "transferencia",
                      monto: transferenciaCentavos / 100,
                      comprobanteTransferenciaKey: "pendiente:cobro-en-lista",
                    },
                  ]);
                }}
```

El `onClick` del boton Cancelar (linea 451) tambien limpia el monto:

```tsx
                onClick={() => {
                  setOrdenACobrar(null);
                  setMetodoPagoSeleccionado("efectivo");
                  setMontoEfectivoMixto("");
                }}
```

Nota sobre el comprobante: en la lista interna no hay captura de foto, asi que se manda el marcador `pendiente:cobro-en-lista` para satisfacer la validacion. Cuando se implemente la subida a S3 (`docs/superpowers/plans/2026-08-03-comprobantes-s3.md`), esta pantalla necesita su propio selector de imagen.

- [ ] **Step 8: Verify in the browser**

```bash
npm run dev
```

1. Cobrar una orden de mesa en efectivo desde la lista: sigue funcionando como antes.
2. Cobrar otra en mixto: se crean dos filas en `Cobro`.
3. Agregar un producto a una orden ya cobrada: la tarjeta reaparece con el badge `SALDO $X` y al cobrarla el modal muestra el saldo, no el total.

- [ ] **Step 9: Commit**

```bash
git add app/mesero/page.tsx
git commit -m "feat(mesero): show pending balance and offer mixed payment"
```

---

## Task 12: Desglose de pagos en los reportes

**Files:**
- Modify: `app/admin/page.tsx` (fila de saldo pendiente en el cuadre, desglose en la tabla)
- Modify: `components/admin/DetalleOrdenModal.tsx`

**Contexto:** hoy el admin muestra `orden.metodoPago` plano. Con multipago ese campo dice `mixto` y hay que poder ver de que se compone.

- [ ] **Step 1: Show the pending balance in the daily close**

En `app/admin/page.tsx`, junto a las filas del resumen del cuadre (cerca de la linea 722, donde ya se pinta `efectivoEntregadoMotorizados`), agregar:

```tsx
              {resumenCuadre.ordenesConSaldoPendiente > 0 && (
                <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
                  <p className="font-bold text-amber-900">
                    {resumenCuadre.ordenesConSaldoPendiente}{" "}
                    {resumenCuadre.ordenesConSaldoPendiente === 1
                      ? "orden con saldo pendiente"
                      : "órdenes con saldo pendiente"}
                  </p>
                  <p className="text-sm text-amber-800">
                    Suman ${resumenCuadre.montoSaldoPendiente.toFixed(2)}. Cóbralas
                    antes de cerrar el día.
                  </p>
                </div>
              )}
```

- [ ] **Step 2: Show the payment breakdown per order**

El badge de metodo de pago de la tabla (`app/admin/page.tsx:1147-1157`) hoy solo distingue efectivo de transferencia, asi que un cobro mixto se pintaria como transferencia. Reemplazar ese `<span>` completo por:

```tsx
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  orden.metodoPago === "efectivo"
                                    ? "bg-green-100 text-green-800"
                                    : orden.metodoPago === "mixto"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                }`}
                                title={
                                  orden.pagos
                                    ?.map(
                                      (pago) =>
                                        `${pago.metodoPago} $${Number(pago.monto).toFixed(2)}`,
                                    )
                                    .join(" + ") ?? undefined
                                }
                              >
                                {orden.metodoPago === "efectivo"
                                  ? "💵 Efectivo"
                                  : orden.metodoPago === "mixto"
                                    ? "🔀 Mixto"
                                    : "🏦 Transferencia"}
                              </span>
```

Y en la interfaz de orden del mismo fichero (linea 43, junto a `metodoPago: string | null;`), agregar:

```ts
  pagos?: { metodoPago: string; monto: number }[];
```

El endpoint del cuadre ya devuelve ese campo desde la Task 9.

- [ ] **Step 3: Show the breakdown in the order detail modal**

En `components/admin/DetalleOrdenModal.tsx`, el badge de metodo de pago (lineas 543-559) tiene el mismo problema. Reemplazar el `<p className="mt-1">` completo por:

```tsx
                      <p className="mt-1">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                            !orden.metodoPago
                              ? "bg-gray-100 text-gray-600"
                              : orden.metodoPago === "efectivo"
                                ? "bg-green-100 text-green-800"
                                : orden.metodoPago === "mixto"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {!orden.metodoPago
                            ? "— Desconocido"
                            : orden.metodoPago === "efectivo"
                              ? "💵 Efectivo"
                              : orden.metodoPago === "mixto"
                                ? "🔀 Mixto"
                                : "🏦 Transferencia"}
                        </span>
                      </p>
                      {orden.pagos && orden.pagos.length > 1 && (
                        <ul className="mt-2 space-y-0.5 text-sm text-gray-600">
                          {orden.pagos.map((pago, indice) => (
                            <li key={indice} className="flex justify-between">
                              <span className="capitalize">{pago.metodoPago}</span>
                              <span className="font-semibold">
                                ${Number(pago.monto).toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
```

Y en la interfaz del modal (linea 46, junto a `metodoPago?: string | null;`), agregar:

```ts
  pagos?: { metodoPago: string; monto: number }[];
```

El modal se abre desde la tabla del cuadre con la orden que ya trae `pagos`, asi que no hay que tocar ningun endpoint. Si al probar el campo llega `undefined`, comprobar que el `map` de la Task 9 no lo esta descartando.

- [ ] **Step 4: Run the full suite**

```bash
npm run test:cobro && npm run test:liquidacion && npm run test:cobro-validaciones && npm run test:cuadre && npm run test:print-jobs && npm run test:printer && npm run test:print-config && npm run test:daily-order-number && npm run test:admin-validaciones && npm run test:fecha-ecuador && npm run test:retiros-validaciones && npm run test:navegacion && npm run test:print-agent
```

Expected: todos PASS.

- [ ] **Step 5: Type check and build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx components/admin/DetalleOrdenModal.tsx
git commit -m "feat(admin): break down mixed payments and flag pending balances"
```

---

## Verificacion final

Antes de dar el trabajo por terminado, correr el caso real de punta a punta contra el servidor de desarrollo:

1. Crear una orden a domicilio con envio de $3, un producto de $8, transferencia confirmada al crear. Nace pagada, `montoPagado = 11`.
2. Agregar un producto de $5 a esa orden. Responde 200, se imprime el ticket de MODIFICACION referenciado a la misma orden, `total = 16`, `montoPagado = 11`, badge `SALDO $5`.
3. Cobrar el saldo de $5 en efectivo.
4. Abrir el cuadre del dia y comprobar:
   - `efectivoCobradoMotorizados = 2` (el motorizado cobro $5 y se queda $3 de envio)
   - `efectivoEntregadoMotorizados = 0`
   - `depositosRecibidos = 11`
   - `transferenciasVentas = 11`
   - `ventasCobradas = 13` (los $16 menos el envio de $3)
   - `ordenesConSaldoPendiente = 0`
5. Comprobar que en `Cobro` hay dos filas para esa orden, y que ninguna tiene columna `efectivoEntregado`.
