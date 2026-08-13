import { describe, expect, it } from "vitest";
import {
  canChangeUserLayerStructure,
  canMoveUserLayer,
  getMinimalKeysLayerRole,
  isPrecisionLayerId,
} from "./minimal-keys-layers";

describe("functional layer IDs", () => {
  it("keeps functional roles when layers are reordered", () => {
    const reorderedLayers = [
      { id: 7 },
      { id: 0 },
      { id: 8 },
      { id: 4 },
    ];

    expect(getMinimalKeysLayerRole(reorderedLayers[0].id)).toBe("scroll");
    expect(getMinimalKeysLayerRole(reorderedLayers[2].id)).toBe("precision");
    expect(getMinimalKeysLayerRole(reorderedLayers[3].id)).toBe("autoMouse");
    expect(isPrecisionLayerId(reorderedLayers[2].id)).toBe(true);
  });
});

describe("precision layer operation guards", () => {
  it("rejects moves that start from or end at the internal layer ID", () => {
    expect(canMoveUserLayer(7, 0)).toBe(true);
    expect(canMoveUserLayer(7, 8)).toBe(false);
    expect(canMoveUserLayer(8, 7)).toBe(false);
  });

  it("blocks add and remove operations when layer ID 8 is present", () => {
    expect(canChangeUserLayerStructure([{ id: 4 }, { id: 7 }])).toBe(true);
    expect(canChangeUserLayerStructure([{ id: 4 }, { id: 8 }])).toBe(false);
  });
});
