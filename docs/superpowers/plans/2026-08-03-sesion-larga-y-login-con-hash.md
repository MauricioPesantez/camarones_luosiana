# Sesión larga y login con hash — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la sesión del navegador sobreviva el turno completo y siga viva en la pestaña que abre el enlace de cobro, y que el login exija contraseña hasheada para todos los usuarios.

**Architecture:** La sesión sigue siendo un token opaco aleatorio con su fila en `SesionUsuario` (no se introduce JWT: no aporta nada aquí y quita la revocación inmediata). Se le agrega renovación deslizante en base y reemisión de la cookie desde `/api/auth/session`, que el cliente pasa a llamar periódicamente en vez de una sola vez al montar. El `cobroUrl` deja de guardarse absoluto y pasa a ser una ruta relativa que se resuelve contra el origen de la petición al imprimir. En paralelo, la contraseña se vuelve obligatoria y se guarda con `bcrypt`.

**Tech Stack:** Next.js 16 App Router, React 19.2, Prisma 5.22 sobre Postgres, TypeScript, `bcryptjs` v3. Tests con `node:assert/strict` ejecutados por `ts-node`, siguiendo el patrón de `lib/cuadre.test.ts` y `lib/navegacion.test.ts`.

## Diagnóstico que origina el plan

Verificado en vivo contra `https://develop.d19qsoj0m02u1y.amplifyapp.com` el 2026-08-03:

- La cookie **sí** cruza pestañas. Con sesión activa, `/ordenes/cobrar/<token-falso>` en una pestaña nueva redirigió a `/mesero?vista=ordenes&cobro=enlace_invalido`, o sea `getAuthenticatedUser()` la leyó bien. CloudFront no interfiere: la página responde `cache-control: private, no-cache, no-store`.
- **Causa A (principal):** `SESSION_DURATION_MS` son 12 h absolutas sin renovación (`lib/session.ts:10` y el comentario de `lib/session.ts:78`), mientras que `useAuth` valida contra el servidor **una sola vez al montar** (`lib/auth.ts:28`, deps `[router, requiredRole]`). El POS es una SPA con SSE que no se recarga en todo el turno: la cookie expira, la pestaña sigue pintando desde `localStorage`, y el fallo recién aparece en la pestaña de cobro, frente al cliente.
- **Causa B:** el QR impreso lo abre el navegador por defecto del teléfono, que puede no ser donde se hizo login. Ninguna tecnología de sesión arregla esto; se mitiga con la sesión larga de la Causa A.
- **Causa C:** en base hay órdenes con `cobroUrl = http://localhost:3000/...` porque la URL absoluta se congela al crear la orden (`lib/payment-link.ts:18`).

## Riesgo asumido, decidido por el dueño del producto

- **Se mantiene el login actual con retorno por `?next=`** para el QR abierto sin sesión. No se implementa PIN ni auto-autorización por token.
- **Se descarta JWT.** El token opaco con fila en base ya es superior: revocable al instante. `JWT_SECRET` queda sin uso y se elimina del `.env` (Task 10).
- **La sesión de 30 días es una decisión de negocio.** Un teléfono robado con sesión abierta puede cobrar órdenes durante 30 días. Se compensa con `/admin/usuarios`, desde donde el admin desactiva al usuario y `getAuthenticatedSession` corta la sesión en el siguiente request (ya valida `usuario.activo`).

## Global Constraints

- Todo el texto de UI en español, sentence case, sin punto final en labels ni encabezados.
- No se agregan dependencias nuevas salvo `bcryptjs`. Nada de `jsonwebtoken`, `next-auth`, `iron-session`.
- `bcryptjs` (JS puro) y no `bcrypt` (binario nativo): el runtime de Amplify SSR no compila binarios nativos en el bundle.
- Los módulos con lógica pura van en archivos **sin** `import 'server-only'`, para que `ts-node` pueda ejecutarlos en los tests. `lib/session.ts` conserva su `server-only`.
- Las cookies solo se escriben desde Route Handlers. Un Server Component no puede llamar `cookies().set()` en Next 16; por eso la reemisión vive en `/api/auth/session`.
- Cada tarea termina con `npx tsc --noEmit` limpio antes del commit.
- Cada tarea nueva de test se registra como script en `package.json` con el mismo formato que los existentes.
- Orden obligatorio: la migración de contraseñas (Task 8) corre **antes** de activar la exigencia en el login (Task 9). Invertirlo deja a los cuatro usuarios fuera del sistema.

---

### Task 1: Reglas puras de duración de sesión

**Files:**
- Create: `lib/session-duracion.ts`
- Create: `lib/session-duracion.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada.
- Produces: `SESSION_DURATION_MS: number`, `necesitaRenovacion(expiresAt: Date, ahora: Date, duracionMs?: number): boolean`, `nuevaExpiracion(ahora: Date, duracionMs?: number): Date`.

- [ ] **Step 1: Escribir el test que falla**

Create `lib/session-duracion.test.ts`:

```ts
import assert from "node:assert/strict";

import {
  SESSION_DURATION_MS,
  necesitaRenovacion,
  nuevaExpiracion,
} from "./session-duracion";

const DIA = 24 * 60 * 60 * 1000;
const ahora = new Date("2026-08-03T12:00:00.000Z");

// La sesion dura 30 dias: un turno largo, un feriado o un fin de semana no
// deben obligar al mesero a volver a loguearse en su celular.
assert.equal(SESSION_DURATION_MS, 30 * DIA);

// Recien emitida: queda todo el plazo, no hay nada que renovar.
const reciente = new Date(ahora.getTime() + 30 * DIA);
assert.equal(necesitaRenovacion(reciente, ahora), false);

// Justo en la mitad del plazo todavia no renueva: el umbral es estricto.
const mitadExacta = new Date(ahora.getTime() + 15 * DIA);
assert.equal(necesitaRenovacion(mitadExacta, ahora), false);

// Pasada la mitad si renueva, para que un aparato en uso nunca expire.
const pasadaLaMitad = new Date(ahora.getTime() + 15 * DIA - 1);
assert.equal(necesitaRenovacion(pasadaLaMitad, ahora), true);

// Ya expirada no se renueva: esa sesion se cierra, no se resucita.
const expirada = new Date(ahora.getTime() - 1);
assert.equal(necesitaRenovacion(expirada, ahora), false);

// El limite exacto tambien cuenta como expirada.
assert.equal(necesitaRenovacion(new Date(ahora.getTime()), ahora), false);

// La expiracion nueva siempre parte del momento de la renovacion.
assert.equal(
  nuevaExpiracion(ahora).toISOString(),
  new Date(ahora.getTime() + 30 * DIA).toISOString(),
);

// La duracion es parametrizable para poder probar sin esperar 30 dias.
assert.equal(necesitaRenovacion(new Date(ahora.getTime() + 400), ahora, 1000), true);
assert.equal(necesitaRenovacion(new Date(ahora.getTime() + 600), ahora, 1000), false);

console.log("session-duracion: OK");
```

- [ ] **Step 2: Registrar el script y correr el test para verlo fallar**

Modify `package.json`, agregando dentro de `"scripts"` justo después de `"test:navegacion"`:

```json
    "test:session-duracion": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/session-duracion.test.ts",
```

Run: `npm run test:session-duracion`
Expected: FAIL con `Cannot find module './session-duracion'`

- [ ] **Step 3: Implementar el módulo**

Create `lib/session-duracion.ts`:

```ts
/**
 * Reglas de duracion de la sesion. Modulo puro y sin `server-only` para que
 * `ts-node` pueda ejecutarlo en los tests, igual que `lib/cuadre.ts`.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * La sesion del POS dura 30 dias. El turno de un mesero no cabe en 12 horas:
 * con el plazo corto la cookie moria a media jornada, la pestana del POS seguia
 * pintando desde localStorage y el fallo recien aparecia al abrir el cobro.
 */
export const SESSION_DURATION_MS = 30 * DIA_MS;

/**
 * Se renueva cuando ya se consumio mas de la mitad del plazo. Asi no se escribe
 * en base en cada request y a la vez un aparato en uso nunca llega a expirar.
 */
export function necesitaRenovacion(
  expiresAt: Date,
  ahora: Date,
  duracionMs: number = SESSION_DURATION_MS,
): boolean {
  const restante = expiresAt.getTime() - ahora.getTime();
  // Una sesion ya vencida no se renueva: se cierra en el llamador.
  if (restante <= 0) return false;
  return restante < duracionMs / 2;
}

