import { verifyUserSessionToken } from "../userSecurity.js";

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }
  const result = verifyUserSessionToken(token);
  if (!result.ok) return res.status(401).json({ error: result.error });
  req.userId = result.userId;
  next();
}
