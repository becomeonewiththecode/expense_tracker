export default function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [],
}) {
  const safePageSize = pageSize > 0 ? pageSize : 19;
  const totalPages = Math.max(1, Math.ceil((totalItems ?? 0) / safePageSize));
  const page = Math.min(Math.max(1, currentPage), totalPages);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Compact page list: show first, last, and a small window around current.
  const pageNumbers = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const windowSize = 2;
    const start = Math.max(2, page - windowSize);
    const end = Math.min(totalPages - 1, page + windowSize);
    const nums = [1];
    for (let p = start; p <= end; p++) nums.push(p);
    nums.push(totalPages);
    return nums;
  })();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-th-border">
      <div className="text-xs text-th-subtle">
        Page <span className="text-th-secondary">{page}</span> of{" "}
        <span className="text-th-secondary">{totalPages}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => canPrev && onPageChange(page - 1)}
          disabled={!canPrev}
          className="rounded-lg border border-th-border-bright px-3 py-1.5 text-xs text-th-tertiary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-th-surface-alt"
        >
          Prev
        </button>

        {pageNumbers.map((p, idx) => {
          const prevNum = pageNumbers[idx - 1];
          const showGap = idx > 0 && prevNum != null && p - prevNum > 1;
          return (
            <span key={`pg-${p}`}>
              {showGap ? <span className="px-1 text-th-muted">...</span> : null}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  p === page
                    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                    : "border border-th-border-bright text-th-tertiary hover:bg-th-surface-alt"
                }`}
              >
                {p}
              </button>
            </span>
          );
        })}

        <button
          type="button"
          onClick={() => canNext && onPageChange(page + 1)}
          disabled={!canNext}
          className="rounded-lg border border-th-border-bright px-3 py-1.5 text-xs text-th-tertiary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-th-surface-alt"
        >
          Next
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-th-subtle">
        {onPageSizeChange && pageSizeOptions.length > 0 ? (
          <label className="inline-flex items-center gap-1.5">
            <span>Rows</span>
            <select
              value={safePageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md bg-th-input border border-th-border-bright px-1.5 py-1 text-xs text-th-secondary"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <span>
          Showing{" "}
          <span className="text-th-secondary">
            {Math.min(totalItems ?? 0, (page - 1) * safePageSize + 1)}–
            {Math.min(totalItems ?? 0, page * safePageSize)}
          </span>{" "}
          of <span className="text-th-secondary">{totalItems ?? 0}</span>
        </span>
      </div>
    </div>
  );
}

