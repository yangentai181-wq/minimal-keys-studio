import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { describe, expect, it } from "vitest";

import {
  ALPHA_LAYOUT_KEYS,
  buildAlphaLayoutChanges,
  detectAlphaLayout,
} from "./alpha-layouts";
import { hid_usage_from_page_and_id } from "../hid-usages";
import { MINIMAL_KEYS_KEY_COUNT } from "./minimal-keys-layout";

const KEY_PRESS_ID = 1;
const LAYER_TAP_ID = 2;
const TRANSPARENT_ID = 3;

const behaviors: Record<number, GetBehaviorDetailsResponse> = {
  [KEY_PRESS_ID]: { id: KEY_PRESS_ID, displayName: "Key Press" } as GetBehaviorDetailsResponse,
  [LAYER_TAP_ID]: { id: LAYER_TAP_ID, displayName: "Layer-Tap" } as GetBehaviorDetailsResponse,
  [TRANSPARENT_ID]: { id: TRANSPARENT_ID, displayName: "Transparent" } as GetBehaviorDetailsResponse,
};

const usage = (id: number) => hid_usage_from_page_and_id(0x07, id);
const kp = (id: number): BehaviorBinding => ({
  behaviorId: KEY_PRESS_ID,
  param1: usage(id),
  param2: 0,
});

function layerBindings(layoutId: "qwerty" | "oonishi"): BehaviorBinding[] {
  const bindings: BehaviorBinding[] = Array.from(
    { length: MINIMAL_KEYS_KEY_COUNT },
    () => ({ behaviorId: TRANSPARENT_ID, param1: 0, param2: 0 }),
  );
  for (const [position, usageId] of Object.entries(ALPHA_LAYOUT_KEYS[layoutId])) {
    const index = Number(position);
    bindings[index] =
      index === 16
        ? { behaviorId: LAYER_TAP_ID, param1: 5, param2: usage(usageId) }
        : kp(usageId);
  }
  return bindings;
}

describe("alpha layouts", () => {
  it("keeps both layouts on the same physical positions", () => {
    expect(Object.keys(ALPHA_LAYOUT_KEYS.qwerty)).toEqual(
      Object.keys(ALPHA_LAYOUT_KEYS.oonishi),
    );
  });

  it("places the oonishi vowels on the left home row and K T N S H on the right", () => {
    const A = 0x04;
    const letter = (c: string) => A + (c.charCodeAt(0) - "a".charCodeAt(0));
    expect([10, 11, 12, 13].map((p) => ALPHA_LAYOUT_KEYS.oonishi[p])).toEqual(
      ["e", "i", "a", "o"].map(letter),
    );
    expect([17, 18, 19, 20, 21].map((p) => ALPHA_LAYOUT_KEYS.oonishi[p])).toEqual(
      ["k", "t", "n", "s", "h"].map(letter),
    );
  });

  it("builds only the bindings that actually differ", () => {
    const result = buildAlphaLayoutChanges(
      layerBindings("qwerty"),
      behaviors,
      "qwerty",
    );
    expect(result.ok && result.changes).toEqual([]);
  });

  it("rewrites key presses and keeps the hold half of layer-taps", () => {
    const result = buildAlphaLayoutChanges(
      layerBindings("qwerty"),
      behaviors,
      "oonishi",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const changed = new Map(result.changes.map((c) => [c.keyPosition, c.binding]));
    // W -> L
    expect(changed.get(1)).toEqual(kp(0x0f));
    // Q stays Q, so it is not rewritten
    expect(changed.has(0)).toBe(false);
    // "-" / L5 center key becomes Backspace / L5
    expect(changed.get(16)).toEqual({
      behaviorId: LAYER_TAP_ID,
      param1: 5,
      param2: usage(0x2a),
    });
    // Backspace pinky becomes H
    expect(changed.get(21)).toEqual(kp(0x0b));
  });

  it("reports a missing Key Press behavior instead of writing nothing silently", () => {
    const result = buildAlphaLayoutChanges(layerBindings("qwerty"), {}, "oonishi");
    expect(result).toEqual({ ok: false, error: "missing-key-press-behavior" });
  });

  it("detects which alpha layout the layer currently uses", () => {
    expect(detectAlphaLayout(layerBindings("qwerty"), behaviors)).toBe("qwerty");
    expect(detectAlphaLayout(layerBindings("oonishi"), behaviors)).toBe("oonishi");

    const custom = layerBindings("qwerty");
    custom[7] = kp(0x1d);
    expect(detectAlphaLayout(custom, behaviors)).toBeNull();
  });
});
