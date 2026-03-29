import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  FINANCIAL_INSTITUTION_OPTIONS,
  PAYMENT_DAY_OPTIONS,
  PAYMENT_MONTH_OPTIONS,
} from "../expenseOptions.js";

export function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyManualExpenseForm() {
  return {
    amount: "",
    category: "personal",
    financial_institution: "bank",
    frequency: "monthly",
    payment_day: "",
    payment_month: "",
    description: "",
    spent_at: todayISODate(),
  };
}

export default function ManualExpenseForm({
  form,
  setForm,
  onSubmit,
  submitLabel = "Add expense",
  disabled = false,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9 items-end bg-slate-900/50 border border-slate-800 rounded-xl p-4"
    >
      <div>
        <label className="text-xs text-slate-500 block mb-1">Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
          placeholder="0.00"
          required
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">Category</label>
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">Frequency</label>
        <select
          value={form.frequency}
          onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">
          Date <span className="text-slate-600 font-normal normal-case">(1–30)</span>
        </label>
        <select
          value={form.payment_day}
          onChange={(e) => setForm((f) => ({ ...f, payment_day: e.target.value }))}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
          title="Day of the month the payment is typically made"
          aria-label="Date as day of month, 1 to 30"
        >
          {PAYMENT_DAY_OPTIONS.map((o) => (
            <option key={o.value === "" ? "unset" : o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">
          Month <span className="text-slate-600 font-normal normal-case">(1–12)</span>
        </label>
        <select
          value={form.payment_month}
          onChange={(e) => setForm((f) => ({ ...f, payment_month: e.target.value }))}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
          title="Typical calendar month for recurring expenses (optional)"
          aria-label="Month of year, 1 to 12"
        >
          {PAYMENT_MONTH_OPTIONS.map((o) => (
            <option key={o.value === "" ? "unset" : o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
        <label className="text-xs text-slate-500 block mb-1">Financial institution</label>
        <select
          value={form.financial_institution}
          onChange={(e) =>
            setForm((f) => ({ ...f, financial_institution: e.target.value }))
          }
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
        >
          {FINANCIAL_INSTITUTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">Transaction date</label>
        <input
          type="date"
          value={form.spent_at}
          onChange={(e) => setForm((f) => ({ ...f, spent_at: e.target.value }))}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
          required
        />
      </div>
      <div className="sm:col-span-2 xl:col-span-2">
        <label className="text-xs text-slate-500 block mb-1">Note</label>
        <input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
          placeholder="Optional"
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 px-4 justify-self-start sm:col-span-2 xl:col-span-9"
      >
        {submitLabel}
      </button>
    </form>
  );
}
