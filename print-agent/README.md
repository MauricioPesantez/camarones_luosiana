# Agente de impresion Ubuntu

Servicio local que consulta la cola de la aplicacion por HTTPS y envia comandas ESC/POS a la impresora de cocina por TCP.

## Preparacion

1. Usa Ubuntu LTS con Node.js 20 o 22.
2. Confirma conectividad con `nc -vz 192.168.18.113 9100`.
3. Ejecuta `sudo bash scripts/install-ubuntu.sh`.
4. Edita `/etc/restaurant-print-agent.env`; usa el mismo `PRINT_AGENT_TOKEN` configurado en Amplify.
5. Mantiene `DRY_RUN=true` durante la primera validacion. En este modo se reportan heartbeats, pero no se reclaman ni imprimen trabajos.
6. Revisa con `sudo systemctl status restaurant-print-agent` y `sudo journalctl -u restaurant-print-agent -f`.
7. Para el piloto real, define el cutover, elimina la impresion directa del servidor y cambia `DRY_RUN=false`. Nunca actives ambos mecanismos de impresion al mismo tiempo.

El reclamo de trabajos se ejecuta por defecto cada 5 segundos, desde las 12:00
inclusive hasta las 21:00 sin incluir, usando `America/Guayaquil`. Se configura con
`POLL_INTERVAL_MS`, `POLL_ACTIVE_START_HOUR`, `POLL_ACTIVE_END_HOUR` y
`POLL_TIME_ZONE`. El heartbeat permanece activo fuera de ese horario para informar
si el agente y la impresora siguen disponibles.

El servicio se habilita durante la instalacion, pero no se inicia automaticamente hasta que se configure el archivo de entorno y se ejecute `sudo systemctl start restaurant-print-agent`.

## Modos de operacion

Durante las pruebas, la aplicacion mantiene `PRINT_QUEUE_ENABLED=true` y
`DIRECT_PRINT_ENABLED=true`, mientras el agente usa `DRY_RUN=true`. Asi se valida
la creacion de trabajos y el heartbeat sin imprimir dos veces.

En el cutover real se conserva `PRINT_QUEUE_ENABLED=true`, se define
`PRINT_CUTOVER_AT`, se cambia `DIRECT_PRINT_ENABLED=false` en Amplify y finalmente
`DRY_RUN=false` en Ubuntu.
