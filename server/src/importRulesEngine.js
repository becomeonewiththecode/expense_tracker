/** @param {string} s */
export function normalizeImportDescription(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * @param {string} descNorm normalized description
 * @param {string} patternNorm normalized pattern
 * @param {string} matchType contains | starts_with | exact
 */
export function matchesImportRule(descNorm, patternNorm, matchType) {
  if (!patternNorm) return false;
  switch (matchType) {
    case "exact":
      return descNorm === patternNorm;
    case "starts_with":
      return descNorm.startsWith(patternNorm);
    case "contains":
    default:
      return descNorm.includes(patternNorm);
  }
}

/**
 * Apply user rules to staging rows with no category. First matching rule wins (sort_order, id).
 * @param {import('pg').PoolClient | import('pg').Pool} db
 * @param {number} userId
 * @param {number} batchId
 * @returns {Promise<{ matched: number }>}
 */
export async function applyImportRulesToBatch(db, userId, batchId) {
  const { rows: rules } = await db.query(
    `SELECT match_type, pattern, category, renewal_kind
     FROM import_category_rules WHERE user_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [userId]
  );
  if (!rules.length) return { matched: 0 };

  const { rows: targets } = await db.query(
    `SELECT id, description FROM import_staging_rows
     WHERE batch_id = $1 AND user_id = $2 AND category IS NULL`,
    [batchId, userId]
  );

  let matched = 0;
  for (const row of targets) {
    const d = normalizeImportDescription(row.description);
    for (const rule of rules) {
      if (rule.category === "renewal" && !rule.renewal_kind) continue;
      const p = normalizeImportDescription(rule.pattern);
      if (!matchesImportRule(d, p, rule.match_type)) continue;
      const rk = rule.category === "renewal" ? rule.renewal_kind : null;
      await db.query(
        `UPDATE import_staging_rows SET category = $1, renewal_kind = $2 WHERE id = $3 AND user_id = $4`,
        [rule.category, rk, row.id, userId]
      );
      matched++;
      break;
    }
  }
  return { matched };
}
