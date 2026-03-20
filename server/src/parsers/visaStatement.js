import { parse } from "csv-parse/sync";
// Avoid package root (runs debug harness when loaded as entry / ESM without parent).
import pdfParse from "pdf-parse/lib/pdf-parse.js";

function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function colIndex(headers, candidates) {
  const normalized = headers.map(normHeader);
  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i];
    for (const c of candidates) {
      if (h === c || h.includes(c)) return i;
    }
  }
  return -1;
}

/** Signed dollar amount (negative = money out on many card CSVs, e.g. Chase). */
function parseSignedAmount(raw) {
  if (raw == null || raw === "") return null;
  let t = String(raw).trim();
  const parenNeg = /^\(.*\)$/.test(t);
  t = t.replace(/[()]/g, "").replace(/\$/g, "").replace(/,/g, "");
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return null;
  if (parenNeg) return -Math.abs(n);
  return n;
}

function parseAmountCellPositiveOnly(raw) {
  const n = parseSignedAmount(raw);
  if (n == null || n < 0) return null;
  return n;
}

function isoFromMDY(mm, dd, y) {
  const year = y.length === 2 ? (Number(y) > 50 ? 1900 : 2000) + Number(y) : Number(y);
  const m = String(mm).padStart(2, "0");
  const d = String(dd).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function parseFlexibleDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) return isoFromMDY(m[1], m[2], m[3]);
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseCsvBuffer(buffer) {
  const warnings = [];
  let text = buffer.toString("utf8");
  if (text.includes("\u0000")) {
    text = buffer.toString("utf16le");
    warnings.push("Detected UTF-16 CSV.");
  }

  let records;
  try {
    records = parse(text, {
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e) {
    return { transactions: [], warnings: [`CSV parse error: ${e.message}`] };
  }

  if (!records.length) {
    return { transactions: [], warnings: ["CSV appears empty."] };
  }

  const DATE_HEADER_CANDS = [
    "transaction date",
    "trans date",
    "date of transaction",
    "posting date",
    "post date",
    "posted",
    "purchase date",
    "activity date",
    "value date",
    "cleared date",
    "date",
  ];
  const DESC_HEADER_CANDS = [
    "description",
    "transaction description",
    "transaction details",
    "details",
    "merchant",
    "payee",
    "item",
    "memo",
    "name",
  ];
  const AMOUNT_HEADER_CANDS = [
    "transaction amount",
    "amount",
    "charge",
    "debit amount",
    "withdrawal amount",
  ];
  const DEBIT_HEADER_CANDS = ["debit", "withdrawal"];
  const CREDIT_HEADER_CANDS = ["credit", "payment"];
  const TYPE_HEADER_CANDS = ["type", "transaction type", "credit / debit", "credit/debit"];

  /** Banks often emit title lines before the real header row; score rows that look like column titles. */
  function headerRowScore(headerCells) {
    const headers = headerCells.map((h) => String(h ?? ""));
    if (!headers.some((h) => h.trim())) return 0;
    let score = 0;
    if (colIndex(headers, DATE_HEADER_CANDS) >= 0) score += 2;
    if (
      colIndex(headers, AMOUNT_HEADER_CANDS) >= 0 ||
      colIndex(headers, DEBIT_HEADER_CANDS) >= 0
    ) {
      score += 2;
    }
    if (colIndex(headers, DESC_HEADER_CANDS) >= 0) score += 1;
    return score;
  }

  let headerRowIndex = 0;
  const scanLimit = Math.min(60, records.length);
  for (let i = 0; i < scanLimit; i++) {
    const row = records[i];
    if (!row?.length) continue;
    if (headerRowScore(row) >= 4) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex > 0) {
    warnings.push(
      `Skipped ${headerRowIndex} leading row(s) before detected column headers (common in bank CSV exports).`
    );
  }

  const headers = records[headerRowIndex].map((h) => String(h ?? ""));
  const hasHeaderRow = headerRowScore(headers) >= 4;

  let dataRows = records;
  let idxDate = -1;
  let idxDesc = -1;
  let idxAmount = -1;
  let idxDebit = -1;
  let idxCredit = -1;
  let idxType = -1;

  if (hasHeaderRow) {
    idxDate = colIndex(headers, DATE_HEADER_CANDS);
    idxDesc = colIndex(headers, DESC_HEADER_CANDS);
    idxAmount = colIndex(headers, AMOUNT_HEADER_CANDS);
    idxDebit = colIndex(headers, DEBIT_HEADER_CANDS);
    idxCredit = colIndex(headers, CREDIT_HEADER_CANDS);
    idxType = colIndex(headers, TYPE_HEADER_CANDS);
    dataRows = records.slice(headerRowIndex + 1);
  } else {
    warnings.push(
      "No header row detected; assuming column 1 = date, column 2 = item, column 3 = charge."
    );
    idxDate = 0;
    idxDesc = 1;
    idxAmount = 2;
  }

  // Fixed layout fallback (1-based: col1 date, col2 item, col3 charge) when amount/date known but item wasn't matched by name.
  if (idxDate === 0 && idxAmount === 2 && idxDesc < 0 && headers.length >= 3) {
    idxDesc = 1;
  }

  if (idxDate < 0) {
    return {
      transactions: [],
      warnings: [
        ...warnings,
        "Could not find a Date column. Use headers like Transaction Date or Post Date.",
      ],
    };
  }

  if (idxAmount < 0 && idxDebit < 0) {
    return {
      transactions: [],
      warnings: [
        ...warnings,
        "Could not find an Amount or Debit column.",
      ],
    };
  }

  /** When Amount is mostly negative (Chase, etc.), charges are negatives; payments positives. */
  let amountConvention = "positive_charge";
  if (idxAmount >= 0 && idxDebit < 0) {
    let neg = 0;
    let pos = 0;
    for (const row of dataRows.slice(0, 40)) {
      if (!row?.length) continue;
      const n = parseSignedAmount(row[idxAmount]);
      if (n == null || n === 0) continue;
      if (n < 0) neg++;
      if (n > 0) pos++;
    }
    if (neg > 0 && neg >= pos) amountConvention = "negative_charge";
  }

  function isCreditRow(typeStr, signedAmount) {
    const t = String(typeStr ?? "").toUpperCase();
    if (
      /CREDIT|REFUND|RETURN|PAYMENT|PAYMENTS|DEPOSIT|CREDITS|AUTOPAY\s+PMT|PMT\s+FROM/i.test(t)
    ) {
      return true;
    }
    if (amountConvention === "negative_charge" && signedAmount != null && signedAmount > 0) {
      return true;
    }
    if (amountConvention === "positive_charge" && signedAmount != null && signedAmount < 0) {
      return true;
    }
    return false;
  }

  function expenseAmountFromRow(row) {
    if (idxDebit >= 0) {
      const v = parseAmountCellPositiveOnly(row[idxDebit]);
      if (v != null) return v;
    }
    if (idxAmount < 0) return null;
    const n = parseSignedAmount(row[idxAmount]);
    if (n == null || n === 0) return null;
    const typeStr = idxType >= 0 ? row[idxType] : "";
    if (isCreditRow(typeStr, n)) return null;
    return Math.abs(n);
  }

  const transactions = [];
  for (const row of dataRows) {
    if (!row || row.every((c) => !String(c ?? "").trim())) continue;

    if (idxCredit >= 0) {
      const credit = parseAmountCellPositiveOnly(row[idxCredit]);
      if (credit != null && credit > 0) continue;
    }

    const amount = expenseAmountFromRow(row);

    const spent_at = parseFlexibleDate(row[idxDate]);
    let description = idxDesc >= 0 ? String(row[idxDesc] ?? "").trim() : "";
    if (!description && row.length) {
      description = row
        .filter((_, i) => i !== idxDate && i !== idxAmount && i !== idxDebit && i !== idxCredit)
        .join(" ")
        .trim()
        .slice(0, 500);
    }
    if (!description) description = "Imported transaction";

    if (!spent_at || amount == null || amount <= 0) continue;

    transactions.push({
      spent_at,
      amount,
      description: description.slice(0, 500),
    });
  }

  if (!transactions.length && dataRows.length) {
    warnings.push(
      "No spend rows found. If your bank uses negative amounts for purchases (e.g. Chase), re-import after updating the app; otherwise check date/amount columns."
    );
  }

  return { transactions, warnings };
}

/**
 * Best-effort PDF parse: common pattern MM/DD (+ YY) description $amount
 */
async function parsePdfBuffer(buffer) {
  const warnings = [
    "PDF layout varies by issuer. For best results, export your Visa activity as CSV from your bank.",
  ];
  let text = "";
  try {
    const data = await pdfParse(buffer);
    text = data.text || "";
  } catch (e) {
    return { transactions: [], warnings: [...warnings, `PDF read error: ${e.message}`] };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const transactions = [];

  const re = /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(.+?)\s+(\(?\$?[\d,]+\.\d{2}\)?)\s*$/;

  for (const line of lines) {
    if (/balance|payment due|minimum|page|account|statement/i.test(line)) continue;
    const m = line.match(re);
    if (!m) continue;
    const spent_at = parseFlexibleDate(m[1]);
    const description = m[2].trim().slice(0, 500);
    const amountVal = parseSignedAmount(m[3]);
    const amount =
      amountVal != null && amountVal !== 0 ? Math.abs(amountVal) : null;
    if (spent_at && amount != null && amount > 0) {
      transactions.push({ spent_at, amount, description: description || "Imported from PDF" });
    }
  }

  if (!transactions.length) {
    warnings.push(
      "Could not extract transactions from this PDF. Try saving your statement as CSV."
    );
  }

  return { transactions, warnings };
}

/**
 * @param {import('multer').File} file
 */
export async function parseVisaStatementFile(file) {
  const name = (file.originalname || "").toLowerCase();
  const mime = file.mimetype || "";

  if (name.endsWith(".csv") || mime.includes("csv") || mime === "text/plain") {
    return parseCsvBuffer(file.buffer);
  }
  if (name.endsWith(".pdf") || mime === "application/pdf") {
    return parsePdfBuffer(file.buffer);
  }

  return {
    transactions: [],
    warnings: ["Unsupported file type. Upload a .csv or .pdf exported from your Visa issuer."],
  };
}
