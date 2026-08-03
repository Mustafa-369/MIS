# AOP Walking Skeleton

Manufacturing Intelligence Systems — minimal end-to-end slice: React client
→ Express API → MySQL, proving the whole stack is wired up before real
features get built.

## Structure

- `client/` — Vite + React single screen that calls `/api/health`.
- `server/` — Express server (ES modules, Node 22) with a `mysql2/promise`
  connection pool. Serves the built client and exposes `GET /api/health`.
- `db/init.sql` — creates the `aop` database and a seeded `health_check` table.
- `scripts/deploy-trial.sh` — idempotent trial deploy: provisions MySQL,
  installs deps, builds the client, and runs the server under PM2.

## Local setup

```bash
cp .env.example .env   # then edit DB_PASSWORD etc.
npm install --prefix server
npm install --prefix client
mysql -u root -p < db/init.sql
npm run build --prefix client
npm start --prefix server
```

Visit `http://localhost:3000`.

## Trial server deploy

On a fresh server, as root, from the repo root:

```bash
sudo ./scripts/deploy-trial.sh
```

This generates `.env` (if missing), provisions the database/user, installs
and builds both apps, and starts the server under PM2 as `aop`.
