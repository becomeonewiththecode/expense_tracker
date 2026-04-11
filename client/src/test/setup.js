import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import indexCss from "../index.css?inline";
import happyDomColorShim from "./happyDomColorShim.js";

/**
 * Vitest + happy-dom do not attach Vite-processed CSS as document stylesheets, so
 * `getComputedStyle` would otherwise return empty strings. Inline inject once.
 */
function ensureGlobalStyles() {
  if (!document.getElementById("vitest-global-css")) {
    const style = document.createElement("style");
    style.id = "vitest-global-css";
    style.textContent = indexCss;
    document.head.appendChild(style);
  }
  if (!document.getElementById("vitest-color-shim")) {
    const shim = document.createElement("style");
    shim.id = "vitest-color-shim";
    shim.textContent = happyDomColorShim;
    document.head.appendChild(shim);
  }
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  ensureGlobalStyles();
  localStorage.clear();
  document.documentElement.setAttribute("data-theme", "midnight");
  document.body.removeAttribute("style");
  document.body.innerHTML = "";
});
