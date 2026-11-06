# Ensayo de OpenWA en Windows

Fase 0 del plan `docs/superpowers/plans/2026-11-04-whatsapp-openwa.md`. Solo se conecta a un POS si completas las secciones 5 y 6.

Usa solo datos de prueba. Las muestras enmascaran identidades y nombres, pero conservan el texto y las coordenadas: revísalas antes de compartirlas.

## 1. Preparar Windows

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

- Docker Desktop: activar **Start Docker Desktop when you sign in**.
- Windows Update: horas activas durante el horario de atención.
- BIOS/UEFI: restaurar energía al volver la luz, si existe.
- Inicio de sesión automático, si el equipo quedará dedicado. Es necesario para que Docker Desktop vuelva solo después de un reinicio, pero cualquiera con acceso físico entra sin clave.

## 2. Iniciar el ensayo

Copia esta carpeta a la computadora y abre PowerShell dentro de ella:

```powershell
New-Item -ItemType Directory -Force muestras
"WEBHOOK_SECRET=$([guid]::NewGuid().ToString('N'))" | Set-Content -Encoding ascii .env
Add-Content -Encoding ascii .env "OPENWA_API_KEY="
Add-Content -Encoding ascii .env "ENGINE_TYPE=whatsapp-web.js"
docker compose up -d
docker compose exec openwa cat /app/data/.api-key
```

Abre `.env`, pega esa clave en `OPENWA_API_KEY=` y ejecuta:

```powershell
docker compose up -d
```

## 3. Vincular el ejecutor

1. Abre `http://localhost:2785` e ingresa la clave.
2. Crea una sesión llamada `ejecutor-ensayo` e iníciala.
3. Escanea el QR desde el teléfono del ejecutor: **Ajustes → Dispositivos vinculados**.
4. Espera el estado `ready` y copia el ID de la sesión:

```powershell
$S = "ID_DE_LA_SESION"
docker compose exec receptor node ensayo.mjs webhook $S
docker compose logs -f receptor
```

Cada evento aparece en esos logs y queda guardado en `muestras/`.

## 4. Pruebas

Abre otra ventana de PowerShell para los comandos y define `$S` otra vez. Número y grupo usan el formato `593XXXXXXXXX@c.us` y `ID@g.us`; el ID del grupo aparece en el log al escribir en ese grupo.

| Paso | Prueba | Acción | Debe ocurrir |
|---|---|---|---|
| 8 | Texto y firma | Escribe `PEDIDO prueba` al ejecutor | Evento `message.received` con `type` de texto |
| 9 | Pin | Reenvía al ejecutor un pin tuyo | `type: location` con latitud y longitud |
| 9 | Filtro | Ejecuta `webhook $S --filtros` y repite el pin | El pin sigue llegando; un mensaje propio, de grupo o sticker no |
| 10 | Tiempo real | Intenta reenviar una ubicación en tiempo real | Anota si WhatsApp lo permite y qué llega |
| 11 | Envío | Usa `enviar` a tu número y al grupo | Mensaje recibido en ambos |
| 11 | Duplicado | Repite `enviar` con el mismo texto y clave | Un solo mensaje; respuesta repetida |
| 12 | Reinicio | `docker compose restart openwa` | Vuelve a `ready` sin QR |
| 12 | Windows | Reinicia Windows y simula corte de energía | Vuelve solo, sin QR |
| 13 | Corte | `docker compose stop openwa`, escribe tres mensajes y usa `docker compose start openwa` | Anota cuáles llegan |
| 14 | POS caído | `fallar`, escribe un mensaje y espera 90 s; revisa `fallos`; ejecuta `normal` y `reenviar` | Fallo registrado y luego entregado |
| 15 | Baileys | Cambia `ENGINE_TYPE=baileys`, ejecuta `docker compose up -d`, vincula de nuevo y repite 8, 9, 12 y 13 | Comparación entre motores |
| 16 | Local | Desde el número del local manda un texto y reenvía un pin | Anota si `from` usa `@c.us` o `@lid` |
| 17 | Estabilidad | Déjalo activo siete días | Sesión sin QR nuevo; memoria dentro del límite |

Comandos:

```powershell
docker compose exec receptor node ensayo.mjs webhook $S --filtros
docker compose exec receptor node ensayo.mjs enviar $S 593XXXXXXXXX@c.us "Prueba 1" prueba-1
docker compose exec receptor node ensayo.mjs fallar
docker compose exec receptor node ensayo.mjs fallos $S
docker compose exec receptor node ensayo.mjs normal
docker compose exec receptor node ensayo.mjs reenviar $S
docker stats --no-stream
```

## 5. Conectar al POS de desarrollo

Solo para pruebas con base de desarrollo. Agrega la IP del equipo del POS a `.env`, aplica el cambio y apunta el webhook:

```powershell
Add-Content -Encoding ascii .env "SSRF_ALLOWED_HOSTS=receptor,IP_DEL_POS"
docker compose up -d
docker compose exec receptor node ensayo.mjs webhook $S --filtros --url http://IP_DEL_POS:3000/api/integraciones/whatsapp/webhook
```

Para volver al receptor, ejecuta `webhook $S --filtros` sin `--url`.

## 6. Enviar respuestas desde el POS

`agente.mjs` entrega las salidas pendientes del POS. Agrega a `.env`:

```text
POS_URL=http://IP_DEL_POS:3000
WHATSAPP_AGENT_TOKEN=MISMO_TOKEN_DEL_POS
WHATSAPP_SESSION_ID=ID_DE_LA_SESION
HORARIO=10-22
```

`HORARIO` es opcional y usa la hora de Ecuador; sin él, el agente trabaja todo el día. Luego ejecuta:

```powershell
docker compose up -d
docker compose logs -f agente
```

Si la sesión no está `ready`, no reserva mensajes. Las salidas sin enviar por más de 30 minutos pasan a `REQUIERE_REVISION`, igual que los resultados inciertos. El agente nunca los reenvía por su cuenta.

## 7. Terminar

`docker compose down` detiene el ensayo y conserva la sesión. `docker compose down -v` borra la sesión y sus datos, y obliga a escanear otro QR.
