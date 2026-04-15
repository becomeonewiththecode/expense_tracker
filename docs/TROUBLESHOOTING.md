# Troubleshooting

## Registration or login fails

The browser talks to the API through the Vite proxy: requests to `/api` are forwarded to your Node server. You need **both** of the following:

1. `docker compose up -d` if you rely on Docker for PostgreSQL and Redis.
2. The server running with `cd server && npm run dev` and a valid `server/.env` (the `JWT_SECRET` is generated automatically if it is weak or missing).

If only the client is running (`npm run dev` inside `client/`), sign-up and sign-in will fail until the API process is started.

## Session expired or “Missing token” right after login (user app)

The user SPA relies on an **HttpOnly** cookie (**`expense_tracker_session`**) instead of **`localStorage`** for the session JWT.

1. **`CLIENT_ORIGIN`** must include the exact origin you open in the browser (scheme, host, port). A mismatch blocks credentialed **`/api`** calls via CORS.
2. **`Secure` cookie on HTTP:** In production, the API may set **`Secure`** cookies. If you serve the UI over **plain HTTP** without a correct **`X-Forwarded-Proto`**, the browser may **refuse to store** the cookie. Set **`SESSION_COOKIE_SECURE=false`** in **`server/.env`** (or Compose **`.env`**) for that setup, or terminate TLS at your reverse proxy and forward **`X-Forwarded-Proto: https`**.
3. Restart the API after env changes, then hard-refresh the browser or clear site data for the app origin.

See **[API_AUTHORIZATION.md](./API_AUTHORIZATION.md)** (session cookie section) for **`trust proxy`** and Swagger same-origin notes.

## Swagger / OpenAPI “Authorize” fails or returns 401

Swagger UI does not invent tokens; you must obtain them from the auth endpoints, then paste them into **Authorize**.

- **User routes**: complete `POST /api/auth/login` then `POST /api/auth/verify-2fa` or `POST /api/auth/setup-2fa/verify`; the API sets an HttpOnly session cookie used by browser requests.
- **Admin routes** (**`adminBearerAuth`**): complete `POST /api/admin/auth/login` then admin verify or setup-2FA verify; use the returned **`token`** in **`adminBearerAuth`**.
- **Sensitive admin routes** (also **`adminReauth`** / **`x-admin-reauth`**): with **`adminBearerAuth`** set, call `POST /api/admin/auth/reauth` with admin password and TOTP; paste **`reauthToken`** into **`adminReauth`**. It expires in about **two minutes**—request a new one if needed.

Full step-by-step flow: **[API_AUTHORIZATION.md](./API_AUTHORIZATION.md)**.

## Single sign-on buttons do nothing or return an error

- An HTTP **503** response from `GET /api/auth/oauth/...` means that provider is **not configured**. Set `OAUTH_<PROVIDER>_CLIENT_ID` and `OAUTH_<PROVIDER>_CLIENT_SECRET` in `server/.env` for that provider, then restart the API.
- **Redirect URI mismatch** in the provider's console: the authorized redirect URL must be exactly `{CLIENT_ORIGIN}/api/auth/oauth/{provider}/callback` as described in `server/.env.example`. Align `CLIENT_ORIGIN` and the provider application settings.
- After OAuth completes, you should land on **`/oauth/callback`** with a **`login_code`** in the query string. If you see **"Missing login code"** or **"Invalid or expired login code"**, the redirect may have been truncated, the code already used, or the API restarted (codes are in-memory). Check API logs for callback errors, try signing in again, and confirm the browser origin is listed in **`CLIENT_ORIGIN`** (required in production for CORS).
- **HTTP 429** on **`/auth/login`**, **`/auth/register`**, **`/auth/verify-2fa`**, **`/auth/setup-2fa/verify`**, **`/auth/oauth/login-code`**, **`/api/admin/auth/login`**, **`/api/admin/auth/verify-2fa`**, or **`/api/admin/auth/setup-2fa/verify`**: too many attempts from your IP; wait for the window to reset.

## Port 4000 already in use ("Empty reply from server")

Another program may be listening on **port 4000** instead of this API (for example `curl` connects but returns an empty reply). The expense tracker will not work correctly if Vite still proxies to port 4000 while nothing valid responds.

**Fix:** In `server/.env`, set `PORT` to another port, for example `4001`. Copy `client/.env.example` to `client/.env` and set `API_PROXY_TARGET=http://127.0.0.1:4001` (or the matching host and port). Restart `npm run dev` in **both** `server/` and `client/`.

To see which process holds a port, run `ss -tlnp | grep ':4000 '` or `lsof -iTCP:4000 -sTCP:LISTEN`, then stop the conflicting service if you want the API to use port 4000.

## PM2 "Process not found"

No process named `expense-api` has been registered with PM2 yet. Run `npm run pm2:start` once from the repository root.

## PM2 version mismatch

If the command-line **PM2 client** and the **background PM2 daemon** report different versions (message such as `Use pm2 update`), run `npx pm2 update` from the repository root, or run `npm install` so the CLI matches the dependency version, then use `npx pm2` for all commands.
