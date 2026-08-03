# Graph Report - .  (2026-08-03)

## Corpus Check
- 71 files · ~93,159 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1085 nodes · 2121 edges · 73 communities (57 shown, 16 thin omitted)
- Extraction: 93% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 132 edges (avg confidence: 0.82)
- Token cost: 127,399 input · 0 output

## Community Hubs (Navigation)
- Pantallas de admin y cocina
- Cliente API del agente de impresión
- Cola y configuración de impresión
- Agente de impresión en Python
- Despliegue del agente de impresión
- Documentación de arquitectura
- Numeración diaria e impresora
- Plan de implementación de impresión
- API del agente de impresión
- Configuración de TypeScript
- API de auth, eventos y cortesías
- Validaciones de admin
- API de cuadre y retiros
- API de productos y usuarios
- AppShell y roles de navegación
- Creación y edición de órdenes
- Modales de detalle y cobro
- Paquete del agente de impresión
- Dependencias de desarrollo
- Dependencias de producción
- Gestión de menú y stock
- Scripts de npm
- Migración de cola de impresión
- Validaciones de retiros
- Cobro de órdenes
- Invariantes del cuadre de caja
- Tests del cuadre
- Roles y formulario de usuario
- Aprobación de órdenes por stock
- Panel de admin y cálculo del cuadre
- API de stock
- Barra inferior y decisiones de nav
- Cobro por QR
- TSConfig del agente de impresión
- Retiro de caja del mesero
- Migración de productos e ítems
- API de modificación de ítems
- API de órdenes e impresora
- Drawer, z-index y accesibilidad
- Migración de usuarios y autoría
- Enlace de pago e historial
- Documentos de diseño y migraciones
- Tests de validación de retiros
- Migración de estado de orden
- API de retiros y sesión
- Server-sent events
- Migración de historial y stock
- Migración de mesas y número diario
- Timeline de historial de orden
- Reporte de modificaciones
- Layout raíz
- Pantalla de login
- Metadatos del paquete
- Seed de bebidas
- Seed de tiempos
- Logo de la marca
- Seed de admin
- Icono de archivo
- Icono de globo
- Icono de ventana
- Configuración de ESLint
- Instalador del proyecto
- Configuración de Next
- Configuración de PostCSS
- Instalador Ubuntu Python
- Instalador Ubuntu Node
- Logo de Vercel
- Configuración de preview
- Prueba de impresora
- Retiro de impresión directa
- Icono de Next

## God Nodes (most connected - your core abstractions)
1. `getAuthenticatedUser()` - 37 edges
2. `error()` - 33 edges
3. `Table Orden` - 30 edges
4. `NivelPicante` - 22 edges
5. `esMetodoPago()` - 19 edges
6. `scripts` - 18 edges
7. `obtenerEtiquetaNivelPicante()` - 18 edges
8. `useAuth()` - 17 edges
9. `enqueueOrderPrintJob()` - 17 edges
10. `PrintWorker` - 16 edges

## Surprising Connections (you probably didn't know these)
- `aUsuarioAdmin()` --conceptually_related_to--> `Sesion firmada HttpOnly y hashing de contrasenas`  [INFERRED]
  types/usuario.ts → PRINTING_IMPLEMENTATION_PLAN.md
- `Cola de impresion PrintJob en PostgreSQL` --references--> `OrdenConStock`  [INFERRED]
  PRINTING_IMPLEMENTATION_PLAN.md → types/orden.ts
- `Formato de comanda termica 80 mm / 42 caracteres` --shares_data_with--> `NIVELES_PICANTE`  [INFERRED]
  public/plantilla-impresiones.html → types/orden.ts
- `Regla: la modificacion imprime solo el delta` --shares_data_with--> `calcularRecargoEnvases()`  [INFERRED]
  public/plantilla-impresiones.html → types/orden.ts
- `Thermal Printer Network Setup` --semantically_similar_to--> `Thermal Printer Diagnostics`  [INFERRED] [semantically similar]
  SETUP.md → QUICK_REFERENCE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Flujo de impresion confiable: cola, agente, leases, ventana y API** — printing_implementation_plan_print_queue, printing_implementation_plan_print_agent, printing_implementation_plan_lease_dedupe, printing_implementation_plan_five_minute_window, printing_implementation_plan_agent_api, printing_implementation_plan_payload_snapshot [EXTRACTED 1.00]
