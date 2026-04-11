import { render } from "@testing-library/react";
import { createElement } from "react";
import { expect, it } from "vitest";
import happyDomColorShim from "./happyDomColorShim.js";

it("happy-dom computes a trivial author stylesheet", () => {
  document.body.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = ".x{color:rgb(1,2,3)!important}";
  document.head.appendChild(style);
  const div = document.createElement("div");
  div.className = "x";
  document.body.appendChild(div);
  expect(getComputedStyle(div).color).toMatch(/rgb\(/);
});

it("happyDomColorShim module contains th token rules", () => {
  expect(happyDomColorShim).toContain(".text-th-primary");
});

it("setup injects vitest-color-shim into document head", () => {
  expect(document.getElementById("vitest-color-shim")?.textContent || "").toContain(".text-th-primary");
});

it("shim makes Tailwind th text utilities computable in happy-dom", () => {
  document.body.innerHTML = "";
  const { container } = render(createElement("div", { className: "text-th-primary" }, "hello"));
  expect(getComputedStyle(container.firstChild).color).toMatch(/rgb\(/);
});
