import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

/** Release string for UI and GET /health. Prefer APP_VERSION from Docker / host env; else server package.json version. */
export function getAppVersion() {
  const v = process.env.APP_VERSION;
  if (typeof v === "string" && v.trim()) return v.trim();
  return typeof pkg?.version === "string" && pkg.version ? pkg.version : "0.0.0";
}