- **Ciclo de vida del trabajo de impresion (encolar, reclamar, completar/fallar, heartbeat)** — app_api_ordenes_route_post, app_api_ordenes_id_items_route_patch, app_api_ordenes_aprobacion_aprobar_route_post, app_api_print_agent_claim_route_post, app_api_print_agent_jobs_id_complete_route_post, app_api_print_agent_jobs_id_fail_route_post, app_api_print_agent_heartbeat_route_post, concept_cola_impresion_lease [INFERRED 0.85]
- **Patrón CRUD del panel admin (listado + modal + formulario + validación)** — components_admin_gestionmenu_gestionmenu, components_admin_modalformulario_modalformulario, components_admin_formularioproducto_formularioproducto, components_admin_formulariousuario_formulariousuario, lib_admin_validaciones_ejecutar [INFERRED 0.85]
- **Stack de CRUD de productos en el panel admin** — docs_superpowers_plans_2026_08_01_admin_menu_usuarios_capa_validacion_pura, docs_superpowers_plans_2026_08_01_admin_menu_usuarios_parametro_vista_admin, docs_superpowers_plans_2026_08_01_admin_menu_usuarios_shell_pestanas_productos, docs_superpowers_plans_2026_08_01_admin_menu_usuarios_modal_formulario_reutilizable, docs_superpowers_plans_2026_08_01_admin_menu_usuarios_sin_borrado_fisico [EXTRACTED 1.00]
- **Flujo claim -> imprimir -> confirmar de un trabajo de impresion** — print_agent_src_worker_printworker, print_agent_src_api_client_printagentapiclient, print_agent_src_printer_sendtoprinter, print_agent_src_types_claimedprintjob, concept_at_least_once_job_delivery [EXTRACTED 1.00]
- **Rollout DRY_RUN -> cutover de impresion** — concept_dry_run_mode, concept_print_cutover, print_agent_readme_agente_impresion_ubuntu, print_agent_python_readme_agente_impresion_python, concept_systemd_service_deployment [INFERRED 0.85]
- **Printing subsystem schema (queue, agent, order print state)** — prisma_migrations_20260731235900_baseline_current_migration_printjob, prisma_migrations_20260731235900_baseline_current_migration_printagent, prisma_migrations_20260731235900_baseline_current_migration_printjobtype, prisma_migrations_20260731235900_baseline_current_migration_printjobstatus, prisma_migrations_20260731235900_baseline_current_migration_orden_impresa, prisma_migrations_20260731235900_baseline_current_migration_orden_printrevision, prisma_migrations_20260731235900_baseline_current_migration_printjob_dedupekey_key, prisma_migrations_20260731235900_baseline_current_migration_printjob_status_availableat_idx, prisma_migrations_20260731235900_baseline_current_migration_printjob_leaseexpiresat_idx [EXTRACTED 1.00]
- **Order lifecycle tables (order, lines, catalog, audit, daily counter)** — prisma_migrations_20260731235900_baseline_current_migration_orden, prisma_migrations_20260731235900_baseline_current_migration_item, prisma_migrations_20260731235900_baseline_current_migration_producto, prisma_migrations_20260731235900_baseline_current_migration_historialorden, prisma_migrations_20260801010000_add_daily_order_number_migration_contadorordendiaria, prisma_migrations_20260731235900_baseline_current_migration_mesa [INFERRED 0.95]
- **Order authorship and authorization columns linked to Usuario** — prisma_migrations_20260801040000_add_order_creator_migration_orden_creadorid, prisma_migrations_20260801040000_add_order_creator_migration_orden_creadorrol, prisma_migrations_20260801040000_add_order_creator_migration_orden_creadorid_fkey, prisma_migrations_20260801040000_add_order_creator_migration_orden_creadorid_idx, prisma_migrations_20260731235900_baseline_current_migration_orden_mesero, prisma_migrations_20260731235900_baseline_current_migration_orden_aprobadaporid, prisma_migrations_20260731235900_baseline_current_migration_usuario [EXTRACTED 1.00]
- **Restaurant Order Lifecycle** — project_structure_waiter_order_interface, project_structure_order_api, project_structure_prisma_data_model, project_structure_thermal_printer_service, project_structure_kitchen_order_monitor [EXTRACTED 1.00]

