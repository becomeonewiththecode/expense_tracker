/**
 * happy-dom does not resolve Tailwind's `rgb(var(--color-*) / <alpha>)` in getComputedStyle.
 * These rules mirror index.css "midnight" tokens as literal sRGB. Injected only from Vitest setup.
 */
export default `
body {
  background-color: rgb(2, 6, 23) !important;
}

.text-th-primary {
  color: rgb(241, 245, 249) !important;
}
.text-th-secondary {
  color: rgb(226, 232, 240) !important;
}
.text-th-tertiary {
  color: rgb(203, 213, 225) !important;
}
.text-th-subtle {
  color: rgb(148, 163, 184) !important;
}
.text-th-muted {
  color: rgb(100, 116, 139) !important;
}

.text-sky-200 {
  color: rgb(186, 230, 253) !important;
}
.text-sky-300 {
  color: rgb(125, 211, 252) !important;
}
.text-sky-400 {
  color: rgb(56, 189, 248) !important;
}

[class~="bg-th-surface"] {
  background-color: rgb(15, 23, 42) !important;
}
[class~="bg-th-surface/50"] {
  background-color: rgba(15, 23, 42, 0.5) !important;
}
[class~="bg-th-surface/55"] {
  background-color: rgba(15, 23, 42, 0.55) !important;
}
[class~="bg-th-surface/80"] {
  background-color: rgba(15, 23, 42, 0.8) !important;
}
[class~="bg-th-surface/90"] {
  background-color: rgba(15, 23, 42, 0.9) !important;
}
[class~="bg-th-surface/95"] {
  background-color: rgba(15, 23, 42, 0.95) !important;
}
`;
