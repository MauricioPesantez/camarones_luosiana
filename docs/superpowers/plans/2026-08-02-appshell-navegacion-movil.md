# AppShell y navegación móvil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los cuatro headers que hoy cada pantalla arma a mano por un `AppShell` compartido que en móvil da drawer lateral más barra inferior, y en escritorio nav horizontal.

**Architecture:** Un mapa de navegación por rol en `lib/navegacion.ts` (data pura, sin React) alimenta cinco componentes de presentación en `components/shell/`. Cada página envuelve su contenido en `<AppShell>` y le pasa su usuario, su vista activa y sus badges. La vista activa deja de vivir en `useState` y pasa a query params.

**Tech Stack:** Next.js 16 App Router, React 19.2, Tailwind CSS v4, TypeScript. Tests con `node:assert/strict` ejecutados por `ts-node`, siguiendo el patrón de `lib/cuadre.test.ts`.

**Spec:** `docs/superpowers/specs/2026-08-02-appshell-navegacion-movil-design.md`

## Global Constraints

- Iconos: emoji, igual que el resto de la app. No agregar `lucide-react` ni ninguna librería de iconos.
- Breakpoint único `md` (768px). Bajo `md`: drawer y barra inferior. Desde `md`: nav horizontal. Los componentes móviles no se rinden en el DOM en escritorio, no se ocultan solo con CSS.
- Objetivos táctiles de nav: mínimo 44×44px (`min-h-11`).
- Texto de la barra inferior: mínimo 11px.
- Todo el texto de UI en español, sentence case, sin punto final en labels ni encabezados.
- Escala de z-index, sin excepciones: barra inferior y topbar `z-30`, banner SSE de cocina `z-40`, overlay del drawer `z-50`, panel del drawer `z-[51]`, modales `z-[60]`, modal anidado `z-[70]`.
- Ninguna página nueva usa `useSearchParams()` dentro de `AppShell`. La página resuelve su `activoId` y lo pasa por prop.
- Acentos por rol: mesero `blue-600`, digital `indigo-600`, cocina `amber-600`, admin `slate-700`.
- Cada tarea termina con `npx tsc --noEmit` limpio antes del commit.

---

### Task 1: Modelo de navegación

**Files:**
- Create: `lib/navegacion.ts`
- Create: `lib/navegacion.test.ts`
- Modify: `package.json` (agregar script `test:navegacion`)

**Interfaces:**
- Consumes: nada.
- Produces: `Rol`, `ContextoNav`, `EntradaNav`, `SeccionNav`, `ACENTO_POR_ROL`, `resolverNav(rol: string, ctx: ContextoNav): SeccionNav[]`, `itemsBarraInferior(secciones: SeccionNav[]): EntradaNav[]`.

- [ ] **Step 1: Escribir el test que falla**

Create `lib/navegacion.test.ts`:

```ts
import assert from "node:assert/strict";
import { resolverNav, itemsBarraInferior, ACENTO_POR_ROL } from "./navegacion";

const ctxSinPermiso = { permisoNotificaciones: "default" as const };
const ctxConPermiso = { permisoNotificaciones: "granted" as const };

// Un rol que no existe en el mapa no revienta: cae a un nav minimo con solo
// la seccion de sesion, para que el usuario al menos pueda salir.
const desconocido = resolverNav("contador", ctxSinPermiso);
assert.equal(desconocido.length, 1);
assert.equal(desconocido[0].titulo, "Sesión");
assert.deepEqual(
  desconocido[0].items.map((i) => i.id),
  ["logout"],
);

// Mesero: tres destinos en la barra inferior, en orden.
const mesero = resolverNav("mesero", ctxSinPermiso);
assert.deepEqual(
  itemsBarraInferior(mesero).map((i) => i.id),
  ["crear", "ordenes", "retiro"],
);

// Cocina tiene un solo destino, asi que la barra inferior no se rinde.
const cocina = resolverNav("cocina", ctxSinPermiso);
assert.deepEqual(itemsBarraInferior(cocina), []);

// El item de notificaciones solo aparece si el navegador aun no decidio.
const idsSinPermiso = cocina.flatMap((s) => s.items.map((i) => i.id));
assert.ok(idsSinPermiso.includes("notificaciones"));
const idsConPermiso = resolverNav("cocina", ctxConPermiso).flatMap((s) =>
  s.items.map((i) => i.id),
);
assert.ok(!idsConPermiso.includes("notificaciones"));

// Admin: cuatro destinos en la barra inferior, y los que tienen hijos apuntan
// a su primer sub-destino.
const admin = resolverNav("admin", ctxSinPermiso);
const inferioresAdmin = itemsBarraInferior(admin);
assert.deepEqual(
  inferioresAdmin.map((i) => i.id),
  ["cuadre", "productos", "reportes", "usuarios"],
);
assert.equal(
  inferioresAdmin.find((i) => i.id === "productos")?.href,
  "/admin/productos?tab=stock",
);
assert.equal(
  inferioresAdmin.find((i) => i.id === "reportes")?.href,
  "/admin/reportes?tab=modificaciones",
);

// La barra inferior nunca pasa de cuatro, aunque el rol marque mas.
const inflado = [
  {
    titulo: "Operación",
    items: [1, 2, 3, 4, 5, 6].map((n) => ({
      id: `i${n}`,
      label: `Item ${n}`,
      emoji: "🔹",
      href: `/x${n}`,
      enBarraInferior: true,
    })),
  },
];
assert.equal(itemsBarraInferior(inflado).length, 4);

// Cada rol conocido tiene acento definido.
for (const rol of ["mesero", "digital", "cocina", "admin"] as const) {
  assert.ok(ACENTO_POR_ROL[rol].texto.length > 0);
  assert.ok(ACENTO_POR_ROL[rol].fondo.length > 0);
}

console.log("navegacion tests passed");
```

- [ ] **Step 2: Correr el test para verificar que falla**

Add to `package.json` scripts, right after `"test:retiros-validaciones"`:

```json
"test:navegacion": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/navegacion.test.ts",
```

Run: `npm run test:navegacion`
Expected: FAIL — `Cannot find module './navegacion'`

- [ ] **Step 3: Escribir la implementación**