export function nuevaExpiracion(
  ahora: Date,
  duracionMs: number = SESSION_DURATION_MS,
): Date {
  return new Date(ahora.getTime() + duracionMs);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test:session-duracion`
Expected: `session-duracion: OK`

- [ ] **Step 5: Verificar tipos y commitear**

Run: `npx tsc --noEmit`
Expected: sin salida

```bash
git add lib/session-duracion.ts lib/session-duracion.test.ts package.json
git commit -m "feat(session): reglas de duracion y renovacion deslizante de 30 dias"
```

---

### Task 2: Renovación deslizante en el servidor

**Files:**
- Modify: `lib/session.ts:9-10` (constante), `lib/session.ts:22-42` (`createSession`), `lib/session.ts:58-87` (`getAuthenticatedUser`)
- Modify: `app/api/auth/session/route.ts`

**Interfaces:**
- Consumes: `SESSION_DURATION_MS`, `necesitaRenovacion`, `nuevaExpiracion` de Task 1.
- Produces: `AuthenticatedSession { usuario: AuthenticatedUser; token: string; expiresAt: Date }`, `getAuthenticatedSession(): Promise<AuthenticatedSession | null>`. `getAuthenticatedUser()` mantiene su firma actual y sus 6 call sites siguen compilando sin tocarlos.

- [ ] **Step 1: Reemplazar la constante y el cálculo de expiración en `lib/session.ts`**

En `lib/session.ts`, borrar la línea `const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;` y agregar el import junto a los demás:

```ts
import {
  SESSION_DURATION_MS,
  necesitaRenovacion,
  nuevaExpiracion,
} from '@/lib/session-duracion';
```

En `createSession`, reemplazar:

```ts
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
```

por:

```ts
  const expiresAt = nuevaExpiracion(new Date());
```

- [ ] **Step 2: Reescribir `getAuthenticatedUser` como `getAuthenticatedSession` + envoltorio**

En `lib/session.ts`, reemplazar la función `getAuthenticatedUser` completa por este bloque:

```ts
export interface AuthenticatedSession {
  usuario: AuthenticatedUser;
  token: string;
  expiresAt: Date;
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.sesionUsuario.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      usuario: {
        select: { id: true, nombre: true, rol: true, activo: true },
      },
    },
  });

  const ahora = new Date();
  if (!session || session.expiresAt <= ahora || !session.usuario.activo) {
    if (session) {
      await prisma.sesionUsuario.delete({ where: { id: session.id } });
    }
    return null;
  }

  // Renovacion deslizante: pasada la mitad del plazo se corre la expiracion.
  // Un aparato en uso diario nunca vuelve a pedir login; uno abandonado caduca.
  let expiresAt = session.expiresAt;
  if (necesitaRenovacion(expiresAt, ahora)) {
    expiresAt = nuevaExpiracion(ahora);
    await prisma.sesionUsuario.update({
      where: { id: session.id },
      data: { expiresAt, lastUsedAt: ahora },
    });
  } else {
    // Es solo telemetria de uso; no bloquea la respuesta.
    void prisma.sesionUsuario
      .update({ where: { id: session.id }, data: { lastUsedAt: ahora } })
      .catch(() => undefined);
  }

  return {
    usuario: {
      id: session.usuario.id,
      nombre: session.usuario.nombre,
      rol: session.usuario.rol,
    },
    token,
    expiresAt,
  };
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await getAuthenticatedSession();
  return session?.usuario ?? null;
}
```

- [ ] **Step 3: Reemitir la cookie desde `/api/auth/session`**

Replace the whole content of `app/api/auth/session/route.ts`:

```ts
import { NextResponse } from 'next/server';

import { attachSessionCookie, getAuthenticatedSession } from '@/lib/session';

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: 'Sesion no valida' }, { status: 401 });
  }

  const response = NextResponse.json({ usuario: session.usuario });
  // El navegador borra la cookie en su fecha `expires` aunque la fila en base
  // siga viva. Este es el unico Route Handler que el cliente toca de forma
  // periodica, asi que es el punto natural para refrescar esa fecha.
  attachSessionCookie(response, {
    token: session.token,
    expiresAt: session.expiresAt,
  });
  return response;
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida. Si aparece un error en `app/ordenes/cobrar/[token]/page.tsx` o en `app/api/cobros/[token]/route.ts`, es que se rompió la firma de `getAuthenticatedUser`: debe seguir devolviendo `AuthenticatedUser | null`.

- [ ] **Step 5: Verificar a mano contra el entorno local**

Run: `npm run dev` y en el navegador:

1. Entrar a `http://localhost:3000/login` e iniciar sesión.
2. En la consola del navegador: `await (await fetch('/api/auth/session')).json()`
   Expected: `{usuario: {...}}` con status 200.
3. En DevTools → Application → Cookies, revisar `restaurant_pos_session`.
   Expected: la columna `Expires` muestra una fecha a ~30 días, no a 12 h.

- [ ] **Step 6: Commit**

```bash
git add lib/session.ts app/api/auth/session/route.ts
git commit -m "feat(session): renovacion deslizante y reemision de cookie en /api/auth/session"
```

---

### Task 3: Reglas puras de revalidación del cliente

**Files:**
- Create: `lib/auth-revalidacion.ts`
- Create: `lib/auth-revalidacion.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada.
- Produces: `INTERVALO_REVALIDACION_MS: number`, `MINIMO_ENTRE_REVALIDACIONES_MS: number`, `debeRevalidar(ultimaMs: number, ahoraMs: number, minimoMs?: number): boolean`.

- [ ] **Step 1: Escribir el test que falla**

Create `lib/auth-revalidacion.test.ts`:

```ts
import assert from "node:assert/strict";

import {
  INTERVALO_REVALIDACION_MS,
  MINIMO_ENTRE_REVALIDACIONES_MS,
  debeRevalidar,
} from "./auth-revalidacion";

// Cada 5 minutos alcanza para detectar una sesion caida antes de que el mesero
// llegue a la pantalla de cobro, sin castigar la red del local.
assert.equal(INTERVALO_REVALIDACION_MS, 5 * 60 * 1000);

// Volver a la pestana no debe disparar un request si recien se valido.
assert.equal(MINIMO_ENTRE_REVALIDACIONES_MS, 60 * 1000);

const t0 = 1_000_000;

// Recien validada: no se repite.
assert.equal(debeRevalidar(t0, t0 + 1_000), false);
assert.equal(debeRevalidar(t0, t0 + 59_999), false);

// Al minuto exacto ya corresponde revalidar.
assert.equal(debeRevalidar(t0, t0 + 60_000), true);
assert.equal(debeRevalidar(t0, t0 + 600_000), true);

// Nunca validada (0) siempre revalida.
assert.equal(debeRevalidar(0, t0), true);

// Un reloj que retrocede no debe disparar revalidaciones en bucle.
assert.equal(debeRevalidar(t0, t0 - 5_000), false);

// El minimo es parametrizable para los tests del hook.
assert.equal(debeRevalidar(t0, t0 + 10, 5), true);

console.log("auth-revalidacion: OK");
```

- [ ] **Step 2: Registrar el script y correr el test para verlo fallar**

Modify `package.json`, agregando dentro de `"scripts"` después de `"test:session-duracion"`:

```json
    "test:auth-revalidacion": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/auth-revalidacion.test.ts",
```

Run: `npm run test:auth-revalidacion`
Expected: FAIL con `Cannot find module './auth-revalidacion'`

- [ ] **Step 3: Implementar el módulo**

Create `lib/auth-revalidacion.ts`:

```ts
/**
 * Cadencia con la que el cliente vuelve a preguntarle al servidor si la sesion
 * sigue viva. Modulo puro, sin React, para poder probarlo con `ts-node`.
 */

/** Chequeo de fondo mientras la pestana esta abierta. */
export const INTERVALO_REVALIDACION_MS = 5 * 60 * 1000;

/** Piso entre dos chequeos, para que volver a la pestana no genere ráfagas. */
export const MINIMO_ENTRE_REVALIDACIONES_MS = 60 * 1000;

