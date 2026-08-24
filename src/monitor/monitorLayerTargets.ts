// Which layer a factory layer-tap key moves to while it is held.
// Mirrors config/minimal-keys.keymap (L0 `&lt` / `&lt_mkp` bindings) so the
// monitor can name the destination instead of only flagging "a layer key".

import { MONITOR_KEY_LABELS_BY_LAYER } from "./minimalKeysMonitorLabels";
import { MONITOR_LAYER_NAMES } from "./layerNames";

export interface MonitorLayerTarget {
  /** Layer index activated while the key is held. */
  layerIndex: number;
  /** Human readable layer name for that index. */
  layerName: string;
}

type LayerTargetTable = Readonly<Record<number, number>>;

/** position -> held layer index, per source layer index. */
const HOLD_LAYER_TARGETS: ReadonlyArray<LayerTargetTable> = [
  // L0 default layer
  { 15: 1, 16: 5, 27: 2, 28: 6, 37: 5, 38: 3, 39: 7, 41: 3 },
];

function layerTarget(
  layerIndex: number,
  position: number,
): MonitorLayerTarget | null {
  const target = HOLD_LAYER_TARGETS[layerIndex]?.[position];
  if (target === undefined) return null;
  return {
    layerIndex: target,
    layerName: MONITOR_LAYER_NAMES[target] ?? `L${target}`,
  };
}

/**
 * Resolves the hold destination with the same active-layer walk that
 * `resolveFactoryMonitorKeyLabel` uses, so the chip always describes the
 * binding that is actually shown on the key.
 */
export function resolveFactoryMonitorLayerTarget(
  position: number,
  activeLayerMask: number,
): MonitorLayerTarget | null {
  for (
    let layerIndex = MONITOR_KEY_LABELS_BY_LAYER.length - 1;
    layerIndex >= 0;
    layerIndex -= 1
  ) {
    if ((activeLayerMask & (1 << layerIndex)) === 0) continue;
    if (!MONITOR_KEY_LABELS_BY_LAYER[layerIndex]?.[position]) continue;
    return layerTarget(layerIndex, position);
  }

  return layerTarget(0, position);
}
