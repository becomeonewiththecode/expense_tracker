# Expense Tracker

**Docs:** [User guide](./docs/USER_GUIDE.md) · [Architecture](./docs/ARCHITECTURE.md) · [**Architecture diagrams**](./docs/ARCHITECTURE_DIAGRAM.md) · [PM2 / controlling apps](./docs/HOWTO_CONTROLLING_APPLICATIONS.md)

Full-stack app: **React + Tailwind + Recharts + React Router + Axios** on the client; **Express + PostgreSQL + JWT + Redis** on the server, with a **cron job** that writes **monthly summary** rows.

## Prerequisites

- Node.js 20+
- Docker (optional, for Postgres + Redis)

## Database & cache

```bash
docker compose up -d
```

Copy `server/.env.example` to `server/.env` and adjust if needed. Default URL matches Docker Compose:

- `DATABASE_URL=postgresql://expense:expense@localhost:5432/expense_tracker`
- `REDIS_URL=redis://localhost:6379`
- `JWT_SECRET` — on first startup, if it’s missing, shorter than 16 characters, or still the `change-me…` placeholder from the example, the server **generates a random secret and writes it** to `server/.env` so it stays stable across restarts. You can also set it yourself (e.g. `openssl rand -base64 32`).

## Run with PM2 (optional)

From the **repository root** (install dependencies in `server/`, `client/`, and `.` first):

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
npm run pm2:start
```

This starts **expense-api** (Express, watches `server/src`) and **expense-client** (`vite dev`). Logs go to `logs/`.

| Command | Purpose |
|--------|---------|
| `npm run pm2:start` | Start both apps |
| `npm run pm2:stop` | Stop both |
| `npm run pm2:restart` | Hard restart both |
| `npm run pm2:reload` | Zero-downtime reload (cluster mode not used here ≈ restart) |
| `npm run pm2:delete` | Remove apps from PM2 |
| `npm run pm2:logs` | Stream logs |
| `npm run rebuild` | Restart both after code changes (same as `pm2 restart ecosystem.config.cjs`) |
| `npm run rebuild:client` | Production build of client + restart Vite process |

Ensure `server/.env` exists and Docker (Postgres/Redis) is up before starting.

**“Process not found”** means nothing named `expense-api` is in PM2 yet — run `npm run pm2:start` once from the repo root.

**CLI vs daemon version mismatch** (`Use pm2 update`): from the repo root run `npx pm2 update`, or install deps so CLI matches: `npm install` then use `npx pm2` for all commands.

## API (without PM2)

```bash
cd server
npm install
npm run dev
```

Tables are created on startup. Endpoints:

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET|POST /api/expenses`, `GET|PATCH|DELETE /api/expenses/:id`
- `POST /api/imports` (multipart `file` + `financial_institution`, `frequency`, optional `payment_day` 1–30 or omit/empty for per-line day from the statement), `GET /api/imports/latest`, `PATCH /api/imports/rows/:id` (`category`, `frequency`, `payment_day`), `POST /api/imports/batches/:id/commit`, `DELETE /api/imports/batches/:id`
- `GET /api/reports/daily?date=YYYY-MM-DD`
- `GET /api/reports/weekly` (current week, Monday start) or `?weekStart=YYYY-MM-DD`
- `GET /api/reports/monthly?year=&month=`
- `GET /api/reports/yearly?year=`
- `GET /api/reports/range?start=&end=`
- `GET /api/reports/summaries` — persisted monthly totals from the background job

Report totals are cached in Redis (~2 minutes TTL) when `REDIS_URL` is set.

## Web app (without PM2)

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` (configure `client/.env` `API_PROXY_TARGET` if the API is not on port 4000).

With PM2, the client is started the same way (`vite dev`); use the URL PM2 prints in logs (usually `http://localhost:5173`).

## Monthly job

`node-cron` runs at **03:00 UTC on the 1st** of each month and aggregates the **previous calendar month** per user into `monthly_summaries`.

## Registration / login fails

The browser talks to the API via the Vite dev proxy (`/api` → your server). You need **both**:

1. `docker compose up -d` (Postgres + Redis)
2. `cd server && npm run dev` with a valid `server/.env` (`DATABASE_URL`, `JWT_SECRET` is auto-set if weak/missing)

If only the client is running (`npm run dev` in `client/`), sign-up will error until the server is up.

### Port 4000 already in use ("Empty reply from server")

Another app may be bound to **4000** and is not this API (`curl -v http://127.0.0.1:4000/health` connects then shows **empty reply**). The expense tracker will misbehave if Vite still proxies to 4000.

**Fix:** In `server/.env` set e.g. `PORT=4001`, then copy `client/.env.example` to `client/.env` and set `API_PROXY_TARGET=http://127.0.0.1:4001`. Restart `npm run dev` in **both** `server/` and `client/`.

To see what holds a port: `ss -tlnp | grep ':4000 '` or `lsof -iTCP:4000 -sTCP:LISTEN` (stop that service if you prefer to keep the API on 4000).
