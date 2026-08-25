import { describe, expect, it } from "vitest";

import { resolveFactoryMonitorLayerTarget } from "./monitorLayerTargets";

describe("resolveFactoryMonitorLayerTarget", () => {
  it("names the layer each default-layer hold moves to", () => {
    expect(resolveFactoryMonitorLayerTarget(15, 1)).toEqual({
      layerIndex: 1,
      layerName: "数字",
    });
    expect(resolveFactoryMonitorLayerTarget(39, 1)).toEqual({
      layerIndex: 7,
      layerName: "スクロール",
    });
    expect(resolveFactoryMonitorLayerTarget(28, 1)).toEqual({
      layerIndex: 6,
      layerName: "Bluetooth",
    });
  });

  it("returns nothing for plain keys", () => {
    expect(resolveFactoryMonitorLayerTarget(0, 1)).toBeNull();
    expect(resolveFactoryMonitorLayerTarget(40, 1)).toBeNull();
  });

  it("drops the hold hint when a higher active layer overrides the key", () => {
    // L3 binds position 41 to "_", so no layer hop is offered there.
    expect(resolveFactoryMonitorLayerTarget(41, (1 << 0) | (1 << 3))).toBeNull();
    // L7 is fully transparent, so the default-layer hold still applies.
    expect(resolveFactoryMonitorLayerTarget(38, (1 << 0) | (1 << 7))).toEqual({
      layerIndex: 3,
      layerName: "記号",
    });
  });
});
