import jwt from "jsonwebtoken";

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const raw = payload.sub;
    const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.userId = n;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
