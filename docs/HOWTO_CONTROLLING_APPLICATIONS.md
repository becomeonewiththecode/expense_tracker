# How to control Expense Tracker with PM2

This guide explains how to **start, stop, restart, and inspect** the Expense Tracker API and web client when they are managed by **PM2**. It also covers how PM2 behaves if you run **other projects** (e.g. Jamaica) on the same machine.

---

## What PM2 is doing here

- **One PM2 daemon per user** — `pm2 list` shows **every** app you have registered (Expense Tracker **and** any other apps). That is expected.
- This repo defines two processes in `ecosystem.config.cjs`:
  - **`expense-api`** — Express API (`server/`, entry `src/index.js`), **watch** enabled on `server/src`
  - **`expense-client`** — Vite dev server (`client/`)
- **Logs** (stdout/stderr) go under **`logs/`** at the repo root (PM2 creates the folder if needed).

Commands below assume your shell’s current directory is the **repository root**:

`~/Documents/cursor/expense_tracker` (or your clone path).

---

## Before first start

1. **Databases:** `docker compose up -d` (Postgres + Redis), unless you point `server/.env` elsewhere.  
2. **`server/.env`:** copy from `server/.env.example` and adjust.  
3. **Dependencies:** install at root, server, and client:

   ```bash
   npm install
   cd server && npm install && cd ..
   cd client && npm install && cd ..
   ```

---

## npm scripts (from repo root)

These map to `ecosystem.config.cjs` and affect **both** `expense-api` and `expense-client`:

| Script | What it does |
|--------|----------------|
| `npm run pm2:start` | Register and start both apps (or start if already registered) |
| `npm run pm2:stop` | Stop both |
| `npm run pm2:restart` | Hard restart both |
| `npm run pm2:reload` | Reload ecosystem (here both apps use fork mode; behaves like a coordinated reload) |
| `npm run pm2:delete` | **Remove** both apps from PM2’s list (they won’t appear in `pm2 list` until you `pm2:start` again) |
| `npm run pm2:logs` | Stream logs for **all** PM2 apps (press Ctrl+C to stop tailing) |
| `npm run pm2:monit` | Terminal “top”-style view |
| `npm run rebuild` | Same as `pm2:restart` — handy after pulling code |
| `npm run rebuild:client` | Production **build** of the client, then restart **only** `expense-client` |

Use **`npx pm2 …`** if you want the CLI version from this repo’s `package.json` (avoids mismatches with a globally installed PM2).

---

## Controlling one app at a time

Other processes (e.g. `jamaica-api`) are **not** touched.

```bash
npx pm2 restart expense-api
npx pm2 restart expense-client
npx pm2 stop expense-api
npx pm2 logs expense-api --lines 100
```

Start **only** the API (useful if you run the client manually):

```bash
npx pm2 start ecosystem.config.cjs --only expense-api
```

---

## Environment variables

If you change **`server/.env`** (or variables injected by PM2), a normal **restart** reloads the process; if something still looks stale:

```bash
npx pm2 restart expense-api --update-env
```

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| **`Process or Namespace expense-api not found`** | The app was never started or was **deleted**. Run `npm run pm2:start` once, or `npx pm2 start ecosystem.config.cjs --only expense-api`. |
| **API crashes / many restarts** (`↺` rising) | `npx pm2 logs expense-api`; verify Postgres/Redis and `DATABASE_URL` / `REDIS_URL` in `server/.env`. |
| **In-memory PM2 is out-of-date** | From repo root: `npm install` then `npx pm2 update` so the CLI and daemon stay aligned. |
| **Port already in use** | See [Port in use (PM2 vs manual dev)](#port-in-use-pm2-vs-manual-dev) below. |

---

### Port in use (PM2 vs manual dev)

`server/.env` sets **`PORT`** (you use **4001** if something else already uses **4000**). **`client/.env`** must set **`API_PROXY_TARGET`** to the same host/port.

If **`expense-api`** is **errored** in `pm2 list` and logs say **`Port … is already in use`**, something else is already listening on that port—often a **leftover** `cd server && npm run dev` while PM2 also tries to start the API.

1. See what holds the port (example for 4001):

   ```bash
   ss -ltnp | grep ':4001'
   # or: lsof -i :4001
   ```

2. **Pick one workflow:**
   - **PM2 only:** stop the manual server (close that terminal or kill the `node src/index.js` process from `server/`), then `npx pm2 restart expense-api`.
   - **Manual only:** `npx pm2 stop expense-api` (and avoid `pm2:start` for the API) so only your terminal runs the server.

3. Confirm the API answers:

   ```bash
   curl -sS "http://127.0.0.1:$(grep '^PORT=' server/.env | cut -d= -f2)/health"
   ```

If the browser shows **HTML (404)** on import, the Vite proxy is often hitting a **dead or wrong** target because PM2’s API never bound to the port—fix the port conflict first.

---

## Without PM2 (manual dev)

Same as in the main README:

- API: `cd server && npm run dev`  
- Client: `cd client && npm run dev`  

Stop with Ctrl+C in those terminals. This does **not** remove PM2 apps; if both run, you can have **duplicate** servers on the same ports — pick one workflow per service.

---

## Optional: persist PM2 across reboots

If you want PM2 to bring apps back after a machine restart (affects **all** saved apps, not just Expense Tracker):

```bash
npx pm2 save
npx pm2 startup
```

Follow the one-line command PM2 prints (often requires sudo). Use carefully in shared or production environments.

---

## Related docs

- [User guide](./USER_GUIDE.md) — product behavior and local setup overview  
- [Architecture](./ARCHITECTURE.md) — system design  
