# Deployment

This folder contains **production-oriented** artifacts for Expense Tracker:

| Path | Purpose |
|------|---------|
| [docker/](docker/) | **Dockerfiles** for the API and for nginx serving the Vite build (with `/api` proxy). |
| [docker-compose/](docker-compose/) | **Docker Compose** stack: PostgreSQL, Redis, API, web. See [docker-compose/README.md](docker-compose/README.md). |
| [kubernetes/](kubernetes/) | **Kubernetes** manifests (namespace, Postgres, Redis, API, web, optional Ingress). See [kubernetes/README.md](kubernetes/README.md). |

The repository root **`docker-compose.yml`** only starts PostgreSQL and Redis for **local development**. For a **full containerized stack** (Postgres, Redis, API, nginx serving the Vite production build with **`/api`** and **`/health`** proxies, persistent volumes), use **`deployment/docker-compose/docker-compose.yml`**.

From the **repository root**, **`npm run compose:prod`** builds and starts that stack using **`deployment/docker-compose/.env`**. **`npm run compose:prod:down`**, **`compose:prod:logs`**, and **`compose:prod:ps`** wrap the matching `docker compose` commands.

## Quick links

- **Docker Compose (single host):** [docker-compose/README.md](docker-compose/README.md)  
- **Kubernetes (cluster):** [kubernetes/README.md](kubernetes/README.md)  

For application behavior, environment variables, OAuth, recovery codes, and **Profile backup/restore**, see the root [README.md](../README.md), [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md), and [docs/USER_GUIDE.md](../docs/USER_GUIDE.md). The Compose **web** nginx **`client_max_body_size`** (25 MB on `/api/`) is enough for default **backup restore** payloads (15 MB limit on the API).
