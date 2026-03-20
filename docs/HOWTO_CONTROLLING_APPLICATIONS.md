# How to control Expense Tracker with PM2

This guide explains how to **start, stop, restart, and inspect** the Expense Tracker API and web client when they are managed by **PM2**. It also covers how PM2 behaves if you run **other projects** (for example another application named Jamaica) on the same machine.

---

## What PM2 is doing here

- **One PM2 daemon per user** — The command `pm2 list` shows **every** application you have registered (Expense Tracker **and** any other applications). That is expected.  
- This repository defines two processes in `ecosystem.config.cjs`:  
  - **`expense-api`** — Express API (`server/`, entry `src/index.js`), **file watch** enabled on `server/src`  
  - **`expense-client`** — Vite development server (`client/`)  
- **Logs** (standard output and standard error) go under **`logs/`** at the repository root (PM2 creates the folder if needed).

Commands below assume your shell’s current directory is the **repository root**, for example:

`~/Documents/cursor/expense_tracker` (or your own clone path).

---

## Before first start

1. **Databases:** Run `docker compose up -d` for PostgreSQL and Redis, unless `server/.env` points elsewhere.  
2. **`server/.env`:** Copy from `server/.env.example` and adjust. For **single sign-on**, set **`CLIENT_ORIGIN`** to the URL users use to open the application (for example `http://localhost:5173` or your deployed origin) and add **`OAUTH_*`** credentials for each provider you enable. See `server/.env.example` and the root **README.md**.  
3. **`client/.env`:** Copy from `client/.env.example`. **`API_PROXY_TARGET`** must match the API **`PORT`** when using PM2 or manual development.  
4. **Dependencies:** Install at the repository root, in `server/`, and in `client/`:

   ```bash
   npm install
   cd server && npm install && cd ..
   cd client && npm install && cd ..
   ```

---

## npm scripts (from repository root)

These scripts map to `ecosystem.config.cjs` and affect **both** `expense-api` and `expense-client`:

| Script | What it does |
|--------|----------------|
| `npm run pm2:start` | Register and start both applications (or start them if already registered) |
| `npm run pm2:stop` | Stop both applications |
| `npm run pm2:restart` | Hard restart both applications |
| `npm run pm2:reload` | Reload the ecosystem. Here both applications use fork mode, so this behaves like a coordinated reload |
| `npm run pm2:delete` | **Remove** both applications from PM2’s list (they will not appear in `pm2 list` until you run `pm2:start` again) |
| `npm run pm2:logs` | Stream logs for **all** PM2-managed processes (press Control+C to stop following) |
| `npm run pm2:monit` | Terminal resource monitor similar to `top` |
| `npm run rebuild` | Same as `pm2:restart` — useful after pulling code |
| `npm run rebuild:client` | Production **build** of the client, then restart **only** the `expense-client` process |

Use **`npx pm2 …`** if you want the command-line interface version from this repository’s `package.json` (avoids mismatches with a globally installed PM2).

---

## Controlling one application at a time

Other processes (for example `jamaica-api`) are **not** touched.

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

If you change **`server/.env`** (or variables injected by PM2), a normal **restart** reloads the process. If something still looks stale:

```bash
npx pm2 restart expense-api --update-env
```

**OAuth and single sign-on:** `CLIENT_ORIGIN`, `OAUTH_*` keys, and optional `OAUTH_GITLAB_BASE_URL` or `OAUTH_MICROSOFT_TENANT` are read when the API starts. After changing them, restart **`expense-api`**, and confirm identity-provider redirect URLs still match `server/.env.example`.

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| **`Process or Namespace expense-api not found`** | The application was never started or was **deleted**. Run `npm run pm2:start` once, or `npx pm2 start ecosystem.config.cjs --only expense-api`. |
| **API crashes or many restarts** (restart counter rising) | Run `npx pm2 logs expense-api`. Verify PostgreSQL and Redis and `DATABASE_URL` and `REDIS_URL` in `server/.env`. |
| **In-memory PM2 is out-of-date** | From the repository root: `npm install` then `npx pm2 update` so the command-line interface and daemon stay aligned. |
| **Port already in use** | See [Port in use: PM2 or manual development](#port-in-use-pm2-or-manual-development) below. |
| **Single sign-on redirect errors or “redirect_uri mismatch”** | **`CLIENT_ORIGIN`** in `server/.env` must equal the browser’s origin (no trailing slash). The registered redirect in Google, GitHub, GitLab, or Microsoft must be `{CLIENT_ORIGIN}/api/auth/oauth/{provider}/callback`. Restart the API after environment changes. |

---

### Port in use: PM2 or manual development

`server/.env` sets **`PORT`** (you might use **4001** if something else already uses **4000**). **`client/.env`** must set **`API_PROXY_TARGET`** to the same host and port.

If **`expense-api`** is **errored** in `pm2 list` and logs say **`Port … is already in use`**, something else is already listening on that port. Often a **leftover** manual `cd server && npm run dev` is still running while PM2 also tries to start the API.

1. See what holds the port (example for port 4001):

   ```bash
   ss -ltnp | grep ':4001'
   # or: lsof -i :4001
   ```

2. **Choose one workflow:**  
   - **PM2 only:** Stop the manual server (close that terminal or end the `node src/index.js` process from `server/`), then `npx pm2 restart expense-api`.  
   - **Manual only:** `npx pm2 stop expense-api` (and avoid `pm2:start` for the API) so only your terminal runs the server.

3. Confirm the API answers:

   ```bash
   curl -sS "http://127.0.0.1:$(grep '^PORT=' server/.env | cut -d= -f2)/health"
   ```

If the browser shows **HTML with a 404** on import, the Vite proxy is often hitting a **dead or wrong** target because PM2’s API never bound to the port. Fix the port conflict first.

---

## Without PM2 (manual development)

Same as in the main README:

- API: change to `server`, run `npm run dev`  
- Client: change to `client`, run `npm run dev`  

Stop with Control+C in those terminals. This does **not** remove PM2 applications. If both manual servers and PM2 run, you can have **duplicate** servers on the same ports — pick one workflow per service.

---

## Optional: persist PM2 across reboots

If you want PM2 to bring applications back after a machine restart (this affects **all** saved applications, not only Expense Tracker):

```bash
npx pm2 save
npx pm2 startup
```

Follow the one-line command PM2 prints (often requires administrator privileges). Use carefully in shared or production environments.

---

## Related documentation

- [User guide](./USER_GUIDE.md) — Product behavior, account types, and local setup overview  
- [Architecture](./ARCHITECTURE.md) — System design, including OAuth routes  
- [Architecture diagrams](./ARCHITECTURE_DIAGRAM.md) — Single sign-on sequence and data model  
- Root [README.md](../README.md) — API overview and OAuth troubleshooting  
