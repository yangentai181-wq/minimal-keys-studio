import type { StudioKeymapLayer } from "../keyboard/useStudioKeymap";

export type ScrollLayerSelection =
  | { kind: "none" }
  | { kind: "single"; layerId: number }
  | { kind: "multiple"; mask: number }
  | { kind: "unavailable"; mask: number };

export function decodeScrollLayerSelection(mask: number, layers: StudioKeymapLayer[]): ScrollLayerSelection {
  if (mask === 0) return { kind: "none" };
  if ((mask & (mask - 1)) !== 0) return { kind: "multiple", mask };

  const layer = layers.find((candidate) => (2 ** candidate.index) >>> 0 === mask);
  return layer ? { kind: "single", layerId: layer.id } : { kind: "unavailable", mask };
}

export function encodeScrollLayerMask(layer: StudioKeymapLayer): number {
  if (!Number.isInteger(layer.index) || layer.index < 0 || layer.index > 31) {
    throw new RangeError("Scroll layer index must be between 0 and 31");
  }
  return (2 ** layer.index) >>> 0;
}

export function encodeAutoMouseLayerId(layer: StudioKeymapLayer): number {
  if (!Number.isInteger(layer.id) || layer.id < 0) {
    throw new RangeError("Auto Mouse layer ID must be a non-negative integer");
  }
  return layer.id;
}
