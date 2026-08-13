import { describe, expect, it } from "vitest";

import { resolveFactoryMonitorKeyLabel } from "./minimalKeysMonitorLabels";

function activeLayers(...indices: number[]) {
  return indices.reduce((mask, index) => mask | (1 << index), 0);
}

describe("resolveFactoryMonitorKeyLabel", () => {
  it("uses L3 when L8, L3, and L0 are active", () => {
    expect(resolveFactoryMonitorKeyLabel(0, activeLayers(0, 3, 8))).toEqual({
      label: "Cmd+0",
      transparent: false,
    });
  });

  it("continues through multiple transparent active layers to the base binding", () => {
    expect(resolveFactoryMonitorKeyLabel(16, activeLayers(0, 5, 7, 8))).toEqual({
      label: "- / Fn",
      transparent: false,
    });
  });
});
