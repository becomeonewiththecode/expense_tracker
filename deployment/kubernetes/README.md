# Deploy on Kubernetes

These manifests run Expense Tracker in a namespace **`expense-tracker`**: in-cluster **PostgreSQL** (StatefulSet), **Redis**, the **API** Deployment, and the **web** (nginx) Deployment. They are suitable for **learning, staging, or small clusters**.

For **production**, use a **managed PostgreSQL** (and often managed Redis), store secrets in a secret manager, run multiple API replicas behind a Service, and pin image digests from your private registry.

## Prerequisites

- A Kubernetes cluster (for example [kind](https://kind.sigs.k8s.io/), [minikube](https://minikube.sigs.k8s.io/), or a cloud provider).
- `kubectl` configured for the cluster.
- **Container images** built from the repository root and available to your cluster:

  ```bash
  docker build -f deployment/docker/Dockerfile.api -t expense-tracker-api:latest .
  docker build -f deployment/docker/Dockerfile.web -t expense-tracker-web:latest .
  ```

  - **kind:** `kind load docker-image expense-tracker-api:latest` and `kind load docker-image expense-tracker-web:latest`.
  - **Cloud:** tag and push to your registry, then change `image:` fields in `api.yaml` and `web.yaml` (or use `kustomize edit set image`).

## 1. Edit in-cluster PostgreSQL password (optional)

In **`postgres.yaml`**, the Secret **`postgres-secret`** contains **`POSTGRES_PASSWORD`**. Change it before applying. The **`DATABASE_URL`** you put in the API secret (next step) **must use the same user, password, database name, and host** `postgres` (the Kubernetes Service name).

## 2. Create the API secret

The API reads configuration from a Secret named **`expense-api-secrets`**.

**Option A — from a file**

1. Copy **`secret-api.example.yaml`** to a local file (for example `secret-api.yaml`) that you **do not commit**.
2. Replace placeholder values, especially **`DATABASE_URL`**, **`CLIENT_ORIGIN`**, **`JWT_SECRET`**, and OAuth keys if used.
3. Apply:

   ```bash
   kubectl apply -f secret-api.yaml
   ```

**Option B — imperative**

```bash
kubectl create secret generic expense-api-secrets \
  --namespace=expense-tracker \
  --from-literal=DATABASE_URL='postgresql://expense:YOUR_PASSWORD@postgres:5432/expense_tracker' \
  --from-literal=REDIS_URL='redis://redis:6379' \
  --from-literal=CLIENT_ORIGIN='https://your-domain.example.com' \
  --from-literal=JWT_SECRET='$(openssl rand -base64 32)'
```

Add OAuth keys with extra `--from-literal` lines if needed. Create the namespace first (see below) or add `--namespace=expense-tracker` after creating it.

## 3. Apply manifests

From the repository root:

```bash
kubectl apply -f deployment/kubernetes/namespace.yaml
kubectl apply -f deployment/kubernetes/postgres.yaml
kubectl apply -f deployment/kubernetes/redis.yaml
kubectl apply -k deployment/kubernetes/
```

If you already applied `namespace.yaml` and data stores, you can use only:

```bash
kubectl apply -k deployment/kubernetes/
```

**Note:** `kubectl apply -k deployment/kubernetes/` applies **`kustomization.yaml`**, which includes the API and web Deployments but **not** `ingress.yaml`. Apply Ingress separately when ready.

## 4. Access the application

**Port-forward** (no Ingress required):

```bash
kubectl port-forward -n expense-tracker service/web 8080:80
```

Open **http://localhost:8080**. Set **`CLIENT_ORIGIN`** in the API secret to **`http://localhost:8080`** for this test, or to your real public URL when using Ingress.

**Health check:**

```bash
kubectl port-forward -n expense-tracker service/api 4000:4000
curl -sS http://127.0.0.1:4000/health
```

## 5. Ingress and TLS (optional)

1. Install an [Ingress controller](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/) if your cluster does not have one.
2. Edit **`ingress.yaml`**: set **`host`**, **`ingressClassName`**, and the TLS **`secretName`** (create a TLS Secret with your certificate, or use cert-manager).
3. Apply:

   ```bash
   kubectl apply -f deployment/kubernetes/ingress.yaml
   ```

4. Set **`CLIENT_ORIGIN`** to **`https://your-hostname`** and update OAuth redirect URLs in each identity provider.

For HTTP-only testing, you can remove the **`tls`** block from **`ingress.yaml`**.

## OAuth redirect URLs

For each provider, register:

`{CLIENT_ORIGIN}/api/auth/oauth/<provider>/callback`

where `<provider>` is `google`, `github`, `gitlab`, or `microsoft`. **`CLIENT_ORIGIN`** must match the URL users use (including scheme and port).

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| API pod `CrashLoopBackOff` | `kubectl logs -n expense-tracker deploy/api`. Wrong **`DATABASE_URL`**, Postgres not ready, or missing **`JWT_SECRET`**. |
| `ImagePullBackOff` | Cluster cannot see `expense-tracker-api:latest` / `expense-tracker-web:latest`. Load images into kind/minikube or push to a registry and update **`image:`**. |
| 502 from web | API Service not reachable; check **`kubectl get svc -n expense-tracker`** and nginx upstream name **`api`** (matches Service **`api`**). |
| Database empty or errors | First startup runs migrations; ensure Postgres credentials in **`DATABASE_URL`** match **`postgres-secret`**. |

## Clean up

```bash
kubectl delete namespace expense-tracker
```

This removes workloads; PersistentVolumeClaims for Postgres may need separate deletion depending on your storage class and reclaim policy.