## Communities (73 total, 16 thin omitted)

### Community 0 - "Pantallas de admin y cocina"
Cohesion: 0.05
Nodes (61): ProductosContenido(), Cortesia, Estadisticas, ReporteCortesias, ReportesContenido(), obtenerUsuarios(), UsuariosPage(), CocinaPage() (+53 more)

### Community 1 - "Cliente API del agente de impresión"
Cohesion: 0.06
Nodes (51): Heartbeat de salud del agente e impresora, Entrega at-least-once de trabajos de impresion, Ventana horaria de polling (12:00-21:00 America/Guayaquil), ApiError (TypeScript), PrintAgentApiClient, boolean(), integer(), loadConfig (TypeScript) (+43 more)

### Community 2 - "Cola y configuración de impresión"
Cohesion: 0.08
Nodes (53): shouldPrintPaymentQr(), isDirectPrintEnabled(), run (pruebas de print-config), AmendmentAction, AmendmentPayloadOptions, AmendmentPrintPayload, assertNonNegativeInteger(), assertNonZeroInteger() (+45 more)

### Community 3 - "Agente de impresión en Python"
Cohesion: 0.09
Nodes (37): Exception, object, amendment_amount_delta(), amendment_quantity_delta(), amendment_reference(), amount_line(), amount_lines_for_order(), ApiClient (+29 more)

### Community 4 - "Despliegue del agente de impresión"
Cohesion: 0.09
Nodes (18): Modo DRY_RUN del agente de impresion, Rasterizado del logo con umbral de gris 128, Cutover de impresion directa a cola, Compatibilidad Python 3.6 / Linux i386, Despliegue como servicio systemd restaurant-print-agent, restaurant-print-agent package manifest, Agente de impresion Python para Linux i386 (README), install-ubuntu.sh (Python agent installer) (+10 more)

### Community 5 - "Documentación de arquitectura"
Cohesion: 0.09
Nodes (33): Project Structure Documentation, Kitchen Order Monitor, Order API, Waiter-to-Kitchen Order Lifecycle, Planned POS Modules, Prisma Data Model, Restaurant POS Architecture, Thermal Printer Service (+25 more)

### Community 6 - "Numeración diaria e impresora"
Cohesion: 0.11
Nodes (28): Auditoría de la edición de órdenes y reimpresión parcial, Ticket AMENDMENT con revisión y número diario, Bloqueo optimista por revisión esperada en edición y cobro, Implementación: revisión esperada, bloqueo de cobradas y delta monetario, allocateDailyOrderNumber(), DailyOrderNumber, DailyOrderNumberTransaction, getOrderDateKey() (+20 more)

### Community 7 - "Plan de implementación de impresión"
Cohesion: 0.08
Nodes (28): Pipeline de build de Amplify, Baseline 20260731235900_baseline_current, Procedimiento de reset unico de preproduccion, Build NodeNext independiente del print-agent, API privada del agente: claim/complete/fail/heartbeat, Ajustes requeridos de Amplify (Next 15, npm ci, migrate deploy), Encolado atomico de trabajos en lib/print-jobs.ts, Cutover PRINT_CUTOVER_AT y despliegue gradual (+20 more)

### Community 8 - "API del agente de impresión"
Cohesion: 0.20
Nodes (24): POST /api/print-agent/claim, optionalText, POST /api/print-agent/heartbeat, POST /api/print-agent/jobs/[id]/complete, POST /api/print-agent/jobs/[id]/fail, Cola de impresion con lease por agente, authenticatePrintAgent(), digest() (+16 more)

### Community 9 - "Configuración de TypeScript"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 10 - "API de auth, eventos y cortesías"
Cohesion: 0.15
Nodes (18): POST(), POST(), GET(), GET(), encoder, GET(), ESTADOS_EDITABLES, POST() (+10 more)

