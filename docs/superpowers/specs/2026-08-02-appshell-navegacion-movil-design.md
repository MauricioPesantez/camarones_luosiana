# AppShell y navegación móvil

Fecha: 2026-08-02
Estado: aprobado, pendiente de plan de implementación

## Problema

Ninguna pantalla comparte header. Cada una arma el suyo a mano, con markup distinto:

- `/mesero`, `/digital`, `/cocina` usan una barra oscura (`bg-gray-800`).
- `/admin/productos` y `/admin/usuarios` usan una barra blanca sticky.
- `/admin` no tiene barra: los enlaces cuelgan del `<h1>`.

Consecuencias:

1. En móvil los headers desbordan. `/mesero` mete tres tabs más nombre de usuario más botón de logout en una fila `flex justify-between` sin envolver.
2. Las sub-páginas de admin navegan con "← Volver" / "← Admin" en vez de nav persistente. Volver al panel y entrar a otra sección cuesta dos cargas de página.
3. La vista activa vive en `useState` (mesero, digital, admin/productos, admin/reportes). Recargar pierde la pestaña y no hay enlaces directos.
4. Cuatro headers que mantener en paralelo: cualquier ítem nuevo se agrega cuatro veces o se olvida en tres.

## Objetivo

Un `AppShell` compartido que reemplace los cuatro headers. En móvil: burger con drawer lateral más barra inferior de accesos primarios. En escritorio (≥768px): nav horizontal en la topbar, visualmente cercano a lo que el equipo ya usa.

## Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Alcance | AppShell unificado, no solo drawer móvil | Elimina la duplicación de los cuatro headers y el patrón "← Volver" |
| Patrón móvil | Drawer + barra inferior | El mesero alterna entre Crear y Mis órdenes decenas de veces por turno; con drawer solo cada cambio cuesta dos taps más el gesto de cierre |
| Escritorio | Topbar horizontal, sin sidebar | Cero cambio visual en pantalla grande; el sidebar persistente robaría ancho a las tablas del cuadre y a la grilla de cocina |
| Sub-nav de admin | Grupos expandibles en el drawer | Deja Stock, Menú, Modificaciones y Cortesías enlazables; obliga a mover la pestaña a la URL, que es una mejora en sí |
| Estilo | Barra clara con acento por rol | El operador reconoce en qué rol está sin que la barra pese visualmente |
| Iconos | Emoji, sin librería | El resto de la app (cards, botones, tablas) ya usa emoji; una librería solo para el nav crearía dos lenguajes visuales |

## Modelo de navegación

Fuente única en `lib/navegacion.ts`. Drawer, barra inferior y topbar rinden el mismo mapa.

### mesero — acento azul

| Destino | Barra inferior | Drawer |
|---|---|---|
| Crear orden | ➕ Crear | Operación |
| Mis órdenes (badge: órdenes por cobrar) | 📋 Órdenes | Operación |
| Retiro de caja | 💸 Retiro | Caja |
| Cerrar sesión | — | Sesión |

Acción de página en la topbar: 🔄 Actualizar, solo en la vista de órdenes.

### digital — acento índigo

| Destino | Barra inferior | Drawer |
|---|---|---|
| Nuevo pedido | ➕ Nuevo | Operación |
| Mis pedidos (badge: pedidos por cobrar) | 📋 Pedidos | Operación |
| Cerrar sesión | — | Sesión |

Acción de página: 🔄 Actualizar.

### cocina — acento ámbar

Un solo destino, así que la barra inferior no se rinde.

| Destino | Drawer |
|---|---|
| Monitor de cocina | Operación |
| 🔔 Activar notificaciones (solo si `Notification.permission === "default"`) | Preferencias |
| Cerrar sesión | Sesión |

### admin — acento slate

| Destino | Ruta | Barra inferior | Drawer |
|---|---|---|---|
| Cuadre de caja | `/admin` | 💵 Cuadre | Cuadre |
| Stock | `/admin/productos?tab=stock` | 📦 Productos | Catálogo → Productos |
| Menú | `/admin/productos?tab=menu` | — | Catálogo → Productos |
| Modificaciones | `/admin/reportes?tab=modificaciones` | 📊 Reportes | Análisis → Reportes |
| Cortesías (badge: total de cortesías) | `/admin/reportes?tab=cortesias` | — | Análisis → Reportes |
| Usuarios | `/admin/usuarios` | 👥 Usuarios | Equipo |
| Cerrar sesión | — | — | Sesión |

Los ítems con hijos llevan a su primer sub-destino cuando se tocan desde la barra inferior. En el drawer se expanden.

### Reglas del modelo

