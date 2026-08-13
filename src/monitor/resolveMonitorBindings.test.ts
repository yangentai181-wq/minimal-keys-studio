import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type {
  BehaviorBinding,
  Keymap,
  Layer,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { describe, expect, it } from "vitest";

import {
  resolveMonitorBinding,
  resolveMonitorLayer,
} from "./resolveMonitorBindings";

const key = (id: number) => (7 << 16) + id;

const behavior = (
  id: number,
  displayName: string,
): GetBehaviorDetailsResponse => ({
  id,
  displayName,
  metadata: [],
});

const binding = (
  behaviorId: number,
  param1 = 0,
  param2 = 0,
): BehaviorBinding => ({ behaviorId, param1, param2 });

const layer = (
  id: number,
  bindingAtPositionZero: BehaviorBinding,
): Layer => ({
  id,
  name: `Layer ${id}`,
  bindings: [bindingAtPositionZero],
});

const keymap = (layers: Layer[]): Keymap => ({
  layers,
  availableLayers: 9,
  maxLayerNameLength: 16,
});

const activeLayers = (...ids: number[]) =>
  ids.reduce((mask, id) => mask | (1 << id), 0);

const behaviors = {
  1: behavior(1, "Key Press"),
  2: behavior(2, "Transparent"),
  3: behavior(3, "None"),
  4: behavior(4, "To Layer"),
};

describe("resolveMonitorBinding", () => {
  it("resolves L8 transparent through to the active L3 binding", () => {
    const result = resolveMonitorBinding({
      keymap: keymap([
        layer(0, binding(1, key(4))),
        layer(3, binding(1, key(22))),
        layer(8, binding(2)),
      ]),
      behaviors,
      activeLayerMask: activeLayers(0, 3, 8),
      position: 0,
    });

    expect(result).toEqual({
      label: "S",
      sourceLayerId: 3,
      sourceLayerIndex: 1,
      inherited: true,
      unknown: false,
    });
  });

  it("resolves multiple transparent active layers through to L0", () => {
    const result = resolveMonitorBinding({
      keymap: keymap([
        layer(0, binding(1, key(4))),
        layer(3, binding(2)),
        layer(8, binding(2)),
      ]),
      behaviors,
      activeLayerMask: activeLayers(0, 3, 8),
      position: 0,
    });

    expect(result).toEqual({
      label: "A",
      sourceLayerId: 0,
      sourceLayerIndex: 0,
      inherited: true,
      unknown: false,
    });
  });

  it("stops at a None binding instead of falling through", () => {
    const result = resolveMonitorBinding({
      keymap: keymap([layer(0, binding(1, key(4))), layer(3, binding(3))]),
      behaviors,
      activeLayerMask: activeLayers(0, 3),
      position: 0,
    });

    expect(result).toEqual({
      label: "無効",
      sourceLayerId: 3,
      sourceLayerIndex: 1,
      inherited: false,
      unknown: false,
    });
  });

  it("shows To Layer 0 as a terminal return to the normal layer", () => {
    const result = resolveMonitorBinding({
      keymap: keymap([
        layer(0, binding(1, key(4))),
        layer(4, binding(4, 0)),
      ]),
      behaviors,
      activeLayerMask: activeLayers(0, 4),
      position: 0,
    });

    expect(result).toEqual({
      label: "通常へ戻る",
      sourceLayerId: 4,
      sourceLayerIndex: 1,
      inherited: false,
      unknown: false,
    });
  });

  it("reports an unknown behavior instead of using a factory fallback", () => {
    const result = resolveMonitorBinding({
      keymap: keymap([layer(0, binding(99, key(4)))]),
      behaviors,
      activeLayerMask: activeLayers(0),
      position: 0,
    });

    expect(result).toEqual({
      label: "不明",
      sourceLayerId: 0,
      sourceLayerIndex: 0,
      inherited: false,
      unknown: true,
    });
  });

  it("uses the edited in-memory binding immediately", () => {
    const liveKeymap = keymap([layer(0, binding(1, key(4)))]);
    const input = {
      keymap: liveKeymap,
      behaviors,
      activeLayerMask: activeLayers(0),
      position: 0,
    };

    expect(resolveMonitorBinding(input).label).toBe("A");

    liveKeymap.layers[0].bindings[0] = binding(1, key(5));

    expect(resolveMonitorBinding(input).label).toBe("B");
  });

  it("uses array priority while testing active bits by persistent layer ID", () => {
    const reorderedKeymap = keymap([
      layer(0, binding(1, key(4))),
      layer(8, binding(1, key(12))),
      layer(3, binding(1, key(6))),
    ]);

    expect(resolveMonitorLayer(reorderedKeymap, activeLayers(0, 3, 8))).toEqual({
      id: 3,
      index: 2,
    });
    expect(
      resolveMonitorBinding({
        keymap: reorderedKeymap,
        behaviors,
        activeLayerMask: activeLayers(0, 3, 8),
        position: 0,
      }),
    ).toMatchObject({
      label: "C",
      sourceLayerId: 3,
      sourceLayerIndex: 2,
      inherited: false,
      unknown: false,
    });
  });
});