Create `lib/navegacion.ts`:

```ts
// Fuente unica de la navegacion. No importa React a proposito: es data mas
// funciones puras, asi el drawer, la barra inferior y la topbar rinden lo
// mismo y esto se puede testear con ts-node.
//
// Escala de z-index de la app (los componentes usan las clases literales):
//   barra inferior / topbar   z-30
//   banner SSE de cocina      z-40
//   overlay del drawer        z-50
//   panel del drawer          z-[51]
//   modales                   z-[60]
//   modal anidado             z-[70]

export type Rol = "mesero" | "digital" | "cocina" | "admin";

export interface ContextoNav {
  permisoNotificaciones: NotificationPermission | "no-soportado";
}

export interface EntradaNav {
  id: string;
  label: string;
  emoji: string;
  href: string;
  hijos?: EntradaNav[];
  enBarraInferior?: boolean;
  labelCorto?: string;
  visible?: (ctx: ContextoNav) => boolean;
}

export interface SeccionNav {
  titulo: string;
  items: EntradaNav[];
}

export interface Acento {
  texto: string;
  fondo: string;
  borde: string;
}

export const ACENTO_POR_ROL: Record<Rol, Acento> = {
  mesero: {
    texto: "text-blue-600",
    fondo: "bg-blue-50",
    borde: "border-blue-600",
  },
  digital: {
    texto: "text-indigo-600",
    fondo: "bg-indigo-50",
    borde: "border-indigo-600",
  },
  cocina: {
    texto: "text-amber-600",
    fondo: "bg-amber-50",
    borde: "border-amber-600",
  },
  admin: {
    texto: "text-slate-700",
    fondo: "bg-slate-100",
    borde: "border-slate-700",
  },
};

export const ACENTO_NEUTRO: Acento = {
  texto: "text-gray-700",
  fondo: "bg-gray-100",
  borde: "border-gray-700",
};

const SESION: SeccionNav = {
  titulo: "Sesión",
  items: [{ id: "logout", label: "Cerrar sesión", emoji: "🚪", href: "#logout" }],
};

const NAV_POR_ROL: Record<Rol, SeccionNav[]> = {
  mesero: [
    {
      titulo: "Operación",
      items: [
        {
          id: "crear",
          label: "Crear orden",
          labelCorto: "Crear",
          emoji: "➕",
          href: "/mesero?vista=crear",
          enBarraInferior: true,
        },
        {
          id: "ordenes",
          label: "Mis órdenes",
          labelCorto: "Órdenes",
          emoji: "📋",
          href: "/mesero?vista=ordenes",
          enBarraInferior: true,
        },
      ],
    },
    {
      titulo: "Caja",
      items: [
        {
          id: "retiro",
          label: "Retiro de caja",
          labelCorto: "Retiro",
          emoji: "💸",
          href: "/mesero?vista=retiro",
          enBarraInferior: true,
        },
      ],
    },
    SESION,
  ],
  digital: [
    {
      titulo: "Operación",
      items: [
        {
          id: "crear",
          label: "Nuevo pedido",
          labelCorto: "Nuevo",
          emoji: "➕",
          href: "/digital?vista=crear",
          enBarraInferior: true,
        },
        {
          id: "pedidos",
          label: "Mis pedidos",
          labelCorto: "Pedidos",
          emoji: "📋",
          href: "/digital?vista=pedidos",
          enBarraInferior: true,
        },
      ],
    },
    SESION,
  ],
  cocina: [
    {
      titulo: "Operación",
      items: [
        { id: "monitor", label: "Monitor de cocina", emoji: "🍳", href: "/cocina" },
      ],
    },
    {
      titulo: "Preferencias",
      items: [
        {
          id: "notificaciones",
          label: "Activar notificaciones",
          emoji: "🔔",
          href: "#notificaciones",
          visible: (ctx) => ctx.permisoNotificaciones === "default",
        },
      ],
    },
    SESION,
  ],
  admin: [
    {
      titulo: "Cuadre",
      items: [
        {
          id: "cuadre",
          label: "Cuadre de caja",
          labelCorto: "Cuadre",
          emoji: "💵",
          href: "/admin",
          enBarraInferior: true,
        },
      ],
    },
    {
      titulo: "Catálogo",
      items: [
        {
          id: "productos",
          label: "Productos",
          emoji: "📦",
          href: "/admin/productos?tab=stock",
          enBarraInferior: true,
          hijos: [
            { id: "stock", label: "Stock", emoji: "📦", href: "/admin/productos?tab=stock" },
            { id: "menu", label: "Menú", emoji: "🍽️", href: "/admin/productos?tab=menu" },
          ],
        },
      ],
    },
    {
      titulo: "Análisis",
      items: [
        {
          id: "reportes",
          label: "Reportes",
          emoji: "📊",
          href: "/admin/reportes?tab=modificaciones",
          enBarraInferior: true,
          hijos: [
            {
              id: "modificaciones",
              label: "Modificaciones",
              emoji: "✏️",
              href: "/admin/reportes?tab=modificaciones",
            },
            {
              id: "cortesias",
              label: "Cortesías",
              emoji: "🎁",
              href: "/admin/reportes?tab=cortesias",
            },
          ],
        },
      ],
    },
    {
      titulo: "Equipo",
      items: [
        {
          id: "usuarios",
          label: "Usuarios",
          emoji: "👥",
          href: "/admin/usuarios",
          enBarraInferior: true,
        },
      ],
    },
    SESION,
  ],
};

const MAX_BARRA_INFERIOR = 4;
const MIN_BARRA_INFERIOR = 2;

export function esRolConocido(rol: string): rol is Rol {
  return rol in NAV_POR_ROL;
}

export function acentoDeRol(rol: string): Acento {
  return esRolConocido(rol) ? ACENTO_POR_ROL[rol] : ACENTO_NEUTRO;
}

export function resolverNav(rol: string, ctx: ContextoNav): SeccionNav[] {
  // `Usuario.rol` es String en el schema, no un enum, asi que un rol nuevo en
  // la BD no debe romper la app: cae a un nav con solo cerrar sesion.
  const secciones = esRolConocido(rol) ? NAV_POR_ROL[rol] : [SESION];

  return secciones
    .map((seccion) => ({
      ...seccion,
      items: seccion.items.filter((item) => item.visible?.(ctx) ?? true),
    }))
    .filter((seccion) => seccion.items.length > 0);
}

export function itemsBarraInferior(secciones: SeccionNav[]): EntradaNav[] {
  const items = secciones
    .flatMap((seccion) => seccion.items)
    .filter((item) => item.enBarraInferior)
    .slice(0, MAX_BARRA_INFERIOR);

  return items.length >= MIN_BARRA_INFERIOR ? items : [];
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm run test:navegacion`
Expected: `navegacion tests passed`

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 6: Commit**

