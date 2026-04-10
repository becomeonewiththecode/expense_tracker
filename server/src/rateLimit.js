/**
 * Simple in-memory per-IP rate limiter for auth endpoints.
 * For multi-instance production, replace with Redis-backed limits.
 */

/** @param {{ windowMs: number; max: number; name?: string }} opts */
export function ipRateLimit(opts) {
  const { windowMs, max, name = "rl" } = opts;
  const store = new Map();
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${name}:${ip}`;
    const now = Date.now();
    let e = store.get(key);
    if (!e || now > e.resetAt) {
      e = { count: 0, resetAt: now + windowMs };
      store.set(key, e);
    }
    e.count += 1;
    if (e.count > max) {
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }
    next();
  };
}
