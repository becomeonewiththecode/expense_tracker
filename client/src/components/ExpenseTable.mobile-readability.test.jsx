import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ExpenseTable from "./ExpenseTable.jsx";
import {
  contrastRatio,
  parseCssColor,
  relativeLuminance,
  resolveApproxBackgroundRgb,
} from "../test/cssColor.js";

/** Typical phone CSS viewport (CSS px). */
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

function setPhoneViewport() {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: PHONE_WIDTH,
  });
  Object.defineProperty(window, "outerWidth", {
    configurable: true,
    writable: true,
    value: PHONE_WIDTH,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: PHONE_HEIGHT,
  });
  Object.defineProperty(window, "outerHeight", {
    configurable: true,
    writable: true,
    value: PHONE_HEIGHT,
  });
  window.dispatchEvent(new Event("resize"));
  if (typeof window.happyDOM?.setViewport === "function") {
    window.happyDOM.setViewport({ width: PHONE_WIDTH, height: PHONE_HEIGHT });
  }
}

function isDisplayed(el) {
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
  return true;
}

function textPaintTarget(td) {
  const span = td.querySelector("span.text-th-primary, span.text-th-secondary, span.text-th-subtle");
  if (span instanceof HTMLElement && isDisplayed(span) && span.textContent?.trim()) return span;
  const link = td.querySelector("a[href]");
  if (link instanceof HTMLElement && isDisplayed(link) && link.textContent?.trim()) return link;
  return td;
}

function minContrastForCells(table, minRatio = 4.5) {
  /** `*ByRole('cell')` can omit nodes depending on a11y visibility; query real `td`s. */
  const tds = [...table.querySelectorAll("tbody td")];
  const ratios = [];
  for (const td of tds) {
    if (!isDisplayed(td)) continue;
    // Row actions use accent menu colors; this test targets data readability.
    if ((td.className || "").includes("sticky")) continue;

    const probe = textPaintTarget(td);
    const colorRaw = getComputedStyle(probe).color;
    const fg = parseCssColor(colorRaw);
    if (!fg || fg.a < 0.05) {
      throw new Error(`Unparseable or invisible foreground color on <td>: "${colorRaw}"`);
    }
    const bgRgb = resolveApproxBackgroundRgb(probe instanceof Element ? probe : td);
    const ratio = contrastRatio(relativeLuminance(fg), relativeLuminance(bgRgb));
    ratios.push(ratio);
    expect(
      ratio,
      `WCAG contrast for "${(td.textContent || "").slice(0, 40)}" should be >= ${minRatio}: got ${ratio.toFixed(2)}`
    ).toBeGreaterThanOrEqual(minRatio);
  }
  expect(ratios.length, "at least one visible body cell should be measured").toBeGreaterThan(0);
  return ratios;
}

const sampleExpense = {
  id: 1,
  spent_at: "2026-03-15",
  amount: 42.5,
  category: "groceries",
  frequency: "monthly",
  financial_institution: "bank",
  bank_name: null,
  state: "cleared",
  description: "Weekly shop",
  payment_day: null,
  payment_day_2: null,
  renewal_kind: null,
  website: null,
};

const sampleRenewal = {
  id: 2,
  spent_at: "2026-04-01",
  amount: 9.99,
  category: "renewal",
  frequency: "yearly",
  financial_institution: "card",
  bank_name: null,
  state: "pending",
  description: "Streaming",
  payment_day: null,
  payment_day_2: null,
  renewal_kind: "subscription",
  website: "example.com",
};

describe("ExpenseTable phone viewport readability", () => {
  beforeEach(() => {
    setPhoneViewport();
  });

  it("keeps WCAG AA contrast on visible cells (expense columns) at phone width", () => {
    const { container } = render(
      <div style={{ width: `${PHONE_WIDTH}px`, maxWidth: "100%" }}>
        <ExpenseTable
          items={[sampleExpense]}
          onEdit={() => {}}
          onCancelEditSession={() => {}}
          remove={() => {}}
          onProjection={() => {}}
          onRowProjection={() => {}}
        />
      </div>
    );

    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    minContrastForCells(table);
  });

  it("keeps WCAG AA contrast on visible cells (renewal columns) at phone width", () => {
    const { container } = render(
      <div style={{ width: `${PHONE_WIDTH}px`, maxWidth: "100%" }}>
        <ExpenseTable
          items={[sampleRenewal]}
          onEdit={() => {}}
          onCancelEditSession={() => {}}
          remove={() => {}}
          onProjection={() => {}}
          onRowProjection={() => {}}
          showRenewalColumns
        />
      </div>
    );

    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    minContrastForCells(table);
  });
});
