#!/usr/bin/env bash
# Idempotent trial deploy for the AOP walking skeleton.
# Run as root from the repo root: sudo ./scripts/deploy-trial.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ "$EUID" -ne 0 ]; then
  echo "This script must be run as root (try: sudo $0)" >&2
  exit 1
fi

ENV_FILE="$ROOT_DIR/.env"

# 1. Generate .env if it doesn't exist yet.
if [ ! -f "$ENV_FILE" ]; then
  echo "==> No .env found, generating one"
  DB_PASSWORD="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 24)"
  cat > "$ENV_FILE" <<EOF
DB_HOST=localhost
DB_USER=aop
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=aop
PORT=3000
EOF
  chmod 600 "$ENV_FILE"
else
  echo "==> .env already exists, reusing it"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-aop}"
DB_NAME="${DB_NAME:-aop}"
PORT="${PORT:-3000}"

# 2. Create database + user via sudo mysql, then run init.sql.
echo "==> Ensuring database and user exist"
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "==> Running db/init.sql"
sudo mysql < "$ROOT_DIR/db/init.sql"

# 3. Install dependencies.
echo "==> Installing server dependencies"
npm install --prefix "$ROOT_DIR/server"

echo "==> Installing client dependencies"
npm install --prefix "$ROOT_DIR/client"

# 4. Build the client.
echo "==> Building client"
npm run build --prefix "$ROOT_DIR/client"

# 5. Start/reload under PM2.
echo "==> Starting server under PM2"
if pm2 describe aop > /dev/null 2>&1; then
  pm2 delete aop > /dev/null 2>&1
fi
pm2 start "$ROOT_DIR/server/index.js" \
  --name aop \
  --cwd "$ROOT_DIR" \
  --node-args="--env-file=$ENV_FILE" \
  --update-env
pm2 save

# 6. Print access URL.
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -z "$IP" ]; then
  IP="$(ip route get 1 2>/dev/null | awk '{print $7; exit}')"
fi
if [ -z "$IP" ]; then
  IP="127.0.0.1"
fi

echo ""
echo "Open: http://${IP}:${PORT}"
echo "==> AOP walking skeleton deployed successfully"
