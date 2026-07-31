#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este instalador con sudo." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 o 22 debe estar instalado antes de continuar." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "Se requiere Node.js 20 o superior." >&2
  exit 1
fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/restaurant-print-agent"
SERVICE_FILE="/etc/systemd/system/restaurant-print-agent.service"
ENV_FILE="/etc/restaurant-print-agent.env"

id -u restaurant-print >/dev/null 2>&1 || useradd --system --home-dir "${INSTALL_DIR}" --shell /usr/sbin/nologin restaurant-print
install -d -o restaurant-print -g restaurant-print "${INSTALL_DIR}"
cp -R "${SOURCE_DIR}/package.json" "${SOURCE_DIR}/package-lock.json" "${SOURCE_DIR}/tsconfig.json" "${SOURCE_DIR}/src" "${INSTALL_DIR}/"
chown -R restaurant-print:restaurant-print "${INSTALL_DIR}"

cd "${INSTALL_DIR}"
npm ci
npm run build
npm prune --omit=dev

install -m 0644 "${SOURCE_DIR}/systemd/restaurant-print-agent.service" "${SERVICE_FILE}"
if [[ ! -f "${ENV_FILE}" ]]; then
  install -m 0600 -o root -g root "${SOURCE_DIR}/.env.example" "${ENV_FILE}"
  echo "Configura ${ENV_FILE} antes de iniciar el servicio. DRY_RUN permanece activo."
fi

systemctl daemon-reload
systemctl enable restaurant-print-agent.service
echo "Instalado. Inicia con: sudo systemctl start restaurant-print-agent"
