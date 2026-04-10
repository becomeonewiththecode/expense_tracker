# Security & hardening backlog

Medium- and lower-priority items from the security review (not addressed in the latest hardening pass).

- [ ] **Password policy**: Raise minimum length beyond 6 characters; consider zxcvbn or Have I Been Pwned (k-anonymity) for common passwords.
- [ ] **Registration email validation**: Apply the same email format checks used on profile update to `POST /auth/register` to reduce garbage accounts.
- [ ] **HTTP security headers**: Add `helmet` (or manual `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, etc.).
- [ ] **API documentation exposure**: Disable or authenticate `/api/docs` and `/api/openapi.json` in production.
- [ ] **Stateful scaling**: Move user/admin session maps and OAuth state from process memory to Redis (or similar) so multiple API instances and restarts behave consistently; align rate limiting with the same store if needed.
- [ ] **Avatar uploads**: Validate image magic bytes (not only `Content-Type`) and optionally re-encode with a safe image library.
- [ ] **Token storage**: Prefer `httpOnly` cookies plus CSRF protection if XSS risk must be minimized; current `localStorage` + Bearer tokens depend on a strict CSP and no XSS.
- [ ] **OAuth callback UX**: Client no longer decodes JWTs from the URL; optional cleanup elsewhere if any legacy `?token=` links remain documented.
- [ ] **Error responses**: Ensure production does not leak stack traces or internal messages via the global Express error handler.
- [ ] **Trust proxy**: If the API sits behind nginx/ELB, set `app.set("trust proxy", …)` so `req.ip` and rate limits use the real client IP.
