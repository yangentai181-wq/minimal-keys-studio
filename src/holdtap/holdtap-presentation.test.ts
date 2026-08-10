import { describe, expect, it } from "vitest";
import {
  findHoldTapUsages,
  presentHoldTap,
} from "./holdtap-presentation";

describe("presentHoldTap", () => {
  it.each([
    ["mod_tap", "Mod-Tap", "Mod-Tap"],
    ["layer_tap", "Layer-Tap", "Layer-Tap"],
    ["layer_tap_mouse_press", "LAYER_TAP_MKP", "LAYER_TAP_MKP"],
    ["my_custom_hold_tap", "My Custom Hold Tap", null],
  ])("presents %s without exposing an unknown internal name", (name, title, behaviorDisplayName) => {
    expect(presentHoldTap(name)).toEqual({ title, behaviorDisplayName });
  });
});

describe("findHoldTapUsages", () => {
  const behaviors = [
    { id: 10, displayName: "Mod-Tap", metadata: [] },
    { id: 20, displayName: "Layer-Tap", metadata: [] },
  ];
  const layers = [
    {
      id: 4,
      index: 0,
      name: "Base",
      bindings: [
        { behaviorId: 10, param1: 0, param2: 0x00070004 },
        { behaviorId: 20, param1: 1, param2: 0x00079999 },
      ],
    },
    {
      id: 8,
      index: 1,
      name: "Nav",
      bindings: [{ behaviorId: 10, param1: 0, param2: 0x00070005 }],
    },
  ];

  it("finds every matching binding across layers and labels the tap key", () => {
    expect(findHoldTapUsages(presentHoldTap("mod_tap"), layers, behaviors)).toEqual([
      { layerId: 4, layerName: "Base", position: 0, keyLabel: "A" },
      { layerId: 8, layerName: "Nav", position: 0, keyLabel: "B" },
    ]);
  });

  it("uses the physical position when the tap key cannot be resolved", () => {
    expect(findHoldTapUsages(presentHoldTap("layer_tap"), layers, behaviors)).toEqual([
      { layerId: 4, layerName: "Base", position: 1, keyLabel: "位置 1" },
    ]);
  });

  it("keeps an unmapped hold-tap editable with no inferred usages", () => {
    expect(findHoldTapUsages(presentHoldTap("custom"), layers, behaviors)).toEqual([]);
  });
});
