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
});