```bash
git add lib/navegacion.ts lib/navegacion.test.ts package.json
git commit -m "feat: modelo de navegación por rol"
```

---

### Task 2: Exportar el tipo Usuario

**Files:**
- Modify: `lib/auth.ts:5-9`

**Interfaces:**
- Consumes: nada.
- Produces: `export interface Usuario { id: string; nombre: string; rol: string }`.

- [ ] **Step 1: Exportar la interfaz**

En `lib/auth.ts`, cambiar:

```ts
interface Usuario {
```

por:

```ts
export interface Usuario {
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "refactor: exportar el tipo Usuario desde lib/auth"
```

---

### Task 3: ItemNav

**Files:**
- Create: `components/shell/ItemNav.tsx`

**Interfaces:**
- Consumes: `EntradaNav`, `Acento` de `lib/navegacion`.
- Produces: componente default `ItemNav` con props `{ item: EntradaNav; variante: "drawer" | "topbar" | "inferior"; activo: boolean; acento: Acento; badge?: number; onNavegar: (item: EntradaNav) => void; sangria?: boolean }`.

Este componente no sabe dónde vive. Recibe `variante` y rinde acorde. Es el único que dibuja badges.

- [ ] **Step 1: Escribir el componente**

Create `components/shell/ItemNav.tsx`:

