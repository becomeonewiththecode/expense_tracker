import {
  CATEGORY_OPTIONS,
  EXPENSE_STATE_OPTIONS,
  FREQUENCY_OPTIONS,
  FINANCIAL_INSTITUTION_OPTIONS,
  RENEWAL_KIND_OPTIONS,
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
    payment_day_2: "",
    state: "active",
    description: "",
    renewal_kind: "",
    website: "",
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
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8 items-end bg-slate-900/50 border border-slate-800 rounded-xl p-4"
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
          onChange={(e) => {
            const category = e.target.value;
            setForm((f) => ({
              ...f,
              category,
              renewal_kind: category === "renewal" ? f.renewal_kind : "",
            }));
          }}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {form.category === "renewal" && (
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="text-xs text-slate-500 block mb-1">Renewal type</label>
          <select
            value={form.renewal_kind}
            onChange={(e) => setForm((f) => ({ ...f, renewal_kind: e.target.value }))}
            required
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
          >
            <option value="">— Select type —</option>
            {RENEWAL_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {form.category === "renewal" && (
        <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <label className="text-xs text-slate-500 block mb-1">Website (optional)</label>
          <input
            type="text"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
            placeholder="https://…"
          />
        </div>
      )}
      <div>
        <label className="text-xs text-slate-500 block mb-1">Frequency</label>
        <select
          value={form.frequency}
          onChange={(e) => {
            const frequency = e.target.value;
            setForm((f) => ({
              ...f,
              frequency,
              payment_day: frequency === "bimonthly" ? f.payment_day : "",
              payment_day_2: frequency === "bimonthly" ? f.payment_day_2 : "",
            }));
          }}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {form.frequency === "bimonthly" && (
        <>
          <div>
            <label className="text-xs text-slate-500 block mb-1">1st payment day</label>
            <input
              type="number"
              min="1"
              max="30"
              value={form.payment_day}
              onChange={(e) => setForm((f) => ({ ...f, payment_day: e.target.value }))}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
              placeholder="1–30"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">2nd payment day</label>
            <input
              type="number"
              min="1"
              max="30"
              value={form.payment_day_2}
              onChange={(e) => setForm((f) => ({ ...f, payment_day_2: e.target.value }))}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
              placeholder="1–30"
              required
            />
          </div>
        </>
      )}
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
        <label className="text-xs text-slate-500 block mb-1">State</label>
        <select
          value={form.state}
          onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
        >
          {EXPENSE_STATE_OPTIONS.map((o) => (
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
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 px-4 justify-self-start sm:col-span-2 xl:col-span-8"
      >
        {submitLabel}
      </button>
    </form>
  );
}
