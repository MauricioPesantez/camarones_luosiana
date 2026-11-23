# Órdenes del día para quien cierra caja — plan

**Goal:** el admin habilita una lista corta de órdenes al mesero que entregó el conteo y puede corregir un cobro, sin abrir un segundo conteo.

**Architecture:** dos columnas en `SesionCaja` guardan la habilitación. Una función pura convierte los datos del cuadre en la lista recortada; el servidor decide quién la recibe. La corrección cambia el `Cobro` bajo el candado de la caja y el cuadre se recalcula solo.

**Tech Stack:** Next.js, Prisma/PostgreSQL, ts-node + `node:assert`.

**Spec:** `docs/superpowers/specs/2026-11-23-ordenes-del-dia-para-cierre-design.md`

## Global Constraints

- La respuesta al mesero no contiene esperado, diferencia, datos de clientes, motivo ni beneficiario.
- Un monto que no se muestra no sale del servidor.
- No se tocan cálculos ni pantallas de turnos, salvo el bloqueo del conteo.
- No se aplica la migración a ninguna base desde aquí.

## Review Focus

- Otro mesero intenta contar después de habilitar: 409.
- Domicilio mixto: la línea es lo que el motorizado entregó, no el efectivo del cliente.
- Orden que creció después de pagada: muestra lo cobrado y lo que falta.
- Cobro simultáneo durante la corrección: 409, sin dejar la orden a medias.
- Orden de ayer pagada hoy: se identifica con su fecha.

### Task 1: Corregir cobro

**Files:** crear `app/api/admin/ordenes/[id]/corregir-cobro/route.ts`; modificar `lib/resumen-cierre.ts`, `components/admin/HistorialOrdenTimeline.tsx`. Test: `lib/corregir-cobro-route.test.ts`.

**Produces:** `PATCH { metodoPago, razon } → { orden: { id, metodoPago }, cobroId }`.

- [x] Test: ida y vuelta, movimientos del cobro, historial, rechazos y carrera. Falla.
- [x] Implementar. Pasa.

### Task 2: Lista de órdenes

**Files:** migración `20261123000000_ordenes_habilitadas`, `prisma/schema.prisma`, `types/caja.ts`, `lib/caja.ts`; crear `lib/ordenes-mesero.ts` y `app/api/caja/ordenes/route.ts`. Test: `lib/ordenes-mesero.test.ts`.

**Produces:** `ordenesParaMesero(datos): { ordenes: OrdenMesero[]; salidas: SalidaDeTurno[] }`; `GET` y `PATCH { fecha }` en `/api/caja/ordenes`.

- [x] Test de cada fila de la tabla del diseño y de los permisos. Falla. Implementar. Pasa.

### Task 3: Frenos y resumen

**Files:** `app/api/caja/corte/route.ts`, `app/api/caja/corte/[id]/anular/route.ts`, `app/api/ordenes/route.ts`, `lib/cuadre-server.ts`, `lib/resumen-cierre.ts`. Test: `lib/corte-turno-route.test.ts`, `lib/resumen-cierre.test.ts`.

- [x] Test: conteo y anulación bloqueados tras habilitar; línea en el resumen. Falla. Implementar. Pasa.

### Task 4: Pantallas

**Files:** crear `components/mesero/OrdenesDelDia.tsx`; modificar `components/mesero/CorteTurno.tsx`, `components/mesero/InicioCaja.tsx`, `components/admin/CierreCaja.tsx`, `components/admin/DetalleOrdenModal.tsx`, `components/admin/orden-admin.ts`, `app/admin/page.tsx`.

- [x] Mesero: lista según la plantilla. Admin: habilitar, movimientos posteriores al conteo y corregir cobro.
- [x] Pruebas relacionadas, `tsc --noEmit`, eslint y revisión en navegador con datos simulados.
