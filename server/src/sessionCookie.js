export const SESSION_COOKIE_NAME = "expense_tracker_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseBoolEnv(value) {
  const v = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return null;
}

function isLocalHttpOrigin(origin) {
  const o = String(origin || "").trim().toLowerCase();
  return o.startsWith("http://localhost") || o.startsWith("http://127.0.0.1");
}

function shouldUseSecureCookie(req) {
  const explicit = parseBoolEnv(process.env.SESSION_COOKIE_SECURE);
  if (explicit != null) return explicit;
  if (process.env.NODE_ENV !== "production") return false;
  if (isLocalHttpOrigin(process.env.CLIENT_ORIGIN)) return false;
  if (req?.secure) return true;
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === "https") return true;
  return true;
}

export function getSessionTokenFromReq(req) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  return bearer || cookieToken || null;
}

export function setSessionCookie(req, res, token) {
  const secure = shouldUseSecureCookie(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(req, res) {
  const secure = shouldUseSecureCookie(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
  });
}
