import { CATEGORIES, parseCategory, parseRenewalKind } from "./expenseEnums.js";

const CATEGORY_LIST = [...CATEGORIES].sort().join(", ");

function openAiConfigured() {
  return Boolean(String(process.env.OPENAI_API_KEY || "").trim());
}

/**
 * @param {Array<{ id: number, description: string, amount: number, spent_at: string }>} rows
 * @returns {Promise<Array<{ row_id: number, category: string, renewal_kind: string | null }>>}
 */
export async function suggestCategoriesForImportRows(rows) {
  if (!openAiConfigured()) {
    const err = new Error("OpenAI is not configured");
    err.statusCode = 503;
    throw err;
  }
  if (!rows.length) return [];

  const payload = rows.map((r) => ({
    id: r.id,
    description: r.description,
    amount: r.amount,
    spent_at: r.spent_at,
  }));

  const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();

  const userContent = `Classify each import row into one category from this exact list: ${CATEGORY_LIST}.

Rules:
- Use only category values from the list exactly (snake_case).
- If category is "renewal", you must also set renewal_kind to one of the valid renewal subtypes (e.g. streaming_services, gym_membership, software_subscriptions). For any other category, renewal_kind must be null.
- If unsure, use "personal".

Rows (JSON): ${JSON.stringify(payload)}

Respond with JSON only, shape: {"suggestions":[{"row_id":number,"category":"string","renewal_kind":string|null}]}
Include every row id exactly once.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You assign expense categories for a personal finance app. Output valid JSON only; no markdown.",
        },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`OpenAI error ${res.status}`);
    err.statusCode = 502;
    err.detail = text.slice(0, 500);
    throw err;
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    const err = new Error("Empty model response");
    err.statusCode = 502;
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error("Model returned non-JSON");
    err.statusCode = 502;
    throw err;
  }

  const list = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  const allowedIds = new Set(rows.map((r) => r.id));
  const out = [];

  for (const s of list) {
    const row_id = Number(s?.row_id);
    if (!Number.isFinite(row_id) || !allowedIds.has(row_id)) continue;
    const category = parseCategory(s?.category);
    if (!category) continue;
    let renewal_kind = null;
    if (category === "renewal") {
      renewal_kind = parseRenewalKind(s?.renewal_kind);
      if (!renewal_kind) continue;
    }
    out.push({ row_id, category, renewal_kind });
  }

  return out;
}

export { openAiConfigured };
