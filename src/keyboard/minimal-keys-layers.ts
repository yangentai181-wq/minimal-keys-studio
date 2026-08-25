export const AUTO_MOUSE_LAYER_ID = 4;
export const SCROLL_LAYER_ID = 7;
export const PRECISION_LAYER_ID = 8;
export const GESTURE_LAYER_ID = 9;

export type MinimalKeysLayerRole = "autoMouse" | "scroll" | "precision" | "gesture";

export interface MinimalKeysLayerMetadata {
  autoMouseLayerId: number | null;
  scrollLayerId: number | null;
}

export function getMinimalKeysLayerRole(layerId: number): MinimalKeysLayerRole | null {
  if (layerId === AUTO_MOUSE_LAYER_ID) return "autoMouse";
  if (layerId === SCROLL_LAYER_ID) return "scroll";
  if (layerId === PRECISION_LAYER_ID) return "precision";
  if (layerId === GESTURE_LAYER_ID) return "gesture";
  return null;
}

export function isPrecisionLayerId(layerId: number): boolean {
  return layerId === PRECISION_LAYER_ID;
}

export function isGestureLayerId(layerId: number): boolean {
  return layerId === GESTURE_LAYER_ID;
}

/** Layers the firmware owns: users may not edit, move, or remove them. */
export function isInternalLayerId(layerId: number): boolean {
  return isPrecisionLayerId(layerId) || isGestureLayerId(layerId);
}

export function hasPrecisionLayer(layers: ReadonlyArray<{ id: number }>): boolean {
  return layers.some((layer) => isPrecisionLayerId(layer.id));
}

export function hasGestureLayer(layers: ReadonlyArray<{ id: number }>): boolean {
  return layers.some((layer) => isGestureLayerId(layer.id));
}

/** Layers a user may keep once the internal layers are reserved. */
export function getUserLayerCapacity(maxLayers: number): number {
  if (maxLayers > GESTURE_LAYER_ID) return maxLayers - 2;
  if (maxLayers > PRECISION_LAYER_ID) return maxLayers - 1;
  return maxLayers;
}

export function canEditUserLayer(layerId: number): boolean {
  return layerId >= 0 && !isInternalLayerId(layerId);
}

export function canMoveUserLayer(startLayerId: number, endLayerId: number): boolean {
  return canEditUserLayer(startLayerId) && canEditUserLayer(endLayerId);
}

export function canChangeUserLayerStructure(layers: ReadonlyArray<{ id: number }>): boolean {
  return !hasPrecisionLayer(layers);
}

export function getMinimalKeysLayerMetadata(layers: ReadonlyArray<{ id: number }>): MinimalKeysLayerMetadata {
  return {
    autoMouseLayerId: layers.some((layer) => layer.id === AUTO_MOUSE_LAYER_ID)
      ? AUTO_MOUSE_LAYER_ID
      : null,
    scrollLayerId: layers.some((layer) => layer.id === SCROLL_LAYER_ID)
      ? SCROLL_LAYER_ID
      : null,
  };
}