### Community 11 - "Validaciones de admin"
Cohesion: 0.24
Nodes (22): Capa de validación pura (lib/admin-validaciones.ts), Detección de duplicados case-insensitive en las rutas, División validarXNuevo / validarXParcial, booleano(), DatosProducto, ejecutar(), entero(), ErrorValidacion (+14 more)

### Community 12 - "API de cuadre y retiros"
Cohesion: 0.14
Nodes (16): GET(), AnulacionConflictError, PATCH(), GET(), Decisión: no guardar fechaLocal en RetiroCaja, isConfirmedPaymentInRange(), obtenerRangoEcuador(), casiMedianoche (+8 more)

### Community 13 - "API de productos y usuarios"
Cohesion: 0.16
Nodes (15): DatosDespuesJson, PATCH /api/productos/[id] (colisiona con /api/usuarios/[id]), GET /api/productos, POST /api/productos, GET /api/usuarios/[id], PATCH(), GET /api/usuarios, POST /api/usuarios (+7 more)

### Community 14 - "AppShell y roles de navegación"
Cohesion: 0.15
Nodes (20): Accesibilidad WCAG 2.1 AA del shell, Acento por rol, AppShell, components/mesero/RetiroCaja.tsx, Decisión: activoId lo resuelve la página, Decisión: solo el rol mesero registra retiros, Decisión: usuario y onLogout por props, Next.js 16 App Router (+12 more)

### Community 15 - "Creación y edición de órdenes"
Cohesion: 0.18
Nodes (16): Orden, Orden, Orden, CrearOrden(), ItemCarrito, Producto, EditarOrdenModal(), EditarOrdenModalProps (+8 more)

### Community 16 - "Modales de detalle y cobro"
Cohesion: 0.12
Nodes (17): DetalleOrdenModal(), DetalleOrdenModalProps, ESTADOS_EDITABLES, ItemOrden, Orden, Producto, CobrarOrdenClient(), CobroOrder (+9 more)

### Community 17 - "Paquete del agente de impresión"
Cohesion: 0.10
Nodes (19): pngjs, dependencies, pngjs, devDependencies, @types/node, @types/pngjs, typescript, @types/node (+11 more)

### Community 18 - "Dependencias de desarrollo"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, ts-node (+11 more)

### Community 19 - "Dependencias de producción"
Cohesion: 0.11
Nodes (19): next, node-thermal-printer, dependencies, next, node-thermal-printer, pg, prisma, @prisma/adapter-pg (+11 more)

### Community 20 - "Gestión de menú y stock"
Cohesion: 0.16
Nodes (14): FormularioProducto, Props, GestionMenu, obtenerProductos (vista=admin), GestionStock, ModalFormulario(), Props, Prisma serializa Decimal como string (+6 more)

### Community 21 - "Scripts de npm"
Cohesion: 0.11
Nodes (18): scripts, build, db:reset:preprod, dev, lint, postinstall, seed, start (+10 more)

### Community 22 - "Migración de cola de impresión"
Cohesion: 0.14
Nodes (18): Baseline Migration (full schema snapshot), Orden.impresa, Table PrintAgent (printer heartbeat), PrintAgent.lastSeenAt / printerReachable / lastPrinterCheckAt, Index PrintAgent_lastSeenAt_idx, Table PrintJob (print queue), PrintJob.dedupeKey (idempotency key), Unique index PrintJob_dedupeKey_key (+10 more)

### Community 23 - "Validaciones de retiros"
Cohesion: 0.21
Nodes (16): POST(), CATEGORIAS_RETIRO (types/retiro.ts), Categoría adelanto, beneficiario(), categoriaValida(), DatosAnulacion, DatosRetiro, ejecutar() (+8 more)

### Community 24 - "Cobro de órdenes"
Cohesion: 0.33
Nodes (12): PATCH(), PATCH(), collectOrderPayment(), PaymentConflictError, PaymentForbiddenError, PaymentNotFoundError, PaymentValidationError, validateOrderCanBePaid() (+4 more)

