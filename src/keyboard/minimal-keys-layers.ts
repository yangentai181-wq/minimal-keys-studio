export const AUTO_MOUSE_LAYER_INDEX = 4;
export const SCROLL_LAYER_INDEX = 7;

export type MinimalKeysLayerRole = "autoMouse" | "scroll";

export interface MinimalKeysLayerMetadata {
  autoMouseLayerIndex: number | null;
  scrollLayerIndex: number | null;
}

export function getMinimalKeysLayerRole(index: number): MinimalKeysLayerRole | null {
  if (index === AUTO_MOUSE_LAYER_INDEX) return "autoMouse";
  if (index === SCROLL_LAYER_INDEX) return "scroll";
  return null;
}

export function getMinimalKeysLayerMetadata(layers: unknown[]): MinimalKeysLayerMetadata {
  return {
    autoMouseLayerIndex: layers.length > AUTO_MOUSE_LAYER_INDEX ? AUTO_MOUSE_LAYER_INDEX : null,
    scrollLayerIndex: layers.length > SCROLL_LAYER_INDEX ? SCROLL_LAYER_INDEX : null,
  };
}
