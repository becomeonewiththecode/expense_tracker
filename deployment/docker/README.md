# Docker build images (API and web)

This directory holds **Dockerfiles** used to build container images for Expense Tracker. They are **not** a runnable stack by themselves; Compose and other tooling reference them by path.

| File | Purpose |
|------|---------|
| **`Dockerfile.api`** | Multi-stage build: install production dependencies and run the Express API (`server/`). |
| **`Dockerfile.web`** | Multi-stage build: run `npm run build` for the Vite client, then copy static assets into **nginx** with an `/api` (and `/health`) proxy to the API service. |

**Local builds:** [`../docker-compose/docker-compose-build.yml`](../docker-compose/docker-compose-build.yml) builds **api** from `Dockerfile.api` and **web** from `Dockerfile.web`. **Registry images:** [`docker-compose-prod.yml`](../docker-compose/docker-compose-prod.yml) pulls pre-tagged images (see [docker-compose/README.md](../docker-compose/README.md)).

For a higher-level map of deployment assets, see [`../README.md`](../README.md).

---

## Development environment

Typical development runs **Node.js on the host** (API + Vite) and uses Docker only for **PostgreSQL** and **Redis**.

### Option A — Docker Compose (databases only)

From the **repository root**:

```bash
docker compose up -d
```

This uses the root [`docker-compose.yml`](../../docker-compose.yml): **postgres** (port `5432`) and **redis** (port `6379`). No API or web containers are started. Containers are named **`expense-tracker-dev-postgres`** and **`expense-tracker-dev-redis`** so they do not clash with the production Compose stack on the same host.

Then:

1. Copy `server/.env.example` to `server/.env` and set **`DATABASE_URL`**, **`REDIS_URL`**, **`JWT_SECRET`**, **`CLIENT_ORIGIN`** (for example `http://localhost:5173` for Vite), and optional **`OAUTH_*`** as in the root [README.md](../../README.md).
2. Install dependencies and run the app:
   - **Manual:** `cd server && npm install && npm run dev` in one terminal; `cd client && npm install && npm run dev` in another (with `client/.env` **`API_PROXY_TARGET`** if the API is not on port 4000).
   - **PM2 (repo root):** `npm install`, then `cd server && npm install && cd ..`, `cd client && npm install && cd ..`, then `npm run pm2:start` — see [HOWTO_CONTROLLING_APPLICATIONS.md](../../docs/HOWTO_CONTROLLING_APPLICATIONS.md).

### Option B — Databases without Docker

Install PostgreSQL and Redis locally, point **`DATABASE_URL`** / **`REDIS_URL`** in `server/.env` at those services, then run the API and client as in Option A.

### Option C — Build images locally (optional)

You can verify the production Dockerfiles without starting the full stack:

```bash
docker build -f deployment/docker/Dockerfile.api --build-arg APP_VERSION=local -t expense-tracker-api:local .
docker build -f deployment/docker/Dockerfile.web --build-arg APP_VERSION=local -t expense-tracker-web:local .
```

Omit **`--build-arg APP_VERSION=...`** to use the default (**`dev`**). The value is exposed as **`GET /health`**’s **`version`** field on the API and inlined into the static web bundle (**`VITE_APP_VERSION`**).

You still need a running API URL and built client configuration for the web image to be useful on its own; the usual path is the Compose stack below.

---

## Full stack in Docker

### Build images locally (dev / QA)

```bash
npm run compose:build
```

Runs **`ensure-env.mjs`**, then **`docker-compose-build.yml`** with **`up -d --build`**.

| Script | Purpose |
|--------|---------|
| `npm run compose:ensure-env` | Only the env bootstrap (no `docker compose up`). |
| `npm run compose:build:down` / **`:logs`** / **`:ps`** | Match **`docker-compose-build.yml`**. |
| `npm run compose:prod` / **`:pull`** / **`:down`** / … | Match **`docker-compose-prod.yml`** (registry images). See [docker-compose/README.md](../docker-compose/README.md). |

### Manual Compose (build stack)

```bash
node deployment/docker-compose/ensure-env.mjs
docker compose -f deployment/docker-compose/docker-compose-build.yml --env-file deployment/docker-compose/.env up -d --build
```

Set **`CLIENT_ORIGIN`** in **`deployment/docker-compose/.env`** to the URL users use (for example `http://localhost:8080` if **`HTTP_PORT=8080`**). In production behind TLS, use `https://your-domain`.

**Detailed steps**, OAuth redirect URLs, health checks, and troubleshooting: **[`../docker-compose/README.md`](../docker-compose/README.md)**.

---

## Related documentation

- **[`../README.md`](../README.md)** — Deployment folder overview (Docker, Compose, Kubernetes).  
- **[`../docker-compose/README.md`](../docker-compose/README.md)** — Full production Compose guide.  
- **[`../../README.md`](../../README.md)** — Root prerequisites, local env vars, PM2, API surface.  
- **[`../../docs/USER_GUIDE.md`](../../docs/USER_GUIDE.md)** — End-user and operator topics (backup, OAuth, Compose JWT notes).
