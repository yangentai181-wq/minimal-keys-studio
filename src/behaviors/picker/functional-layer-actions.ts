import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { PRECISION_LAYER_ID, SCROLL_LAYER_ID } from "../../keyboard/minimal-keys-layers";
import { encodeTapKey, type TapKeyItem } from "./common-tap-keys";

export type FunctionalLayerAction = "scroll" | "precision";

interface BuildFunctionalLayerTapBindingInput {
  action: FunctionalLayerAction;
  tapKey: TapKeyItem;
  behaviors: GetBehaviorDetailsResponse[];
  layers: ReadonlyArray<{ id: number }>;
}

export type FunctionalLayerTapBindingResult =
  | { ok: true; binding: BehaviorBinding }
  | { ok: false; reason: string };

const actionDetails = {
  scroll: { layerId: SCROLL_LAYER_ID, layerName: "スクロール" },
  precision: { layerId: PRECISION_LAYER_ID, layerName: "ポインター精密" },
} as const;

export function buildFunctionalLayerTapBinding({
  action,
  tapKey,
  behaviors,
  layers,
}: BuildFunctionalLayerTapBindingInput): FunctionalLayerTapBindingResult {
  const layerTap = behaviors.find((behavior) => behavior.displayName === "Layer-Tap");
  if (!layerTap) return { ok: false, reason: "Layer-Tap が利用できません" };

  const { layerId, layerName } = actionDetails[action];
  if (!layers.some((layer) => layer.id === layerId)) {
    return { ok: false, reason: `${layerName}用レイヤーがありません` };
  }

  return {
    ok: true,
    binding: { behaviorId: layerTap.id, param1: layerId, param2: encodeTapKey(tapKey) },
  };
}
