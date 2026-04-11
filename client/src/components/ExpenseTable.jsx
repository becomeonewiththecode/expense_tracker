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
import { setRowsPerPage, TABLE_ROWS_PER_PAGE_OPTIONS } from "../tablePreferences.js";
import {
  SORTABLE_TH_BUTTON,
  SORTABLE_TH_ICON_ACTIVE,
  SORTABLE_TH_ICON_IDLE,
  TABLE,
  TABLE_BODY,
  TABLE_CARD,
  TABLE_HEAD,
  TABLE_HEADER_BAR,
  TABLE_ROW,
  TABLE_SCROLL,
  TABLE_TD,
  TABLE_TD_STICKY_ACTIONS_DEFAULT,
  TABLE_TH,
  TABLE_TH_STICKY_ACTIONS,
} from "../tableStyles.js";
import PaginationControls from "./PaginationControls.jsx";
import RowActionsMenu from "./RowActionsMenu.jsx";
import TableUpdateFlash from "./TableUpdateFlash.jsx";

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
      cmp = formatFinancialInstitution(a.financial_institution, a.bank_name).localeCompare(
        formatFinancialInstitution(b.financial_institution, b.bank_name),
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

function SortableTh({ colKey, label, sort, onSort, className = "" }) {
  const active = sort.key === colKey;
  const dir = sort.dir;
  return (
    <th
      scope="col"
      className={[TABLE_TH, className].filter(Boolean).join(" ")}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className={`${SORTABLE_TH_BUTTON} text-left`}
        title={`Sort by ${label}`}
      >
        <span className="truncate">{label}</span>
        <span
          className={`shrink-0 text-[10px] leading-none w-3.5 text-center ${
            active ? SORTABLE_TH_ICON_ACTIVE : SORTABLE_TH_ICON_IDLE
          }`}
          aria-hidden
        >
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function ExpenseTable({
  items,
  onEdit,
  /** Called when pagination changes so the parent can close an open edit dialog. */
  onCancelEditSession,
  remove,
  onProjection,
  /** Omit to hide per-row Projection (e.g. Renewals list). */
  onRowProjection,
  showRenewalColumns = false,
  tableTitle = "Expenses",
  searchValue = "",
  onSearchChange = () => {},
  searchPlaceholder = "Search notes",
  updateFlashToken = 0,
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
    onCancelEditSession?.();
    setPage(nextPage);
  }

  function handleRowsPerPageChange(nextSize) {
    onCancelEditSession?.();
    setRowsPerPage(nextSize);
    setPage(1);
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
    <div className={`${TABLE_CARD} w-full min-w-0`}>
      <div className={TABLE_HEADER_BAR}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-th-primary">{tableTitle}</h2>
          <TableUpdateFlash token={updateFlashToken} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-48 rounded-lg bg-th-input border border-th-border-bright px-3 py-1.5 text-th-primary text-xs placeholder:text-th-muted"
          />
          <button
            type="button"
            onClick={onProjection}
            className="rounded-lg border border-violet-500/40 bg-violet-950/40 hover:bg-violet-900/35 text-violet-200 text-xs font-medium px-3 py-1.5"
          >
            Projection
          </button>
        </div>
      </div>
      <div className={TABLE_SCROLL}>
        <table
          data-expense-table
          className={`${TABLE} min-w-[56rem] text-th-primary`}
        >
          <thead className={TABLE_HEAD}>
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
              <th scope="col" className={TABLE_TH_STICKY_ACTIONS}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={TABLE_BODY}>
            {pageItems.map((row) => (
              <tr key={row.id} className={TABLE_ROW}>
                <td className={`${TABLE_TD} text-th-primary whitespace-nowrap`}>
                  {toDateInputValue(row.spent_at) || "—"}
                </td>
                <td className={`${TABLE_TD} text-th-primary`}>
                  <span className="font-semibold text-th-primary tabular-nums">${Number(row.amount).toFixed(2)}</span>
                </td>
                <td className={TABLE_TD}>
                  <span className="text-th-primary">{formatCategory(row.category)}</span>
                </td>
                <td className={`${TABLE_TD} hidden lg:table-cell`}>
                  <span className="text-th-primary">
                    {formatFrequency(row.frequency)}
                    {row.frequency === "bimonthly" && row.payment_day != null && row.payment_day_2 != null && (
                      <span className="text-th-subtle text-xs block">
                        Days {row.payment_day} &amp; {row.payment_day_2}
                      </span>
                    )}
                  </span>
                </td>
                <td className={`${TABLE_TD} text-th-primary hidden md:table-cell`}>
                  {formatFinancialInstitution(row.financial_institution, row.bank_name)}
                </td>
                <td className={`${TABLE_TD} hidden md:table-cell`}>
                  <span className="text-th-primary">{formatExpenseState(row.state)}</span>
                </td>
                {showRenewalColumns && (
                  <td className={`${TABLE_TD} text-th-primary hidden lg:table-cell`}>
                    {row.category === "renewal" ? formatRenewalKind(row.renewal_kind) : "—"}
                  </td>
                )}
                {showRenewalColumns && (
                  <td className={`${TABLE_TD} hidden xl:table-cell max-w-[12rem]`}>
                    {row.category === "renewal" && row.website ? (
                      <a
                        href={/^https?:\/\//i.test(row.website) ? row.website : `https://${row.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-300 hover:text-sky-200 truncate block max-w-[12rem]"
                      >
                        {row.website}
                      </a>
                    ) : (
                      <span className="text-th-primary">—</span>
                    )}
                  </td>
                )}
                <td className={`${TABLE_TD} text-th-secondary hidden sm:table-cell`}>
                  <span className="block max-w-xs truncate">{row.description}</span>
                </td>
                <td className={`${TABLE_TD_STICKY_ACTIONS_DEFAULT} whitespace-nowrap`}>
                  <div className="flex justify-end">
                    <RowActionsMenu
                      items={[
                        ...(onRowProjection
                          ? [
                              {
                                key: "projection",
                                label: "Projection",
                                className: "text-violet-400",
                                onClick: () => onRowProjection(row),
                              },
                            ]
                          : []),
                        {
                          key: "edit",
                          label: "Edit",
                          className: "text-sky-400",
                          onClick: () => onEdit(row),
                        },
                        {
                          key: "delete",
                          label: "Delete",
                          className: "text-rose-400",
                          onClick: () => remove(row.id),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalItems > 0 ? (
        <PaginationControls
          currentPage={safePage}
          totalItems={totalItems}
          pageSize={rowsPerPage}
          onPageChange={handlePageChange}
          onPageSizeChange={handleRowsPerPageChange}
          pageSizeOptions={TABLE_ROWS_PER_PAGE_OPTIONS}
        />
      ) : null}
    </div>
  );
}
