import { describe, expect, it } from "vitest";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { buildFunctionalLayerTapBinding } from "./functional-layer-actions";

const behavior = (id: number, displayName: string): GetBehaviorDetailsResponse => ({
  id,
  displayName,
  metadata: [],
});

const behaviors = [behavior(12, "Layer-Tap")];
const layers = [
  { id: 0, index: 0, name: "Base" },
  { id: 7, index: 1, name: "Scroll" },
  { id: 8, index: 2, name: "Precision" },
];

describe("buildFunctionalLayerTapBinding", () => {
  it.each([
    ["scroll", 7],
    ["precision", 8],
  ] as const)("builds Layer-Tap for %s with the fixed layer ID", (action, layerId) => {
    expect(buildFunctionalLayerTapBinding({
      action,
      tapKey: { label: "A", hidId: 4 },
      behaviors,
      layers,
    })).toEqual({
      ok: true,
      binding: { behaviorId: 12, param1: layerId, param2: 0x00070004 },
    });
  });

  it("rejects the action when Layer-Tap is unavailable", () => {
    expect(buildFunctionalLayerTapBinding({
      action: "scroll",
      tapKey: { label: "A", hidId: 4 },
      behaviors: [],
      layers,
    })).toEqual({ ok: false, reason: "Layer-Tap が利用できません" });
  });

  it("rejects the action when its fixed layer is unavailable", () => {
    expect(buildFunctionalLayerTapBinding({
      action: "precision",
      tapKey: { label: "A", hidId: 4 },
      behaviors,
      layers: layers.filter((layer) => layer.id !== 8),
    })).toEqual({ ok: false, reason: "ポインター精密用レイヤーがありません" });
  });
});
