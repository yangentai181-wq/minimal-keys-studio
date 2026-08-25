import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { describe, expect, it } from "vitest";

import {
  ALPHA_LAYOUT_KEYS,
  buildAlphaLayoutChanges,
  detectAlphaLayout,
  readAlphaLayoutSnapshot,
  resolveCurrentAlphaLayout,
  snapshotAlphaBlock,
  storeAlphaSnapshot,
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

  it("covers the whole 30-key alpha block, keeping Z X C V on their own slots", () => {
    const letter = (c: string) => 0x04 + (c.charCodeAt(0) - "a".charCodeAt(0));
    expect([22, 23, 24, 25, 26].map((p) => ALPHA_LAYOUT_KEYS.qwerty[p])).toEqual(
      ["z", "x", "c", "v", "b"].map(letter),
    );
    expect([22, 23, 24, 25].map((p) => ALPHA_LAYOUT_KEYS.oonishi[p])).toEqual(
      ["z", "x", "c", "v"].map(letter),
    );
    // 大西 puts ";" where QWERTY has B.
    expect(ALPHA_LAYOUT_KEYS.oonishi[26]).toBe(0x33);
    expect(Object.keys(ALPHA_LAYOUT_KEYS.qwerty)).toHaveLength(31);
  });

  it("remembers each layout's own alpha block across switches", () => {
    localStorage.clear();
    const custom: BehaviorBinding = {
      behaviorId: KEY_PRESS_ID,
      param1: usage(0x35),
      param2: 0,
    };

    // The user tweaked one key while 大西 was active.
    const tweakedOonishi = layerBindings("oonishi");
    tweakedOonishi[4] = custom;
    storeAlphaSnapshot("oonishi", snapshotAlphaBlock(tweakedOonishi));

    const result = buildAlphaLayoutChanges(
      layerBindings("qwerty"),
      behaviors,
      "oonishi",
      readAlphaLayoutSnapshot("oonishi"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const changed = new Map(result.changes.map((c) => [c.keyPosition, c.binding]));
    expect(changed.get(4)).toEqual(custom);
    // The rest of the block still lands on the 大西 letters.
    expect(changed.get(1)).toEqual(kp(0x0f));
  });

  it("restores the displaced bindings instead of a canned table", () => {
    const oonishi = layerBindings("oonishi");
    const baseline = snapshotAlphaBlock(layerBindings("qwerty"));
    // The user had Shift parked in the Z slot before switching.
    const shift: BehaviorBinding = {
      behaviorId: KEY_PRESS_ID,
      param1: usage(0xe1),
      param2: 0,
    };
    baseline[22] = shift;

    const result = buildAlphaLayoutChanges(
      oonishi,
      behaviors,
      "qwerty",
      baseline,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const changed = new Map(result.changes.map((c) => [c.keyPosition, c.binding]));
    expect(changed.get(22)).toEqual(shift);
    expect(changed.get(21)).toEqual(kp(0x2a));
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

  // Measured with a getKeymap dump from the real board (2026-08-25). Guards the
  // table against drifting away from the physical alpha block again.
  it("matches the QWERTY usage ids the keyboard actually reports", () => {
    const measured: Record<number, number> = {
      0: 0x14, 1: 0x1a, 2: 0x08, 3: 0x15, 4: 0x17,
      5: 0x1c, 6: 0x18, 7: 0x0c, 8: 0x12, 9: 0x13,
      10: 0x04, 11: 0x16, 12: 0x07, 13: 0x09, 14: 0x0a,
      16: 0x2d, 17: 0x0b, 18: 0x0d, 19: 0x0e, 20: 0x0f, 21: 0x2a,
      22: 0x1d, 23: 0x1b, 24: 0x06, 25: 0x19, 26: 0x05,
      29: 0x11, 30: 0x10, 31: 0x36, 32: 0x37, 33: 0x38,
    };

    expect(ALPHA_LAYOUT_KEYS.qwerty).toEqual(measured);
  });

  it("still knows which layout is in use after the user customises a key", () => {
    const customised = layerBindings("oonishi");
    customised[4] = kp(0x35); // one slot re-bound by hand
    customised[26] = kp(0xe1); // Shift parked in an alpha slot

    // Exact detection gives up, but the toggle still needs a direction.
    expect(detectAlphaLayout(customised, behaviors)).toBeNull();
    expect(resolveCurrentAlphaLayout(customised, behaviors)).toBe("oonishi");
    expect(
      resolveCurrentAlphaLayout(layerBindings("qwerty"), behaviors),
    ).toBe("qwerty");
  });

  it("detects which alpha layout the layer currently uses", () => {
    expect(detectAlphaLayout(layerBindings("qwerty"), behaviors)).toBe("qwerty");
    expect(detectAlphaLayout(layerBindings("oonishi"), behaviors)).toBe("oonishi");

    const custom = layerBindings("qwerty");
    custom[7] = kp(0x1d);
    expect(detectAlphaLayout(custom, behaviors)).toBeNull();
  });
});
