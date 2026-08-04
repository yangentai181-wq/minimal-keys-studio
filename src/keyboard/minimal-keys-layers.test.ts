import { describe, expect, it } from "vitest";
import { canChangeUserLayerStructure, canMoveUserLayer } from "./minimal-keys-layers";

describe("precision layer operation guards", () => {
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
