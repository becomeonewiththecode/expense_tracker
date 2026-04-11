/** @param {string} raw */
export function parseCssColor(raw) {
  const s = (raw || "").trim().toLowerCase();
  if (!s || s === "transparent") return null;

  const m = s.match(/rgba?\(\s*([^)]+)\s*\)/);
  if (!m) return null;

  const inner = m[1].replace(/\s+/g, " ").trim();
  const slashIdx = inner.indexOf("/");
  let rgbPart = inner;
  let alpha = 1;
  if (slashIdx !== -1) {
    rgbPart = inner.slice(0, slashIdx).trim();
    const aRaw = inner.slice(slashIdx + 1).trim();
    const aNum = Number(aRaw);
    alpha = Number.isFinite(aNum) ? aNum : 1;
  }

  const nums = rgbPart.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length < 3) return null;
  const [r, g, b] = nums;
  return { r, g, b, a: alpha };
}

/** @param {{ r: number; g: number; b: number; a?: number }} top @param {{ r: number; g: number; b: number }} bottom */
export function compositeOver(top, bottom) {
  const a = top.a == null ? 1 : top.a;
  const inv = 1 - a;
  return {
    r: Math.round(top.r * a + bottom.r * inv),
    g: Math.round(top.g * a + bottom.g * inv),
    b: Math.round(top.b * a + bottom.b * inv),
  };
}

function lin(c) {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** @param {{ r: number; g: number; b: number }} rgb sRGB 0–255 */
export function relativeLuminance(rgb) {
  return (
    0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b)
  );
}

export function contrastRatio(lumA, lumB) {
  const hi = Math.max(lumA, lumB);
  const lo = Math.min(lumA, lumB);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Approximate painted background behind text: walk ancestors and composite
 * semi-transparent backgrounds onto the nearest opaque backdrop.
 * @param {Element} el
 */
export function resolveApproxBackgroundRgb(el) {
  const doc = el.ownerDocument;
  const html = doc.documentElement;
  const body = doc.body;

  const htmlBg = parseCssColor(getComputedStyle(html).backgroundColor);
  const bodyBg = parseCssColor(getComputedStyle(body).backgroundColor);

  let backdrop = { r: 255, g: 255, b: 255 };
  if (htmlBg && htmlBg.a >= 0.99) backdrop = { r: htmlBg.r, g: htmlBg.g, b: htmlBg.b };
  if (bodyBg) {
    backdrop =
      bodyBg.a >= 0.99
        ? { r: bodyBg.r, g: bodyBg.g, b: bodyBg.b }
        : compositeOver(bodyBg, backdrop);
  }

  const chain = [];
  let cur = el;
  while (cur && cur instanceof Element) {
    chain.push(cur);
    cur = cur.parentElement;
  }

  let rgb = backdrop;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const bg = parseCssColor(getComputedStyle(chain[i]).backgroundColor);
    if (!bg) continue;
    if (bg.a >= 0.99) {
      rgb = { r: bg.r, g: bg.g, b: bg.b };
    } else {
      rgb = compositeOver(bg, rgb);
    }
  }
  return rgb;
}