- La barra inferior toma como máximo cuatro ítems y no se rinde con menos de dos.
- Los grupos del drawer con un solo ítem se rinden planos, sin encabezado de grupo.
- El drawer siempre cierra el grupo Sesión al final, separado por una línea.
- `/login` y `/ordenes/cobrar/[token]` no usan AppShell: no hay sesión de operador.

## Arquitectura

```
lib/navegacion.ts                   Tipos, NAV_POR_ROL, acento por rol, z-index
components/shell/AppShell.tsx       Orquesta topbar + drawer + barra inferior + <main>
components/shell/TopBar.tsx         Burger (móvil) | nav horizontal (≥md) | slot de acciones
components/shell/DrawerNav.tsx      Panel + overlay, focus trap, ESC, grupos expandibles
components/shell/BarraInferior.tsx  Tabs primarias en móvil
components/shell/ItemNav.tsx        Ítem: emoji, label, badge, estado activo
```

Cada unidad tiene una responsabilidad y se entiende sin leer las demás:

- `navegacion.ts` no importa React. Es data más tipos, testeable en aislamiento con el runner de `ts-node` que ya usa el repo.
- `ItemNav` no sabe si vive en el drawer, la topbar o la barra inferior. Recibe `variante`.
- `DrawerNav` no sabe de roles. Recibe secciones ya resueltas.
- `AppShell` es el único que toca `useAuth`.

### Contrato de AppShell

```tsx
interface AppShellProps {
  usuario: Usuario;
  onLogout: () => void;
  titulo: string;
  activoId: string;
  badges?: Record<string, number>;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}
```

Uso:

```tsx
<AppShell
  usuario={usuario}
  onLogout={logout}
  titulo="Mis órdenes"
  activoId="ordenes"
  badges={{ ordenes: ordenesPorCobrar.length }}
  acciones={<button onClick={cargarOrdenes}>🔄 Actualizar</button>}
>
  {contenido}
</AppShell>
```

`usuario` y `onLogout` viajan por props en vez de que `AppShell` llame a `useAuth()` por su cuenta. Cada página ya llama `useAuth(rol)` para su control de acceso, y una segunda llamada dentro del shell dispararía un `GET /api/auth/session` extra por carga de página, además de una segunda ruta de redirección compitiendo con la de la página. `Usuario` pasa a exportarse desde `lib/auth.ts`.

`activoId` también viene de la página, que ya conoce su vista actual. Así el shell no necesita `useSearchParams()`, que en el App Router obligaría a envolver cada página en `<Suspense>` para no romper el build.

Un ítem sin entrada en `badges` se rinde sin badge. Esto es esperado: estando en `/admin` nadie ha cargado el reporte de cortesías, así que ese badge solo aparece dentro de `/admin/reportes`. No se agrega fetching al shell para llenarlos.

### Tipos

El tipo se llama `EntradaNav` para no chocar con el componente `ItemNav`.

```ts
export type Rol = "mesero" | "digital" | "cocina" | "admin";

export interface ContextoNav {
  permisoNotificaciones: NotificationPermission | "no-soportado";
}

export interface EntradaNav {
  id: string;              // clave del badge y del estado activo
  label: string;
  emoji: string;
  href: string;            // ruta o ruta con query
  hijos?: EntradaNav[];
  enBarraInferior?: boolean;
  labelCorto?: string;     // para la barra inferior
  visible?: (ctx: ContextoNav) => boolean;
}

export interface SeccionNav {
  titulo: string;
  items: EntradaNav[];
}
```

`visible` cubre el único ítem condicional que existe hoy: "Activar notificaciones" en cocina, que solo aparece con `permisoNotificaciones === "default"`. `AppShell` arma el `ContextoNav` y se lo pasa al resolver las secciones.

## Estado de la vista activa

Pasa de `useState` a query param. Afecta cuatro pantallas:

| Pantalla | Antes | Después |
|---|---|---|
| `/mesero` | `useState<"crear" \| "ordenes" \| "retiro">`, lee `?vista=ordenes` solo al montar | `?vista=` como fuente única, default `crear` |
| `/digital` | `useState<"crear" \| "pedidos">` | `?vista=`, default `crear` |
| `/admin/productos` | `useState` de pestaña | `?tab=stock \| menu`, default `stock` |
| `/admin/reportes` | `useState` de pestaña | `?tab=modificaciones \| cortesias`, default `modificaciones` |

Se lee con `useSearchParams()` y se navega con `router.replace()` para no llenar el historial con cambios de tab. Un valor desconocido en el query param cae al default en vez de romper.

## Accesibilidad

Objetivo WCAG 2.1 AA.

