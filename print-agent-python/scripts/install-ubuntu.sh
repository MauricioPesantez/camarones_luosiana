#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este instalador con sudo." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.6 o superior debe estar instalado." >&2
  exit 1
fi

if ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 6) else 1)'; then
  echo "Se requiere Python 3.6 o superior." >&2
  exit 1
fi

if ! python3 -c 'from PIL import Image' >/dev/null 2>&1; then
  apt-get update
  apt-get install -y python3-pil
fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/restaurant-print-agent-python"
SERVICE_FILE="/etc/systemd/system/restaurant-print-agent.service"
ENV_FILE="/etc/restaurant-print-agent.env"
LOGO_SOURCE="${SOURCE_DIR}/../print-agent/assets/logo-camarones-louisiana.png"

if [[ ! -f "${LOGO_SOURCE}" ]]; then
  echo "No se encontro el logo en ${LOGO_SOURCE}." >&2
  exit 1
fi

id -u restaurant-print >/dev/null 2>&1 || useradd --system --home-dir "${INSTALL_DIR}" --shell /usr/sbin/nologin restaurant-print
systemctl stop restaurant-print-agent.service 2>/dev/null || true

install -d -o restaurant-print -g restaurant-print "${INSTALL_DIR}" "${INSTALL_DIR}/assets"
install -m 0755 -o restaurant-print -g restaurant-print "${SOURCE_DIR}/agent.py" "${INSTALL_DIR}/agent.py"
install -m 0644 -o restaurant-print -g restaurant-print "${LOGO_SOURCE}" "${INSTALL_DIR}/assets/logo-camarones-louisiana.png"
install -m 0644 "${SOURCE_DIR}/systemd/restaurant-print-agent.service" "${SERVICE_FILE}"

if [[ ! -f "${ENV_FILE}" ]]; then
  install -m 0600 -o root -g root "${SOURCE_DIR}/restaurant-print-agent.env.example" "${ENV_FILE}"
  echo "Configura ${ENV_FILE} antes de iniciar el servicio. DRY_RUN permanece activo."
fi

systemctl daemon-reload
systemctl enable restaurant-print-agent.service
echo "Instalado. Edita ${ENV_FILE} y luego inicia con: sudo systemctl start restaurant-print-agent"
