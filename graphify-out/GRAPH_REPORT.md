# Graph Report - .  (2026-08-01)

## Corpus Check
- 137 files · ~71,201 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 868 nodes · 1704 edges · 51 communities (38 shown, 13 thin omitted)
- Extraction: 88% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.88)
- Token cost: 719,760 input · 0 output

## Community Hubs (Navigation)
- Agente de impresion Python
- API admin y cuadre
- Ticketing ESC/POS del agente
- Rutas API de ordenes
- Cola de trabajos de impresion
- Documentacion de arquitectura POS
- Configuracion de despliegue
- Config TypeScript raiz
- Admin productos y reportes
- Cobro y cuadre de caja
- Pantallas de ordenes
- Renderizado de comanda servidor
- Creacion de orden y numeracion diaria
- Modificacion de items de orden
- Decisiones y riesgos operativos
- Dependencias del print-agent
- Tooling de lint y estilos
- Dependencias runtime Next.js
- Esquema baseline de impresion
- Panel admin y detalle de orden
- Carga y cobro en clientes
- Scripts npm del proyecto
- SSE y cortesias
- tsconfig del print-agent
- Esquema de items y productos
- Autoria y aprobacion de ordenes
- Esquema de orden y pagos
- Historial y stock (esquema)
- Mesas y numero diario
- Flujo de aprobacion por stock
- Timeline de historial
- Layout raiz de Next.js
- Manifiesto package raiz
- Script sembrar bebidas
- Script actualizar tiempos
- Logo de marca Camarones Louisiana
- Script actualizar admin
- Iconos de documento
- Icono de globo
- Icono de ventana
- Config de ESLint
- Script install.sh
- Config de Next.js
- Deuda de impresion directa
- Config de PostCSS
- Instalador Ubuntu (Python)
- Instalador Ubuntu (Node)
- Logo de Vercel
- Logo de Next.js