- Burger: `aria-label="Abrir menú"`, `aria-expanded`, `aria-controls` apuntando al id del drawer.
- Drawer: `role="dialog"`, `aria-modal="true"`, `aria-label="Menú de navegación"`. ESC cierra. Foco atrapado dentro mientras está abierto. Al cerrar, el foco vuelve al burger.
- Overlay: clic cierra. El contenido de fondo recibe `inert` mientras el drawer está abierto.
- Barra inferior: `<nav aria-label="Navegación principal">`; el ítem activo lleva `aria-current="page"`.
- Grupos expandibles: el disparador es un `<button aria-expanded>` y la lista de hijos su `aria-controls`.
- Objetivos táctiles ≥44×44px. Los headers de hoy usan `py-2` (≈36px); los ítems de nav suben a `min-h-11`.
- Los labels de la barra inferior no bajan de 11px y mantienen contraste ≥4.5:1 contra la superficie clara.
- `prefers-reduced-motion: reduce`: se elimina el desplazamiento del drawer y queda solo el fundido.
- El badge numérico se acompaña de texto para lectores: `<span class="sr-only">3 órdenes por cobrar</span>`.

## Detalles físicos

- `padding-bottom: env(safe-area-inset-bottom)` en la barra inferior. Sin esto, el home indicator de iPhone se come el tercer ítem.
- La barra inferior es `fixed bottom-0`; `<main>` compensa con `pb-16 md:pb-0`.
- Breakpoint único: `md` (768px). Bajo `md` se rinden drawer y barra inferior; a partir de `md` se rinde nav horizontal y ambos desaparecen del DOM, no solo por CSS, para que el focus trap no pueda capturar foco en escritorio.

## Escala de z-index

Hoy hay colisión real: el banner SSE de cocina (`app/cocina/page.tsx`) y todos los modales de mesero y admin usan `z-50`. Se centraliza en `lib/navegacion.ts` y se corrigen los usos existentes:

| Capa | z-index |
|---|---|
| Contenido | auto |
| Barra inferior | 30 |
| Topbar sticky | 30 |
| Banner de notificación (cocina) | 40 |
| Overlay del drawer | 50 |
| Panel del drawer | 51 |
| Modales | 60 |

## Acento por rol

Solo colorea el ítem activo, el avatar de iniciales y el indicador de la barra inferior. La superficie de topbar y drawer es clara (`bg-white`, borde `border-gray-200`) en los cuatro roles.

| Rol | Acento |
|---|---|
| mesero | `blue-600` |
| digital | `indigo-600` |
| cocina | `amber-600` |
| admin | `slate-700` |

Cocina conserva su fondo `gray-900` en el área de contenido; solo la barra es clara.

## Riesgos

1. **Carrito sticky de `CrearOrden`.** `components/mesero/CrearOrden.tsx` (894 líneas) tiene un pie de carrito que puede quedar bajo la barra inferior. Hay que verificarlo a 375px y darle `bottom` o `padding` acorde. Es el riesgo más probable de romper algo visible.
2. **`app/admin/page.tsx` son 1326 líneas.** Se le extrae únicamente el header para envolverlo en AppShell. No se abre refactor mayor del archivo en este trabajo.
3. **Sin runner de tests de UI.** El repo solo tiene tests de `lib/` vía `ts-node`. La lógica pura de `navegacion.ts` se cubre ahí; el resto se verifica en el navegador.
4. **Roles de la BD sin restringir.** `Usuario.rol` es `String` en el schema, no un enum. Un rol fuera de los cuatro conocidos debe caer a un nav mínimo (solo Cerrar sesión) en vez de lanzar.

## Verificación

- `npx tsc --noEmit` sin errores.
- `npm run lint` sin errores nuevos.
- Nuevo test `lib/navegacion.test.ts` con el runner existente: resolución de rol desconocido, filtro de `visible`, tope de cuatro ítems en la barra inferior, grupos de un solo ítem aplanados.
- Verificación en navegador a 375px y a 1280px para cada rol: abrir y cerrar el drawer, navegar por la barra inferior, confirmar que el carrito de `CrearOrden` no queda tapado, y que el banner SSE de cocina queda por debajo del drawer.

## Fases

1. `lib/navegacion.ts` más los cinco componentes del shell, sin conectar a ninguna página. Test de `navegacion.ts`.
2. `/mesero` como piloto. Valida barra inferior, carrito sticky y `?vista=`.
3. `/digital` y `/cocina`. Valida el caso sin barra inferior y el ítem condicional de notificaciones.
4. `/admin` y sus tres sub-rutas, con `?tab=` en la URL y grupos expandibles.
5. Borrar los cuatro headers viejos y corregir la escala de z-index en modales y banner.

## Fuera de alcance

- Rediseño del contenido de cualquier pantalla. Solo cambia la navegación.
- Refactor de `app/admin/page.tsx` más allá de extraer su header.
- Modo oscuro. `globals.css` declara variables de `prefers-color-scheme` pero ninguna pantalla las usa hoy.
- Navegación para `/login` y `/ordenes/cobrar/[token]`.
