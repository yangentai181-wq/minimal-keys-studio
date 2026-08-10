import { describe, expect, it } from "vitest";
import type { ComboConfig } from "../proto/combos";
import { validateComboDraft } from "./combo-validation";

function combo(overrides: Partial<ComboConfig> = {}): ComboConfig {
  return {
    comboId: 1,
    keyPositions: [13, 18],
    timeoutMs: 50,
    binding: { behaviorId: 1, param1: 0, param2: 0 },
    layerMask: 0,
    slowRelease: false,
    ...overrides,
  };
}

describe("validateComboDraft", () => {
  it("accepts two to four distinct non-negative keys and returns a sorted copy", () => {
    const draft = combo({ keyPositions: [18, 3, 13, 0] });

    expect(validateComboDraft(draft, [])).toEqual({
      ok: true,
      normalized: combo({ keyPositions: [0, 3, 13, 18] }),
    });
    expect(draft.keyPositions).toEqual([18, 3, 13, 0]);
  });

  it.each([
    [[13], "2〜4個の異なるキーを選んでください"],
    [[1, 2, 3, 4, 5], "2〜4個の異なるキーを選んでください"],
    [[13, 13], "2〜4個の異なるキーを選んでください"],
    [[-1, 13], "キー位置は0以上にしてください"],
  ])("rejects invalid key positions %j", (keyPositions, message) => {
    expect(validateComboDraft(combo({ keyPositions }), [])).toEqual({ ok: false, message });
  });

  it.each([
    [[Number.NaN, 13]],
    [[Number.POSITIVE_INFINITY, 13]],
    [[-1, 13]],
    [[1.5, 13]],
    [[0x1_0000_0000, 13]],
  ])("rejects key positions that cannot be encoded as uint32: %j", (keyPositions) => {
    expect(validateComboDraft(combo({ keyPositions }), [])).toEqual({
      ok: false,
      message: "キー位置は0以上にしてください",
    });
  });

  it("accepts uint32 key position boundaries", () => {
    expect(validateComboDraft(combo({ keyPositions: [0xffffffff, 0] }), [])).toEqual({
      ok: true,
      normalized: combo({ keyPositions: [0, 0xffffffff] }),
    });
  });

  it("requires a behavior", () => {
    expect(validateComboDraft(combo({ binding: null }), [])).toEqual({
      ok: false,
      message: "動作を選んでください",
    });
  });

  it.each([0, Number.NaN, 1.5, 0x1_0000_0000])("requires a positive uint32 behavior ID", (behaviorId) => {
    expect(validateComboDraft(combo({ binding: { behaviorId, param1: 0, param2: 0 } }), [])).toEqual({
      ok: false,
      message: "動作を選んでください",
    });
  });

  it.each([0, 1001, Number.NaN, 1.5, Number.POSITIVE_INFINITY])("requires a timeout from 1 through 1000ms", (timeoutMs) => {
    expect(validateComboDraft(combo({ timeoutMs }), [])).toEqual({
      ok: false,
      message: "タイムアウトは1〜1000msにしてください",
    });
  });

  it.each([1, 1000])("accepts timeout boundary %i", (timeoutMs) => {
    expect(validateComboDraft(combo({ timeoutMs }), [])).toEqual({
      ok: true,
      normalized: combo({ timeoutMs }),
    });
  });

  it("rejects the same key set when its layer conditions overlap regardless of key order", () => {
    const existing = combo({ comboId: 2, keyPositions: [18, 13], layerMask: 0b0100 });

    expect(validateComboDraft(combo({ layerMask: 0b1100 }), [existing])).toEqual({
      ok: false,
      message: "同じキーの組み合わせが同じレイヤー条件にあります",
    });
  });

  it.each([
    [0, 0],
    [0, 0b0100],
    [0b0100, 0],
    [0x80000000, 0x80000000],
  ])("rejects overlapping uint layer masks %i and %i", (existingMask, draftMask) => {
    const existing = combo({ comboId: 2, layerMask: existingMask });

    expect(validateComboDraft(combo({ layerMask: draftMask }), [existing])).toEqual({
      ok: false,
      message: "同じキーの組み合わせが同じレイヤー条件にあります",
    });
  });

  it("allows the same key set when its non-zero uint layer masks do not overlap", () => {
    const existing = combo({ comboId: 2, layerMask: 0x80000000 });

    expect(validateComboDraft(combo({ layerMask: 0x00000001 }), [existing])).toEqual({
      ok: true,
      normalized: combo({ layerMask: 0x00000001 }),
    });
  });

  it("excludes the draft itself from duplicate checking", () => {
    const draft = combo({ comboId: 2 });

    expect(validateComboDraft(draft, [combo({ comboId: 2 })])).toEqual({
      ok: true,
      normalized: combo({ comboId: 2 }),
    });
  });

  it("does not mutate an existing combo's key positions while comparing key sets", () => {
    const existing = combo({ comboId: 2, keyPositions: [18, 13], layerMask: 0b0010 });

    expect(validateComboDraft(combo({ layerMask: 0b0001 }), [existing])).toEqual({
      ok: true,
      normalized: combo({ layerMask: 0b0001 }),
    });
    expect(existing.keyPositions).toEqual([18, 13]);
  });
});
