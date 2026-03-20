# Deployment

This folder contains **production-oriented** artifacts for Expense Tracker:

| Path | Purpose |
|------|---------|
| [docker/](docker/) | **Dockerfiles** for the API and for nginx serving the Vite build (with `/api` proxy). |
| [docker-compose/](docker-compose/) | **Docker Compose** stack: PostgreSQL, Redis, API, web. See [docker-compose/README.md](docker-compose/README.md). |
| [kubernetes/](kubernetes/) | **Kubernetes** manifests (namespace, Postgres, Redis, API, web, optional Ingress). See [kubernetes/README.md](kubernetes/README.md). |

The repository root **`docker-compose.yml`** only starts PostgreSQL and Redis for **local development**. For a **full containerized stack**, use **`deployment/docker-compose/docker-compose.yml`**.

## Quick links

- **Docker Compose (single host):** [docker-compose/README.md](docker-compose/README.md)  
- **Kubernetes (cluster):** [kubernetes/README.md](kubernetes/README.md)  

For application behavior, environment variables, and OAuth setup, see the root [README.md](../README.md) and [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).
