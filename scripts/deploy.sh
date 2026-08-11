#!/usr/bin/env bash
# Idempotent deploy for AOP. Run as root from the repo root: sudo ./scripts/deploy.sh
#
# Pipeline: provision DB -> install/build -> migrate -> seed -> runAudit ->
# (only if audit is green) restart PM2. Golden rule: nothing goes live unless
# runAudit passes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
cd "$ROOT_DIR"

if [ "$EUID" -ne 0 ]; then
  echo "This script must be run as root (try: sudo $0)" >&2
  exit 1
fi

ENV_FILE="$BACKEND_DIR/.env"

# 1. Generate backend/.env if it doesn't exist yet.
if [ ! -f "$ENV_FILE" ]; then
  echo "==> No backend/.env found, generating one"
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
  echo "==> backend/.env already exists, reusing it"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-aop}"
DB_NAME="${DB_NAME:-aop}"
PORT="${PORT:-3000}"

# 2. Create database + user via sudo mysql.
echo "==> Ensuring database and user exist"
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

# 3. Install dependencies.
echo "==> Installing backend dependencies"
npm install --prefix "$BACKEND_DIR"

echo "==> Installing frontend dependencies"
npm install --prefix "$FRONTEND_DIR"

# 4. Migrate, then seed.
echo "==> Running migrations"
npm run migrate --prefix "$BACKEND_DIR"

echo "==> Running seeds"
npm run seed --prefix "$BACKEND_DIR"

# 5. runAudit — the release gate. Stop here if it fails; do not touch PM2.
echo "==> Running runAudit"
if ! npm run audit --prefix "$BACKEND_DIR"; then
  echo "" >&2
  echo "==> runAudit FAILED. Not restarting PM2, not proceeding." >&2
  exit 1
fi

# 6. Build the frontend.
echo "==> Building frontend"
npm run build --prefix "$FRONTEND_DIR"

# 7. Start/reload under PM2.
echo "==> Starting backend under PM2"
if pm2 describe aop > /dev/null 2>&1; then
  pm2 delete aop > /dev/null 2>&1
fi
pm2 start "$BACKEND_DIR/src/server.js" \
  --name aop \
  --cwd "$BACKEND_DIR" \
  --node-args="--env-file=.env" \
  --update-env
pm2 save

# 8. Print access URL.
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -z "$IP" ]; then
  IP="$(ip route get 1 2>/dev/null | awk '{print $7; exit}')"
fi
if [ -z "$IP" ]; then
  IP="127.0.0.1"
fi

echo ""
echo "Open: http://${IP}:${PORT}"
echo "==> AOP deployed successfully (runAudit green)"
