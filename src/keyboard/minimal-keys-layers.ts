export const AUTO_MOUSE_LAYER_INDEX = 4;
export const SCROLL_LAYER_INDEX = 7;
export const PRECISION_LAYER_INDEX = 8;
export const GESTURE_LAYER_INDEX = 9;
export const MINIMAL_KEYS_LAYER_COUNT = GESTURE_LAYER_INDEX + 1;

export type MinimalKeysLayerRole = "autoMouse" | "scroll" | "precision" | "gesture";

export interface MinimalKeysLayerMetadata {
  autoMouseLayerIndex: number | null;
  scrollLayerIndex: number | null;
}

export function getMinimalKeysLayerRole(index: number): MinimalKeysLayerRole | null {
  if (index === AUTO_MOUSE_LAYER_INDEX) return "autoMouse";
  if (index === SCROLL_LAYER_INDEX) return "scroll";
  if (index === PRECISION_LAYER_INDEX) return "precision";
  if (index === GESTURE_LAYER_INDEX) return "gesture";
  return null;
}

export function isPrecisionLayerIndex(index: number): boolean {
  return index === PRECISION_LAYER_INDEX;
}

export function isInternalLayerIndex(index: number): boolean {
  return index === PRECISION_LAYER_INDEX || index === GESTURE_LAYER_INDEX;
}

export function hasPrecisionLayer(layers: unknown[]): boolean {
  return layers.length > PRECISION_LAYER_INDEX;
}

export function hasGestureLayer(layers: unknown[]): boolean {
  return layers.length > GESTURE_LAYER_INDEX;
}

export function getUserLayerCapacity(maxLayers: number): number {
  if (maxLayers > GESTURE_LAYER_INDEX) return maxLayers - 2;
  if (maxLayers > PRECISION_LAYER_INDEX) return maxLayers - 1;
  return maxLayers;
}

export function canEditUserLayer(index: number): boolean {
  return index >= 0 && !isInternalLayerIndex(index);
}

export function canMoveUserLayer(start: number, end: number): boolean {
  return canEditUserLayer(start) && canEditUserLayer(end);
}

export function canChangeUserLayerStructure(layers: unknown[]): boolean {
  return !hasPrecisionLayer(layers);
}

export function getMinimalKeysLayerMetadata(layers: unknown[]): MinimalKeysLayerMetadata {
  return {
    autoMouseLayerIndex: layers.length > AUTO_MOUSE_LAYER_INDEX ? AUTO_MOUSE_LAYER_INDEX : null,
    scrollLayerIndex: layers.length > SCROLL_LAYER_INDEX ? SCROLL_LAYER_INDEX : null,
  };
}
