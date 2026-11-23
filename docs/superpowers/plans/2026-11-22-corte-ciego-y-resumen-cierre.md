# Corte ciego y resumen del cierre — plan

**Goal:** el mesero entrega su conteo sin ver el cuadre, solo el admin lo anula, y el cierre encola el detalle del día por WhatsApp al operador.

**Architecture:** el servidor recorta la caja para todo rol distinto de admin; los cortes anulados se conservan y el cálculo usa el último vigente. El resumen es una función pura que produce textos; se encolan en `WhatsappSalida` después de confirmar el cierre.

**Tech Stack:** Next.js, Prisma/PostgreSQL, ts-node + `node:assert`.

**Spec:** `docs/superpowers/specs/2026-11-22-corte-ciego-y-resumen-cierre-design.md` (aprobado; destino: operador digital)

## Global Constraints

- El mesero no recibe `montoEsperadoCierre`, `montoCierre`, `diferenciaCierre`, `montoEsperado`, `diferencia` ni `razonAnulacion`.
- Un fallo de WhatsApp no impide cerrar la caja.
- Mensajes de hasta 3.500 caracteres; vigencia 24 h; sin teléfonos, direcciones ni nombres de clientes.
- No se aplica la migración a ninguna base desde aquí.

## Review Focus

- Doble clic o reintento del corte: "Ya entregaste tu turno", no "otro mesero".
- Anular un corte que no es el último vigente: 409.
- Cerrar un día anterior: el resumen es de esa fecha.
- Orden de ayer pagada hoy: no suma unidades vendidas de hoy.
- Línea más larga que el límite: se recorta, no se pierde el mensaje.

### Task 1: Servidor del corte

**Files:** `prisma/schema.prisma`, `prisma/migrations/20261122000000_anular_corte_turno/migration.sql`, `types/caja.ts`, `lib/caja.ts`, `app/api/caja/route.ts`, `app/api/caja/corte/route.ts`, `app/api/caja/corte/[id]/anular/route.ts`. Test: `lib/corte-turno-route.test.ts`.

**Produces:** `ocultarCuadre(caja: SesionCaja): CajaMesero`; `ultimoCorteVigente<T extends { anuladoAt: unknown }>(cortes: readonly T[]): T | undefined`; `GET /api/caja/corte → { salidas }`; `PATCH /api/caja/corte/:id/anular { razon }`.

- [x] Test: recorte, corte repetido, adelanto tardío (−20 → anular → 0), anulación de un corte no último, respuesta sin cifras. Falla.
- [x] Implementar. Pasa.

### Task 2: Pantallas

**Files:** crear `components/mesero/CorteTurno.tsx`; modificar `components/mesero/InicioCaja.tsx`, `app/mesero/page.tsx`, `components/admin/CierreCaja.tsx`.

- [x] Mesero: salidas → contar → confirmar → entregado. Admin: anular el último vigente; anulados tachados.

### Task 3: Textos del resumen

**Files:** crear `lib/resumen-cierre.ts`; exportar `dinero` y `horaLocal` de `lib/whatsapp-mensajes.ts`. Test: `lib/resumen-cierre.test.ts`.

**Produces:** `textosResumenCierre(datos: DatosResumenCierre): string[]`.

- [x] Test: día completo, día vacío, partido en 3.500, sin datos de clientes, orden de ayer pagada hoy. Falla. Implementar. Pasa.

### Task 4: Encolar al cerrar

**Files:** `lib/whatsapp-salidas.ts`, `app/api/caja/route.ts`, `components/admin/CierreCaja.tsx`, `components/admin/RevisionWhatsapp.tsx`, `package.json`.

**Produces:** `registrarResumenCierre(db, fecha, textos, ahora): Promise<'encolado' | 'sin_configuracion' | 'sin_operador'>`.

- [x] Test en `lib/resumen-cierre.test.ts`: destino es el último remitente vigente, orden, vigencia, sin operador; en `lib/corte-turno-route.test.ts`: la caja se cierra aunque el encolado falle.
- [x] Implementar, correr todas las pruebas relacionadas, `tsc --noEmit` y eslint.
