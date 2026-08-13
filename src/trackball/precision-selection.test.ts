import { describe, expect, it } from "vitest";
import { getPrecisionSelectionAnalysis } from "./precision-selection";

const behaviors = [
  { id: 1, displayName: "Key Press", metadata: [] },
  { id: 2, displayName: "Transparent", metadata: [] },
];

const keymap = (behaviorId: number) => ({
  layers: [{ id: 0, name: "Base", bindings: [{ behaviorId, param1: (7 << 16) + 4, param2: 0 }] }],
  availableLayers: 9,
  maxLayerNameLength: 16,
});

describe("getPrecisionSelectionAnalysis", () => {
  it("recalculates the selected position from the latest keymap rather than retaining a prior supported result", () => {
    expect(getPrecisionSelectionAnalysis(keymap(1), behaviors, null, 0)).toMatchObject({ supported: true });
    expect(getPrecisionSelectionAnalysis(keymap(2), behaviors, null, 0)).toEqual({ supported: false, reason: "透明キーは選択できません" });
  });

  it("uses the confirmed original binding for the currently wrapped position", () => {
    expect(getPrecisionSelectionAnalysis(keymap(2), behaviors, {
      schemaVersion: 1, normalCpi: 800, precisionCpi: 200, enabled: true, selectedPosition: 0,
      originalBinding: { behaviorId: 1, param1: (7 << 16) + 4, param2: 0 }, revision: 3,
      precisionActive: false, currentCpi: 800,
    }, 0)).toMatchObject({ supported: true });
  });
});
