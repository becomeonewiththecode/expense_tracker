import Redis from "ioredis";

let client = null;

export function getRedis() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    client.on("error", () => {});
    return client;
  } catch {
    return null;
  }
}

export async function cacheGet(key) {
  const r = getRedis();
  if (!r) return null;
  try {
    if (r.status === "wait") await r.connect().catch(() => null);
    const v = await r.get(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  const r = getRedis();
  if (!r) return;
  try {
    if (r.status === "wait") await r.connect().catch(() => null);
    await r.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    /* optional cache */
  }
}