### Community 25 - "Invariantes del cuadre de caja"
Cohesion: 0.14
Nodes (16): Aprobación por falta de stock, calcularResumenCuadre() (types/cuadre.ts), Comprobantes de transferencia en S3 (pendiente), Cuadre de caja, Decisión: el retiro es siempre en efectivo, Domicilio en efectivo, Domicilio por transferencia, efectivoEnCaja (+8 more)

### Community 26 - "Tests del cuadre"
Cohesion: 0.12
Nodes (15): cajaEnNegativo, centavos, cobradaSinMetodoLegado, conReembolsoPendiente, conRetiros, domicilioConCentavos, domicilioSinCobrar, envioFueraDeDomicilio (+7 more)

### Community 27 - "Roles y formulario de usuario"
Cohesion: 0.18
Nodes (13): Allowlist de permisos Bash del proyecto, FormularioUsuario, Props, Catálogo de ROLES (admin, mesero, cocina, digital), Plan: Gestión de menú y usuarios en el panel admin, Sin borrado físico (desactivación lógica), Diseño: Gestión de menú y usuarios desde el panel admin, DatosUsuario (+5 more)

### Community 28 - "Aprobación de órdenes por stock"
Cohesion: 0.16
Nodes (11): ApprovalConflictError, POST(), POST(), RejectionConflictError, AprobarOrdenRequest, CobrarOrdenRequest, CrearOrdenRequest, DesglosePrecio (+3 more)

### Community 29 - "Panel de admin y cálculo del cuadre"
Cohesion: 0.29
Nodes (11): AdminPage(), obtenerTituloOrden(), obtenerFechaEcuador(), aCentavos(), aDolares(), calcularResumenCuadre(), OrdenParaCuadre, ResumenCuadre (+3 more)

### Community 30 - "API de stock"
Cohesion: 0.21
Nodes (6): ItemValidacion, ActualizarStockRequest, ItemSinStock, ProductoConStock, ProductoStockBajo, ValidacionStock

### Community 31 - "Barra inferior y decisiones de nav"
Cohesion: 0.15
Nodes (13): Badges de navegación, BarraInferior, components/mesero/CrearOrden.tsx, Decisión: drawer más barra inferior en móvil, Decisión: iconos emoji sin librería, Decisión: topbar horizontal en escritorio, sin sidebar, Cobro, Orden (+5 more)

### Community 32 - "Cobro por QR"
Cohesion: 0.21
Nodes (12): Campo paymentUrl, Cobro por QR y URL, Comanda e impresión del QR, NEXT_PUBLIC_APP_URL, Documento: Cobros por QR y URL, Consulta graphify: cobro autenticado de órdenes por QR/URL, Rama feat/cobro, Riesgo: contraseñas en texto plano (+4 more)

### Community 33 - "TSConfig del agente de impresión"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 34 - "Retiro de caja del mesero"
Cohesion: 0.26
Nodes (10): formatearHora(), nuevoIdEnvio(), Props, RetiroCaja(), UsuarioSimple, AnularRetiroRequest, CATEGORIAS_RETIRO, CrearRetiroRequest (+2 more)

### Community 35 - "Migración de productos e ítems"
Cohesion: 0.23
Nodes (12): Table Item (order line), Item.esCortesia / adminCortesia, FK Item_ordenId_fkey -> Orden (CASCADE), FK Item_productoId_fkey -> Producto (RESTRICT), Item.cantidad / precioUnitario / subtotal, Table Producto, Producto.categoria, Migration add_nivel_picante (order-level) (+4 more)

### Community 36 - "API de modificación de ítems"
Cohesion: 0.22
Nodes (9): HistoryRecord, ItemChange, ModificationRequest, ModificationRequestError, PATCH(), validateRequest(), AmendmentChangeSource, esNivelPicante() (+1 more)

### Community 37 - "API de órdenes e impresora"
Cohesion: 0.29
Nodes (7): GET(), POST(), StockConflictError, withoutPaymentSecrets(), DigitalContenido(), PrinterService, error()

