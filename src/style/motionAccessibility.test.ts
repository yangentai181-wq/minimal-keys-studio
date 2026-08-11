import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const motionCss = readFileSync(resolve(import.meta.dirname, "../motion/motion.css"), "utf8");

describe("motion accessibility", () => {
  it("defines the shared durations and removes transforms for reduced motion", () => {
    expect(motionCss).toContain("--motion-press: 90ms");
    expect(motionCss).toContain("--motion-return: 120ms");
    expect(motionCss).toContain("--motion-view: 160ms");
    expect(motionCss).toContain("--motion-confirm: 220ms");
    expect(motionCss).toContain("--motion-dialog-in: 200ms");
    expect(motionCss).toContain("--motion-dialog-out: 140ms");
    expect(motionCss).toContain("@media (prefers-reduced-motion: reduce)");

    const reducedMotion = motionCss.split("@media (prefers-reduced-motion: reduce)")[1];
    expect(reducedMotion).toContain("transform: none");
  });

  it("uses the specified easing and separate press and return timing", () => {
    expect(motionCss).toContain(
      "animation: motion-enter var(--motion-view) cubic-bezier(0, 0, 0.2, 1)"
    );
    expect(motionCss).toContain(
      "animation: motion-confirmed var(--motion-confirm) cubic-bezier(0.4, 0, 0.2, 1)"
    );
    expect(motionCss).toContain(
      "animation: motion-closing var(--motion-dialog-out) cubic-bezier(0.4, 0, 0.2, 1) forwards"
    );
    expect(motionCss).toContain(
      "transition: transform var(--motion-return) cubic-bezier(0.4, 0, 0.2, 1)"
    );
    expect(motionCss).toContain(
      "transition: transform var(--motion-press) cubic-bezier(0.4, 0, 0.2, 1)"
    );
  });

  it("uses dialog-specific entry timing and fades only native dialog backdrops", () => {
    expect(motionCss).toContain(
      '[data-motion-kind="dialog"][data-motion-state="enter"]'
    );
    expect(motionCss).toContain(
      "animation: motion-enter var(--motion-dialog-in) cubic-bezier(0, 0, 0.2, 1)"
    );
    expect(motionCss).toContain('dialog[data-motion-kind="dialog"]::backdrop');
    expect(motionCss).toContain("animation: motion-backdrop-enter var(--motion-dialog-in)");
    expect(motionCss).toContain(
      'dialog[data-motion-kind="dialog"][data-motion-state="closing"]::backdrop'
    );
    expect(motionCss).toContain("animation: motion-backdrop-closing var(--motion-dialog-out)");
  });

  it("uses a 4px view entrance and a 160ms sliding tab indicator", () => {
    expect(motionCss).toContain("from { opacity: 0; transform: translateY(4px); }");
    expect(motionCss).toContain(".motion-tab-indicator");
    expect(motionCss).toContain(
      "transition: left var(--motion-view) cubic-bezier(0, 0, 0.2, 1), width var(--motion-view) cubic-bezier(0, 0, 0.2, 1)"
    );

    const reducedMotion = motionCss.split("@media (prefers-reduced-motion: reduce)")[1];
    expect(reducedMotion).toContain(".motion-tab-indicator");
    expect(reducedMotion).toContain("transition: none");
  });

  it("keeps the required press transform for keycaps", () => {
    const keycapPressRule = motionCss.slice(
      motionCss.indexOf(".keycap:not(:disabled):active"),
      motionCss.indexOf("@media (prefers-reduced-motion: reduce)")
    );

    expect(keycapPressRule).toContain("transform: translateY(1px) scale(0.98)");
  });

  it("keeps keycap visual transitions during return and press", () => {
    const keycapRule = motionCss.slice(
      motionCss.indexOf(".keycap:not(:disabled),"),
      motionCss.indexOf(".keycap:not(:disabled):active")
    );
    const keycapPressRule = motionCss.slice(
      motionCss.indexOf(".keycap:not(:disabled):active"),
      motionCss.indexOf("@media (prefers-reduced-motion: reduce)")
    );

    expect(keycapRule).toContain("transition-property: transform, box-shadow, border-color, background-color");
    expect(keycapRule).toContain("transition-duration: var(--motion-return)");
    expect(keycapPressRule).toContain("transition-property: transform, box-shadow, border-color, background-color");
    expect(keycapPressRule).toContain("transition-duration: var(--motion-press)");
  });

  it("reduces dialog and backdrop animation time to avoid a long motion wait", () => {
    const reducedMotion = motionCss.split("@media (prefers-reduced-motion: reduce)")[1];

    expect(reducedMotion).toContain("animation-duration: 1ms !important");
    expect(reducedMotion).toContain("*::before, *::after");
  });
});