```tsx
"use client";

import type { Acento, EntradaNav } from "@/lib/navegacion";

interface Props {
  item: EntradaNav;
  variante: "drawer" | "topbar" | "inferior";
  activo: boolean;
  acento: Acento;
  badge?: number;
  onNavegar: (item: EntradaNav) => void;
  sangria?: boolean;
}

function Badge({ valor, label }: { valor: number; label: string }) {
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-bold text-white">
      {valor}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export default function ItemNav({
  item,
  variante,
  activo,
  acento,
  badge,
  onNavegar,
  sangria = false,
}: Props) {
  const hayBadge = typeof badge === "number" && badge > 0;
  const etiquetaBadge = `${badge} pendiente${badge === 1 ? "" : "s"}`;

  if (variante === "inferior") {
    return (
      <button
        type="button"
        onClick={() => onNavegar(item)}
        aria-current={activo ? "page" : undefined}
        className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 ${
          activo ? acento.texto : "text-gray-500"
        }`}
      >
        <span aria-hidden="true" className="text-xl leading-none">
          {item.emoji}
        </span>
        <span className="text-[11px] font-semibold leading-none">
          {item.labelCorto ?? item.label}
        </span>
        {hayBadge && (
          <span className="absolute right-[22%] top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-green-600 px-1 text-[11px] font-bold leading-4 text-white">
            {badge}
            <span className="sr-only"> {etiquetaBadge}</span>
          </span>
        )}
      </button>
    );
  }

  if (variante === "topbar") {
    return (
      <button
        type="button"
        onClick={() => onNavegar(item)}
        aria-current={activo ? "page" : undefined}
        className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
          activo
            ? `${acento.fondo} ${acento.texto}`
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <span aria-hidden="true">{item.emoji}</span>
        {item.label}
        {hayBadge && <Badge valor={badge} label={etiquetaBadge} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavegar(item)}
      aria-current={activo ? "page" : undefined}
      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition-colors ${
        sangria ? "pl-10" : ""
      } ${
        activo
          ? `${acento.fondo} ${acento.texto} font-semibold`
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        {item.emoji}
      </span>
      {item.label}
      {hayBadge && <Badge valor={badge} label={etiquetaBadge} />}
    </button>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 3: Commit**

```bash
git add components/shell/ItemNav.tsx
git commit -m "feat: componente ItemNav con variantes drawer, topbar e inferior"
```

---

### Task 4: BarraInferior

**Files:**
- Create: `components/shell/BarraInferior.tsx`

**Interfaces:**
- Consumes: `ItemNav` (Task 3), `EntradaNav` y `Acento` de `lib/navegacion`.
- Produces: componente default `BarraInferior` con props `{ items: EntradaNav[]; activoId: string; acento: Acento; badges: Record<string, number>; onNavegar: (item: EntradaNav) => void }`. Devuelve `null` con lista vacía.

- [ ] **Step 1: Escribir el componente**

Create `components/shell/BarraInferior.tsx`:

```tsx
"use client";

import type { Acento, EntradaNav } from "@/lib/navegacion";
import ItemNav from "./ItemNav";

interface Props {
  items: EntradaNav[];
  activoId: string;
  acento: Acento;
  badges: Record<string, number>;
  onNavegar: (item: EntradaNav) => void;
}

export default function BarraInferior({
  items,
  activoId,
  acento,
  badges,
  onNavegar,
}: Props) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white md:hidden"
      // El home indicator de iPhone se come el ultimo item sin esto.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => (
        <ItemNav
          key={item.id}
          item={item}
          variante="inferior"
          activo={item.id === activoId}
          acento={acento}
          badge={badges[item.id]}
          onNavegar={onNavegar}
        />
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 3: Commit**

```bash
git add components/shell/BarraInferior.tsx
git commit -m "feat: barra inferior de navegación móvil"
```

---

### Task 5: DrawerNav

**Files:**
- Create: `components/shell/DrawerNav.tsx`

**Interfaces:**
- Consumes: `ItemNav` (Task 3), `SeccionNav`, `EntradaNav`, `Acento`, `Usuario`.
- Produces: componente default `DrawerNav` con props `{ abierto: boolean; onCerrar: () => void; secciones: SeccionNav[]; activoId: string; acento: Acento; badges: Record<string, number>; usuario: Usuario; onNavegar: (item: EntradaNav) => void }`.

Este es el componente con más comportamiento: focus trap, ESC, bloqueo de scroll, grupos expandibles y aplanado de grupos de un solo ítem.

- [ ] **Step 1: Escribir el componente**

Create `components/shell/DrawerNav.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Acento, EntradaNav, SeccionNav } from "@/lib/navegacion";
import type { Usuario } from "@/lib/auth";
import ItemNav from "./ItemNav";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  secciones: SeccionNav[];
  activoId: string;
  acento: Acento;
  badges: Record<string, number>;
  usuario: Usuario;
  onNavegar: (item: EntradaNav) => void;
}

const SELECTOR_FOCUSABLE =
  'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export default function DrawerNav({
  abierto,
  onCerrar,
  secciones,
  activoId,
  acento,
  badges,
  usuario,
  onNavegar,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [expandidos, setExpandidos] = useState<string[]>([]);

  // Abre por defecto el grupo que contiene la vista activa.
  useEffect(() => {
    if (!abierto) return;
    const padre = secciones
      .flatMap((s) => s.items)
      .find((item) => item.hijos?.some((h) => h.id === activoId));
    if (padre) setExpandidos((prev) => (prev.includes(padre.id) ? prev : [...prev, padre.id]));
  }, [abierto, activoId, secciones]);

  // Bloquea el scroll del fondo mientras el drawer esta abierto.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  // Foco al abrir, ESC para cerrar, Tab atrapado dentro del panel.
  useEffect(() => {
    if (!abierto) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABLE));

    focusables()[0]?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onCerrar();
        return;
      }
      if (evento.key !== "Tab") return;

      const elementos = focusables();
      if (elementos.length === 0) return;
      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const alternarGrupo = (id: string) =>
    setExpandidos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 motion-safe:animate-[fadeIn_150ms_ease-out] md:hidden"
        onClick={onCerrar}
        aria-hidden="true"
      />
      <div
        id="drawer-navegacion"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className="fixed inset-y-0 left-0 z-[51] flex w-[82%] max-w-xs flex-col overflow-y-auto bg-white motion-safe:animate-[slideIn_180ms_ease-out] md:hidden"
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${acento.fondo} ${acento.texto}`}
            aria-hidden="true"
          >
            {iniciales(usuario.nombre)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-gray-900">
              {usuario.nombre}
            </p>
            <p className="text-xs capitalize text-gray-500">{usuario.rol}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar menú"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 px-2 py-3">
          {secciones.map((seccion) => (
            <div key={seccion.titulo} className="mb-3">
              {seccion.items.length > 1 && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {seccion.titulo}
                </p>
              )}
              {seccion.items.map((item) =>
                item.hijos && item.hijos.length > 0 ? (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => alternarGrupo(item.id)}
                      aria-expanded={expandidos.includes(item.id)}
                      aria-controls={`grupo-${item.id}`}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] text-gray-700 hover:bg-gray-100"
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        {item.emoji}
                      </span>
                      {item.label}
                      <span aria-hidden="true" className="ml-auto text-xs text-gray-400">
                        {expandidos.includes(item.id) ? "▲" : "▼"}
                      </span>
                    </button>
                    {expandidos.includes(item.id) && (
                      <div id={`grupo-${item.id}`}>
                        {item.hijos.map((hijo) => (
                          <ItemNav
                            key={hijo.id}
                            item={hijo}
                            variante="drawer"
                            activo={hijo.id === activoId}
                            acento={acento}
                            badge={badges[hijo.id]}
                            onNavegar={onNavegar}
                            sangria
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <ItemNav
                    key={item.id}
                    item={item}
                    variante="drawer"
                    activo={item.id === activoId}
                    acento={acento}
                    badge={badges[item.id]}
                    onNavegar={onNavegar}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Agregar las animaciones**

Append to `app/globals.css`:

```css
/* Entrada del drawer de navegación */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
```

Las clases del componente usan el prefijo `motion-safe:`, así que con `prefers-reduced-motion: reduce` no se aplican y el drawer aparece sin desplazamiento.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 4: Commit**

```bash
git add components/shell/DrawerNav.tsx app/globals.css
git commit -m "feat: drawer de navegación con focus trap y grupos expandibles"
```

---

### Task 6: TopBar

**Files:**
- Create: `components/shell/TopBar.tsx`

**Interfaces:**
- Consumes: `ItemNav` (Task 3), `SeccionNav`, `EntradaNav`, `Acento`, `Usuario`.
- Produces: componente default `TopBar` con props `{ titulo: string; secciones: SeccionNav[]; activoId: string; acento: Acento; badges: Record<string, number>; usuario: Usuario; acciones?: React.ReactNode; onAbrirDrawer: () => void; onNavegar: (item: EntradaNav) => void }`.

En escritorio aplana los hijos: `Productos` no se rinde como grupo sino que se rinden `Stock` y `Menú` directo. La sección Sesión no entra en la nav horizontal; ahí van el nombre y el botón de salir.

- [ ] **Step 1: Escribir el componente**

Create `components/shell/TopBar.tsx`:

```tsx
"use client";

import type { Acento, EntradaNav, SeccionNav } from "@/lib/navegacion";
import type { Usuario } from "@/lib/auth";
import ItemNav from "./ItemNav";

interface Props {
  titulo: string;
  secciones: SeccionNav[];
  activoId: string;
  acento: Acento;
  badges: Record<string, number>;
  usuario: Usuario;
  acciones?: React.ReactNode;
  onAbrirDrawer: () => void;
  onNavegar: (item: EntradaNav) => void;
}

