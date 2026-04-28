function spentAtToIso(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function parseIso(iso) {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  const mo = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  return new Date(y, mo, d);
}

export function sod(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dim(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function clamp(y, m, day) {
  return Math.min(Math.max(1, Number(day)), dim(y, m));
}

function addMonths(d, delta) {
  const r = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  r.setDate(Math.min(d.getDate(), dim(r.getFullYear(), r.getMonth())));
  return sod(r);
}

export function isoStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Returns the current hour (0-23) in the given IANA timezone. */
export function getHourInTz(now, timezone) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(now)
    );
  } catch {
    return now.getUTCHours();
  }
}

/** Returns today's date as "YYYY-MM-DD" in the given IANA timezone. */
export function getUserTodayIso(now, timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return isoStr(sod(now));
  }
}

export function nextRenewalDate(expense, from) {
  const freq = String(expense.frequency ?? "monthly").toLowerCase().trim();
  if (freq === "once") return null;
  const iso = spentAtToIso(expense.spent_at);
  if (!iso) return null;
  const spent = parseIso(iso);
  if (!spent) return null;
  const fromS = sod(from);
  const day = Math.min(30, Math.max(1, spent.getDate()));

  if (freq === "weekly") {
    let cur = sod(spent);
    while (cur < fromS) cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
    return cur;
  }
  if (freq === "monthly") {
    const y = fromS.getFullYear(), m = fromS.getMonth();
    const cand = new Date(y, m, clamp(y, m, day));
    return cand < fromS ? addMonths(cand, 1) : cand;
  }
  if (freq === "bimonthly") {
    const day2 = expense.payment_day_2 != null ? Math.min(30, Math.max(1, Number(expense.payment_day_2))) : null;
    const days = [...new Set([day, ...(day2 != null ? [day2] : [])])].sort((a, b) => a - b);
    let y = fromS.getFullYear(), m = fromS.getMonth();
    for (let g = 0; g < 60; g++) {
      for (const d of days) {
        const cand = new Date(y, m, clamp(y, m, d));
        if (cand >= fromS) return cand;
      }
      if (++m > 11) { m = 0; y++; }
    }
    return null;
  }
  if (freq === "yearly") {
    const mi = spent.getMonth();
    let y = fromS.getFullYear();
    let cand = new Date(y, mi, clamp(y, mi, day));
    if (cand < fromS) cand = new Date(++y, mi, clamp(y, mi, day));
    return cand;
  }
  return null;
}