export function debeRevalidar(
  ultimaMs: number,
  ahoraMs: number,
  minimoMs: number = MINIMO_ENTRE_REVALIDACIONES_MS,
): boolean {
  const transcurrido = ahoraMs - ultimaMs;
  // Un reloj que retrocede daria negativo; ahi no se revalida.
  if (transcurrido < 0) return false;
  return transcurrido >= minimoMs;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test:auth-revalidacion`
Expected: `auth-revalidacion: OK`

- [ ] **Step 5: Commit**

```bash
git add lib/auth-revalidacion.ts lib/auth-revalidacion.test.ts package.json
git commit -m "feat(auth): reglas de cadencia para revalidar la sesion en el cliente"
```

---

### Task 4: `useAuth` revalida y deja de confiar en `localStorage`

**Files:**
- Modify: `lib/auth.ts` (archivo completo)

**Interfaces:**
- Consumes: `debeRevalidar`, `INTERVALO_REVALIDACION_MS` de Task 3.
- Produces: `useAuth(requiredRole?: string)` devuelve `{ usuario, loading, logout }` — **misma forma que hoy**, para no tocar los 8 consumidores (`app/cocina/page.tsx:65`, `app/admin/reportes/page.tsx:50`, `app/admin/page.tsx:77`, `app/mesero/page.tsx:56`, `app/admin/usuarios/page.tsx:23`, `app/admin/productos/page.tsx:11`, `app/digital/page.tsx:55`, `components/mesero/CrearOrden.tsx:37`).

- [ ] **Step 1: Reescribir `lib/auth.ts`**

Replace the whole content of `lib/auth.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  INTERVALO_REVALIDACION_MS,
  debeRevalidar,
} from "@/lib/auth-revalidacion";

export interface Usuario {
  id: string;
  nombre: string;
  rol: string;
}

const CLAVE_CACHE = "usuario";

const rolRedirects: Record<string, string> = {
  admin: "/admin",
  mesero: "/mesero",
  cocina: "/cocina",
  digital: "/digital",
};

/**
 * `localStorage` es solo cache de pintado para evitar el parpadeo del primer
 * render. Nunca es prueba de sesion: la unica autoridad es la cookie HttpOnly
 * validada contra `/api/auth/session`.
 */
function leerCache(): Usuario | null {
  if (typeof window === "undefined") return null;
  try {
    const guardado = localStorage.getItem(CLAVE_CACHE);
    return guardado ? (JSON.parse(guardado) as Usuario) : null;
  } catch {
    // Un JSON corrupto no debe tumbar la pantalla.
    localStorage.removeItem(CLAVE_CACHE);
    return null;
  }
}

export function useAuth(requiredRole?: string) {
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(leerCache);
  const [loading, setLoading] = useState(true);
  const ultimaValidacion = useRef(0);
  const activo = useRef(true);

  const validar = useCallback(async () => {
    ultimaValidacion.current = Date.now();
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) throw new Error("Sesion no valida");
      const data = await response.json();
      if (!activo.current) return;
      setUsuario(data.usuario);
      localStorage.setItem(CLAVE_CACHE, JSON.stringify(data.usuario));
      if (requiredRole && data.usuario.rol !== requiredRole) {
        router.replace(rolRedirects[data.usuario.rol] ?? "/login");
      }
    } catch {
      if (!activo.current) return;
      localStorage.removeItem(CLAVE_CACHE);
      setUsuario(null);
      router.replace("/login");
    } finally {
      if (activo.current) setLoading(false);
    }
  }, [router, requiredRole]);

  useEffect(() => {
    activo.current = true;
    void validar();

    // El POS es una SPA con SSE: la pestana queda abierta el turno entero sin
    // recargarse. Sin estos dos disparadores, una sesion caida recien se
    // detectaba al abrir el cobro, ya frente al cliente.
    const intervalo = setInterval(() => {
      void validar();
    }, INTERVALO_REVALIDACION_MS);

    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      if (!debeRevalidar(ultimaValidacion.current, Date.now())) return;
      void validar();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      activo.current = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [validar]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    localStorage.removeItem(CLAVE_CACHE);
    setUsuario(null);
    router.push("/login");
  };

  return { usuario, loading, logout };
}
```

- [ ] **Step 2: Limpiar el caché fantasma al llegar al login**

En `app/login/page.tsx`, dentro del `useEffect` existente que carga usuarios (empieza en `app/login/page.tsx:21`), agregar como **primera** línea del cuerpo del efecto, antes de `const cargarUsuarios = async () => {`:

```ts
    // Si se llego aca es porque no hay cookie valida. El usuario cacheado que
    // haya quedado en localStorage es una sesion fantasma: se descarta.
    localStorage.removeItem("usuario");
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 4: Verificar el comportamiento en el navegador**

Run: `npm run dev`

1. Iniciar sesión en `http://localhost:3000/mesero`.
2. En DevTools → Application → Cookies, borrar `restaurant_pos_session` a mano.
3. Cambiar a otra pestaña del navegador y volver.
   Expected: la pantalla redirige a `/login` en menos de un segundo, y `localStorage.getItem('usuario')` devuelve `null`.
4. Volver a iniciar sesión y dejar la pestaña en primer plano 5 minutos.
   Expected: en DevTools → Network aparece un `GET /api/auth/session` con status 200 cada 5 minutos.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts app/login/page.tsx
git commit -m "fix(auth): revalidar la sesion por intervalo y al volver a la pestana"
```

---

### Task 5: `cobroUrl` pasa a ser ruta relativa

**Files:**
- Modify: `lib/payment-link.ts`
- Create: `lib/payment-link.test.ts`
- Modify: `package.json`
- Modify: `app/api/ordenes/route.ts:308` y el `data:` del `orden.create`
- Modify: `lib/print-jobs.ts:189-192` (`PayloadOptions`), `lib/print-jobs.ts:327-341` (`buildOrderSnapshot`), `lib/print-jobs.ts:383-398` (`buildOrderPrintPayload`), y los otros dos builders
- Create: `prisma/migrations/<timestamp>_cobro_url_relativo/migration.sql`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: `createPaymentLink(): { token: string; tokenHash: string; path: string }` (ya **no** recibe `requestUrl`), `resolvePaymentUrl(path: string, origin: string): string`, `hashPaymentToken` y `shouldPrintPaymentQr` sin cambios. `PayloadOptions` gana `paymentOrigin?: string`.

- [ ] **Step 1: Escribir el test que falla**

Create `lib/payment-link.test.ts`:

```ts
import assert from "node:assert/strict";

import {
  createPaymentLink,
  hashPaymentToken,
  resolvePaymentUrl,
  shouldPrintPaymentQr,
} from "./payment-link";

// El enlace se guarda relativo: una orden creada en localhost no puede quedar
// con una URL que en produccion apunta a otro origen y pierde la cookie.
const enlace = createPaymentLink();
assert.match(enlace.path, /^\/ordenes\/cobrar\/[A-Za-z0-9_-]{43}$/);
assert.equal(enlace.tokenHash, hashPaymentToken(enlace.token));
assert.equal(enlace.path, `/ordenes/cobrar/${enlace.token}`);

// Dos enlaces nunca coinciden.
assert.notEqual(createPaymentLink().token, createPaymentLink().token);

// El absoluto se arma recien al imprimir, contra el origen real de ese momento.
assert.equal(
  resolvePaymentUrl("/ordenes/cobrar/abc", "https://pos.example.com"),
  "https://pos.example.com/ordenes/cobrar/abc",
);

// Una barra final de mas en el origen no debe duplicarse.
assert.equal(
  resolvePaymentUrl("/ordenes/cobrar/abc", "https://pos.example.com/"),
  "https://pos.example.com/ordenes/cobrar/abc",
);

// Compatibilidad hacia atras: una orden vieja ya guardada absoluta se respeta.
assert.equal(
  resolvePaymentUrl("https://viejo.example.com/ordenes/cobrar/abc", "https://pos.example.com"),
  "https://viejo.example.com/ordenes/cobrar/abc",
);

// shouldPrintPaymentQr conserva su comportamiento.
assert.equal(shouldPrintPaymentQr({ cobroUrl: null }), false);
assert.equal(shouldPrintPaymentQr({ cobroUrl: "/ordenes/cobrar/a", cobrada: true }), false);
assert.equal(shouldPrintPaymentQr({ cobroUrl: "/ordenes/cobrar/a" }), true);
assert.equal(
  shouldPrintPaymentQr({
    cobroUrl: "/ordenes/cobrar/a",
    tipoOrden: "domicilio",
    metodoPagoPrevisto: "transferencia",
  }),
  false,
);
assert.equal(
  shouldPrintPaymentQr({
    cobroUrl: "/ordenes/cobrar/a",
    tipoOrden: "domicilio",
    metodoPagoPrevisto: "efectivo",
  }),
  true,
);

console.log("payment-link: OK");
```

- [ ] **Step 2: Registrar el script y correr el test para verlo fallar**

Modify `package.json`, agregando dentro de `"scripts"` después de `"test:auth-revalidacion"`:

```json
    "test:payment-link": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/payment-link.test.ts",
```

Run: `npm run test:payment-link`
Expected: FAIL con `Property 'path' does not exist` o `resolvePaymentUrl is not a function`

- [ ] **Step 3: Reescribir `lib/payment-link.ts`**

Replace the whole content of `lib/payment-link.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';

export function hashPaymentToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * El enlace se guarda relativo a proposito. Guardarlo absoluto congelaba el
 * origen del momento de creacion: una orden creada en localhost o bajo un
 * dominio viejo abria en otro origen, donde la cookie de sesion no existe.
 */
export function createPaymentLink(): {
  token: string;
  tokenHash: string;
  path: string;
} {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashPaymentToken(token),
    path: `/ordenes/cobrar/${token}`,
  };
}