export default function TopBar({
  titulo,
  secciones,
  activoId,
  acento,
  badges,
  usuario,
  acciones,
  onAbrirDrawer,
  onNavegar,
}: Props) {
  const itemLogout = secciones
    .flatMap((s) => s.items)
    .find((item) => item.id === "logout");

  // En escritorio no hay grupos plegables: los hijos se rinden al mismo nivel.
  const itemsHorizontales = secciones
    .filter((s) => s.titulo !== "Sesión")
    .flatMap((s) => s.items)
    .flatMap((item) => (item.hijos?.length ? item.hijos : [item]))
    .filter((item) => !item.href.startsWith("#"));

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={onAbrirDrawer}
          aria-label="Abrir menú"
          aria-expanded={false}
          aria-controls="drawer-navegacion"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-gray-700 hover:bg-gray-100 md:hidden"
        >
          ☰
        </button>

        <h1 className="truncate text-base font-semibold text-gray-900 md:hidden">
          {titulo}
        </h1>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-1 md:flex"
        >
          {itemsHorizontales.map((item) => (
            <ItemNav
              key={item.id}
              item={item}
              variante="topbar"
              activo={item.id === activoId}
              acento={acento}
              badge={badges[item.id]}
              onNavegar={onNavegar}
            />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {acciones}
          <span className="hidden text-sm text-gray-600 md:inline">
            {usuario.nombre}
          </span>
          {itemLogout && (
            <button
              type="button"
              onClick={() => onNavegar(itemLogout)}
              className="hidden min-h-11 rounded-lg bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600 md:block"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 3: Commit**

```bash
git add components/shell/TopBar.tsx
git commit -m "feat: topbar con nav horizontal en escritorio"
```

---

### Task 7: AppShell

**Files:**
- Create: `components/shell/AppShell.tsx`

**Interfaces:**
- Consumes: `TopBar` (Task 6), `DrawerNav` (Task 5), `BarraInferior` (Task 4), `resolverNav`, `itemsBarraInferior`, `acentoDeRol`, `Usuario`.
- Produces: componente default `AppShell` con props `{ usuario: Usuario; onLogout: () => void; titulo: string; activoId: string; badges?: Record<string, number>; acciones?: React.ReactNode; onAccion?: (id: string) => void; children: React.ReactNode }`.

`onAccion` cubre los ítems cuyo `href` empieza con `#`: hoy solo `#notificaciones` en cocina. `#logout` lo maneja el shell llamando `onLogout`.

- [ ] **Step 1: Escribir el componente**

Create `components/shell/AppShell.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Usuario } from "@/lib/auth";
import {
  acentoDeRol,
  itemsBarraInferior,
  resolverNav,
  type ContextoNav,
  type EntradaNav,
} from "@/lib/navegacion";
import TopBar from "./TopBar";
import DrawerNav from "./DrawerNav";
import BarraInferior from "./BarraInferior";

interface Props {
  usuario: Usuario;
  onLogout: () => void;
  titulo: string;
  activoId: string;
  badges?: Record<string, number>;
  acciones?: React.ReactNode;
  onAccion?: (id: string) => void;
  children: React.ReactNode;
}

const SIN_BADGES: Record<string, number> = {};

export default function AppShell({
  usuario,
  onLogout,
  titulo,
  activoId,
  badges = SIN_BADGES,
  acciones,
  onAccion,
  children,
}: Props) {
  const router = useRouter();
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  // Se resuelve en efecto y no en el primer render: `Notification` no existe
  // en el servidor y leerlo directo produce mismatch de hidratacion.
  const [permisoNotificaciones, setPermisoNotificaciones] =
    useState<ContextoNav["permisoNotificaciones"]>("no-soportado");
  // El drawer y la barra inferior se sacan del DOM en escritorio, no se ocultan
  // solo con CSS: si se ocultaran, redimensionar con el drawer abierto dejaria
  // el focus trap activo sobre un panel invisible.
  const [esMovil, setEsMovil] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermisoNotificaciones(Notification.permission);
  }, []);

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 767px)");
    const sincronizar = () => {
      setEsMovil(consulta.matches);
      if (!consulta.matches) setDrawerAbierto(false);
    };
    sincronizar();
    consulta.addEventListener("change", sincronizar);
    return () => consulta.removeEventListener("change", sincronizar);
  }, []);

  const secciones = useMemo(
    () => resolverNav(usuario.rol, { permisoNotificaciones }),
    [usuario.rol, permisoNotificaciones],
  );
  const inferiores = useMemo(() => itemsBarraInferior(secciones), [secciones]);
  const acento = acentoDeRol(usuario.rol);

  const navegar = (item: EntradaNav) => {
    setDrawerAbierto(false);
    if (item.id === "logout") {
      onLogout();
      return;
    }
    if (item.href.startsWith("#")) {
      onAccion?.(item.id);
      return;
    }
    router.push(item.href);
  };

  return (
    <div className="min-h-screen">
      <TopBar
        titulo={titulo}
        secciones={secciones}
        activoId={activoId}
        acento={acento}
        badges={badges}
        usuario={usuario}
        acciones={acciones}
        onAbrirDrawer={() => setDrawerAbierto(true)}
        onNavegar={navegar}
      />

      {esMovil && (
        <DrawerNav
          abierto={drawerAbierto}
          onCerrar={() => setDrawerAbierto(false)}
          secciones={secciones}
          activoId={activoId}
          acento={acento}
          badges={badges}
          usuario={usuario}
          onNavegar={navegar}
        />
      )}

      <main inert={drawerAbierto ? true : undefined} className="pb-20 md:pb-0">
        {children}
      </main>

      {esMovil && (
        <BarraInferior
          items={inferiores}
          activoId={activoId}
          acento={acento}
          badges={badges}
          onNavegar={navegar}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida. Si `inert` da error de tipo con `@types/react` 19, reemplazar la línea del `<main>` por:

```tsx
      <main {...(drawerAbierto ? { inert: "" } : {})} className="pb-20 md:pb-0">
```

- [ ] **Step 3: Commit**

```bash
git add components/shell/AppShell.tsx
git commit -m "feat: AppShell que orquesta topbar, drawer y barra inferior"
```

---

### Task 8: Migrar /mesero

**Files:**
- Modify: `app/mesero/page.tsx:53-63` (estado de vista), `:149-226` (header y encabezado de la lista)
- Modify: `components/mesero/CrearOrden.tsx:827` (posición del botón flotante del carrito)

**Interfaces:**
- Consumes: `AppShell` (Task 7).
- Produces: patrón de migración que las tareas 9 a 13 repiten.

La vista pasa de `useState` a query param. `useSearchParams()` en el App Router obliga a envolver el contenido en `<Suspense>`, así que el componente se parte en dos: un `MeseroContenido` con toda la lógica y un default export que solo aporta el boundary.

- [ ] **Step 1: Extraer el contenido y leer la vista de la URL**

En `app/mesero/page.tsx`, cambiar los imports iniciales:

```tsx
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
```

Renombrar `export default function MeseroPage()` a `function MeseroContenido()` y reemplazar el bloque de estado de vista (líneas 56-63) por:

```tsx
  const router = useRouter();
  const searchParams = useSearchParams();
  const vistaParam = searchParams.get("vista");
  const vistaActiva: "crear" | "ordenes" | "retiro" =
    vistaParam === "ordenes" || vistaParam === "retiro" ? vistaParam : "crear";
```

Un valor desconocido cae a `crear` en vez de romper.

- [ ] **Step 2: Reemplazar el header por AppShell**

Sustituir todo el bloque `return (...)` de `MeseroContenido`, desde `<div>` hasta el cierre del header (líneas 150-203), de modo que el componente devuelva:

```tsx
  const titulos = {
    crear: "Crear orden",
    ordenes: "Mis órdenes",
    retiro: "Retiro de caja",
  } as const;

  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo={titulos[vistaActiva]}
      activoId={vistaActiva}
      badges={{ ordenes: ordenesPorCobrar.length }}
      acciones={
        vistaActiva === "ordenes" ? (
          <button
            onClick={cargarOrdenes}
            className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            🔄 Actualizar
          </button>
        ) : undefined
      }
    >
      {vistaActiva === "crear" && <CrearOrden />}
      {vistaActiva === "retiro" && <RetiroCaja usuario={usuario} />}
      {vistaActiva === "ordenes" && (
        /* ... el bloque existente de la lista de ordenes ... */
      )}
      {/* ... los dos modales existentes ... */}
    </AppShell>
  );
```

Dentro del bloque de órdenes, borrar el `<div className="flex justify-between items-center mb-6">` con el `<h1>` y el botón Actualizar (líneas 212-222): ese título ahora lo pone la topbar y el botón vive en `acciones`.

- [ ] **Step 3: Agregar el boundary de Suspense**

Al final de `app/mesero/page.tsx`:

```tsx
export default function MeseroPage() {
  return (
    <Suspense fallback={null}>
      <MeseroContenido />
    </Suspense>
  );
}
```

- [ ] **Step 4: Levantar el botón flotante del carrito**

En `components/mesero/CrearOrden.tsx:827`, el botón está en `bottom-5` y la barra inferior mide 56px más el safe area. Cambiar:

```tsx
          className="lg:hidden fixed right-5 bottom-5 z-40 rounded-full bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-xl transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
```

por:

```tsx
          className="lg:hidden fixed right-5 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-full bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-xl transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 md:bottom-5"
```

- [ ] **Step 5: Verificar tipos y compilación**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores

- [ ] **Step 6: Verificar en el navegador**

Levantar la preview y abrir `/mesero` a 375px de ancho. Confirmar:
- La barra inferior muestra Crear, Órdenes y Retiro; el badge aparece sobre Órdenes cuando hay órdenes por cobrar.
- El burger abre el drawer; ESC lo cierra; el foco vuelve al burger.
- El botón "↓ Ir al carrito" queda por encima de la barra inferior, no tapado.
- A 1280px no hay drawer ni barra inferior, y la nav horizontal muestra Crear orden, Mis órdenes y Retiro de caja.

- [ ] **Step 7: Commit**

```bash
git add app/mesero/page.tsx components/mesero/CrearOrden.tsx
git commit -m "feat: migrar /mesero al AppShell"
```

---

### Task 9: Migrar /digital

**Files:**
- Modify: `app/digital/page.tsx:53-54` (estado de vista), `:143-200` (header y encabezado)

**Interfaces:**
- Consumes: `AppShell` (Task 7).
- Produces: nada nuevo.

Mismo patrón que la Task 8, con dos vistas en vez de tres y sin botón flotante que ajustar.

- [ ] **Step 1: Extraer el contenido y leer la vista de la URL**

Imports:

```tsx
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
```

Renombrar `export default function DigitalPage()` a `function DigitalContenido()` y reemplazar el `useState` de `vistaActiva` por:

```tsx
  const searchParams = useSearchParams();
  const vistaActiva: "crear" | "pedidos" =
    searchParams.get("vista") === "pedidos" ? "pedidos" : "crear";
```

- [ ] **Step 2: Reemplazar el header por AppShell**

El `return` pasa a:

```tsx
  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo={vistaActiva === "crear" ? "Nuevo pedido" : "Mis pedidos"}
      activoId={vistaActiva}
      badges={{ pedidos: pedidosPorCobrar.length }}
      acciones={
        vistaActiva === "pedidos" ? (
          <button
            onClick={cargarOrdenes}
            className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            🔄 Actualizar
          </button>
        ) : undefined
      }
    >
      {vistaActiva === "crear" ? (
        <CrearOrden />
      ) : (
        /* ... el bloque existente de la lista de pedidos, sin su <h1> ni su boton Actualizar ... */
      )}
      {/* ... los modales existentes ... */}
    </AppShell>
  );
```

- [ ] **Step 3: Agregar el boundary de Suspense**

```tsx
export default function DigitalPage() {
  return (
    <Suspense fallback={null}>
      <DigitalContenido />
    </Suspense>
  );
}
```

- [ ] **Step 4: Verificar tipos y compilación**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores

- [ ] **Step 5: Verificar en el navegador**

`/digital` a 375px: barra inferior con dos ítems, badge sobre Pedidos, drawer funcional.

- [ ] **Step 6: Commit**

```bash
git add app/digital/page.tsx
git commit -m "feat: migrar /digital al AppShell"
```

---

### Task 10: Migrar /cocina

**Files:**
- Modify: `app/cocina/page.tsx:255` (z-index del banner), `:293-329` (header y título)

**Interfaces:**
- Consumes: `AppShell` (Task 7).
- Produces: nada nuevo.

Cocina no lleva barra inferior: tiene un solo destino. El botón de activar notificaciones deja de vivir en el header y pasa a ser el ítem `#notificaciones` del drawer, resuelto por `onAccion`.

- [ ] **Step 1: Bajar el z-index del banner SSE**

En `app/cocina/page.tsx:255`, cambiar:

```tsx
        <div className="fixed top-0 left-0 right-0 z-50 shadow-2xl">
```

por:

```tsx
        <div className="fixed top-0 left-0 right-0 z-40 shadow-2xl">
```

El drawer va en `z-50` y `z-[51]`; con el banner en `z-50` quedaba encima del overlay.

- [ ] **Step 2: Reemplazar el header por AppShell**

Agregar el import:

```tsx
import AppShell from "@/components/shell/AppShell";
```

Sustituir el bloque del header (líneas 293-324) y el `<h1>` de "Monitor de Cocina" (líneas 327-329). El `return` queda:

```tsx
  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo="Monitor de cocina"
      activoId="monitor"
      onAccion={(id) => {
        if (id !== "notificaciones") return;
        Notification.requestPermission().then((p) => {
          if (p !== "default") setPermisoBrowser(false);
        });
      }}
    >
      <div className="min-h-screen bg-gray-900">
        {notificacion && (
          /* ... el banner existente, ya con z-40 ... */
        )}

        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ordenes.map((orden) => (
              <OrdenCard
                key={orden.id}
                orden={orden}
                onMarcarLista={(id) => cambiarEstado(id, "lista")}
              />
            ))}
          </div>

          {ordenes.length === 0 && (
            <div className="mt-20 text-center text-2xl text-white">
              No hay órdenes pendientes
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
```

El estado `permisoBrowser` se conserva porque el efecto de SSE lo usa, pero ya no controla ningún botón del header: el ítem del drawer se filtra solo, vía `visible` en `lib/navegacion.ts`.

- [ ] **Step 3: Verificar tipos y compilación**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores

- [ ] **Step 4: Verificar en el navegador**

`/cocina` a 375px: no hay barra inferior. El drawer muestra Monitor de cocina, Activar notificaciones (si el permiso está en `default`) y Cerrar sesión. Con el drawer abierto, el banner de nueva orden queda por debajo del overlay.

- [ ] **Step 5: Commit**

```bash
git add app/cocina/page.tsx
git commit -m "feat: migrar /cocina al AppShell"
```

---

### Task 11: Migrar /admin

**Files:**
- Modify: `app/admin/page.tsx:371-408` (header)

**Interfaces:**
- Consumes: `AppShell` (Task 7).
- Produces: nada nuevo.

Solo se le extrae el header. El archivo son 1326 líneas y no se abre refactor más allá de eso.

- [ ] **Step 1: Reemplazar el header por AppShell**

Agregar el import:

```tsx
import AppShell from "@/components/shell/AppShell";
```

Justo antes del `return`, guardar contra la sesión aún sin resolver, ya que `AppShell` exige un `usuario`:

```tsx
  if (!usuario) return null;
```

Sustituir las líneas 372-408 de modo que el `return` empiece así:

```tsx
  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo="Cuadre de caja"
      activoId="cuadre"
    >
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-7xl">
          {/* ... desde el bloque de filtros del cuadre en adelante, sin cambios ... */}
```

y cerrar con `</AppShell>` al final. Se borran los tres enlaces (Reportes, Productos, Usuarios), el nombre del admin y el botón de cerrar sesión: todo eso vive ahora en el shell.

- [ ] **Step 2: Verificar tipos y compilación**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores

- [ ] **Step 3: Verificar en el navegador**

`/admin` a 375px: barra inferior con Cuadre, Productos, Reportes y Usuarios. El drawer muestra Productos y Reportes como grupos plegables.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: migrar /admin al AppShell"
```

---

### Task 12: Migrar /admin/productos con pestaña en la URL

**Files:**
- Modify: `app/admin/productos/page.tsx` (archivo completo, son 78 líneas)

**Interfaces:**
- Consumes: `AppShell` (Task 7).
- Produces: nada nuevo.

- [ ] **Step 1: Reescribir la página**

Replace the entire contents of `app/admin/productos/page.tsx`:

```tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
import GestionStock from "@/components/admin/GestionStock";
import GestionMenu from "@/components/admin/GestionMenu";

function ProductosContenido() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const searchParams = useSearchParams();
  const pestana = searchParams.get("tab") === "menu" ? "menu" : "stock";

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario || usuario.rol !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-xl text-red-600">Acceso denegado</div>
      </div>
    );
  }

  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo={pestana === "stock" ? "Stock" : "Menú"}
      activoId={pestana}
    >
      <div className="min-h-screen bg-gray-100">
        {pestana === "stock" ? <GestionStock /> : <GestionMenu />}
      </div>
    </AppShell>
  );
}

