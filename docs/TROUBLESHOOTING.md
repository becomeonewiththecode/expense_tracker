# Troubleshooting

## Registration or login fails

The browser talks to the API through the Vite proxy: requests to `/api` are forwarded to your Node server. You need **both** of the following:

1. `docker compose up -d` if you rely on Docker for PostgreSQL and Redis.
2. The server running with `cd server && npm run dev` and a valid `server/.env` (the `JWT_SECRET` is generated automatically if it is weak or missing).

If only the client is running (`npm run dev` inside `client/`), sign-up and sign-in will fail until the API process is started.

## Single sign-on buttons do nothing or return an error

- An HTTP **503** response from `GET /api/auth/oauth/...` means that provider is **not configured**. Set `OAUTH_<PROVIDER>_CLIENT_ID` and `OAUTH_<PROVIDER>_CLIENT_SECRET` in `server/.env` for that provider, then restart the API.
- **Redirect URI mismatch** in the provider's console: the authorized redirect URL must be exactly `{CLIENT_ORIGIN}/api/auth/oauth/{provider}/callback` as described in `server/.env.example`. Align `CLIENT_ORIGIN` and the provider application settings.
- After OAuth completes, you should land on **`/oauth/callback`**. If you always see "Missing token", check the API logs for callback errors and confirm the browser's origin matches `CLIENT_ORIGIN`.

## Port 4000 already in use ("Empty reply from server")

Another program may be listening on **port 4000** instead of this API (for example `curl` connects but returns an empty reply). The expense tracker will not work correctly if Vite still proxies to port 4000 while nothing valid responds.

**Fix:** In `server/.env`, set `PORT` to another port, for example `4001`. Copy `client/.env.example` to `client/.env` and set `API_PROXY_TARGET=http://127.0.0.1:4001` (or the matching host and port). Restart `npm run dev` in **both** `server/` and `client/`.

To see which process holds a port, run `ss -tlnp | grep ':4000 '` or `lsof -iTCP:4000 -sTCP:LISTEN`, then stop the conflicting service if you want the API to use port 4000.

## PM2 "Process not found"

No process named `expense-api` has been registered with PM2 yet. Run `npm run pm2:start` once from the repository root.

## PM2 version mismatch

If the command-line **PM2 client** and the **background PM2 daemon** report different versions (message such as `Use pm2 update`), run `npx pm2 update` from the repository root, or run `npm install` so the CLI matches the dependency version, then use `npx pm2` for all commands.
