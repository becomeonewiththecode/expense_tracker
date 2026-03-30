import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api.js";
import { formatPrescriptionCategory } from "../prescriptionOptions.js";
import { daysUntilPrescriptionRenewal, prescriptionNeedsReminder } from "../prescriptionSchedule.js";

function leadPhrase(days) {
  if (days == null) return "";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

export default function PrescriptionReminders() {
  const [rows, setRows] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  function fetchRows() {
    api
      .get("/prescriptions", { params: { limit: 500 } })
      .then((r) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]));
  }

  useEffect(() => {
    fetchRows();
    function onChanged() {
      fetchRows();
      setDismissed(false);
    }
    window.addEventListener("prescriptions-changed", onChanged);
    return () => window.removeEventListener("prescriptions-changed", onChanged);
  }, []);

  const due = useMemo(() => rows.filter(prescriptionNeedsReminder), [rows]);

  if (due.length === 0 || dismissed) return null;

  return (
    <div
      className="mb-6 rounded-xl border border-cyan-900/60 bg-cyan-950/35 px-4 py-3 text-sm text-cyan-100"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-cyan-50">Prescription renewals</p>
          <p className="text-cyan-200/90 mt-1">
            {due.length} item{due.length === 1 ? "" : "s"} in the next 30 days (or recently overdue)—plan refills or
            appointments.
          </p>
          <ul className="mt-2 space-y-1 text-cyan-100/95">
            {due.slice(0, 8).map((r) => {
              const days = daysUntilPrescriptionRenewal(r.next_renewal_date);
              return (
                <li key={r.id}>
                  <span className="text-cyan-300/90">{r.name}</span>
                  <span className="text-cyan-500/80"> · </span>
                  {formatPrescriptionCategory(r.category)}
                  <span className="text-cyan-500/80"> · </span>
                  {leadPhrase(days)}
                </li>
              );
            })}
            {due.length > 8 ? (
              <li className="text-cyan-400/80">+{due.length - 8} more…</li>
            ) : null}
          </ul>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Link
            to="/prescriptions"
            className="text-sm font-medium text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
          >
            Open Prescriptions
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-xs text-cyan-500/90 hover:text-cyan-300"
          >
            Dismiss for this visit
          </button>
        </div>
      </div>
    </div>
  );
}