export default function ProductosPage() {
  return (
    <Suspense fallback={null}>
      <ProductosContenido />
    </Suspense>
  );
}
```

Las dos pestañas de la barra interna desaparecen: ahora son sub-ítems del drawer y entradas de la nav horizontal.

- [ ] **Step 2: Verificar tipos y compilación**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores

- [ ] **Step 3: Verificar en el navegador**

Abrir `/admin/productos?tab=menu` directo y confirmar que carga en Menú. Recargar y confirmar que se mantiene. En el drawer, el grupo Productos aparece ya expandido con Menú marcado como activo.

- [ ] **Step 4: Commit**

```bash
git add app/admin/productos/page.tsx
git commit -m "feat: migrar /admin/productos al AppShell con la pestaña en la URL"
```

---

### Task 13: Migrar /admin/reportes y /admin/usuarios

**Files:**
- Modify: `app/admin/reportes/page.tsx:47-56` (estado), `:110-128` (header), `:163-190` (pestañas)
- Modify: `app/admin/usuarios/page.tsx:113-140` (header)

**Interfaces:**
- Consumes: `AppShell` (Task 7).
- Produces: nada nuevo.

- [ ] **Step 1: Reportes — leer la pestaña de la URL**

Imports de `app/admin/reportes/page.tsx`:

```tsx
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
```

Renombrar `export default function ReportesPage()` a `function ReportesContenido()`, extraer `logout` de `useAuth()` (hoy solo saca `usuario` y `loading`), y reemplazar el `useState` de `pestanaActiva` por:

```tsx
  const searchParams = useSearchParams();
  const pestanaActiva: "modificaciones" | "cortesias" =
    searchParams.get("tab") === "cortesias" ? "cortesias" : "modificaciones";
