# Capa de Presentación

## Reconciliación `src/app` vs `src/presentation/app`

El diseño (`design.md`) ubica las rutas en `presentation/app`. Sin embargo, Next.js
(App Router) solo reconoce el directorio de rutas en `app/` o `src/app/`. Para no
romper el build de Next, adoptamos el enfoque pragmático recomendado:

- **`src/app/`**: directorio oficial de routing de Next.js (route handlers, server
  actions, layouts y páginas). Estos archivos son finos: solo orquestan y delegan en
  los _containers_ y casos de uso.
- **`src/presentation/`**: alberga las capas de arquitectura de la presentación
  desacopladas del router:
  - `components/presenters/` — UI pura (sin fetching).
  - `components/containers/` — wiring a casos de uso, fetching y estado.
  - `components/ui/` — primitivas de shadcn/ui (`utils.ts` con `cn`, modales, toasts).
  - `hooks/` — `usePollingOrders`, `useWakeLock`, `useAudioUnlock`, etc.

Las páginas/route handlers de `src/app` importan containers y componentes desde
`@/presentation/*`. Así se mantiene la regla de dependencia
(`presentation → application → domain`) y se respeta la convención de Next.
