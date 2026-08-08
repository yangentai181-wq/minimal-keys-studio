import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { hid_usage_page_and_id_from_usage } from "../hid-usages";
import { getHidKeyDescription, getMouseKeyDescription } from "../keyboard/key-descriptions";
import { PRECISION_LAYER_ID } from "../keyboard/minimal-keys-layers";

export type PrecisionBindingAnalysis =
  | { supported: true; tapLabel: string; holdLabel: string }
  | { supported: false; reason: string };

function hidLabel(usage: number): string {
  const [page, id] = hid_usage_page_and_id_from_usage(usage);
  return getHidKeyDescription(page & 0xff, id).roleName;
}

function modifierLabel(modifiers: number): string {
  const labels = [
    [0x01, "左Ctrl"], [0x02, "左Shift"], [0x04, "左Alt"], [0x08, "左⌘"],
    [0x10, "右Ctrl"], [0x20, "右Shift"], [0x40, "右Alt"], [0x80, "右⌘"],
  ] as const;
  const result = labels.filter(([bit]) => modifiers & bit).map(([, label]) => label);
  return result.length > 0 ? result.join(" + ") : `修飾キー ${modifiers}`;
}

export function analyzePrecisionBinding(
  binding: BehaviorBinding,
  behaviors: GetBehaviorDetailsResponse[],
  _position: number,
  isEncoder = false,
): PrecisionBindingAnalysis {
  if (isEncoder) return { supported: false, reason: "エンコーダーは選択できません" };

  const displayName = behaviors.find((behavior) => behavior.id === binding.behaviorId)?.displayName;
  if (displayName === "Transparent" || displayName === "&trans") {
    return { supported: false, reason: "透明キーは選択できません" };
  }
  if ((displayName === "Layer-Tap" || displayName === "LAYER_TAP_MKP" || displayName === "&lt" || displayName === "&lt_mkp") && binding.param1 === PRECISION_LAYER_ID) {
    return { supported: false, reason: "精密モード用レイヤーは選択できません" };
  }

  switch (displayName) {
    case "Key Press":
    case "&kp":
      return { supported: true, tapLabel: hidLabel(binding.param1), holdLabel: "なし" };
    case "Layer-Tap":
    case "&lt":
      return { supported: true, tapLabel: hidLabel(binding.param2), holdLabel: `レイヤー ${binding.param1}` };
    case "Mod-Tap":
    case "&mt":
      return { supported: true, tapLabel: hidLabel(binding.param2), holdLabel: modifierLabel(binding.param1) };
    case "LAYER_TAP_MKP":
    case "&lt_mkp":
      return { supported: true, tapLabel: getMouseKeyDescription(binding.param2).roleName, holdLabel: `レイヤー ${binding.param1}` };
    default:
      return { supported: false, reason: "このキーの動作は精密モードに対応していません" };
  }
}