### Community 38 - "Drawer, z-index y accesibilidad"
Cohesion: 0.18
Nodes (11): Banner SSE de cocina, Breakpoint único md (768px), DrawerNav, Escala de z-index, Focus trap del drawer, Los cuatro headers por pantalla, Activar notificaciones (cocina), Soporte de prefers-reduced-motion (+3 more)

### Community 39 - "Migración de usuarios y autoría"
Cohesion: 0.24
Nodes (11): Orden.aprobadaPorId / razonAprobacion, FK Orden_aprobadaPorId_fkey -> Usuario (SET NULL), Orden.cobrada / fechaCobro / cobradaPor, Orden.mesero (legacy creator name), Table Usuario, Usuario.rol, Backfill UPDATE Orden creador from Usuario by name match, Orden.creadorId (+3 more)

### Community 40 - "Enlace de pago e historial"
Cohesion: 0.38
Nodes (7): GET(), CobrarOrdenPage(), canUserCollectOrder(), createPaymentLink(), hashPaymentToken(), roleHome(), roleOrdersHome()

### Community 41 - "Documentos de diseño y migraciones"
Cohesion: 0.20
Nodes (10): Decisión: registro directo con anulación del admin, Plan de implementación: AppShell y navegación móvil, Spec: AppShell y navegación móvil (2026-08-02), Spec: Retiro de caja por empleados (2026-08-01), Usuario (modelo), Fallback de rol desconocido, Migración 20260802010000_add_qr_payments_and_sessions, Migración 20260802020000_add_retiro_caja (+2 more)

### Community 42 - "Tests de validación de retiros"
Cohesion: 0.20
Nodes (8): adelanto, anulacion, centavosIncomodos, conAdminIdEnElCuerpo, conEspacios, enElTecho, montoTexto, valido

### Community 43 - "Migración de estado de orden"
Cohesion: 0.27
Nodes (10): Table Orden, Orden.costoEnvio / recargo, Orden.estado (pendiente por defecto), Orden.metodoPago (cobro efectivo), Orden.printRevision, Orden.tipoOrden (local / domicilio), PrintJob.revision / payloadVersion, Migration add_metodo_pago_previsto (+2 more)

### Community 44 - "API de retiros y sesión"
Cohesion: 0.32
Nodes (8): Anulación de retiro, API de retiros (app/api/retiros/), Compare-and-set al cobrar, GET /api/retiros?fecha=YYYY-MM-DD, getAuthenticatedUser(), Idempotencia por clientRequestId, PATCH /api/retiros/[id]/anular, POST /api/retiros

### Community 45 - "Server-sent events"
Cohesion: 0.29
Nodes (4): encoder, globalForSSE, notificarClientes(), SSEController

### Community 46 - "Migración de historial y stock"
Cohesion: 0.25
Nodes (8): Table HistorialOrden (audit log), Index HistorialOrden_createdAt_idx, HistorialOrden.datosAntes / datosDespues / itemAfectado (JSONB), FK HistorialOrden_ordenId_fkey -> Orden (CASCADE), Index HistorialOrden_ordenId_idx, Orden.sinStock / itemsSinStock, PrintJob.payload (JSONB ticket snapshot), Producto.stock / stockMinimo

### Community 47 - "Migración de mesas y número diario"
Cohesion: 0.29
Nodes (8): Table Mesa, Unique index Mesa_numero_key, Orden.numeroMesa, Migration add_daily_order_number, Table ContadorOrdenDiaria (daily counter, PK fecha), Concept: visible daily order number vs technical cuid, Unique index Orden_fechaNumeroDiario_numeroDiario_key, Orden.numeroDiario / fechaNumeroDiario

### Community 48 - "Timeline de historial de orden"
Cohesion: 0.33
Nodes (4): DatosHistorial, HistorialItem, HistorialOrdenTimelineProps, ItemAfectado

### Community 51 - "Pantalla de login"
Cohesion: 0.50
Nodes (3): LoginPage(), Usuario, Parámetro ?vista=admin