/** Arma el absoluto para el QR. Respeta las URLs absolutas ya guardadas. */
export function resolvePaymentUrl(path: string, origin: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin.replace(/\/$/, '')}${path}`;
}

export function shouldPrintPaymentQr(order: {
  tipoOrden?: string | null;
  metodoPagoPrevisto?: string | null;
  cobrada?: boolean;
  cobroUrl?: string | null;
}): boolean {
  if (!order.cobroUrl || order.cobrada) return false;
  if (order.tipoOrden === 'domicilio') {
    return order.metodoPagoPrevisto === 'efectivo';
  }
  return true;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test:payment-link`
Expected: `payment-link: OK`

- [ ] **Step 5: Adaptar la creación de la orden**

En `app/api/ordenes/route.ts:308`, reemplazar:

```ts
    const paymentLink = createPaymentLink(request.url);
```

por:

```ts
    const paymentLink = createPaymentLink();
```

Luego, en el `data:` del `tx.orden.create` de esa misma función, buscar la asignación de `cobroUrl` y dejarla así (el nombre del campo del enlace cambió de `url` a `path`):

```ts
          cobroUrl: paymentLink.path,
```

- [ ] **Step 6: Resolver el absoluto al construir el payload de impresión**

En `lib/print-jobs.ts`, agregar `resolvePaymentUrl` al import existente de `./payment-link`:

```ts
import { resolvePaymentUrl, shouldPrintPaymentQr } from './payment-link';
```

Reemplazar la interfaz `PayloadOptions` (`lib/print-jobs.ts:189-192`):

```ts
interface PayloadOptions {
  revision?: number;
  generatedAt?: Date;
  /** Origen publico con el que se arma la URL del QR. Sin el, no se imprime. */
  paymentOrigin?: string;
}
```

Cambiar la firma de `buildOrderSnapshot` y el cálculo de `paymentUrl`:

```ts
function buildOrderSnapshot(
  order: PrintOrderSource,
  paymentOrigin?: string,
): PrintOrderSnapshot {
```

y dentro de esa función, reemplazar:

```ts
  const paymentUrl = shouldPrintPaymentQr(order)
    ? normalizeOptionalText(order.cobroUrl)
    : null;
```

por:

```ts
  // `cobroUrl` se guarda relativo; el absoluto se arma con el origen de ahora.
  const paymentPath = shouldPrintPaymentQr(order)
    ? normalizeOptionalText(order.cobroUrl)
    : null;
  const paymentUrl =
    paymentPath && paymentOrigin
      ? resolvePaymentUrl(paymentPath, paymentOrigin)
      : null;
```

Finalmente, en los tres builders, pasar el origen. En `buildOrderPrintPayload`, `buildAmendmentPrintPayload` y `buildReprintPrintPayload`, cambiar cada llamada:

```ts
    order: buildOrderSnapshot(order),
```

por:

```ts
    order: buildOrderSnapshot(order, options.paymentOrigin),
```

- [ ] **Step 7: Pasar el origen desde los tres call sites**

En `app/api/ordenes/route.ts`, `app/api/ordenes/[id]/items/route.ts` y `app/api/ordenes/aprobacion/aprobar/route.ts`, calcular el origen una vez dentro del handler, antes de construir el payload:

```ts
    // El origen publico configurado gana; si falta, el de la peticion actual.
    const paymentOrigin =
      process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ||
      new URL(request.url).origin;
```

y agregar `paymentOrigin` al objeto de opciones de cada `buildOrderPrintPayload` / `buildAmendmentPrintPayload` / `buildReprintPrintPayload` de esos archivos. Ejemplo:

```ts
    const payload = buildOrderPrintPayload(orden, { revision, paymentOrigin });
```

- [ ] **Step 8: Correr los tests de impresión y verificar tipos**

Run: `npm run test:print-jobs`
Expected: PASS. Si un caso falla porque esperaba `paymentUrl` con `cobroUrl` absoluto y sin `paymentOrigin`, actualizar ese caso de `lib/print-jobs.test.ts:39` y `:74` para pasar `{ paymentOrigin: 'https://pos.example.com' }` y `cobroUrl: '/ordenes/cobrar/token-seguro'`.

