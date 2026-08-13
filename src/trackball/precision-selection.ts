import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { TrackballConfig } from "../proto/trackball-settings";
import { analyzePrecisionBinding, type PrecisionBindingAnalysis } from "./precision-binding";

export function getPrecisionSelectionAnalysis(
  keymap: Keymap,
  behaviors: GetBehaviorDetailsResponse[],
  confirmed: TrackballConfig | null,
  selectedPosition: number,
): PrecisionBindingAnalysis {
  const baseLayer = keymap.layers.find((layer) => layer.id === 0);
  if (!baseLayer) return { supported: false, reason: "ベースレイヤーを読み込めません" };
  const binding = confirmed?.enabled && confirmed.selectedPosition === selectedPosition && confirmed.originalBinding
    ? confirmed.originalBinding
    : baseLayer.bindings[selectedPosition];
  if (!binding) return { supported: false, reason: "このキーは選べません" };
  return analyzePrecisionBinding(binding, behaviors, selectedPosition);
}
