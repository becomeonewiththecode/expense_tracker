import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ReportsPage from "./ReportsPage.jsx";
import IncomePage from "./IncomePage.jsx";
import ExpensesPage from "./ExpensesPage.jsx";

function tabClass(active) {
  return [
    "relative pb-3 pt-1 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",
    "outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-th-base rounded-t",
    active
      ? "border-emerald-500 text-emerald-300"
      : "border-transparent text-th-muted hover:text-th-secondary hover:border-th-border",
  ].join(" ");
}

function parseBudgetHubView(searchParams) {
  const v = searchParams.get("view");
  if (v === "reports") return "reports";
  if (v === "income") return "income";
  if (v === "import") return "import";
  return "budget";
}

export default function BudgetHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseBudgetHubView(searchParams);

  const setView = useCallback(
    (next) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "budget") p.delete("view");
          else p.set("view", next);
          return p;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Budget &amp; reports</h1>
        <p className="text-sm text-th-subtle mt-1">
          Log inflows, import statements, set budget caps, then dig into reports. Use{" "}
          <strong className="text-th-tertiary font-medium">Income</strong> for paychecks and other inflows;{" "}
          <strong className="text-th-tertiary font-medium">Import</strong> for uploads and manual adds;{" "}
          <strong className="text-th-tertiary font-medium">Budget</strong> for caps and variance;{" "}
          <strong className="text-th-tertiary font-medium">Reports</strong> for daily, weekly, and other periods.
        </p>
      </div>

      <div className="border-b border-th-border">
        <nav className="flex flex-wrap gap-8" role="tablist" aria-label="Income, import, budget, and reports">
          <button
            type="button"
            role="tab"
            id="budget-hub-tab-income"
            aria-selected={view === "income"}
            aria-controls="budget-hub-panel"
            className={tabClass(view === "income")}
            onClick={() => setView("income")}
          >
            Income
          </button>
          <button
            type="button"
            role="tab"
            id="budget-hub-tab-import"
            aria-selected={view === "import"}
            aria-controls="budget-hub-panel"
            className={tabClass(view === "import")}
            onClick={() => setView("import")}
          >
            Import
          </button>
          <button
            type="button"
            role="tab"
            id="budget-hub-tab-budget"
            aria-selected={view === "budget"}
            aria-controls="budget-hub-panel"
            className={tabClass(view === "budget")}
            onClick={() => setView("budget")}
          >
            Budget
          </button>
          <button
            type="button"
            role="tab"
            id="budget-hub-tab-reports"
            aria-selected={view === "reports"}
            aria-controls="budget-hub-panel"
            className={tabClass(view === "reports")}
            onClick={() => setView("reports")}
          >
            Reports
          </button>
        </nav>
      </div>

      <div
        id="budget-hub-panel"
        role="tabpanel"
        aria-labelledby={
          view === "import"
            ? "budget-hub-tab-import"
            : view === "budget"
              ? "budget-hub-tab-budget"
              : view === "income"
                ? "budget-hub-tab-income"
                : "budget-hub-tab-reports"
        }
      >
        {view === "import" ? (
          <ExpensesPage key="import" embedded />
        ) : view === "income" ? (
          <IncomePage key="income" embedded />
        ) : (
          <ReportsPage
            key={view}
            variant={view === "budget" ? "monthly_budget" : "full"}
            embedded
          />
        )}
      </div>
    </div>
  );
}
