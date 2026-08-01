# Agente de impresion Python para Linux i386

Alternativa al agente Node.js para computadoras de 32 bits. Reutiliza la misma
cola y los mismos endpoints HTTPS, y envia las comandas ESC/POS por TCP a la
impresora de cocina.

## Requisitos

- Ubuntu con Python 3.6 o superior.
- Acceso HTTPS al dominio de la aplicacion.
- Acceso TCP a la impresora en el puerto 9100.
- El repositorio completo, porque el instalador reutiliza el logo de
  `print-agent/assets/`.

## Instalacion

Desde la raiz del repositorio:

```bash
python3 --version
python3 -c "import socket; s=socket.create_connection(('192.168.18.113', 9100), 5); print('IMPRESORA CONECTADA'); s.close()"
sudo bash print-agent-python/scripts/install-ubuntu.sh
sudo nano /etc/restaurant-print-agent.env
```

Usa un `PRINT_AGENT_TOKEN` nuevo de al menos 32 caracteres y configura el mismo
valor en Amplify. Para la primera validacion conserva `DRY_RUN=true`.

Inicia y revisa el agente:

```bash
sudo systemctl start restaurant-print-agent
sudo systemctl status restaurant-print-agent
sudo journalctl -u restaurant-print-agent -f
```

En `DRY_RUN=true` el agente envia heartbeats y prueba la impresora, pero no
reclama trabajos. En el cutover real configura `PRINT_CUTOVER_AT`, cambia
`DIRECT_PRINT_ENABLED=false` en Amplify, despliega, cambia `DRY_RUN=false` en
Ubuntu y reinicia el servicio.

## Pruebas de desarrollo

```bash
python3 -m unittest discover -s print-agent-python -p 'test_*.py'
```
