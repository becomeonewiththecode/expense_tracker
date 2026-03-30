import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_OPTIONS,
  EXPENSE_STATE_OPTIONS,
  FREQUENCY_OPTIONS,
  FINANCIAL_INSTITUTION_OPTIONS,
  RENEWAL_KIND_OPTIONS,
  formatCategory,
  formatExpenseState,
  formatFinancialInstitution,
  formatFrequency,
  formatRenewalKind,
} from "../expenseOptions.js";
import useTableRowsPerPage from "../hooks/useTableRowsPerPage.js";
import PaginationControls from "./PaginationControls.jsx";

/** Normalize API spent_at to YYYY-MM-DD for date inputs and sorting. */
function toDateInputValue(spentAt) {
  if (spentAt == null) return "";
  const s = String(spentAt);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

/** Sortable data columns (not Actions). */
const SORT_KEYS = [
  "spent_at",
  "amount",
  "category",
  "renewal_kind",
  "website",
  "frequency",
  "financial_institution",
  "state",
  "description",
];

function compareExpenseRows(a, b, key, dir) {
  const mul = dir === "asc" ? 1 : -1;
  const tie = (a.id ?? 0) - (b.id ?? 0);
  let cmp = 0;
  switch (key) {
    case "spent_at": {
      const va = toDateInputValue(a.spent_at) || "";
      const vb = toDateInputValue(b.spent_at) || "";
      cmp = va.localeCompare(vb);
      break;
    }
    case "amount": {
      const na = Number(a.amount);
      const nb = Number(b.amount);
      cmp = (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
      break;
    }
    case "category":
      cmp = formatCategory(a.category).localeCompare(formatCategory(b.category), undefined, {
        sensitivity: "base",
      });
      break;
    case "renewal_kind":
      cmp = formatRenewalKind(a.renewal_kind).localeCompare(
        formatRenewalKind(b.renewal_kind),
        undefined,
        { sensitivity: "base" }
      );
      break;
    case "website":
      cmp = String(a.website ?? "")
        .toLowerCase()
        .localeCompare(String(b.website ?? "").toLowerCase(), undefined, { numeric: true });
      break;
    case "frequency":
      cmp = formatFrequency(a.frequency).localeCompare(formatFrequency(b.frequency), undefined, {
        sensitivity: "base",
      });
      break;
    case "financial_institution":
      cmp = formatFinancialInstitution(a.financial_institution).localeCompare(
        formatFinancialInstitution(b.financial_institution),
        undefined,
        { sensitivity: "base" }
      );
      break;
    case "state":
      cmp = formatExpenseState(a.state).localeCompare(formatExpenseState(b.state), undefined, {
        sensitivity: "base",
      });
      break;
    case "description":
      cmp = String(a.description ?? "")
        .toLowerCase()
        .localeCompare(String(b.description ?? "").toLowerCase(), undefined, {
          sensitivity: "base",
          numeric: true,
        });
      break;
    default:
      return tie;
  }
  if (cmp !== 0) return cmp * mul;
  return tie;
}

function sortExpenseItems(items, key, dir) {
  if (!key || !SORT_KEYS.includes(key)) return items;
  return [...items].sort((a, b) => compareExpenseRows(a, b, key, dir));
}

function SortableTh({ colKey, label, sort, onSort, className }) {
  const active = sort.key === colKey;
  const dir = sort.dir;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className="group inline-flex items-center gap-1 w-full min-w-0 text-left font-medium uppercase tracking-wide text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 rounded px-0.5 -mx-0.5 -my-1"
        title={`Sort by ${label}`}
      >
        <span className="truncate">{label}</span>
        <span
          className={`shrink-0 text-[10px] leading-none w-3.5 text-center ${
            active ? "text-sky-400" : "text-slate-600 opacity-0 group-hover:opacity-100"
          }`}
          aria-hidden
        >
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

/** Merge saved row with in-progress edit for projection preview. */
function rowSnapshotForProjection(row, draft) {
  if (draft) {
    const amt = Number(draft.amount);
    return {
      ...row,
      amount: Number.isFinite(amt) ? amt : row.amount,
      category: draft.category,
      renewal_kind: draft.renewal_kind,
      website: draft.website,
      frequency: draft.frequency,
      financial_institution: draft.financial_institution,
      state: draft.state,
      description: draft.description,
      spent_at: draft.spent_at,
    };
  }
  return row;
}

export default function ExpenseTable({
  items,
  expensesModifyMode,
  setExpensesModifyMode,
  expenseEditId,
  expenseEditDraft,
  setExpenseEditDraft,
  expenseSaving,
  openExpenseEdit,
  cancelExpenseEdit,
  saveExpenseEdit,
  remove,
  onProjection,
  /** Omit to hide per-row Projection (e.g. Renewals list). */
  onRowProjection,
  showRenewalColumns = false,
  tableTitle = "Expenses",
}) {
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const rowsPerPage = useTableRowsPerPage();
  const [page, setPage] = useState(1);

  const sortedItems = useMemo(
    () => sortExpenseItems(items, sort.key, sort.dir),
    [items, sort.key, sort.dir]
  );

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage]);

  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, rowsPerPage)));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageItems = sortedItems.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  );

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  function handlePageChange(nextPage) {
    cancelExpenseEdit();
    setPage(nextPage);
  }

  function handleSort(colKey) {
    setSort((prev) => {
      if (prev.key === colKey) {
        return { key: colKey, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key: colKey, dir: "asc" };
    });
  }

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/80 border-b border-slate-800">
        <h2 className="text-sm font-medium text-slate-200">{tableTitle}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onProjection}
            className="rounded-lg border border-violet-500/40 bg-violet-950/40 hover:bg-violet-900/35 text-violet-200 text-xs font-medium px-3 py-1.5"
          >
            Projection
          </button>
          {expensesModifyMode ? (
            <button
              type="button"
              onClick={() => {
                cancelExpenseEdit();
                setExpensesModifyMode(false);
              }}
              className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5"
            >
              Exit modification mode
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpensesModifyMode(true)}
              className="rounded-lg bg-sky-700/80 hover:bg-sky-600 text-white text-xs font-medium px-3 py-1.5"
            >
              Enter modification mode
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[70rem] text-sm text-left">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
            <tr>
              <SortableTh
                colKey="spent_at"
                label="Transaction"
                sort={sort}
                onSort={handleSort}
                className="px-4 py-3 w-[9.5rem]"
              />
              <SortableTh
                colKey="amount"
                label="Amount"
                sort={sort}
                onSort={handleSort}
                className="px-4 py-3 w-[5.5rem]"
              />
              <SortableTh
                colKey="category"
                label="Category"
                sort={sort}
                onSort={handleSort}
                className="px-4 py-3 w-[7.5rem]"
              />
              <SortableTh
                colKey="frequency"
                label="Frequency"
                sort={sort}
                onSort={handleSort}
                className="px-4 py-3 hidden lg:table-cell w-[6.5rem]"
              />
              <SortableTh
                colKey="financial_institution"
                label="Institution"
                sort={sort}
                onSort={handleSort}
                className="px-4 py-3 hidden md:table-cell w-[7rem]"
              />
              <SortableTh
                colKey="state"
                label="State"
                sort={sort}
                onSort={handleSort}
                className="px-4 py-3 hidden md:table-cell w-[5.5rem]"
              />
              {showRenewalColumns && (
                <SortableTh
                  colKey="renewal_kind"
                  label="Renewal type"
                  sort={sort}
                  onSort={handleSort}
                  className="px-4 py-3 min-w-[9rem] hidden lg:table-cell"
                />
              )}
              {showRenewalColumns && (
                <SortableTh
                  colKey="website"
                  label="Website"
                  sort={sort}
                  onSort={handleSort}
                  className="px-4 py-3 min-w-[8rem] hidden xl:table-cell"
                />
              )}
              <SortableTh
                colKey="description"
                label="Note"
                sort={sort}
                onSort={handleSort}
                className="px-4 py-3 hidden sm:table-cell min-w-[8rem]"
              />
              <th scope="col" className="px-4 py-3 text-right min-w-[15rem] font-medium uppercase tracking-wide text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {pageItems.map((row) => {
              const editing = expensesModifyMode && expenseEditId === row.id;
              const d = expenseEditDraft;
              const snapshot = rowSnapshotForProjection(row, editing ? d : null);
              return (
                <tr key={row.id} className={editing ? "bg-slate-900/80" : "hover:bg-slate-900/60"}>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap align-middle">
                    {editing && d ? (
                      <input
                        type="date"
                        value={d.spent_at}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, spent_at: e.target.value } : prev
                          )
                        }
                        className="w-full min-w-[9.5rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      />
                    ) : (
                      toDateInputValue(row.spent_at) || "—"
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {editing && d ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.amount}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, amount: e.target.value } : prev
                          )
                        }
                        className="w-full max-w-[7rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs tabular-nums"
                      />
                    ) : (
                      <span className="font-medium text-white tabular-nums">
                        ${Number(row.amount).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 align-middle">
                    {editing && d ? (
                      <select
                        value={d.category}
                        onChange={(e) => {
                          const category = e.target.value;
                          setExpenseEditDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  category,
                                  renewal_kind: category === "renewal" ? prev.renewal_kind : "",
                                }
                              : prev
                          );
                        }}
                        className="w-full max-w-[11rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        {CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatCategory(row.category)
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-slate-300 align-middle ${editing ? "" : "hidden lg:table-cell"}`}
                  >
                    {editing && d ? (
                      <select
                        value={d.frequency}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, frequency: e.target.value } : prev
                          )
                        }
                        className="w-full max-w-[8rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        {FREQUENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatFrequency(row.frequency)
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-slate-300 align-middle ${editing ? "" : "hidden md:table-cell"}`}
                  >
                    {editing && d ? (
                      <select
                        value={d.financial_institution}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, financial_institution: e.target.value } : prev
                          )
                        }
                        className="w-full max-w-[10rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        {FINANCIAL_INSTITUTION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatFinancialInstitution(row.financial_institution)
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-slate-300 align-middle ${editing ? "" : "hidden md:table-cell"}`}
                  >
                    {editing && d ? (
                      <select
                        value={d.state}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, state: e.target.value } : prev
                          )
                        }
                        className="w-full max-w-[8rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        {EXPENSE_STATE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatExpenseState(row.state)
                    )}
                  </td>
                  {showRenewalColumns && (
                    <td
                      className={`px-4 py-3 text-slate-300 align-middle hidden lg:table-cell ${editing ? "" : ""}`}
                    >
                      {editing && d && d.category === "renewal" ? (
                        <select
                          value={d.renewal_kind || ""}
                          onChange={(e) =>
                            setExpenseEditDraft((prev) =>
                              prev ? { ...prev, renewal_kind: e.target.value } : prev
                            )
                          }
                          className="w-full max-w-[12rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                        >
                          <option value="">— Type —</option>
                          {RENEWAL_KIND_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : row.category === "renewal" ? (
                        formatRenewalKind(row.renewal_kind)
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {showRenewalColumns && (
                    <td
                      className={`px-4 py-3 text-slate-300 align-middle hidden xl:table-cell max-w-[12rem]`}
                    >
                      {editing && d && d.category === "renewal" ? (
                        <input
                          value={d.website ?? ""}
                          onChange={(e) =>
                            setExpenseEditDraft((prev) =>
                              prev ? { ...prev, website: e.target.value } : prev
                            )
                          }
                          className="w-full min-w-0 rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-slate-300 text-xs"
                          placeholder="URL or portal"
                        />
                      ) : row.category === "renewal" && row.website ? (
                        <a
                          href={
                            /^https?:\/\//i.test(row.website)
                              ? row.website
                              : `https://${row.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 hover:text-sky-300 truncate block max-w-[12rem]"
                        >
                          {row.website}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td
                    className={`px-4 py-3 align-middle ${editing ? "" : "hidden sm:table-cell"}`}
                  >
                    {editing && d ? (
                      <input
                        value={d.description}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, description: e.target.value } : prev
                          )
                        }
                        className="w-full min-w-[8rem] max-w-xs rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-slate-300 text-xs"
                        placeholder="Note"
                      />
                    ) : (
                      <span className="text-slate-500 max-w-xs truncate block">{row.description}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-middle min-w-[15rem]">
                    {editing ? (
                      <div className="flex flex-row flex-wrap gap-x-3 gap-y-1 justify-end items-center">
                        {onRowProjection && (
                          <button
                            type="button"
                            onClick={() => onRowProjection(snapshot)}
                            className="shrink-0 text-violet-400 hover:text-violet-300 text-xs"
                          >
                            Projection
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={expenseSaving}
                          onClick={() => saveExpenseEdit()}
                          className="shrink-0 text-emerald-400 hover:text-emerald-300 text-xs disabled:opacity-50"
                        >
                          {expenseSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={expenseSaving}
                          onClick={cancelExpenseEdit}
                          className="shrink-0 text-slate-400 hover:text-slate-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-row flex-wrap gap-x-3 gap-y-1 justify-end items-center">
                        {onRowProjection && (
                          <button
                            type="button"
                            onClick={() => onRowProjection(snapshot)}
                            className="shrink-0 text-violet-400 hover:text-violet-300 text-xs"
                          >
                            Projection
                          </button>
                        )}
                        {expensesModifyMode && (
                          <button
                            type="button"
                            onClick={() => openExpenseEdit(row)}
                            className="shrink-0 text-sky-400 hover:text-sky-300 text-xs"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(row.id)}
                          className="shrink-0 text-rose-400 hover:text-rose-300 text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalItems > 0 && (
          <PaginationControls
            currentPage={safePage}
            totalItems={totalItems}
            pageSize={rowsPerPage}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
