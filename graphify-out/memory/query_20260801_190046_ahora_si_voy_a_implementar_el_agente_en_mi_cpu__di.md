---
type: "query"
date: "2026-08-01T19:00:46.395133+00:00"
question: "ahora si voy a implementar el agente en mi cpu. Dime exactamente que archivos tengo que modificar"
contributor: "graphify"
source_nodes: ["Environment Variable Configuration", "PrinterService", "install.sh", "Thermal Printer Network Setup"]
---

# Q: ahora si voy a implementar el agente en mi cpu. Dime exactamente que archivos tengo que modificar

## Answer

Expanded from original query via vocab: [print, printer, config, configuration, env, environment, install, local, logo, auth, api, service]. Para Ubuntu, el unico archivo operativo que se edita en la CPU es /etc/restaurant-print-agent.env, creado por print-agent/scripts/install-ubuntu.sh. Debe contener API_BASE_URL, un PRINT_AGENT_TOKEN nuevo compartido con Amplify, WORKER_ID, PRINTER_IP, PRINTER_PORT y los ajustes de dry run, horarios e intervalos. En Amplify se configuran variables, no se modifica codigo: PRINT_AGENT_TOKEN, PRINT_QUEUE_ENABLED, DIRECT_PRINT_ENABLED, PRINT_CUTOVER_AT, PRINT_AUTO_WINDOW_MINUTES y PRINT_LEASE_SECONDS. El archivo print-agent/.env.example parece contener una credencial real y debe sanearse con placeholders y rotarse. No hay que editar los archivos src, el servicio systemd ni los endpoints para una instalacion Ubuntu estandar.

## Source Nodes

- Environment Variable Configuration
- PrinterService
- install.sh
- Thermal Printer Network Setup