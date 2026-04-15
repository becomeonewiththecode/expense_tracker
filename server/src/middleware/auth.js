import { verifyUserSessionToken } from "../userSecurity.js";
import { getSessionTokenFromReq } from "../sessionCookie.js";

export function authRequired(req, res, next) {
  const token = getSessionTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }
  const result = verifyUserSessionToken(token);
  if (!result.ok) return res.status(401).json({ error: result.error });
  req.userId = result.userId;
  next();
}
