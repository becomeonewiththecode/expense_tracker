import { useEffect, useState } from "react";

const fromBuild =
  typeof import.meta.env.VITE_APP_VERSION === "string" && import.meta.env.VITE_APP_VERSION.trim()
    ? import.meta.env.VITE_APP_VERSION.trim()
    : null;

/**
 * Release string from the production static build (Docker) or, in dev, from GET /health.
 */
export function useAppVersion() {
  const [v, setV] = useState(fromBuild);

  useEffect(() => {
    if (fromBuild) return;
    let cancelled = false;
    fetch("/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("health"))))
      .then((j) => {
        if (cancelled || typeof j?.version !== "string") return;
        const s = j.version.trim();
        if (s) setV(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return v;
}
