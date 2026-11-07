# Pedidos por WhatsApp: OpenWA y agente

Manual de instalación y operación. El diseño completo está en `docs/superpowers/plans/2026-11-04-whatsapp-openwa.md`.

## 1. Cómo funciona

```text
Número del local ──pedido──▶ Número ejecutor (OpenWA, PC Windows) ──webhook──▶ POS
                                                                               │ crea la orden
Grupo de pedidos ◀── orden, cambios, anulación ──┐                             │ guarda los mensajes
Grupo Motos      ◀── MOTO para orden # ──────────┼── agente (PC Windows) ◀─────┘ por enviar
Número del local ◀── confirmación o error ───────┘
```

- **OpenWA** mantiene vinculado el número ejecutor y entrega cada mensaje al POS.
- **POS** valida el pedido y crea la orden, la impresión y los mensajes de salida en una sola operación.
- **Agente** consulta el POS cada 5 a 60 s y envía esos mensajes. Si el envío falla, reintenta con la misma clave para no duplicar. Si no sabe si el mensaje salió, no lo reenvía: lo deja en revisión.
- **Aviso de moto:** al vencer la espera (`moto N`, o 10 minutos sin esa línea), el POS pide la moto en el grupo Motos con cliente, teléfono, ubicación y monto a cobrar. Cuando el agente lo envía, la orden queda como "Delivery pedido".

## 2. Preparar el equipo Windows

Ejecuta PowerShell como administrador:

```powershell
wsl --install
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

Reinicia Windows e instala Docker Desktop desde el sitio oficial, con backend WSL2. Si Docker indica que falta virtualización, actívala en BIOS/UEFI.

Crea `%UserProfile%\.wslconfig`:

```ini
[wsl2]
memory=4GB
```

Configura además:

- **Docker Desktop:** activa **Start Docker Desktop when you sign in**.
- **Windows Update:** define horas activas que cubran el horario de atención.
- **BIOS/UEFI:** activa restaurar energía al volver la luz, si existe.
- **Inicio de sesión automático:** úsalo si el equipo será dedicado. Docker Desktop lo necesita para volver solo tras un reinicio, pero cualquiera con acceso físico podrá entrar sin clave.

## 3. Instalar desde cero

Copia esta carpeta a `C:\whatsapp-pos` con estos 4 archivos: `agente.mjs`, `openwa.mjs`, `docker-compose.yml` y este README. Abre PowerShell dentro de esa carpeta.

1. Crea `.env` con el secreto del webhook:

   ```powershell
   "WEBHOOK_SECRET=$([guid]::NewGuid().ToString('N'))$([guid]::NewGuid().ToString('N'))" | Set-Content -Encoding ascii .env
   notepad .env
   ```

2. Completa `.env`:

   ```text
   WEBHOOK_SECRET=(ya generado; el mismo valor va en WHATSAPP_WEBHOOK_SECRET del POS)
   OPENWA_API_KEY=pendiente
   ENGINE_TYPE=whatsapp-web.js
   POS_URL=https://DOMINIO_DEL_POS
   WHATSAPP_AGENT_TOKEN=(mismo valor que en el POS; genera uno de 64 caracteres)
   WHATSAPP_SESSION_ID=pendiente
   HORARIO=10-22
   ```

   `HORARIO` usa la hora de Ecuador. Fuera de ese horario, el agente no envía; sin esa línea, trabaja todo el día. Docker exige todas las variables desde el inicio: `pendiente` se reemplaza en los pasos 3 y 4.

3. Inicia OpenWA y lee su clave:

   ```powershell
   docker compose up -d
   docker compose exec openwa cat /app/data/.api-key
   ```

   Pégala en `OPENWA_API_KEY=`. Mientras tanto, el agente mostrará una sesión no lista; es esperado.

4. Vincula el número ejecutor:

   1. Abre `http://localhost:2785` e ingresa la clave.
   2. Crea una sesión, iníciala y escanea el QR desde el teléfono ejecutor: **Ajustes → Dispositivos vinculados**.
   3. Espera el estado `ready`, copia el ID de la sesión y pégalo en `WHATSAPP_SESSION_ID=`.

