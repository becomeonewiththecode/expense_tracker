import { Link } from "react-router-dom";
import AppVersionStamp from "../components/AppVersionStamp.jsx";
import "./LandingPage.css";

export default function LandingPage() {
  return (
    <div className="landing-editorial">
      <div className="lp-page">
        <header className="lp-header">
          <div className="lp-brand">
            Expense <span>Tracker</span>
          </div>
          <nav>
            <Link to="/login">Log in</Link>
            <Link className="lp-btn lp-btn-fill" to="/register">
              Get started
            </Link>
          </nav>
        </header>

        <section className="lp-hero-bento" aria-label="Introduction">
          <div className="lp-tile lp-hero-main">
            <h1>
              Personal finance, <i>edited</i> for clarity.
            </h1>
            <p className="lp-lede">
              Recurring bills, one-off spends, renewals, prescriptions, and installment plans — unified with
              imports, projections, and reports you can trust.
            </p>
            <div className="lp-actions">
              <Link className="lp-btn lp-btn-fill" to="/register">
                Create your workspace
              </Link>
              <Link className="lp-btn lp-btn-outline" to="/login">
                Sign in
              </Link>
            </div>
          </div>
          <div className="lp-tile lp-tile-side">
            <span className="lp-label">House expression</span>
            <p className="lp-tile-quote" style={{ margin: "0.75rem 0 0" }}>
              “I don’t have a spending problem — I have a long-term collaboration with ‘just this once.’”
            </p>
          </div>
          <div className="lp-tile lp-tile-side">
            <p className="lp-tile-quote">
              “Know what renews, what’s due, and what you already paid — without another spreadsheet.”
            </p>
          </div>
        </section>

        <section className="lp-grid-3" aria-label="Capabilities">
          <article className="lp-card">
            <h3>Statements → ledger</h3>
            <p>CSV and PDF imports with staging so you commit clean rows, not guesswork.</p>
          </article>
          <article className="lp-card">
            <h3>Time-aware reporting</h3>
            <p>From a single day to a custom window, see categories and trends that match how you plan.</p>
          </article>
          <article className="lp-card">
            <h3>Built-in specialized flows</h3>
            <p>Renewals, prescriptions, and payment plans get first-class screens — not bolt-on notes.</p>
          </article>
        </section>

        <div className="lp-footer-copy">
          <p style={{ margin: 0 }}>© 2026 Expense Tracker. All rights reserved.</p>
          <AppVersionStamp className="block mt-2 text-[0.75rem] opacity-90" />
        </div>
      </div>
    </div>
  );
}
