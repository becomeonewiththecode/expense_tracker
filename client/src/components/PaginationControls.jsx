export default function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
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
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800">
      <div className="text-xs text-slate-400">
        Page <span className="text-slate-200">{page}</span> of{" "}
        <span className="text-slate-200">{totalPages}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => canPrev && onPageChange(page - 1)}
          disabled={!canPrev}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
        >
          Prev
        </button>

        {pageNumbers.map((p, idx) => {
          const prevNum = pageNumbers[idx - 1];
          const showGap = idx > 0 && prevNum != null && p - prevNum > 1;
          return (
            <span key={`pg-${p}`}>
              {showGap ? <span className="px-1 text-slate-500">...</span> : null}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  p === page
                    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                    : "border border-slate-700 text-slate-300 hover:bg-slate-800"
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
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
        >
          Next
        </button>
      </div>

      <div className="text-xs text-slate-400">
        Showing{" "}
        <span className="text-slate-200">
          {Math.min(totalItems ?? 0, (page - 1) * safePageSize + 1)}–{Math.min(totalItems ?? 0, page * safePageSize)}
        </span>{" "}
        of <span className="text-slate-200">{totalItems ?? 0}</span>
      </div>
    </div>
  );
}