Run: `npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 9: Migrar los `cobroUrl` absolutos ya guardados**

Run: `npx prisma migrate dev --name cobro_url_relativo --create-only`

Editar el `migration.sql` recién creado y dejarlo con este contenido:

```sql
-- El enlace de cobro deja de guardarse absoluto. Las filas creadas antes tienen
-- el origen congelado (hay ordenes con http://localhost:3000) y al abrirse
-- caian en otro origen, donde la cookie de sesion no existe.
UPDATE "Orden"
SET "cobroUrl" = '/ordenes/cobrar/' || split_part("cobroUrl", '/ordenes/cobrar/', 2)
WHERE "cobroUrl" LIKE 'http%'
  AND "cobroUrl" LIKE '%/ordenes/cobrar/%';
```

Run: `npx prisma migrate dev`
Expected: `Your database is now in sync with your schema.`

Verificar el resultado:

Run: `npx prisma studio` y en la tabla `Orden` revisar la columna `cobroUrl`.
Expected: todos los valores empiezan por `/ordenes/cobrar/`, ninguno por `http`.

- [ ] **Step 10: Commit**

```bash
git add lib/payment-link.ts lib/payment-link.test.ts lib/print-jobs.ts lib/print-jobs.test.ts app/api/ordenes prisma/migrations package.json
git commit -m "fix(cobros): guardar cobroUrl relativo y resolver el origen al imprimir"
```

---

### Task 6: Módulo de contraseñas con bcrypt

**Files:**
- Modify: `package.json` (dependencia `bcryptjs` + script de test)
- Create: `lib/password.ts`
- Create: `lib/password.test.ts`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: `PASSWORD_MIN_LENGTH: number`, `esHashBcrypt(valor: string): boolean`, `validarPassword(valor: unknown): { ok: true; value: string } | { ok: false; error: string }`, `hashPassword(valor: string): Promise<string>`, `verifyPassword(valor: string, hash: string): Promise<boolean>`.

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install bcryptjs@^3.0.2`
Expected: `added 1 package`

Verificar que trae sus propios tipos:

Run: `node -e "console.log(require('fs').existsSync('node_modules/bcryptjs/types/index.d.ts') || require('fs').existsSync('node_modules/bcryptjs/index.d.ts'))"`
Expected: `true`. Si imprime `false`, correr además `npm install -D @types/bcryptjs`.

- [ ] **Step 2: Escribir el test que falla**

Create `lib/password.test.ts`:

```ts
import assert from "node:assert/strict";

import {
  PASSWORD_MIN_LENGTH,
  esHashBcrypt,
  hashPassword,
  validarPassword,
  verifyPassword,
} from "./password";

async function main() {
  assert.equal(PASSWORD_MIN_LENGTH, 6);

  // Validacion de entrada.
  assert.deepEqual(validarPassword(undefined), {
    ok: false,
    error: "La contraseña es requerida",
  });
  assert.deepEqual(validarPassword(""), {
    ok: false,
    error: "La contraseña debe tener al menos 6 caracteres",
  });
  assert.deepEqual(validarPassword("12345"), {
    ok: false,
    error: "La contraseña debe tener al menos 6 caracteres",
  });
  // Los espacios de los bordes no cuentan como longitud.
  assert.deepEqual(validarPassword("  12345  "), {
    ok: false,
    error: "La contraseña debe tener al menos 6 caracteres",
  });
  assert.deepEqual(validarPassword("secreta1"), { ok: true, value: "secreta1" });

  // Reconocimiento de hash.
  assert.equal(esHashBcrypt("$2b$10$abcdefghijklmnopqrstuv"), true);
  assert.equal(esHashBcrypt("$2a$10$abcdefghijklmnopqrstuv"), true);
  assert.equal(esHashBcrypt("clave123"), false);

  // Ida y vuelta.
  const hash = await hashPassword("secreta1");
  assert.equal(esHashBcrypt(hash), true);
  assert.notEqual(hash, "secreta1");
  assert.equal(await verifyPassword("secreta1", hash), true);
  assert.equal(await verifyPassword("secreta2", hash), false);

  // Dos hashes de la misma clave difieren: el salt es aleatorio.
  assert.notEqual(await hashPassword("secreta1"), hash);

  // Una clave en texto plano heredada NUNCA autentica, ni comparandola consigo
  // misma. Es lo que fuerza a correr la migracion antes de exigir el login.
  assert.equal(await verifyPassword("clave123", "clave123"), false);

  console.log("password: OK");
}

void main();
```

- [ ] **Step 3: Registrar el script y correr el test para verlo fallar**

Modify `package.json`, agregando dentro de `"scripts"` después de `"test:payment-link"`:

```json
    "test:password": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/password.test.ts",
```

Run: `npm run test:password`
Expected: FAIL con `Cannot find module './password'`

- [ ] **Step 4: Implementar el módulo**

Create `lib/password.ts`:

```ts
import bcrypt from 'bcryptjs';

/**
 * Modulo puro: no lleva `server-only` para poder ejecutarlo con `ts-node`.
 * `bcryptjs` es JS puro a proposito; el bundle de Amplify SSR no compila el
 * binario nativo de `bcrypt`.
 */

export const PASSWORD_MIN_LENGTH = 6;

const COSTO_BCRYPT = 10;
const PREFIJO_BCRYPT = /^\$2[aby]\$/;

export function esHashBcrypt(valor: string): boolean {
  return PREFIJO_BCRYPT.test(valor);
}

export type ResultadoPassword =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validarPassword(valor: unknown): ResultadoPassword {
  if (typeof valor !== 'string') {
    return { ok: false, error: 'La contraseña es requerida' };
  }
  const limpio = valor.trim();
  if (limpio.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    };
  }
  return { ok: true, value: limpio };
}

export async function hashPassword(valor: string): Promise<string> {
  return bcrypt.hash(valor, COSTO_BCRYPT);
}

export async function verifyPassword(
  valor: string,
  hash: string,
): Promise<boolean> {
  // Una clave heredada en texto plano no autentica jamas. Es deliberado: obliga
  // a correr la migracion antes de activar la exigencia en el login.
  if (!esHashBcrypt(hash)) return false;
  return bcrypt.compare(valor, hash);
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm run test:password`
Expected: `password: OK`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/password.ts lib/password.test.ts
git commit -m "feat(auth): modulo de contrasenas con bcrypt"
```

---

### Task 7: La administración de usuarios guarda hash y exige contraseña

**Files:**
- Modify: `lib/admin-validaciones.ts:19-23` (tipo `DatosUsuario`), `:161-172` (`validarUsuarioNuevo`), `:174-190` (`validarUsuarioParcial`)
- Modify: `lib/admin-validaciones.test.ts`
- Modify: `app/api/usuarios/route.ts` (POST)
- Modify: `app/api/usuarios/[id]/route.ts` (PATCH)
- Modify: `components/admin/FormularioUsuario.tsx`

**Interfaces:**
- Consumes: `validarPassword`, `hashPassword`, `PASSWORD_MIN_LENGTH` de Task 6.
- Produces: `POST /api/usuarios` exige `password` y guarda su hash; `PATCH /api/usuarios/[id]` acepta `password` opcional y lo hashea, y **rechaza** `password: null`. `DatosUsuario.password` pasa de `string | null` a `string`.

- [ ] **Step 1: Actualizar el test de validaciones**

En `lib/admin-validaciones.test.ts`, agregar este bloque **dentro** de la función `run()`, justo antes del `console.log('admin-validaciones tests: ok');` de cierre. Reutiliza el helper `errorDe` que ya existe en el archivo (`lib/admin-validaciones.test.ts:17`) y respeta sus comillas simples:

```ts
  // Un usuario nuevo sin contrasena ya no se acepta: antes quedaba con password
  // NULL y el login se saltaba la validacion entera para el.
  assert.equal(
    errorDe(validarUsuarioNuevo({ nombre: 'Ana', rol: 'mesero' })),
    'La contraseña es requerida',
  );

  assert.equal(
    errorDe(validarUsuarioNuevo({ nombre: 'Ana', rol: 'mesero', password: '123' })),
    'La contraseña debe tener al menos 6 caracteres',
  );

  const conClave = validarUsuarioNuevo({
    nombre: 'Ana',
    rol: 'mesero',
    password: 'secreta1',
  });
  assert.equal(conClave.ok, true);
  assert.equal(conClave.ok === true ? conClave.data.password : '', 'secreta1');

  // Editar sin tocar la clave sigue permitido.
  const soloNombre = validarUsuarioParcial({ nombre: 'Ana Maria' });
  assert.equal(soloNombre.ok, true);
  assert.equal(soloNombre.ok === true ? 'password' in soloNombre.data : true, false);

  // Pero borrar la clave ya no: dejaria al usuario entrando sin credencial.
  assert.equal(
    errorDe(validarUsuarioParcial({ password: null })),
    'La contraseña es requerida',
  );
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npm run test:admin-validaciones`
Expected: FAIL en el primer `errorDe(validarUsuarioNuevo({ nombre: 'Ana', rol: 'mesero' }))` con `esperaba que la validacion fallara` — hoy esa validación devuelve `ok: true`.

- [ ] **Step 3: Endurecer las validaciones**

En `lib/admin-validaciones.ts`, agregar el import. **Tiene que ser relativo**, como el `'../types/usuario'` que ya está ahí: `ts-node` corre los tests sin resolver el alias `@/` del `tsconfig.json`.

```ts
import { validarPassword } from './password';
```

En la interfaz `DatosUsuario`, cambiar:

```ts
  password: string | null;
```

por:

```ts
  password: string;
```

En `validarUsuarioNuevo`, reemplazar:

```ts
      password: textoOpcional(datos.password, 'La contrasena'),
```

por:

```ts
      password: passwordObligatoria(datos.password),
```

En `validarUsuarioParcial`, reemplazar:

```ts
    // password ausente no se toca; null o cadena vacia borran la clave.
    if ('password' in datos) parcial.password = textoOpcional(datos.password, 'La contrasena');
```

por:

```ts
    // password ausente no se toca. Presente, debe ser una clave valida: ya no
    // existe la opcion de dejar al usuario sin credencial.
    if ('password' in datos) parcial.password = passwordObligatoria(datos.password);
```

Y agregar esta función auxiliar junto a las demás privadas del archivo (antes de `validarUsuarioNuevo`):

```ts
function passwordObligatoria(valor: unknown): string {
  const resultado = validarPassword(valor);
  if (!resultado.ok) throw new Error(resultado.error);
  return resultado.value;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test:admin-validaciones`
Expected: PASS

- [ ] **Step 5: Hashear al escribir en la API**

En `app/api/usuarios/route.ts`, agregar el import:

```ts
import { hashPassword } from '@/lib/password';
```

En el `POST`, reemplazar la línea del `create`:

```ts
    const usuario = await prisma.usuario.create({ data: datos });
```

por:

```ts
    // La clave llega en claro desde el formulario; nunca se guarda asi.
    const usuario = await prisma.usuario.create({
      data: { ...datos, password: await hashPassword(datos.password) },
    });
```

En `app/api/usuarios/[id]/route.ts`, agregar el mismo import y, en el `PATCH`, reemplazar la línea del `update`:

```ts
    const actualizado = await prisma.usuario.update({ where: { id }, data: datos });
```

por:

```ts
    // `datos` es parcial: si no vino `password`, la clave guardada no se toca.
    const actualizado = await prisma.usuario.update({
      where: { id },
      data:
        datos.password === undefined
          ? datos
          : { ...datos, password: await hashPassword(datos.password) },
    });
```

- [ ] **Step 6: Quitar del formulario la opción de dejar sin clave**

En `components/admin/FormularioUsuario.tsx`:

1. Borrar el estado `quitarPassword`: la línea `const [quitarPassword, setQuitarPassword] = useState(false);` (`components/admin/FormularioUsuario.tsx:27`).
2. Reemplazar el bloque `tendraPassword` (`:32-34`) por nada — la variable deja de usarse. Borrar también el checkbox y el texto que la consumen en el JSX.
3. Reemplazar el armado del cuerpo (`:43-44`):

```ts
    if (quitarPassword) cuerpo.password = null;
    else if (!usuario || password.trim() !== "") cuerpo.password = password;
```

por:

```ts
    // Al editar, un campo vacio deja la clave como esta. Al crear, es obligatoria.
    if (!usuario || password.trim() !== "") cuerpo.password = password;
```

4. En el `<input id="usuario-password">`, agregar `required={!usuario}` y `minLength={6}`, y cambiar su `placeholder` a `"Mínimo 6 caracteres"`.

- [ ] **Step 7: Verificar tipos y probar en el navegador**

Run: `npx tsc --noEmit`
Expected: sin salida

Run: `npm run dev`, entrar como admin a `http://localhost:3000/admin/usuarios`:

1. Crear un usuario sin contraseña.
   Expected: el formulario no deja enviar (`required`).
2. Crear un usuario con contraseña `12345`.
   Expected: error `La contraseña debe tener al menos 6 caracteres`.
3. Crear un usuario con contraseña `secreta1`.
   Expected: se crea. Verificar en `npx prisma studio` que la columna `password` de esa fila empieza por `$2b$10$`, no por `secreta1`.

- [ ] **Step 8: Commit**

```bash
git add lib/admin-validaciones.ts lib/admin-validaciones.test.ts app/api/usuarios components/admin/FormularioUsuario.tsx
git commit -m "feat(usuarios): contrasena obligatoria y guardada con hash bcrypt"
```

---

### Task 8: Migración de las contraseñas existentes

**Files:**
- Create: `scripts/migrar-passwords.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada en tiempo de compilación (script suelto, igual que `scripts/reset-preproduction.mjs`).
- Produces: script `npm run auth:migrar-passwords`. Deja a **todos** los usuarios con `password` en formato bcrypt.

- [ ] **Step 1: Escribir el script**

Create `scripts/migrar-passwords.mjs`:

```js
/**
 * Deja a todos los usuarios con contrasena en formato bcrypt.
 *
 * - Quien ya tiene clave en texto plano: se hashea la misma, sigue entrando
 *   con lo que ya conoce.
 * - Quien no tiene ninguna: se le genera una y se imprime aca. Es el unico
 *   momento en que esa clave es legible; despues solo queda el hash.
 *
 * Correr ANTES de desplegar Task 9, que es la que empieza a exigirla.
 *
 * Uso: npm run auth:migrar-passwords
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// El script corre fuera de Next, que es quien normalmente carga el .env.
for (const linea of readFileSync('.env', 'utf8').split('\n')) {
  const par = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (par && !process.env[par[1]]) process.env[par[1]] = par[2].trim();
}

const COSTO_BCRYPT = 10;
const ES_HASH = /^\$2[aby]\$/;

function claveLegible() {
  // 6 bytes en base64url dan 8 caracteres: cumple el minimo y se dicta facil.
  return randomBytes(6).toString('base64url');
}

const prisma = new PrismaClient();

async function main() {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, rol: true, password: true },
    orderBy: { nombre: 'asc' },
  });

  const generadas = [];
  let hasheadas = 0;
  let intactas = 0;

  for (const usuario of usuarios) {
    if (usuario.password && ES_HASH.test(usuario.password)) {
      intactas += 1;
      continue;
    }

    const enClaro = usuario.password?.trim() || claveLegible();
    if (!usuario.password?.trim()) {
      generadas.push({ nombre: usuario.nombre, rol: usuario.rol, clave: enClaro });
    } else {
      hasheadas += 1;
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { password: await bcrypt.hash(enClaro, COSTO_BCRYPT) },
    });
  }

  console.log(`Ya estaban hasheadas: ${intactas}`);
  console.log(`Migradas de texto plano (misma clave): ${hasheadas}`);
  console.log(`Claves nuevas generadas: ${generadas.length}`);

  if (generadas.length > 0) {
    console.log('\nEntregar en persona y cambiar desde /admin/usuarios:\n');
    for (const fila of generadas) {
      console.log(`  ${fila.nombre.padEnd(20)} ${fila.rol.padEnd(10)} ${fila.clave}`);
    }
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error('Fallo la migracion:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Registrar el script**

Modify `package.json`, agregando dentro de `"scripts"` después de `"db:reset:preprod"`:

```json
    "auth:migrar-passwords": "node scripts/migrar-passwords.mjs"
```

- [ ] **Step 3: Correr la migración en local**

Run: `npm run auth:migrar-passwords`
Expected: una salida como

```
Ya estaban hasheadas: 0
Migradas de texto plano (misma clave): 1
Claves nuevas generadas: 3

Entregar en persona y cambiar desde /admin/usuarios:

  Admin                admin      ...
  Carlos López         cocina     xxxxxxxx
  Juan Pérez           mesero     xxxxxxxx
  María digital        digital    xxxxxxxx
```

**Anotar las claves generadas antes de cerrar la terminal.** No hay forma de recuperarlas después.

- [ ] **Step 4: Verificar que no quedó texto plano**

Run: `npx prisma studio` y revisar la columna `password` de la tabla `Usuario`.
Expected: las cuatro filas empiezan por `$2b$10$`. Ninguna vacía, ninguna legible.

- [ ] **Step 5: Verificar que es idempotente**

Run: `npm run auth:migrar-passwords`
Expected: `Ya estaban hasheadas: 4`, `Claves nuevas generadas: 0`

- [ ] **Step 6: Commit**

```bash
git add scripts/migrar-passwords.mjs package.json
git commit -m "chore(auth): script de migracion de contrasenas a bcrypt"
```

---

### Task 9: El login exige contraseña, verifica hash y limita intentos

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `lib/rate-limit.test.ts`
- Modify: `package.json`
- Modify: `app/api/auth/login/route.ts` (archivo completo)
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `verifyPassword` de Task 6.
- Produces: `MAX_INTENTOS: number`, `BLOQUEO_MS: number`, `EstadoIntentos { fallos: number; bloqueadoHasta: number }`, `estadoInicial(): EstadoIntentos`, `registrarFallo(estado: EstadoIntentos, ahoraMs: number): EstadoIntentos`, `estaBloqueado(estado: EstadoIntentos, ahoraMs: number): boolean`.

> **Precondición:** Task 8 ya corrió contra la base de este entorno. Sin eso, esta tarea deja a todos los usuarios fuera del sistema.

- [ ] **Step 1: Escribir el test que falla**

Create `lib/rate-limit.test.ts`:

```ts
import assert from "node:assert/strict";

import {
  BLOQUEO_MS,
  MAX_INTENTOS,
  estadoInicial,
  estaBloqueado,
  registrarFallo,
} from "./rate-limit";

assert.equal(MAX_INTENTOS, 5);
assert.equal(BLOQUEO_MS, 5 * 60 * 1000);

const t0 = 1_000_000;

// Sin fallos previos no hay bloqueo.
let estado = estadoInicial();
assert.equal(estaBloqueado(estado, t0), false);

// Los primeros cuatro fallos no bloquean.
for (let i = 0; i < MAX_INTENTOS - 1; i += 1) {
  estado = registrarFallo(estado, t0);
  assert.equal(estaBloqueado(estado, t0), false);
}

// El quinto si.
estado = registrarFallo(estado, t0);
assert.equal(estado.fallos, MAX_INTENTOS);
assert.equal(estaBloqueado(estado, t0), true);
assert.equal(estado.bloqueadoHasta, t0 + BLOQUEO_MS);

// Sigue bloqueado dentro de la ventana.
assert.equal(estaBloqueado(estado, t0 + BLOQUEO_MS - 1), true);

// Y se libera al vencerla.
assert.equal(estaBloqueado(estado, t0 + BLOQUEO_MS), false);

// Un fallo despues del vencimiento reinicia la cuenta, no arrastra la anterior.
const despues = registrarFallo(estado, t0 + BLOQUEO_MS + 1);
assert.equal(despues.fallos, 1);
assert.equal(estaBloqueado(despues, t0 + BLOQUEO_MS + 1), false);

console.log("rate-limit: OK");
```

- [ ] **Step 2: Registrar el script y correr el test para verlo fallar**

Modify `package.json`, agregando dentro de `"scripts"` después de `"test:password"`:

```json
    "test:rate-limit": "ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' lib/rate-limit.test.ts",
```

Run: `npm run test:rate-limit`
Expected: FAIL con `Cannot find module './rate-limit'`

- [ ] **Step 3: Implementar el módulo**

Create `lib/rate-limit.ts`:

```ts
/**
 * Conteo de intentos fallidos de login. Estado inmutable y puro para poder
 * probarlo; quien lo use decide donde guardarlo.
 */

export const MAX_INTENTOS = 5;
export const BLOQUEO_MS = 5 * 60 * 1000;

export interface EstadoIntentos {
  fallos: number;
  bloqueadoHasta: number;
}

export function estadoInicial(): EstadoIntentos {
  return { fallos: 0, bloqueadoHasta: 0 };
}

export function estaBloqueado(estado: EstadoIntentos, ahoraMs: number): boolean {
  return ahoraMs < estado.bloqueadoHasta;
}

export function registrarFallo(
  estado: EstadoIntentos,
  ahoraMs: number,
): EstadoIntentos {
  // Vencido el bloqueo se empieza de cero: no se acumulan rachas viejas.
  const base = ahoraMs >= estado.bloqueadoHasta && estado.bloqueadoHasta > 0
    ? estadoInicial()
    : estado;
  const fallos = base.fallos + 1;
  return {
    fallos,
    bloqueadoHasta: fallos >= MAX_INTENTOS ? ahoraMs + BLOQUEO_MS : base.bloqueadoHasta,
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test:rate-limit`
Expected: `rate-limit: OK`

- [ ] **Step 5: Reescribir el handler de login**

Replace the whole content of `app/api/auth/login/route.ts`:

```ts
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import {
  estadoInicial,
  estaBloqueado,
  registrarFallo,
  type EstadoIntentos,
} from '@/lib/rate-limit';
import { attachSessionCookie, createSession } from '@/lib/session';

/**
 * Conteo en memoria del proceso. En Amplify hay varias instancias, asi que es
 * best-effort: frena el tanteo desde un navegador, no un ataque distribuido.
 * Si eso llega a hacer falta, mover el conteo a una tabla.
 */
const intentos = new Map<string, EstadoIntentos>();

// Respuesta unica para usuario inexistente, inactivo, sin clave o con clave
// equivocada: quien tantea no aprende cual de los cuatro casos toco.
const CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { usuarioId, password } = body;

    if (typeof usuarioId !== 'string' || !usuarioId) {
      return NextResponse.json(
        { success: false, error: CREDENCIALES_INVALIDAS },
        { status: 401 },
      );
    }

    const ahora = Date.now();
    const estado = intentos.get(usuarioId) ?? estadoInicial();
    if (estaBloqueado(estado, ahora)) {
      const faltan = Math.ceil((estado.bloqueadoHasta - ahora) / 1000 / 60);
      return NextResponse.json(
        {
          success: false,
          error: `Demasiados intentos. Reintenta en ${faltan} minuto(s)`,
        },
        { status: 429 },
      );
    }

    const fallar = () => {
      intentos.set(usuarioId, registrarFallo(estado, ahora));
      return NextResponse.json(
        { success: false, error: CREDENCIALES_INVALIDAS },
        { status: 401 },
      );
    };

    const usuario = await prisma.usuario.findFirst({
      where: { id: usuarioId, activo: true },
    });
    if (!usuario) return fallar();

    // Un usuario sin clave ya no entra. Antes esta rama se saltaba entera y
    // bastaba con elegir el nombre en el desplegable para iniciar sesion.
    if (!usuario.password) return fallar();
    if (typeof password !== 'string') return fallar();
    if (!(await verifyPassword(password, usuario.password))) return fallar();

    intentos.delete(usuarioId);

    const session = await createSession(usuario.id);
    const response = NextResponse.json({
      success: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        activo: usuario.activo,
      },
    });
    attachSessionCookie(response, session);
    return response;
  } catch (error) {
    console.error('Error al autenticar:', error);
    return NextResponse.json(
      { success: false, error: 'Error al autenticar' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 6: El formulario de login pide contraseña siempre**

En `app/login/page.tsx`:

1. Borrar el estado `requiresPassword` y todas sus asignaciones (`app/login/page.tsx:17`, y los `setRequiresPassword(...)` de `handleUsuarioChange`).
2. Reemplazar `handleUsuarioChange` completo por:

```ts
  const handleUsuarioChange = (usuarioId: string) => {
    setUsuarioSeleccionado(usuarioId);
    setPassword("");
  };
```

   Con esto desaparece el `fetch(`/api/usuarios/${usuarioId}`)`, que existía solo para saber si el usuario tenía clave.
3. En `handleLogin`, reemplazar:

```ts
    if (requiresPassword && !password) {
      alert("Por favor ingresa tu contraseña");
      return;
    }
```

   por:

```ts
    if (!password) {
      alert("Por favor ingresa tu contraseña");
      return;
    }
```

4. En el JSX, quitar el `{requiresPassword && (` que envuelve el bloque de la contraseña y su `)}` de cierre, dejando el campo siempre visible.
5. En el `disabled` del botón, reemplazar `(requiresPassword && !password)` por `!password`, y quitar `loadingUsuario` del `disabled` y del texto del botón junto con su `useState` (ya no hay carga por usuario).

- [ ] **Step 7: Verificar tipos y probar el flujo completo**

Run: `npx tsc --noEmit`
Expected: sin salida

Run: `npm run dev` y en `http://localhost:3000/login`:

1. Elegir un usuario y dejar la contraseña vacía.
   Expected: el botón `Iniciar Sesión` queda deshabilitado.
2. Elegir un usuario y poner una contraseña incorrecta.
   Expected: `Usuario o contraseña incorrectos`.
3. Repetirlo cinco veces seguidas con el mismo usuario.
   Expected: al sexto intento, `Demasiados intentos. Reintenta en 5 minuto(s)`.
4. Con otro usuario, iniciar sesión con la clave correcta de Task 8.
   Expected: entra y redirige según su rol.
5. Cerrar sesión, y abrir directamente `http://localhost:3000/ordenes/cobrar/faketoken123`.
   Expected: redirige a `/login?next=%2Fordenes%2Fcobrar%2Ffaketoken123`; tras iniciar sesión vuelve al cobro y, por ser un token inexistente, termina en `/mesero?vista=ordenes&cobro=enlace_invalido`.

- [ ] **Step 8: Commit**

```bash
git add lib/rate-limit.ts lib/rate-limit.test.ts app/api/auth/login/route.ts app/login/page.tsx package.json
git commit -m "feat(auth): exigir contrasena verificada por hash y limitar intentos"
```

---

### Task 10: Cerrar la exposición del listado de usuarios y limpiar el `.env`

**Files:**
- Modify: `app/api/usuarios/route.ts` (rama `GET` sin `?vista=admin`)
- Modify: `app/api/usuarios/[id]/route.ts` (`GET`)
- Modify: `.env`
- Modify: `docs/COBROS_QR.md`

**Interfaces:**
- Consumes: `getAuthenticatedUser` de Task 2.
- Produces: `GET /api/usuarios` devuelve solo `{ id, nombre }`. `GET /api/usuarios/[id]` exige sesión.

- [ ] **Step 1: Reducir lo que expone el listado público**

En `app/api/usuarios/route.ts`, dentro del `GET`, reemplazar la rama sin `?vista=admin`:

```ts
    if (!vistaAdmin) {
      const usuarios = await prisma.usuario.findMany({
        where: { activo: true },
        select: {
          id: true,
          nombre: true,
          rol: true,
          activo: true,
        },
        orderBy: { nombre: 'asc' },
      });
      return NextResponse.json(usuarios);
    }
```

por:

```ts
    if (!vistaAdmin) {
      // Este listado alimenta el desplegable del login y es publico por
      // necesidad. Va sin `rol`: quien no tiene sesion no necesita saber quien
      // puede cobrar. La forma se mantiene para no romper al cliente.
      const usuarios = await prisma.usuario.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      });
      return NextResponse.json(usuarios);
    }
```

- [ ] **Step 2: Adaptar el desplegable del login**

En `app/login/page.tsx`, la interfaz `Usuario` local (`app/login/page.tsx:5-10`) pasa a:

```ts
interface Usuario {
  id: string;
  nombre: string;
}
```

En el `<option>` del desplegable, reemplazar:

```tsx
                  {usuario.nombre} ({usuario.rol})
```

por:

```tsx
                  {usuario.nombre}
```

En `handleLogin`, borrar el bloque que redirige por rol leyendo `usuario.rol` del listado y usar el rol que devuelve el servidor tras autenticar:

```ts
    const rol = result.usuario?.rol;
    if (rol === "admin") router.push("/admin");
    else if (rol === "mesero") router.push("/mesero");
    else if (rol === "cocina") router.push("/cocina");
    else if (rol === "digital") router.push("/digital");
    else router.push("/mesero");
```

Borrar también la línea `const usuario = usuarios.find((u) => u.id === usuarioSeleccionado);` y su guarda `if (!usuario) return;`, junto con el `result.usuario ?? usuario` del `localStorage.setItem`, que pasa a ser `JSON.stringify(result.usuario)`.

- [ ] **Step 3: Exigir sesión en el detalle de usuario**

En `app/api/usuarios/[id]/route.ts`, agregar el import:

```ts
import { getAuthenticatedUser } from '@/lib/session';
```

y como primera instrucción del `try` del `GET`:

```ts
    // Este endpoint existia para que el login supiera si el usuario tenia clave.
    // Ya no hace falta: ahora siempre se pide. Queda solo para el panel admin.
    const solicitante = await getAuthenticatedUser();
    if (!solicitante || solicitante.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
```

- [ ] **Step 4: Limpiar `JWT_SECRET`**

En `.env`, borrar la línea `JWT_SECRET=...` y su comentario `# Secreto para firmar los JWT de sesión...`. No hay ninguna referencia a esa variable en el código.

Verificar:

Run: `grep -rn "JWT_SECRET" app lib components scripts prisma amplify.yml`
Expected: sin resultados

- [ ] **Step 5: Actualizar la documentación**

En `docs/COBROS_QR.md`, reemplazar el punto 5 de `## Flujo implementado`:

```markdown
5. La página exige una sesión de servidor en cookie `HttpOnly`, `SameSite=Lax`. Si falta, vuelve al login y después retorna al QR.
```

por:

```markdown
5. La página exige una sesión de servidor en cookie `HttpOnly`, `SameSite=Lax`, `Secure`. Si falta, vuelve al login y después retorna al QR.
6. La sesión dura 30 días y se renueva sola: pasada la mitad del plazo, el siguiente request corre la expiración en base, y `/api/auth/session` reemite la cookie. El cliente revalida cada 5 minutos y al volver a la pestaña, así una sesión caída se detecta antes de llegar a la pantalla de cobro y no en medio del cobro.
7. `cobroUrl` se guarda como ruta relativa. El absoluto del QR se arma al imprimir, contra el origen de esa petición: una orden creada en un entorno ya no abre en el origen de otro, donde la cookie no existe.
8. Todos los usuarios tienen contraseña, guardada con `bcrypt`. El login la exige siempre y bloquea 5 minutos tras 5 intentos fallidos.
```

y renumerar los puntos siguientes (el actual 6 pasa a 9 y el 7 a 10).

En `## Despliegue`, agregar como primer paso:

```markdown
1. Correr `npm run auth:migrar-passwords` contra la base del entorno **antes** de desplegar. Sin eso, nadie puede iniciar sesión: el login ya no acepta usuarios sin clave ni claves en texto plano.
```

y renumerar los pasos existentes.

- [ ] **Step 6: Verificar tipos y probar**

Run: `npx tsc --noEmit`
Expected: sin salida

Run: `npm run dev`, y sin iniciar sesión, en una ventana privada:

1. `curl -s http://localhost:3000/api/usuarios`
   Expected: un arreglo de `{"id":...,"nombre":...}` sin campo `rol`.
2. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/usuarios/<id-real>`
   Expected: `403`
3. Abrir `http://localhost:3000/login`.
   Expected: el desplegable muestra solo los nombres, el campo de contraseña está siempre visible, y el login funciona.

- [ ] **Step 7: Commit**

```bash
git add app/api/usuarios app/login/page.tsx .env docs/COBROS_QR.md
git commit -m "fix(seguridad): reducir el listado publico de usuarios y cerrar el detalle"
```

---

### Task 11: Verificación de extremo a extremo en `develop`

**Files:**
- Ninguno. Es la comprobación de que el problema original quedó resuelto.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Correr la batería completa de tests**

```bash
npm run test:session-duracion
npm run test:auth-revalidacion
npm run test:payment-link
npm run test:password
npm run test:rate-limit
npm run test:admin-validaciones
npm run test:print-jobs
npm run test:printer
npm run test:print-config
npm run test:print-agent
npm run test:cuadre
npm run test:retiros-validaciones
npm run test:navegacion
npm run test:fecha-ecuador
npm run test:daily-order-number
```

Expected: cada uno imprime su línea `: OK` y sale con código 0.

- [ ] **Step 2: Compilar**

Run: `npx tsc --noEmit && npm run build`
Expected: build exitoso, sin errores de tipo

- [ ] **Step 3: Migrar las contraseñas del entorno de destino**

Run: `npm run auth:migrar-passwords` apuntando al `DATABASE_URL` de `develop`.
Expected: la tabla de claves generadas. **Anotarlas.**

- [ ] **Step 4: Desplegar y verificar el escenario original**

Desplegar la rama a `develop`. Después, desde el celular de un mesero:

1. Iniciar sesión en `https://develop.d19qsoj0m02u1y.amplifyapp.com` con su usuario y su contraseña.
2. Crear una orden de mesa y llevarla a estado `lista`.
3. Escanear el QR del ticket impreso **con el mismo navegador** en el que inició sesión.
   Expected: abre `/ordenes/cobrar/<token>` con la pantalla de cobro, sin pedir login.
4. Cerrar la pestaña, esperar unas horas y repetir el escaneo.
   Expected: sigue sin pedir login. Antes fallaba pasadas las 12 h.
5. Escanear el QR con **otro** navegador del mismo teléfono (por ejemplo Safari si el POS está en Chrome).
   Expected: pide login y, al iniciar sesión, vuelve solo a la pantalla de cobro de esa orden. Este caso siempre va a pedir login la primera vez en cada navegador: una cookie no cruza navegadores. Con la sesión de 30 días, es una vez por aparato y no una vez por turno.

- [ ] **Step 5: Verificar la renovación en base**

Run, contra la base de `develop`:

```sql
SELECT "usuarioId", "createdAt", "lastUsedAt", "expiresAt" FROM "SesionUsuario" ORDER BY "lastUsedAt" DESC LIMIT 5;
```

Expected: `expiresAt` está a ~30 días de `lastUsedAt` en las sesiones activas, y `lastUsedAt` se mueve con el uso.

- [ ] **Step 6: Merge**

Usar la skill `superpowers:finishing-a-development-branch` para decidir cómo integrar la rama.

---

## Qué queda deliberadamente fuera

- **PIN numérico.** Se evaluó y se descartó a favor de contraseña completa.
- **Auto-autorización del enlace de cobro sin sesión.** Convertiría el ticket de papel en credencial: cualquiera que lo levante de una mesa podría marcar la orden como cobrada.
- **JWT.** No resuelve ninguna de las tres causas y quita la revocación inmediata.
- **Rate limit distribuido.** El conteo de Task 9 vive en la memoria de cada instancia de Lambda. Frena el tanteo manual desde un navegador, no un ataque distribuido. Si hace falta, mover el estado a una tabla `IntentoLogin`.
- **Cambio de contraseña por el propio usuario.** Hoy solo el admin las asigna desde `/admin/usuarios`.
- **Comprobantes de transferencia en S3.** Sigue pendiente, según `docs/COBROS_QR.md`.
