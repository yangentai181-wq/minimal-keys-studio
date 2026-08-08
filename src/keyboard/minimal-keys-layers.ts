export const AUTO_MOUSE_LAYER_ID = 4;
export const SCROLL_LAYER_ID = 7;
export const PRECISION_LAYER_ID = 8;

export type MinimalKeysLayerRole = "autoMouse" | "scroll" | "precision";

export interface MinimalKeysLayerMetadata {
  autoMouseLayerId: number | null;
  scrollLayerId: number | null;
}

export function getMinimalKeysLayerRole(layerId: number): MinimalKeysLayerRole | null {
  if (layerId === AUTO_MOUSE_LAYER_ID) return "autoMouse";
  if (layerId === SCROLL_LAYER_ID) return "scroll";
  if (layerId === PRECISION_LAYER_ID) return "precision";
  return null;
}

export function isPrecisionLayerId(layerId: number): boolean {
  return layerId === PRECISION_LAYER_ID;
}

export function hasPrecisionLayer(layers: ReadonlyArray<{ id: number }>): boolean {
  return layers.some((layer) => isPrecisionLayerId(layer.id));
}

export function canEditUserLayer(layerId: number): boolean {
  return layerId >= 0 && !isPrecisionLayerId(layerId);
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
