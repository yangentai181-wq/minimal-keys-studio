import { describe, expect, it } from "vitest";
import {
  decodeResponse,
  encodeSetCombo,
  type ComboConfig,
} from "./combos";

const missionControl: ComboConfig = {
  comboId: 1,
  keyPositions: [13, 18], // F + J
  timeoutMs: 50,
  binding: { behaviorId: 1, param1: 0x01070052, param2: 0 }, // Ctrl + Up
  layerMask: 0,
  slowRelease: false,
};

describe("runtime combo protocol", () => {
  it("encodes the F+J Mission Control request as the exact 21-byte payload", () => {
    expect([...encodeSetCombo(missionControl)]).toEqual([
      10, 19, 10, 17, 8, 1, 16, 13, 16, 18, 24, 50,
      34, 7, 8, 1, 16, 210, 128, 156, 8,
    ]);
    expect(encodeSetCombo(missionControl)).toHaveLength(21);
  });

  it("preserves four keys, uint32 parameters and layer mask, and slow release", () => {
    const maximum: ComboConfig = {
      comboId: 0xffffffff,
      keyPositions: [0, 1, 2, 3],
      timeoutMs: 1000,
      binding: { behaviorId: 0xffffffff, param1: 0xffffffff, param2: 0xffffffff },
      layerMask: 0xffffffff,
      slowRelease: true,
    };

    expect([...encodeSetCombo(maximum)]).toEqual([
      10, 47, 10, 45,
      8, 255, 255, 255, 255, 15,
      16, 0, 16, 1, 16, 2, 16, 3,
      24, 232, 7,
      34, 18,
      8, 255, 255, 255, 255, 15,
      16, 255, 255, 255, 255, 15,
      24, 255, 255, 255, 255, 15,
      40, 255, 255, 255, 255, 15,
      48, 1,
    ]);

    const getAllResponse = Uint8Array.from([
      34, 47, 10, 45,
      8, 255, 255, 255, 255, 15,
      16, 0, 16, 1, 16, 2, 16, 3,
      24, 232, 7,
      34, 18,
      8, 255, 255, 255, 255, 15,
      16, 255, 255, 255, 255, 15,
      24, 255, 255, 255, 255, 15,
      40, 255, 255, 255, 255, 15,
      48, 1,
    ]);

    expect(decodeResponse(getAllResponse)).toEqual({
      getAllCombos: { combos: [maximum] },
    });
  });

  it.each([
    ["setCombo", [], undefined],
    ["setCombo", [18, 0], false],
    ["setCombo", [18, 2, 8, 1], true],
    ["deleteCombo", [], undefined],
    ["deleteCombo", [26, 0], false],
    ["deleteCombo", [26, 2, 8, 1], true],
  ] as const)("decodes %s success only when the response explicitly says true", (operation, bytes, success) => {
    const response = decodeResponse(Uint8Array.from(bytes));

    expect(response[operation]?.success).toBe(success);
  });

  it("decodes a GetAll fixture without exposing a test-only codec API", () => {
    const response = decodeResponse(Uint8Array.from([
      34, 19, 10, 17, 8, 1, 16, 13, 16, 18, 24, 50,
      34, 7, 8, 1, 16, 210, 128, 156, 8,
    ]));

    expect(response).toEqual({ getAllCombos: { combos: [missionControl] } });
  });
});
