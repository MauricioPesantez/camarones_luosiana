# Espera de la moto según carga de cocina — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un pedido de WhatsApp a domicilio no trae línea `Moto N`, el aviso automático al grupo Motos sale a una hora calculada con el tiempo de la orden y las órdenes en cocina, en vez de 10 min fijos.

**Architecture:** Lógica nueva en `lib/espera-moto.ts` (fórmula pura + consulta de carga). `whatsapp-ingreso.ts` y `registrarAprobacionWhatsapp` resuelven la espera una vez y la pasan a `avisoDeDelivery`/`salidasDeOrdenAceptada` (sin cambiar su firma) y a `textoConfirmacion`.

**Tech Stack:** TypeScript, Prisma, tests con `node:assert/strict` vía ts-node (scripts `test:*` en `package.json`).

**Spec:** `docs/superpowers/specs/2026-11-16-espera-moto-por-carga-design.md`

## Global Constraints

- Constantes: piso de tiempo propio 15 min (`max(tiempoEstimado ?? 0, 15)`); 3 min por orden en cocina; llegada moto 5 min; margen de vigencia 10 min; tope de espera 45 min.
- Línea `Moto N` se respeta tal cual y no consulta carga.
- La impresión no cambia. Los domicilios manuales no cambian.
- Órdenes en cocina: todos los tipos (el consumo de empleado nace 'entregada', lib/employee-consumption.ts:66, y nunca cuenta, igual que en la pantalla de cocina), `anulada = false`, `estado IN ('pendiente','en_preparacion')`, sin la orden nueva, vigentes por `createdAt + max(tiempoEstimado ?? 0, 15) + 10 min > ahora`.

## Review Focus

- `tiempoEstimado` 0, null (combos) o 1–2 (solo entradas/acompañamientos) → usa 15; cocina vacía da 10 min como hoy. Test en Task 1.
- Orden vieja nunca marcada "Lista" → no cuenta pasado su tiempo + 10. Test en Task 1 (`ordenSigueEnCocina`).
- La orden recién creada no se cuenta a sí misma (misma transacción). Test postgres en Task 3.
- Orden aprobada sin stock tarde → la carga se mide al aprobar, no al crear. Cubierto: se llama con `ahora` de la aprobación (Task 3).
- Confirmación y recordatorio deben mostrar la misma hora → una sola llamada a `resolverEsperaMoto` por aceptación (Task 3).

---

### Task 1: Fórmula y conteo de carga

**Files:**
- Create: `lib/espera-moto.ts`
- Test: `lib/espera-moto.test.ts`
- Modify: `package.json` (script `test:espera-moto`, mismo formato ts-node que `test:whatsapp-mensajes`)

**Interfaces:**
- Produces:
  - `esperaMotoPorCarga(tiempoEstimado: number | null | undefined, enCocina: number): number`
  - `ordenSigueEnCocina(o: { createdAt: Date; tiempoEstimado: number | null }, ahora: Date): boolean`
  - `contarOrdenesEnCocina(tx: Prisma.TransactionClient, excluirId: string, ahora: Date): Promise<number>`
  - `type EsperaMoto = { minutos: number; enCocina: number | null }`
  - `resolverEsperaMoto(tx: Prisma.TransactionClient, orden: { id: string; tipoOrden: string; tiempoEstimado: number | null }, ahora: Date, esperaLinea: number | null | undefined): Promise<EsperaMoto | null>` — `null` si no es domicilio; `{ minutos: esperaLinea, enCocina: null }` si hay línea; si no, cuenta y aplica la fórmula.

- [ ] **Step 1: Write failing tests** (`lib/espera-moto.test.ts`, solo funciones puras)

```ts
import assert from 'node:assert/strict';
import { esperaMotoPorCarga, ordenSigueEnCocina } from './espera-moto';

assert.equal(esperaMotoPorCarga(0, 0), 10);     // sin tiempo, cocina vacía = hoy
assert.equal(esperaMotoPorCarga(null, 0), 10);
assert.equal(esperaMotoPorCarga(0, 1), 13);
assert.equal(esperaMotoPorCarga(20, 0), 15);
assert.equal(esperaMotoPorCarga(20, 2), 21);
assert.equal(esperaMotoPorCarga(20, 10), 45);
assert.equal(esperaMotoPorCarga(30, 10), 45);   // tope
assert.equal(esperaMotoPorCarga(1, 0), 10);     // solo patacones: nunca antes que hoy
assert.equal(esperaMotoPorCarga(25, 5), 35);    // plato fuerte con 5 en cocina

const ahora = new Date('2026-11-16T18:00:00Z');
const hace = (min: number) => new Date(ahora.getTime() - min * 60_000);
assert.equal(ordenSigueEnCocina({ createdAt: hace(24), tiempoEstimado: 0 }, ahora), true);
assert.equal(ordenSigueEnCocina({ createdAt: hace(26), tiempoEstimado: 0 }, ahora), false);
assert.equal(ordenSigueEnCocina({ createdAt: hace(24), tiempoEstimado: 1 }, ahora), true);
assert.equal(ordenSigueEnCocina({ createdAt: hace(29), tiempoEstimado: 20 }, ahora), true);
assert.equal(ordenSigueEnCocina({ createdAt: hace(31), tiempoEstimado: 20 }, ahora), false);
console.log('espera-moto OK');
```