5. Inicia todo y conecta el webhook al POS:

   ```powershell
   docker compose up -d
   $S = "ID_DE_LA_SESION"
   docker compose exec agente node openwa.mjs webhook $S
   docker compose logs -f agente
   ```

   Debe aparecer `Sesion: ready`.

6. Agrega el número ejecutor al grupo de pedidos y al grupo Motos. Lista sus IDs:

   ```powershell
   docker compose exec agente node openwa.mjs grupos $S
   ```

   Ponlos en el POS como `WHATSAPP_GROUP_CHAT_ID` y `WHATSAPP_MOTOS_CHAT_ID`.

## 4. Pasar desde la carpeta de ensayo

Para el equipo que ya corre `C:\openwa-ensayo`. Mantiene la sesión vinculada: no se vuelve a escanear el QR.

```powershell
cd C:\openwa-ensayo
docker compose down
```

No uses `down -v`: borraría la sesión.

1. Copia `agente.mjs`, `openwa.mjs`, `docker-compose.yml` y `README.md` de esta carpeta a `C:\openwa-ensayo`, reemplazando los anteriores.
2. Borra `receptor.mjs`, `ensayo.mjs` y la carpeta `muestras`. Las muestras contienen mensajes reales de prueba.
3. Renombra la carpeta y vuelve a iniciar:

   ```powershell
   cd C:\
   Rename-Item C:\openwa-ensayo whatsapp-pos
   cd C:\whatsapp-pos
   docker compose up -d
   docker compose logs -f agente
   ```

Docker puede advertir que el volumen `openwa-ensayo_openwa-data` fue creado por otro proyecto. Es esperado: es la sesión vinculada.

## 5. Configuración del POS

Variables del POS (`.env` en desarrollo, Amplify en producción):

| Variable | Valor |
|---|---|
| `WHATSAPP_ENABLED` | `true` para crear órdenes; `false` deja cada pedido en revisión sin crear nada |
| `WHATSAPP_SESSION_ID` | ID de la sesión de OpenWA |
| `WHATSAPP_WEBHOOK_SECRET` | Mismo valor que `WEBHOOK_SECRET` del equipo Windows |
| `WHATSAPP_AGENT_TOKEN` | Mismo valor que en el equipo Windows |
| `WHATSAPP_OPERATOR_IDS` | IDs del número del local, separados por coma, por ejemplo `1357...@lid` |
| `WHATSAPP_OPERATOR_USER_ID` | Usuario `digital` del POS a nombre de quien se crean las órdenes |
| `WHATSAPP_GROUP_CHAT_ID` | Grupo de pedidos (`...@g.us`) |
| `WHATSAPP_MOTOS_CHAT_ID` | Grupo Motos (`...@g.us`) |

En producción, `POS_URL` debe usar HTTPS. En desarrollo se acepta `http://IP_LOCAL:3000`. En ese caso, agrega `SSRF_ALLOWED_HOSTS=IP_LOCAL` al `.env` del equipo Windows, para que OpenWA pueda entregar el webhook en la red local.

## 6. Operación diaria

**Panel WhatsApp (Cuadre, solo administrador).** Muestra:

- **Estado:**
  - **Agente y sesión de WhatsApp activos:** todo bien.
  - **Agente activo, sesión de WhatsApp desconectada:** el teléfono ejecutor se desvinculó o no tiene internet. Ver sección 7.
  - **Agente sin respuesta** o **sin conectar:** el equipo Windows, Docker o la red están caídos. Ver sección 7.
- **Por revisar:** mensajes que el sistema no procesó ni envió solo. Cada línea indica el motivo:
  - `VENCIDA`: pasó más de 30 minutos sin enviarse.
  - `IDEMPOTENCY_OUTCOME_UNKNOWN`: no se sabe si salió. Revisa el chat antes de reenviarlo a mano.
  - `INTENTOS_AGOTADOS`: falló 6 veces.
  - `ENTRADA_ANTIGUA`: pedido recibido tarde. No creó orden.
  - `SUSPENDIDO`: llegó con la integración apagada.

  Resuelve a mano, en el POS o en WhatsApp, y luego pulsa **Descartar**. Descartar no envía nada: solo registra quién lo revisó.