```

- [ ] **Step 2: Reportes — reemplazar header y pestañas**

Borrar el bloque del header con el `<h1>` y el enlace "← Volver" (líneas 114-128) y la barra de pestañas (líneas 163-190). El `return` queda:

```tsx
  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo={pestanaActiva === "cortesias" ? "Cortesías" : "Modificaciones"}
      activoId={pestanaActiva}
      badges={
        reporteCortesias
          ? { cortesias: reporteCortesias.resumen.totalCortesias }
          : undefined
      }
    >
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-7xl">
          {/* ... desde el bloque de filtros de fecha en adelante, sin cambios ... */}
        </div>
      </div>
    </AppShell>
  );
```

Antes del `return`, agregar la guarda `if (!usuario) return null;`.

- [ ] **Step 3: Reportes — boundary de Suspense**

```tsx
export default function ReportesPage() {
  return (
    <Suspense fallback={null}>
      <ReportesContenido />
    </Suspense>
  );
}
```

- [ ] **Step 4: Usuarios — reemplazar el header**

En `app/admin/usuarios/page.tsx`, agregar el import de `AppShell` y sustituir el header sticky (líneas 114-140) para que el `return` sea:

```tsx
  return (
    <AppShell
      usuario={usuario}
      onLogout={logout}
      titulo="Usuarios"
      activoId="usuarios"
    >
      <div className="min-h-screen bg-gray-100">
        <div className="mx-auto max-w-5xl px-4 py-4">
          {/* ... el contenido existente, sin cambios ... */}
        </div>
      </div>
    </AppShell>
  );
