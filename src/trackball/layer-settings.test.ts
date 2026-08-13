import { describe, expect, it } from "vitest";
import type { StudioKeymapLayer } from "../keyboard/useStudioKeymap";
import {
  decodeScrollLayerSelection,
  encodeAutoMouseLayerId,
  encodeScrollLayerMask,
} from "./layer-settings";

const layers: StudioKeymapLayer[] = [
  { id: 40, index: 4, name: "Mouse", bindings: [] },
  { id: 70, index: 7, name: "Scroll", bindings: [] },
];

describe("layer settings", () => {
  it("decodes zero as no scroll layer", () => {
    expect(decodeScrollLayerSelection(0, layers)).toEqual({ kind: "none" });
  });

  it("decodes one matching bit as its layer ID rather than its index", () => {
    expect(decodeScrollLayerSelection(128, layers)).toEqual({ kind: "single", layerId: 70 });
  });

  it("preserves multiple configured scroll bits without selecting one", () => {
    expect(decodeScrollLayerSelection(144, layers)).toEqual({ kind: "multiple", mask: 144 });
  });

  it("marks a single bit with no matching layer as unavailable", () => {
    expect(decodeScrollLayerSelection(2, layers)).toEqual({ kind: "unavailable", mask: 2 });
  });

  it("encodes layer index zero as the lowest scroll mask bit", () => {
    expect(encodeScrollLayerMask({ id: 70, index: 0, name: "Scroll", bindings: [] })).toBe(1);
  });

  it("encodes layer index 31 as the highest unsigned 32-bit scroll mask bit", () => {
    expect(encodeScrollLayerMask({ id: 70, index: 31, name: "Scroll", bindings: [] })).toBe(2147483648);
  });

  it("rejects a scroll layer index above the 32-bit mask range", () => {
    expect(() => encodeScrollLayerMask({ id: 70, index: 32, name: "Scroll", bindings: [] })).toThrow(
      new RangeError("Scroll layer index must be between 0 and 31"),
    );
  });

  it("encodes the non-sequential Auto Mouse layer ID unchanged", () => {
    expect(encodeAutoMouseLayerId(layers[1])).toBe(70);
  });
});
