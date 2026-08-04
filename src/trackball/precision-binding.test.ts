import { describe, expect, it } from "vitest";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { analyzePrecisionBinding } from "./precision-binding";

const behavior = (id: number, displayName: string): GetBehaviorDetailsResponse => ({
  id,
  displayName,
  metadata: [],
});

const behaviors = [
  behavior(1, "Key Press"),
  behavior(2, "Layer-Tap"),
  behavior(3, "Mod-Tap"),
  behavior(4, "LAYER_TAP_MKP"),
  behavior(5, "Transparent"),
];
const key = (id: number) => (7 << 16) + id;

describe("analyzePrecisionBinding", () => {
  it("keeps a key press tap action and replaces its empty hold action", () => {
    expect(analyzePrecisionBinding({ behaviorId: 1, param1: key(4), param2: 0 }, behaviors, 0)).toEqual({
      supported: true,
      tapLabel: "A",
      holdLabel: "なし",
    });
  });

  it.each([
    [{ behaviorId: 2, param1: 3, param2: key(5) }, "B", "レイヤー 3"],
    [{ behaviorId: 3, param1: 2, param2: key(6) }, "C", "左Shift"],
    [{ behaviorId: 4, param1: 4, param2: 1 }, "左クリック", "レイヤー 4"],
  ])("preserves the tap action for supported hold-tap bindings", (binding, tapLabel, holdLabel) => {
    expect(analyzePrecisionBinding(binding, behaviors, 1)).toEqual({
      supported: true,
      tapLabel,
      holdLabel,
    });
  });

  it.each([
    [{ behaviorId: 5, param1: 0, param2: 0 }, 1, "透明キーは選択できません"],
    [{ behaviorId: 2, param1: 8, param2: key(4) }, 1, "精密モード用レイヤーは選択できません"],
    [{ behaviorId: 1, param1: key(4), param2: 0 }, 1, "エンコーダーは選択できません", true],
    [{ behaviorId: 99, param1: 0, param2: 0 }, 1, "このキーの動作は精密モードに対応していません"],
  ])("rejects unsupported positions with a Japanese reason", (binding, position, reason, isEncoder = false) => {
    expect(analyzePrecisionBinding(binding, behaviors, position, isEncoder)).toEqual({
      supported: false,
      reason,
    });
  });
});
