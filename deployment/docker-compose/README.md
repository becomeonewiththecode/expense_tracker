# Deploy with Docker Compose

This directory contains a **production-style** Compose file that runs:

1. **PostgreSQL** — application database (persistent volume).
2. **Redis** — optional report cache (persistent append-only file).
3. **api** — Express API built from `deployment/docker/Dockerfile.api`.
4. **web** — nginx serving the Vite production build from `deployment/docker/Dockerfile.web`, proxying `/api` to **api**.

The root `docker-compose.yml` (repository root) only starts PostgreSQL and Redis for **local development**. This file runs the **full application** in containers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) v2.
- Repository clone with `server/package-lock.json` and `client/package-lock.json` present.

## Configure environment

1. Copy the example environment file:

   ```bash
   cp deployment/docker-compose/.env.example deployment/docker-compose/.env
   ```

2. Edit **`deployment/docker-compose/.env`**:

   - **`CLIENT_ORIGIN`** — Must equal the URL users use to open the app. If you map nginx to port 8080 on your machine, use `http://localhost:8080` (or your hostname and HTTPS URL in production).
   - **`JWT_SECRET`** — Required in production. Use a long random string (at least 16 characters), for example from `openssl rand -base64 32`. If this is unset or weak, the API may try to write a generated secret to `server/.env` inside the container; setting a strong **`JWT_SECRET`** avoids that and is required for stable tokens across container restarts.
   - **`POSTGRES_PASSWORD`** — Change from the example for any non-local deployment.
   - **OAuth variables** — Optional; set the `OAUTH_*` pairs for each provider you enable. Register redirect URLs with each provider as:

     `{CLIENT_ORIGIN}/api/auth/oauth/<provider>/callback`

     where `<provider>` is `google`, `github`, `gitlab`, or `microsoft`.

## Build and start

From the **repository root**:

```bash
docker compose -f deployment/docker-compose/docker-compose.yml --env-file deployment/docker-compose/.env up -d --build
```

Wait until **postgres** is healthy and **api** has started (first boot runs database migrations). Then open **`CLIENT_ORIGIN`** in a browser (for example `http://localhost:8080` if `HTTP_PORT=8080`).

## Verify

- **Web:** Open the app URL; you should see the login page.
- **API health:** `curl -sS http://localhost:8080/health` should return JSON with `"ok": true` (replace port with `HTTP_PORT`).

## Logs and stop

```bash
docker compose -f deployment/docker-compose/docker-compose.yml --env-file deployment/docker-compose/.env logs -f api
docker compose -f deployment/docker-compose/docker-compose.yml --env-file deployment/docker-compose/.env down
```

`down` keeps volumes (`pgdata`, `redisdata`). To remove volumes as well:

```bash
docker compose -f deployment/docker-compose/docker-compose.yml --env-file deployment/docker-compose/.env down -v
```

## HTTPS and a real domain

Compose publishes HTTP on **`HTTP_PORT`**. For HTTPS, put a reverse proxy (Traefik, Caddy, nginx, or a cloud load balancer) in front with TLS certificates, and set **`CLIENT_ORIGIN`** to `https://your-domain.example`. Update OAuth redirect URIs in each identity provider to use `https`.

## Troubleshooting

- **API exits or restarts:** Check `docker compose ... logs api`. Common causes: invalid **`DATABASE_URL`** (wait for postgres healthy), or missing **`JWT_SECRET`**.
- **502 on `/api`:** Ensure the **api** service is running and nginx can resolve the hostname **`api`** on the Compose network (default service name).

More context: [deployment/README.md](../README.md) and the root [README.md](../../README.md).
