import { describe, expect, it } from "vitest";
import {
  canChangeUserLayerStructure,
  canEditUserLayer,
  canMoveUserLayer,
  getMinimalKeysLayerRole,
  hasGestureLayer,
  isInternalLayerIndex,
} from "./minimal-keys-layers";

describe("precision layer operation guards", () => {
  it("keeps the gesture layer out of user layer operations", () => {
    expect(getMinimalKeysLayerRole(9)).toBe("gesture");
    expect(isInternalLayerIndex(8)).toBe(true);
    expect(isInternalLayerIndex(9)).toBe(true);
    expect(canEditUserLayer(9)).toBe(false);
    expect(hasGestureLayer(Array.from({ length: 10 }))).toBe(true);
  });

  it("rejects moves that start from or end at the internal layer index", () => {
    expect(canMoveUserLayer(7, 0)).toBe(true);
    expect(canMoveUserLayer(7, 8)).toBe(false);
    expect(canMoveUserLayer(8, 7)).toBe(false);
  });

  it("blocks add and remove operations when layer 8 is present", () => {
    expect(canChangeUserLayerStructure(Array.from({ length: 8 }))).toBe(true);
    expect(canChangeUserLayerStructure(Array.from({ length: 9 }))).toBe(false);
  });
});
