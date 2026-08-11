# AOP

Manufacturing Intelligence Systems. Code follows THE BRAIN (`docs/brain/`) —
schema and behavior are derived from that locked spec, not the other way
around.

## Structure

- `frontend/` — Vite + React client (`src/features/<feature>/` per module).
- `backend/` — Express API (ES modules, Node 22), `mysql2/promise` pool.
  - `src/db/migrations/` — append-only, numbered SQL migrations. Once a
    migration has run, it is never edited; changes are new numbered files.
  - `src/db/seeds/` — seed data, applied the same way as migrations.
  - `src/modules/<name>/` — one folder per module (routes/controller/
    service/model).
  - `tests/runAudit/` — the release gate. Nothing gets committed or deployed
    unless these pass.
- `docs/brain/` — THE BRAIN, the schema/behavior source of truth.
- `scripts/deploy.sh` — idempotent deploy: provisions MySQL, installs and
  builds both apps, runs migrate → seed → runAudit, and only then restarts
  PM2.

## Local setup

```bash
cp backend/.env.example backend/.env   # then edit DB_PASSWORD etc.
npm install --prefix backend
npm install --prefix frontend
npm run migrate --prefix backend
npm run seed --prefix backend
npm run audit --prefix backend          # must pass
npm run build --prefix frontend
npm start --prefix backend
```

Visit `http://localhost:3000`.

## Deploy

On a fresh server, as root, from the repo root:

```bash
sudo ./scripts/deploy.sh
```

This generates `backend/.env` (if missing), provisions the database/user,
installs and builds both apps, runs migrations/seeds/`runAudit`, and — only
if `runAudit` is green — starts the backend under PM2 as `aop`.

## Golden rules

- Additive, never destructive.
- Migrations are append-only: never edit one that has already run.
- Nothing commits or deploys unless `runAudit` passes.
