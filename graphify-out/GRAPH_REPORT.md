# Graph Report - .  (2026-07-31)

## Corpus Check
- Corpus is ~29,528 words - fits in a single context window. You may not need a graph.

## Summary
- 309 nodes · 376 edges · 28 communities (16 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Interfaces POS
- Aprobación y stock
- Órdenes y eventos
- Calidad y desarrollo
- Configuración TypeScript
- Despliegue Amplify
- Administración y reportes
- Dependencias runtime
- Edición e historial
- Operación y seguridad
- Comandas cocina
- Layout principal
- Carga de bebidas
- Tiempos de preparación
- Inicio de sesión
- Datos iniciales
- Administración usuarios
- Ícono documento
- Ícono global
- Ícono ventana
- Configuración ESLint
- Instalación local
- Configuración Next.js
- Configuración PostCSS
- Marca Vercel
- Marca Next.js

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `useAuth()` - 15 edges
3. `notificarClientes()` - 8 edges
4. `ItemSinStock` - 8 edges
5. `include` - 7 edges
6. `Restaurant POS Architecture` - 7 edges
7. `scripts` - 6 edges
8. `Waiter-to-Kitchen Order Lifecycle` - 6 edges
9. `Restaurant POS Setup Guide` - 6 edges
10. `PrinterService` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Thermal Printer Network Setup` --semantically_similar_to--> `Thermal Printer Diagnostics`  [INFERRED] [semantically similar]
  SETUP.md → QUICK_REFERENCE.md
- `AWS Amplify Frontend Pipeline` --semantically_similar_to--> `Vercel Platform`  [INFERRED] [semantically similar]
  amplify.yml → README.md
- `AdminPage()` --calls--> `useAuth()`  [EXTRACTED]
  app/admin/page.tsx → lib/auth.ts
- `ProductosPage()` --calls--> `useAuth()`  [EXTRACTED]
  app/admin/productos/page.tsx → lib/auth.ts
- `ReportesPage()` --calls--> `useAuth()`  [EXTRACTED]
  app/admin/reportes/page.tsx → lib/auth.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Restaurant Order Lifecycle** — project_structure_waiter_order_interface, project_structure_order_api, project_structure_prisma_data_model, project_structure_thermal_printer_service, project_structure_kitchen_order_monitor [EXTRACTED 1.00]
- **Amplify Deployment Flow** — amplify_environment_variables, amplify_prisma_schema_sync, amplify_nextjs_build, amplify_nextjs_artifacts [EXTRACTED 1.00]

## Communities (28 total, 12 thin omitted)

### Community 0 - "Interfaces POS"
Cohesion: 0.08
Nodes (27): AdminPage(), Orden, ProductosPage(), Cortesia, Estadisticas, ReporteCortesias, ReportesPage(), CocinaPage() (+19 more)

### Community 1 - "Aprobación y stock"
Cohesion: 0.10
Nodes (15): METODOS_PAGO_VALIDOS, PATCH(), ItemValidacion, AprobarOrdenRequest, CobrarOrdenRequest, DesglosePrecio, EstadoOrden, OrdenConStock (+7 more)

### Community 2 - "Órdenes y eventos"
Cohesion: 0.09
Nodes (18): encoder, ESTADOS_EDITABLES, POST(), PATCH(), OrdenConItems, POST(), ItemComanda, NumericValue (+10 more)

### Community 3 - "Calidad y desarrollo"
Cohesion: 0.07
Nodes (28): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, ts-node (+20 more)

### Community 4 - "Configuración TypeScript"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "Despliegue Amplify"
Cohesion: 0.11
Nodes (28): AWS Amplify Build Configuration, Amplify Environment Variables, AWS Amplify Frontend Pipeline, Next.js Build Artifacts, Next.js Production Build, Amplify Pre-Build Phase, Prisma Schema Synchronization, Project Structure Documentation (+20 more)

### Community 6 - "Administración y reportes"
Cohesion: 0.08
Nodes (4): DatosDespuesJson, EstadisticaMesero, ItemAfectadoJson, globalForPrisma

### Community 7 - "Dependencias runtime"
Cohesion: 0.10
Nodes (21): next, node-thermal-printer, dependencies, next, node-thermal-printer, pg, prisma, @prisma/adapter-pg (+13 more)

### Community 8 - "Edición e historial"
Cohesion: 0.15
Nodes (9): DetalleOrdenModalProps, ESTADOS_EDITABLES, ItemOrden, Orden, Producto, DatosHistorial, HistorialItem, HistorialOrdenTimelineProps (+1 more)

### Community 9 - "Operación y seguridad"
Cohesion: 0.24
Nodes (12): Common Database Operations, Restaurant POS Quick Reference, Pre-Production Checklist, Prisma Studio, Sales Reporting Queries, Thermal Printer Diagnostics, Admin Password Login, Daily Close Administration Panel (+4 more)

### Community 10 - "Comandas cocina"
Cohesion: 0.29
Nodes (5): EstadoTiempo, Item, Orden, OrdenCardProps, Producto

### Community 18 - "Ícono documento"
Cohesion: 0.67
Nodes (3): Generic Document File Icon, Folded Document Corner, Document Text Lines

### Community 19 - "Ícono global"
Cohesion: 0.67
Nodes (3): Globe Icon, Latitude and Longitude Grid, World / Global

### Community 20 - "Ícono ventana"
Cohesion: 0.67
Nodes (3): Browser or Application Window, Application Window Icon, Three Window Controls

## Knowledge Gaps
- **125 isolated node(s):** `Orden`, `Estadisticas`, `Cortesia`, `ReporteCortesias`, `DatosDespuesJson` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Dependencias runtime` to `Calidad y desarrollo`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `Orden`, `Estadisticas`, `Cortesia` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Interfaces POS` be split into smaller, more focused modules?**
  _Cohesion score 0.08258258258258258 - nodes in this community are weakly interconnected._
- **Should `Aprobación y stock` be split into smaller, more focused modules?**
  _Cohesion score 0.09885057471264368 - nodes in this community are weakly interconnected._
- **Should `Órdenes y eventos` be split into smaller, more focused modules?**
  _Cohesion score 0.09195402298850575 - nodes in this community are weakly interconnected._
- **Should `Calidad y desarrollo` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Configuración TypeScript` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._