## God Nodes (most connected - your core abstractions)
1. `Table Orden` - 30 edges
2. `NivelPicante` - 21 edges
3. `POST /api/ordenes (crear orden)` - 20 edges
4. `enqueueOrderPrintJob()` - 17 edges
5. `lines_for_payload()` - 17 edges
6. `PrintWorker` - 17 edges
7. `buildOrderTicketLines()` - 16 edges
8. `Worker` - 16 edges
9. `compilerOptions` - 16 edges
10. `obtenerEtiquetaNivelPicante()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `DetalleOrdenModal` --semantically_similar_to--> `buildAmountLines()`  [INFERRED] [semantically similar]
  components/admin/DetalleOrdenModal.tsx → lib/printer.ts
- `encode_ticket_lines()` --semantically_similar_to--> `encodeTicketLines`  [INFERRED] [semantically similar]
  print-agent-python/agent.py → print-agent/src/printer.ts
- `build_esc_pos_ticket()` --semantically_similar_to--> `buildEscPosTicket`  [INFERRED] [semantically similar]
  print-agent-python/agent.py → print-agent/src/printer.ts
- `send_to_printer()` --semantically_similar_to--> `sendToPrinter (TCP 9100)`  [INFERRED] [semantically similar]
  print-agent-python/agent.py → print-agent/src/printer.ts
- `Formato de comanda termica 80 mm / 42 caracteres` --shares_data_with--> `NIVELES_PICANTE`  [INFERRED]
  public/plantilla-impresiones.html → types/orden.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Flujo de impresion confiable: cola, agente, leases, ventana y API** — printing_implementation_plan_print_queue, printing_implementation_plan_print_agent, printing_implementation_plan_lease_dedupe, printing_implementation_plan_five_minute_window, printing_implementation_plan_agent_api, printing_implementation_plan_payload_snapshot [EXTRACTED 1.00]
- **Patron de type guards sobre listas const del dominio** — types_orden_esmetodopago, types_orden_esnivelpicante, types_orden_escategoriacombo, types_usuario_esrol [INFERRED 0.85]
- **Regla de liquidacion del envio con el motorizado** — types_orden_calcularliquidaciondomicilio, types_cuadre_calcularresumencuadre, public_plantilla_impresiones_ticket_80mm, types_cuadre_resumencuadre [INFERRED 0.85]
- **Patron de guarda optimista con error 409 por conflicto** — app_api_ordenes_route_stockconflicterror, app_api_ordenes_id_cobrar_route_paymentconflicterror, app_api_ordenes_aprobacion_aprobar_route_approvalconflicterror, app_api_ordenes_id_items_route_modificationrequesterror, concept_control_optimista_revision [INFERRED 0.85]
- **Ciclo de vida del trabajo de impresion (encolar, reclamar, completar/fallar, heartbeat)** — app_api_ordenes_route_post, app_api_ordenes_id_items_route_patch, app_api_ordenes_aprobacion_aprobar_route_post, app_api_print_agent_claim_route_post, app_api_print_agent_jobs_id_complete_route_post, app_api_print_agent_jobs_id_fail_route_post, app_api_print_agent_heartbeat_route_post, concept_cola_impresion_lease [INFERRED 0.85]
- **Flujo de aprobacion de ordenes sin stock** — app_api_ordenes_route_post, app_api_ordenes_aprobacion_pendientes_route_get, app_api_ordenes_aprobacion_aprobar_route_post, app_admin_page_aprobarorden, app_admin_page_cargarordenespendientes [INFERRED 0.85]
- **Ciclo de vida del trabajo de impresión (encolar, arrendar, completar, reintentar)** — lib_print_jobs_enqueueorderprintjob, lib_print_jobs_cantransitionprintjob, lib_print_agent_jobs_claimnextprintjob, lib_print_agent_jobs_completeprintjob, lib_print_agent_jobs_failprintjob [INFERRED 0.95]
- **Pipeline de renderizado del ticket (orden -> snapshot -> líneas -> impresora)** — lib_print_jobs_buildordersnapshot, lib_print_jobs_buildorderprintpayload, lib_printer_buildorderticketlines, lib_printer_buildamountlines, lib_printer_printerservice [INFERRED 0.85]
- **Patrón CRUD del panel admin (listado + modal + formulario + validación)** — components_admin_gestionmenu_gestionmenu, components_admin_modalformulario_modalformulario, components_admin_formularioproducto_formularioproducto, components_admin_formulariousuario_formulariousuario, lib_admin_validaciones_ejecutar [INFERRED 0.85]
- **Stack de CRUD de productos en el panel admin** — docs_superpowers_plans_2026_08_01_admin_menu_usuarios_capa_validacion_pura, docs_superpowers_plans_2026_08_01_admin_menu_usuarios_parametro_vista_admin, docs_superpowers_plans_2026_08_01_admin_menu_usuarios_shell_pestanas_productos, docs_superpowers_plans_2026_08_01_admin_menu_usuarios_modal_formulario_reutilizable, docs_superpowers_plans_2026_08_01_admin_menu_usuarios_sin_borrado_fisico [EXTRACTED 1.00]
- **Puesta en marcha y depuración del agente de impresión** — graphify_out_memory_query_20260801_190046_ahora_si_voy_a_implementar_el_agente_en_mi_cpu_di_archivos_a_modificar_agente, graphify_out_memory_query_20260801_190538_pero_el_agente_no_lo_tengo_que_instalar_o_algo_instalacion_agente_ubuntu, graphify_out_memory_query_20260801_200757_me_dice_que_configure_el_env_anrtes_de_iniciar_p_configuracion_env_amplify, graphify_out_memory_query_20260801_204341_acabo_de_crear_dos_ordenes_pero_no_me_funciona_diagnostico_por_logs, graphify_out_memory_query_20260801_205721_pero_no_imprime_nada_jaja_creo_que_falta_el_agente_revision_agente_python, graphify_out_memory_query_20260801_210009_o_sea_ya_se_conecto_bien_fue_un_error_mio_al_pone_ticket_en_blanco, docs_superpowers_specs_scr_prueba_conectividad_impresora [INFERRED 0.85]
- **Evolución del cuadre de caja diario** — graphify_out_memory_query_20260801_223231_quiero_implementar_un_cuadro_de_caja_diario_en_el_cuadre_caja_diario, memory_query_20260801_224232_quiero_que_el_cuadre_muestre_tambien_las_ordenes_n_cuadre_ordenes_no_cobradas, graphify_out_memory_query_20260801_223231_quiero_implementar_un_cuadro_de_caja_diario_en_el_liquidacion_motorizados, graphify_out_memory_query_20260801_223231_quiero_implementar_un_cuadro_de_caja_diario_en_el_trazabilidad_creador_orden, memory_query_20260801_224232_quiero_que_el_cuadre_muestre_tambien_las_ordenes_n_pendiente_no_es_caja [EXTRACTED 1.00]
- **Flujo claim -> imprimir -> confirmar de un trabajo de impresion** — print_agent_src_worker_printworker, print_agent_src_api_client_printagentapiclient, print_agent_src_printer_sendtoprinter, print_agent_src_types_claimedprintjob, concept_at_least_once_job_delivery [EXTRACTED 1.00]
- **Pipeline de renderizado de la comanda ESC/POS** — print_agent_src_printer_buildescposticket, print_agent_src_printer_linesforpayload, print_agent_src_printer_encodeticketlines, print_agent_src_logo_loadlogoraster, print_agent_src_logo_encodeescposraster, concept_escpos_ticket_layout [EXTRACTED 1.00]
- **Rollout DRY_RUN -> cutover de impresion** — concept_dry_run_mode, concept_print_cutover, print_agent_readme_agente_impresion_ubuntu, print_agent_python_readme_agente_impresion_python, concept_systemd_service_deployment [INFERRED 0.85]
- **Printing subsystem schema (queue, agent, order print state)** — prisma_migrations_20260731235900_baseline_current_migration_printjob, prisma_migrations_20260731235900_baseline_current_migration_printagent, prisma_migrations_20260731235900_baseline_current_migration_printjobtype, prisma_migrations_20260731235900_baseline_current_migration_printjobstatus, prisma_migrations_20260731235900_baseline_current_migration_orden_impresa, prisma_migrations_20260731235900_baseline_current_migration_orden_printrevision, prisma_migrations_20260731235900_baseline_current_migration_printjob_dedupekey_key, prisma_migrations_20260731235900_baseline_current_migration_printjob_status_availableat_idx, prisma_migrations_20260731235900_baseline_current_migration_printjob_leaseexpiresat_idx [EXTRACTED 1.00]
- **Order lifecycle tables (order, lines, catalog, audit, daily counter)** — prisma_migrations_20260731235900_baseline_current_migration_orden, prisma_migrations_20260731235900_baseline_current_migration_item, prisma_migrations_20260731235900_baseline_current_migration_producto, prisma_migrations_20260731235900_baseline_current_migration_historialorden, prisma_migrations_20260801010000_add_daily_order_number_migration_contadorordendiaria, prisma_migrations_20260731235900_baseline_current_migration_mesa [INFERRED 0.95]
- **Order authorship and authorization columns linked to Usuario** — prisma_migrations_20260801040000_add_order_creator_migration_orden_creadorid, prisma_migrations_20260801040000_add_order_creator_migration_orden_creadorrol, prisma_migrations_20260801040000_add_order_creator_migration_orden_creadorid_fkey, prisma_migrations_20260801040000_add_order_creator_migration_orden_creadorid_idx, prisma_migrations_20260731235900_baseline_current_migration_orden_mesero, prisma_migrations_20260731235900_baseline_current_migration_orden_aprobadaporid, prisma_migrations_20260731235900_baseline_current_migration_usuario [EXTRACTED 1.00]
- **Restaurant Order Lifecycle** — project_structure_waiter_order_interface, project_structure_order_api, project_structure_prisma_data_model, project_structure_thermal_printer_service, project_structure_kitchen_order_monitor [EXTRACTED 1.00]

## Communities (51 total, 13 thin omitted)

### Community 0 - "Agente de impresion Python"
Cohesion: 0.05
Nodes (50): Validacion estricta de configuracion del agente, Heartbeat de salud del agente e impresora, Entrega at-least-once de trabajos de impresion, Ventana horaria de polling (12:00-21:00 America/Guayaquil), Exception, object, restaurant-print-agent package manifest, ApiClient (+42 more)

### Community 1 - "API admin y cuadre"
Cohesion: 0.06
Nodes (62): AdminPage.cargarOrdenes, UsuariosPage.alternarActivo, obtenerUsuarios, UsuariosPage, GET /api/admin/cuadre, obtenerRangoEcuador, PATCH /api/productos/[id] (colisiona con /api/usuarios/[id]), GET /api/productos (+54 more)

### Community 2 - "Ticketing ESC/POS del agente"
Cohesion: 0.07
Nodes (58): Ticket de modificacion por deltas, Liquidacion de domicilio segun modalidad de pago, Modo DRY_RUN del agente de impresion, Formato de comanda ESC/POS de 42 columnas, Rasterizado del logo con umbral de gris 128, Cutover de impresion directa a cola, Compatibilidad Python 3.6 / Linux i386, Despliegue como servicio systemd restaurant-print-agent (+50 more)

### Community 3 - "Rutas API de ordenes"
Cohesion: 0.07
Nodes (34): DatosDespuesJson, EstadisticaMesero, ItemAfectadoJson, POST /api/print-agent/claim, optionalText, POST /api/print-agent/heartbeat, POST /api/print-agent/jobs/[id]/complete, POST /api/print-agent/jobs/[id]/fail (+26 more)

### Community 4 - "Cola de trabajos de impresion"
Cohesion: 0.09
Nodes (51): AmendmentAction, AmendmentPayloadOptions, AmendmentPrintPayload, assertNonNegativeInteger(), assertNonZeroInteger(), assertOptionalNonNegativeInteger(), assertPositiveInteger(), assertPrintJobTransition() (+43 more)

### Community 5 - "Documentacion de arquitectura POS"
Cohesion: 0.09
Nodes (33): Project Structure Documentation, Kitchen Order Monitor, Order API, Waiter-to-Kitchen Order Lifecycle, Planned POS Modules, Prisma Data Model, Restaurant POS Architecture, Thermal Printer Service (+25 more)

### Community 6 - "Configuracion de despliegue"
Cohesion: 0.08
Nodes (27): Configuracion de arranque restaurant-pos (npm run dev, puerto 3000), Allowlist de permisos Bash del proyecto, Pipeline de build de Amplify, Script npm db:reset:preprod, Pin de Next.js 16.0.6 en la app raiz, Script npm seed (ts-node prisma/seed.ts), Baseline 20260731235900_baseline_current, Procedimiento de reset unico de preproduccion (+19 more)

### Community 7 - "Config TypeScript raiz"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 8 - "Admin productos y reportes"
Cohesion: 0.09
Nodes (22): Pestana, ProductosPage (admin tabs Stock/Menu), Cortesia, Estadisticas, ReporteCortesias, ReportesPage(), Props, GestionMenu (+14 more)

### Community 9 - "Cobro y cuadre de caja"
Cohesion: 0.14
Nodes (17): cobradaSinMetodoLegado, pagadaPeroAunEnPreparacion, resumen, sinErrorDePuntoFlotante, aCentavos(), aDolares(), calcularResumenCuadre(), OrdenParaCuadre (+9 more)

### Community 10 - "Pantallas de ordenes"
Cohesion: 0.13
Nodes (18): Item, Notificacion, Orden, Producto, Orden, Orden, EstadoTiempo, Item (+10 more)

### Community 11 - "Renderizado de comanda servidor"
Cohesion: 0.16
Nodes (21): run (pruebas de cuadre), amountLine(), ascii(), buildAmountLines(), buildOrderTicketLines(), centered(), DEFAULT_LOGO_PATH, ItemComanda (+13 more)

### Community 12 - "Creacion de orden y numeracion diaria"
Cohesion: 0.16
Nodes (14): POST /api/ordenes (crear orden), StockConflictError, Cola de impresion con lease por agente, Control optimista de concurrencia por printRevision, allocateDailyOrderNumber(), DailyOrderNumber, DailyOrderNumberTransaction, getOrderDateKey() (+6 more)

### Community 13 - "Modificacion de items de orden"
Cohesion: 0.16
Nodes (18): HistoryRecord, ItemChange, ModificationRequest, ModificationRequestError, PATCH /api/ordenes/[id]/items (modificar items), validateRequest, CrearOrden, Producto (+10 more)

### Community 14 - "Decisiones y riesgos operativos"
Cohesion: 0.11
Nodes (21): Sin borrado físico (desactivación lógica), Contraseñas en texto plano y rutas /api públicas, Prueba de conectividad TCP a la impresora térmica (9100), Auditoría de la edición de órdenes y reimpresión parcial, Ticket AMENDMENT con revisión y número diario, Bloqueo optimista por revisión esperada en edición y cobro, Implementación: revisión esperada, bloqueo de cobradas y delta monetario, Archivos a modificar para desplegar el agente de impresión (+13 more)

### Community 15 - "Dependencias del print-agent"
Cohesion: 0.10
Nodes (19): pngjs, dependencies, pngjs, devDependencies, @types/node, @types/pngjs, typescript, @types/node (+11 more)

### Community 16 - "Tooling de lint y estilos"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, ts-node (+11 more)

### Community 17 - "Dependencias runtime Next.js"
Cohesion: 0.11
Nodes (19): next, node-thermal-printer, dependencies, next, node-thermal-printer, pg, prisma, @prisma/adapter-pg (+11 more)

### Community 18 - "Esquema baseline de impresion"
Cohesion: 0.14
Nodes (18): Baseline Migration (full schema snapshot), Orden.impresa, Table PrintAgent (printer heartbeat), PrintAgent.lastSeenAt / printerReachable / lastPrinterCheckAt, Index PrintAgent_lastSeenAt_idx, Table PrintJob (print queue), PrintJob.dedupeKey (idempotency key), Unique index PrintJob_dedupeKey_key (+10 more)

### Community 19 - "Panel admin y detalle de orden"
Cohesion: 0.20
Nodes (14): AdminPage, obtenerFechaEcuador, obtenerTituloOrden, Orden, DetalleOrdenModal, DetalleOrdenModalProps, ESTADOS_EDITABLES, ItemOrden (+6 more)

### Community 20 - "Carga y cobro en clientes"
Cohesion: 0.18
Nodes (15): AdminPage.cobrarOrden, PATCH /api/ordenes/[id]/cobrar, GET /api/ordenes, CocinaPage.cargarOrdenes, CocinaPage, CocinaPage.reproducirSonido (Web Audio beep), DigitalPage.cargarOrdenes, DigitalPage.cobrarOrden (+7 more)

### Community 21 - "Scripts npm del proyecto"
Cohesion: 0.13
Nodes (15): scripts, build, db:reset:preprod, dev, lint, postinstall, seed, start (+7 more)

### Community 22 - "SSE y cortesias"
Cohesion: 0.20
Nodes (9): encoder, ESTADOS_EDITABLES, POST(), eliminarCliente(), encoder, globalForSSE, notificarClientes(), registrarCliente() (+1 more)

### Community 23 - "tsconfig del print-agent"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 24 - "Esquema de items y productos"
Cohesion: 0.23
Nodes (12): Table Item (order line), Item.esCortesia / adminCortesia, FK Item_ordenId_fkey -> Orden (CASCADE), FK Item_productoId_fkey -> Producto (RESTRICT), Item.cantidad / precioUnitario / subtotal, Table Producto, Producto.categoria, Migration add_nivel_picante (order-level) (+4 more)

### Community 25 - "Autoria y aprobacion de ordenes"
Cohesion: 0.24
Nodes (11): Orden.aprobadaPorId / razonAprobacion, FK Orden_aprobadaPorId_fkey -> Usuario (SET NULL), Orden.cobrada / fechaCobro / cobradaPor, Orden.mesero (legacy creator name), Table Usuario, Usuario.rol, Backfill UPDATE Orden creador from Usuario by name match, Orden.creadorId (+3 more)

### Community 26 - "Esquema de orden y pagos"
Cohesion: 0.27
Nodes (10): Table Orden, Orden.costoEnvio / recargo, Orden.estado (pendiente por defecto), Orden.metodoPago (cobro efectivo), Orden.printRevision, Orden.tipoOrden (local / domicilio), PrintJob.revision / payloadVersion, Migration add_metodo_pago_previsto (+2 more)

### Community 27 - "Historial y stock (esquema)"
Cohesion: 0.25
Nodes (8): Table HistorialOrden (audit log), Index HistorialOrden_createdAt_idx, HistorialOrden.datosAntes / datosDespues / itemAfectado (JSONB), FK HistorialOrden_ordenId_fkey -> Orden (CASCADE), Index HistorialOrden_ordenId_idx, Orden.sinStock / itemsSinStock, PrintJob.payload (JSONB ticket snapshot), Producto.stock / stockMinimo

### Community 28 - "Mesas y numero diario"
Cohesion: 0.29
Nodes (8): Table Mesa, Unique index Mesa_numero_key, Orden.numeroMesa, Migration add_daily_order_number, Table ContadorOrdenDiaria (daily counter, PK fecha), Concept: visible daily order number vs technical cuid, Unique index Orden_fechaNumeroDiario_numeroDiario_key, Orden.numeroDiario / fechaNumeroDiario

### Community 29 - "Flujo de aprobacion por stock"
Cohesion: 0.33
Nodes (7): AdminPage.aprobarOrden, AdminPage.cargarOrdenesPendientes, AdminPage.rechazarOrden, ApprovalConflictError, POST /api/ordenes/aprobacion/aprobar, GET /api/ordenes/aprobacion/pendientes, PaymentConflictError

### Community 30 - "Timeline de historial"
Cohesion: 0.33
Nodes (4): DatosHistorial, HistorialItem, HistorialOrdenTimelineProps, ItemAfectado

### Community 33 - "Manifiesto package raiz"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 36 - "Logo de marca Camarones Louisiana"
Cohesion: 1.00
Nodes (3): Camarones Louisiana Logo (print-agent copy) - circular badge with red shrimp, 'CAMARONES LOUISIANA' arched top, 'SEA FOOD BOIL' arched bottom, red 'cuenca' tag; embedded by the thermal print agent onto receipt headers, Camarones Louisiana brand identity - single restaurant logotype (shrimp seal, Cuenca location mark) duplicated across the print and web delivery channels of the POS, Camarones Louisiana Logo (public web copy) - byte-identical duplicate of the print-agent logo, served as a static asset from public/assets for the web POS UI

### Community 38 - "Iconos de documento"
Cohesion: 0.67
Nodes (3): Generic Document File Icon, Folded Document Corner, Document Text Lines

### Community 39 - "Icono de globo"
Cohesion: 0.67
Nodes (3): Globe Icon, Latitude and Longitude Grid, World / Global

### Community 40 - "Icono de ventana"
Cohesion: 0.67
Nodes (3): Browser or Application Window, Application Window Icon, Three Window Controls

## Ambiguous Edges - Review These
- `PATCH /api/productos/[id] (colisiona con /api/usuarios/[id])` → `UsuariosPage.alternarActivo`  [AMBIGUOUS]
  app/admin/usuarios/page.tsx · relation: references
- `DetalleOrdenModal` → `EditarOrdenModal`  [AMBIGUOUS]
  components/mesero/EditarOrdenModal.tsx · relation: conceptually_related_to
- `loadLogoRaster (pngjs)` → `restaurant-print-agent package manifest`  [AMBIGUOUS]
  print-agent/package.json · relation: references
- `Orden.cobrada / fechaCobro / cobradaPor` → `Table Usuario`  [AMBIGUOUS]
  prisma/migrations/20260731235900_baseline_current/migration.sql · relation: conceptually_related_to
- `PrintJob lease columns (workerId, leasedAt, leaseExpiresAt)` → `Table PrintAgent (printer heartbeat)`  [AMBIGUOUS]
  prisma/migrations/20260731235900_baseline_current/migration.sql · relation: shares_data_with
- `Camarones Louisiana Logo (print-agent copy) - circular badge with red shrimp, 'CAMARONES LOUISIANA' arched top, 'SEA FOOD BOIL' arched bottom, red 'cuenca' tag; embedded by the thermal print agent onto receipt headers` → `Camarones Louisiana brand identity - single restaurant logotype (shrimp seal, Cuenca location mark) duplicated across the print and web delivery channels of the POS`  [AMBIGUOUS]
  print-agent/assets/logo-camarones-louisiana.png · relation: rationale_for

## Knowledge Gaps
- **214 isolated node(s):** `Estadisticas`, `Cortesia`, `ReporteCortesias`, `DatosDespuesJson`, `ItemAfectadoJson` (+209 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `PATCH /api/productos/[id] (colisiona con /api/usuarios/[id])` and `UsuariosPage.alternarActivo`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `DetalleOrdenModal` and `EditarOrdenModal`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `loadLogoRaster (pngjs)` and `restaurant-print-agent package manifest`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Orden.cobrada / fechaCobro / cobradaPor` and `Table Usuario`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `PrintJob lease columns (workerId, leasedAt, leaseExpiresAt)` and `Table PrintAgent (printer heartbeat)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Camarones Louisiana Logo (print-agent copy) - circular badge with red shrimp, 'CAMARONES LOUISIANA' arched top, 'SEA FOOD BOIL' arched bottom, red 'cuenca' tag; embedded by the thermal print agent onto receipt headers` and `Camarones Louisiana brand identity - single restaurant logotype (shrimp seal, Cuenca location mark) duplicated across the print and web delivery channels of the POS`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `dependencies` connect `Dependencias runtime Next.js` to `Manifiesto package raiz`, `Rutas API de ordenes`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._