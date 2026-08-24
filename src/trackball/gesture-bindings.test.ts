import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { describe, expect, it } from "vitest";
import { GESTURE_DIRECTIONS, getGestureBinding } from "./gesture-bindings";

const binding = (behaviorId: number) => ({ behaviorId, param1: 0, param2: 0 });

function keymapWithLayers(count: number): Keymap {
  return {
    layers: Array.from({ length: count }, (_, id) => ({
      id,
      name: `Layer ${id}`,
      bindings: Array.from({ length: 43 }, (_, position) => binding(id * 100 + position)),
    })),
    availableLayers: count,
    maxLayerNameLength: 16,
  };
}

describe("gesture bindings", () => {
  it("maps each gesture direction to its reserved gesture-layer position", () => {
    expect(GESTURE_DIRECTIONS.map(({ id, position }) => [id, position])).toEqual([
      ["up", 7],
      ["down", 31],
      ["left", 18],
      ["right", 20],
    ]);
  });

  it("gets a gesture binding only when the reserved layer exists", () => {
    const tenLayerKeymap = keymapWithLayers(10);
    const nineLayerKeymap = keymapWithLayers(9);

    expect(getGestureBinding(tenLayerKeymap, "left")).toEqual(
      tenLayerKeymap.layers[9].bindings[18],
    );
    expect(getGestureBinding(nineLayerKeymap, "up")).toBeNull();
  });
});