- [ ] **Step 2:** `npm run test:espera-moto` → FAIL (módulo no existe).
- [ ] **Step 3: Implement** `lib/espera-moto.ts` con las firmas de arriba y las constantes de Global Constraints. `contarOrdenesEnCocina`: `tx.orden.findMany` con `anulada: false`, `estado in`, `id: { not: excluirId }`, `createdAt >= ahora − 3 h` (cota de la consulta), `select { createdAt, tiempoEstimado }`, luego `.filter(o => ordenSigueEnCocina(o, ahora)).length`. Solo importa `type { Prisma }` para que el test no cargue el cliente.
- [ ] **Step 4:** `npm run test:espera-moto` → `espera-moto OK`.
- [ ] **Step 5: Commit** `feat: compute moto wait from kitchen load`

### Task 2: Carga en el texto de confirmación

**Files:**
- Modify: `lib/whatsapp-mensajes.ts` (`textoConfirmacion`)
- Test: `lib/whatsapp-mensajes.test.ts`

**Interfaces:**
- Produces: `textoConfirmacion(orden, { impresionEnCola, avisoDelivery, enCocina?: number | null })`. Sufijo tras la hora: `null`/ausente → nada; `0` → ` (cocina libre)`; `1` → ` (1 orden en cocina)`; `n` → ` (n órdenes en cocina)`.

- [ ] **Step 1: Failing tests** junto al caso existente de la línea 45:

```ts
assert.match(textoConfirmacion(orden, { impresionEnCola: true, avisoDelivery: aviso, enCocina: 3 }), /Moto se pedirá al grupo: 15:10 \(3 órdenes en cocina\)$/);
assert.match(textoConfirmacion(orden, { impresionEnCola: true, avisoDelivery: aviso, enCocina: 1 }), /\(1 orden en cocina\)$/);
assert.match(textoConfirmacion(orden, { impresionEnCola: true, avisoDelivery: aviso, enCocina: 0 }), /\(cocina libre\)$/);
```
El `assert.equal` existente (sin `enCocina`) debe seguir pasando sin cambios.
- [ ] **Step 2:** `npm run test:whatsapp-mensajes` → FAIL.
- [ ] **Step 3:** Implementar el sufijo.
- [ ] **Step 4:** `npm run test:whatsapp-mensajes` → PASS.
- [ ] **Step 5: Commit** `feat: show kitchen load in moto confirmation`

### Task 3: Conectar en aceptación y aprobación

**Files:**
- Modify: `lib/whatsapp-ingreso.ts:~270-281`
- Modify: `lib/whatsapp-salidas.ts` (`registrarAprobacionWhatsapp`)
- Test: `lib/whatsapp-ingreso.test.ts` (mock), `lib/whatsapp-orden.postgres.test.ts`

**Interfaces:**
- Consumes: `resolverEsperaMoto`, `EsperaMoto` (Task 1); `textoConfirmacion(..., enCocina)` (Task 2).
- `avisoDeDelivery` y `salidasDeOrdenAceptada` no cambian de firma: reciben `espera?.minutos`.

- [ ] **Step 1: Failing postgres test** en `whatsapp-orden.postgres.test.ts`, después del caso de la línea ~142 (que debe seguir dando 10 min): crear 2 órdenes `local` en `pendiente`, no anuladas, `createdAt` = ahora; procesar un domicilio nuevo sin línea `Moto`; esperar `recordatorio.disponibleAt = ahora + 16 min` (`10 + 3×2`) y que la respuesta contenga `(2 órdenes en cocina)`. Agregar una tercera orden `pendiente` con `createdAt` = ahora − 40 min y `tiempoEstimado` 0: no debe contar (sigue 16).
- [ ] **Step 2:** `npm run test:whatsapp-postgres` → FAIL (da 10).
- [ ] **Step 3: Implement.** En `whatsapp-ingreso.ts`: `const espera = aceptada ? await resolverEsperaMoto(tx, orden, ahora, pedido.esperaMotoMin) : null;` y usar `espera?.minutos` en `avisoDeDelivery` y `salidasDeOrdenAceptada`, `espera?.enCocina` en `textoConfirmacion`. En `registrarAprobacionWhatsapp`: lo mismo con `esperaMin` leído del pedido. `orden`/`ordenActualizada` son `Orden` de Prisma y traen `tiempoEstimado`; si el tipo `OrdenConId` no lo expone, ampliarlo con `tiempoEstimado: number | null`. En `whatsapp-ingreso.test.ts` agregar a `dependencias`: `'@/lib/espera-moto': { resolverEsperaMoto: async () => null }`.
- [ ] **Step 4:** Correr `npm run test:whatsapp-postgres`, `npm run test:whatsapp-ingreso`, `npm run test:whatsapp-mensajes`, `npm run test:espera-moto`, `npx tsc --noEmit` → todo PASS, sin errores de tipo.
- [ ] **Step 5: Commit** `feat: schedule WhatsApp moto by kitchen load`
