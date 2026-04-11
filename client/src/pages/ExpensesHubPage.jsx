import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import YourExpensesPage from "./YourExpensesPage.jsx";
import RenewalsPage from "./RenewalsPage.jsx";
import PrescriptionsPage from "./PrescriptionsPage.jsx";
import PaymentPlansPage from "./PaymentPlansPage.jsx";

function tabClass(active) {
  return [
    "relative pb-3 pt-1 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",
    "outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-th-base rounded-t",
    active
      ? "border-emerald-500 text-emerald-300"
      : "border-transparent text-th-secondary hover:text-th-primary hover:border-th-border",
  ].join(" ");
}

function parseExpensesHubView(searchParams) {
  const v = searchParams.get("view");
  if (v === "renewals") return "renewals";
  if (v === "prescriptions") return "prescriptions";
  if (v === "payment-plans") return "payment-plans";
  return "list";
}

function tabIdForView(view) {
  if (view === "renewals") return "expenses-hub-tab-renewals";
  if (view === "prescriptions") return "expenses-hub-tab-prescriptions";
  if (view === "payment-plans") return "expenses-hub-tab-payment-plans";
  return "expenses-hub-tab-list";
}

export default function ExpensesHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseExpensesHubView(searchParams);

  const setView = useCallback(
    (next) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "list") p.delete("view");
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
        <h1 className="text-xl font-semibold text-white">Expenses</h1>
        <p className="text-sm text-th-subtle mt-1">
          Saved expense lines, renewals (category Renewal), prescriptions, and payment plans. Use{" "}
          <strong className="text-th-tertiary font-medium">Income hub → Import</strong> to add or upload transactions.
        </p>
      </div>

      <div className="border-b border-th-border">
        <nav
          className="flex flex-wrap gap-8"
          role="tablist"
          aria-label="Expenses, renewals, prescriptions, and payment plans"
        >
          <button
            type="button"
            role="tab"
            id="expenses-hub-tab-list"
            aria-selected={view === "list"}
            aria-controls="expenses-hub-panel"
            className={tabClass(view === "list")}
            onClick={() => setView("list")}
          >
            Expenses
          </button>
          <button
            type="button"
            role="tab"
            id="expenses-hub-tab-renewals"
            aria-selected={view === "renewals"}
            aria-controls="expenses-hub-panel"
            className={tabClass(view === "renewals")}
            onClick={() => setView("renewals")}
          >
            Renewals
          </button>
          <button
            type="button"
            role="tab"
            id="expenses-hub-tab-prescriptions"
            aria-selected={view === "prescriptions"}
            aria-controls="expenses-hub-panel"
            className={tabClass(view === "prescriptions")}
            onClick={() => setView("prescriptions")}
          >
            Prescriptions
          </button>
          <button
            type="button"
            role="tab"
            id="expenses-hub-tab-payment-plans"
            aria-selected={view === "payment-plans"}
            aria-controls="expenses-hub-panel"
            className={tabClass(view === "payment-plans")}
            onClick={() => setView("payment-plans")}
          >
            Payment Plan
          </button>
        </nav>
      </div>

      <div
        id="expenses-hub-panel"
        className="min-w-0"
        role="tabpanel"
        aria-labelledby={tabIdForView(view)}
      >
        {view === "list" ? (
          <YourExpensesPage key="list" embedded />
        ) : view === "renewals" ? (
          <RenewalsPage key="renewals" embedded />
        ) : view === "prescriptions" ? (
          <PrescriptionsPage key="prescriptions" embedded />
        ) : (
          <PaymentPlansPage key="payment-plans" embedded />
        )}
      </div>
    </div>
  );
}
