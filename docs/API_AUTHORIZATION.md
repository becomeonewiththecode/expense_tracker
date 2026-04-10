# API authorization (Swagger / OpenAPI)

Interactive API documentation is served at **`/api/docs`** (Swagger UI) and **`/api/openapi.json`** (OpenAPI 3 spec). The spec is defined in **`server/src/openapi.js`**.

This guide explains each **Authorize** entry in Swagger and how to obtain the values.

## Security schemes

| Scheme in Swagger | How it is sent | Purpose |
|-------------------|----------------|---------|
| **`bearerAuth`** | `Authorization: Bearer <token>` | Normal **user** session JWT |
| **`adminBearerAuth`** | `Authorization: Bearer <token>` | **Admin** session JWT |
| **`adminReauth`** | `x-admin-reauth: <token>` | Short-lived **admin re-authentication** token for sensitive operations |

---

## 1. User token (`bearerAuth`)

### Step A — Password login

`POST /api/auth/login`

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

Response includes **`challengeId`** (and flags for 2FA setup vs verify).

### Step B — Complete 2FA

- Existing 2FA: `POST /api/auth/verify-2fa`
- First-time enrollment: `POST /api/auth/setup-2fa/verify`

```json
{
  "challengeId": "<from login response>",
  "code": "123456"
}
```

Response includes **`token`**.

### Step C — Swagger

Paste **`token`** into **`bearerAuth`** (Swagger adds the `Bearer ` prefix).

**Also issued without the login challenge:** `POST /api/auth/register` returns **`token`** immediately (new accounts without 2FA yet follow the same enrollment flow on first password login).

### OAuth (Google, GitHub, GitLab, Microsoft)

The browser does **not** receive the JWT in the redirect query string.

1. User opens **`GET /api/auth/oauth/{provider}`** (from **SsoButtons**); the API redirects to the identity provider.
2. After consent, the IdP redirects to **`GET /api/auth/oauth/{provider}/callback`** with **`code`** and **`state`**.
3. The API exchanges the code, creates or links the user, issues a session JWT, and responds with **`302`** to **`{CLIENT_ORIGIN}/oauth/callback?login_code=…`**.
4. **`OAuthCallbackPage`** calls **`POST /api/auth/oauth/login-code`** with JSON **`{ "code": "<login_code from query>" }`** (no **`Authorization`** header required). Response **`200`** body includes **`token`** and **`user`** — use the same **`bearerAuth`** value in Swagger as for password login.

**Rate limits:** Repeated failed **`POST /api/auth/login`** or **`POST /api/auth/register`** attempts from one IP may return **HTTP 429**. The login-code exchange endpoint is also rate-limited.

---

## 2. Admin token (`adminBearerAuth`)

Admin auth is separate from user JWTs. Implementation: **`server/src/routes/admin.js`**, **`server/src/adminSecurity.js`**.

### Step A — Admin login

`POST /api/admin/auth/login` — **rate-limited** by IP (**HTTP 429** when exceeded).

```json
{
  "username": "admin-username",
  "password": "admin-password"
}
```

Response includes **`challengeId`**.

### Step B — Admin 2FA

- Verify: `POST /api/admin/auth/verify-2fa`
- First-time setup: `POST /api/admin/auth/setup-2fa/verify`

```json
{
  "challengeId": "<from admin login response>",
  "code": "123456"
}
```

Response includes **`token`**.

### Step C — Swagger

Paste **`token`** into **`adminBearerAuth`**.

---

## 3. Admin re-auth token (`adminReauth` / `x-admin-reauth`)

Some admin endpoints require **both** an active admin bearer token **and** a fresh re-auth token (password + TOTP again). The re-auth JWT is short-lived (**120 seconds** in **`issueReauthToken`**).

### Prerequisites

- **`adminBearerAuth`** already authorized in Swagger.

### Request re-auth token

`POST /api/admin/auth/reauth`

```json
{
  "password": "admin-password",
  "code": "123456"
}
```

Response:

```json
{
  "reauthToken": "<jwt>",
  "expiresInSec": 120
}
```

### Swagger

Paste **`reauthToken`** into **`adminReauth`**. Swagger sends it as header **`x-admin-reauth`**.

---

## Endpoints that require `adminReauth`

Per **`server/src/openapi.js`**, these need **`adminBearerAuth`** and **`adminReauth`** together:

- `GET /api/admin/backup/database`
- `POST /api/admin/restore/database`
- `POST /api/admin/users/{userId}/reset-password`
- `PATCH /api/admin/users/{userId}/permissions`

Other admin routes typically need only **`adminBearerAuth`**.

---

## Typical Swagger order of operations

### User-only endpoints (e.g. `GET /api/auth/me`)

1. `POST /api/auth/login` → copy **`challengeId`**
2. `POST /api/auth/verify-2fa` (or setup verify) → copy **`token`**
3. **Authorize** → **`bearerAuth`** = that **`token`**
4. Call protected user routes

### Admin + sensitive admin action

1. Complete admin login + 2FA → copy admin **`token`**
2. **Authorize** → **`adminBearerAuth`** = admin **`token`**
3. For a reauth-protected route: `POST /api/admin/auth/reauth` → copy **`reauthToken`**
4. **Authorize** → **`adminReauth`** = **`reauthToken`** (repeat step 3 if it expires)
5. Call the sensitive route

---

## Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| **401** Missing admin token | **`adminBearerAuth`** not set or wrong scheme |
| **401** Re-authentication required | Missing or empty **`adminReauth`** |
| **401** Invalid re-authentication token | Wrong token, expired (**~120s**), or token for another admin session |
| **401** Admin session expired / timed out | Admin idle timeout (**15 minutes**); sign in again |

See also **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** for general login and proxy issues.

---

## Related files

| Concern | Location |
|--------|----------|
| OpenAPI spec (security schemes and path security) | `server/src/openapi.js` |
| User auth routes | `server/src/routes/auth.js` |
| Admin auth + reauth routes | `server/src/routes/admin.js` |
| Admin JWT, reauth header validation, session TTL | `server/src/adminSecurity.js` |
| User JWT middleware | `server/src/middleware/auth.js` |
| Admin UI (reauth flow mirrors API) | `client/src/pages/AdminPage.jsx` |