```

No usa `useSearchParams`, así que no necesita `Suspense`.

- [ ] **Step 5: Verificar tipos y compilación**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores

- [ ] **Step 6: Verificar en el navegador**

Abrir `/admin/reportes?tab=cortesias` directo y confirmar que carga en Cortesías con su badge. Navegar entre las cuatro secciones de admin desde la barra inferior sin pasar por "← Volver".

- [ ] **Step 7: Commit**

```bash
git add app/admin/reportes/page.tsx app/admin/usuarios/page.tsx
git commit -m "feat: migrar /admin/reportes y /admin/usuarios al AppShell"
```

---

### Task 14: Corregir la escala de z-index de los modales

**Files:**
- Modify: `app/mesero/page.tsx:430`
- Modify: `app/digital/page.tsx:415`
- Modify: `app/admin/page.tsx:627`, `:946`, `:1263`
- Modify: `components/mesero/CrearOrden.tsx:839`
- Modify: `components/mesero/EditarOrdenModal.tsx:321`
- Modify: `components/admin/ModalFormulario.tsx:13`
- Modify: `components/admin/DetalleOrdenModal.tsx:165`, `:612`

**Interfaces:**
- Consumes: la escala documentada en `lib/navegacion.ts`.
- Produces: nada nuevo.

Diez modales están en `z-50`, que colisiona con el overlay del drawer. Suben a `z-[60]`. El único modal anidado sube a `z-[70]`.

- [ ] **Step 1: Subir los modales de primer nivel**

En cada una de estas ubicaciones, cambiar `z-50` por `z-[60]` en el `className` del contenedor `fixed inset-0`:

- `app/mesero/page.tsx:430`
- `app/digital/page.tsx:415`
- `app/admin/page.tsx:627`, `:946`, `:1263`
- `components/mesero/CrearOrden.tsx:839`
- `components/mesero/EditarOrdenModal.tsx:321`
- `components/admin/ModalFormulario.tsx:13`
- `components/admin/DetalleOrdenModal.tsx:165`

- [ ] **Step 2: Subir el modal anidado**

En `components/admin/DetalleOrdenModal.tsx:612`, cambiar `z-[60]` por `z-[70]`. Ese es el modal de confirmación que se abre encima del detalle de la orden.

- [ ] **Step 3: Verificar que no queden colisiones**

Run: `grep -rn "z-50" app components`
Expected: solo el overlay del drawer en `components/shell/DrawerNav.tsx`

- [ ] **Step 4: Verificar tipos y compilación**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add app components
git commit -m "fix: unificar la escala de z-index entre modales, drawer y banner"
```

---

### Task 15: Verificación final

**Files:**
- Ninguno. Es una pasada de verificación.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Correr toda la suite**

```bash
npm run test:navegacion && npm run test:cuadre && npm run test:retiros-validaciones && npm run test:admin-validaciones
```

Expected: cada uno imprime su línea de `tests passed`

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso. Un error de `useSearchParams() should be wrapped in a suspense boundary` significa que a alguna página migrada le falta el boundary de la Task 8, 9, 12 o 13.

- [ ] **Step 3: Recorrido por rol a 375px**

Para cada rol (mesero, digital, cocina, admin), con la preview abierta y el viewport en 375×812:

- El drawer abre con el burger y cierra con ESC, con el overlay y con la ✕.
- Al cerrar, el foco vuelve al burger.
- Con el drawer abierto, Tab no sale del panel.
- El ítem activo está marcado y lleva `aria-current="page"`.
- Ningún contenido queda tapado por la barra inferior.

- [ ] **Step 4: Recorrido a 1280px**

Para cada rol: no hay burger, no hay barra inferior, la nav horizontal muestra los destinos del rol y el nombre y el botón de cerrar sesión están a la derecha.

- [ ] **Step 5: Reduced motion**

Con `prefers-reduced-motion: reduce` activo en el navegador, abrir el drawer y confirmar que aparece sin desplazamiento lateral.

- [ ] **Step 6: Commit final**

```bash
git commit --allow-empty -m "chore: verificación del AppShell completa"
```

---

## Desviaciones respecto del spec

Dos, ambas ya reflejadas en el documento de spec:

1. `usuario` y `onLogout` viajan por props en vez de que `AppShell` llame a `useAuth()`. Evita un `GET /api/auth/session` extra por carga de página y una segunda ruta de redirección compitiendo con la de la página.
2. `activoId` viene de la página. Mantiene `useSearchParams()` fuera del shell, que si no obligaría a un `<Suspense>` alrededor de cada página migrada solo para el nav.