### Community 53 - "Metadatos del paquete"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 56 - "Logo de la marca"
Cohesion: 1.00
Nodes (3): Camarones Louisiana Logo (print-agent copy) - circular badge with red shrimp, 'CAMARONES LOUISIANA' arched top, 'SEA FOOD BOIL' arched bottom, red 'cuenca' tag; embedded by the thermal print agent onto receipt headers, Camarones Louisiana brand identity - single restaurant logotype (shrimp seal, Cuenca location mark) duplicated across the print and web delivery channels of the POS, Camarones Louisiana Logo (public web copy) - byte-identical duplicate of the print-agent logo, served as a static asset from public/assets for the web POS UI

### Community 58 - "Icono de archivo"
Cohesion: 0.67
Nodes (3): Generic Document File Icon, Folded Document Corner, Document Text Lines

### Community 59 - "Icono de globo"
Cohesion: 0.67
Nodes (3): Globe Icon, Latitude and Longitude Grid, World / Global

### Community 60 - "Icono de ventana"
Cohesion: 0.67
Nodes (3): Browser or Application Window, Application Window Icon, Three Window Controls

## Ambiguous Edges - Review These
- `loadLogoRaster (pngjs)` → `restaurant-print-agent package manifest`  [AMBIGUOUS]
  print-agent/package.json · relation: references
- `Orden.cobrada / fechaCobro / cobradaPor` → `Table Usuario`  [AMBIGUOUS]
  prisma/migrations/20260731235900_baseline_current/migration.sql · relation: conceptually_related_to
- `PrintJob lease columns (workerId, leasedAt, leaseExpiresAt)` → `Table PrintAgent (printer heartbeat)`  [AMBIGUOUS]
  prisma/migrations/20260731235900_baseline_current/migration.sql · relation: shares_data_with
- `Camarones Louisiana Logo (print-agent copy) - circular badge with red shrimp, 'CAMARONES LOUISIANA' arched top, 'SEA FOOD BOIL' arched bottom, red 'cuenca' tag; embedded by the thermal print agent onto receipt headers` → `Camarones Louisiana brand identity - single restaurant logotype (shrimp seal, Cuenca location mark) duplicated across the print and web delivery channels of the POS`  [AMBIGUOUS]
  print-agent/assets/logo-camarones-louisiana.png · relation: rationale_for
- `Sección Retiros de caja del admin` → `Escala de z-index`  [AMBIGUOUS]
   · relation: depends_on
- `Los cuatro headers por pantalla` → `Escala de z-index`  [AMBIGUOUS]
   · relation: replaces

## Knowledge Gaps
- **270 isolated node(s):** `DatosDespuesJson`, `ItemAfectadoJson`, `EstadisticaMesero`, `ItemValidacion`, `inter` (+265 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `loadLogoRaster (pngjs)` and `restaurant-print-agent package manifest`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Orden.cobrada / fechaCobro / cobradaPor` and `Table Usuario`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `PrintJob lease columns (workerId, leasedAt, leaseExpiresAt)` and `Table PrintAgent (printer heartbeat)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Camarones Louisiana Logo (print-agent copy) - circular badge with red shrimp, 'CAMARONES LOUISIANA' arched top, 'SEA FOOD BOIL' arched bottom, red 'cuenca' tag; embedded by the thermal print agent onto receipt headers` and `Camarones Louisiana brand identity - single restaurant logotype (shrimp seal, Cuenca location mark) duplicated across the print and web delivery channels of the POS`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **What is the exact relationship between `Sección Retiros de caja del admin` and `Escala de z-index`?**
  _Edge tagged AMBIGUOUS (relation: depends_on) - confidence is low._
- **What is the exact relationship between `Los cuatro headers por pantalla` and `Escala de z-index`?**
  _Edge tagged AMBIGUOUS (relation: replaces) - confidence is low._
- **Why does `error()` connect `API de órdenes e impresora` to `Pantallas de admin y cocina`, `Cliente API del agente de impresión`, `API de modificación de ítems`, `Enlace de pago e historial`, `API de auth, eventos y cortesías`, `Tests de validación de retiros`, `API de cuadre y retiros`, `Creación y edición de órdenes`, `Pantalla de login`, `Validaciones de retiros`, `Cobro de órdenes`, `Aprobación de órdenes por stock`, `Panel de admin y cálculo del cuadre`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._