**Botón "🛵 Ya pedí la moto"** (digital y detalle de orden). Úsalo si alguien pidió la moto antes del aviso automático. Así el POS no la pide otra vez.

## 7. Recuperación

| Situación | Qué hacer |
|---|---|
| Sesión desconectada | Abre `http://localhost:2785`. Si pide QR, escanéalo con el teléfono ejecutor. El ID de sesión no cambia. |
| Agente sin respuesta | Comprueba que Docker Desktop esté abierto. Ejecuta `docker compose ps` y luego `docker compose up -d`. Revisa `docker compose logs --tail 50 agente`. |
| `POS tick 401` en logs | `WHATSAPP_AGENT_TOKEN` no coincide entre Windows y POS. |
| `POS tick 503` en logs | El POS no tiene `WHATSAPP_AGENT_TOKEN`. |
| POS caído un rato | OpenWA reintenta el webhook 5 veces. Si se agotan, lista con `docker compose exec agente node openwa.mjs fallos $S` y reenvía con `... reenviar $S`. Si llegan tarde, quedan en revisión y no crean ventas viejas. |
| Cambió un grupo | Agrega el número ejecutor al grupo nuevo, ejecuta `grupos $S`, actualiza la variable en el POS y vuelve a desplegar o reiniciar el POS. |
| Cambió el número del local | Agrega su ID (`@lid` o `@c.us`) a `WHATSAPP_OPERATOR_IDS`. El ID aparece en `docker compose logs openwa` al escribir al ejecutor. |
| Actualizar OpenWA | Ensaya primero la versión nueva. `docker-compose.yml` fija versión y digest a propósito. |

## 8. Pausar y respaldo manual

1. **Pausa inmediata:** `docker compose stop`. No entra ni sale nada; el POS sigue funcionando normal.
2. **Solo envíos:** `docker compose stop agente`. Las órdenes se crean, pero nada se envía. Al volver, lo que tenga más de 30 minutos pasa a revisión.
3. **Pausa larga:** despliega el POS con `WHATSAPP_ENABLED=false`. Los pedidos quedan en revisión y no se crean.
4. **Mientras está pausado:** registra pedidos desde el POS, publícalos y pide motos a mano. Pulsa "Ya pedí la moto".
5. **Al reactivar:** revisa el panel antes de reenviar nada. Nunca vuelvas a crear una orden solo porque faltó la respuesta: busca primero si ya existe en el POS.

## 9. Respaldo y restauración de la sesión

El respaldo contiene la sesión de WhatsApp. Quien lo tenga puede usar el número ejecutor: guárdalo fuera del equipo y sin compartirlo.

```powershell
docker compose stop openwa
docker run --rm -v openwa-ensayo_openwa-data:/datos -v ${PWD}:/respaldo alpine tar czf /respaldo/openwa-respaldo.tgz -C /datos .
docker compose start openwa
```

Restaurar (borra la sesión actual del equipo):

```powershell
docker compose down
docker volume rm openwa-ensayo_openwa-data
docker volume create openwa-ensayo_openwa-data
docker run --rm -v openwa-ensayo_openwa-data:/datos -v ${PWD}:/respaldo alpine tar xzf /respaldo/openwa-respaldo.tgz -C /datos
docker compose up -d
```

Después de restaurar, el panel no debe mostrar mensajes duplicados. Las claves de envío viven en el POS; OpenWA las recuerda solo 24 horas.

## 10. Pruebas del equipo antes de producción

| Prueba | Acción | Debe ocurrir |
|---|---|---|
| Reinicio | Reinicia Windows | Vuelve `Sesion: ready` sin QR; panel activo en menos de 5 minutos |
| Corte de luz | Desconecta la energía y vuelve a conectarla | Igual que reinicio |
| Corte de internet | Desconecta la red 5 minutos y envía un pedido | Al volver, el pedido entra o queda en revisión; no se duplica |
| Restauración | Respalda, restaura y envía un pedido | Sin QR nuevo y sin mensajes duplicados |
| Estabilidad | Siete días encendido | Sin QR nuevo; `docker stats --no-stream` con OpenWA bajo 2 GB |
| Privacidad | `docker compose logs openwa \| Select-String "593"` | Anota si OpenWA registra teléfonos o textos |
