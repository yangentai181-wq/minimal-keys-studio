import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { PhysicalLayout, type BehaviorBinding, type Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { ReactNode } from "react";
import { HidUsageLabel } from "./HidUsageLabel";
import { getHidKeyDescription, getMouseKeyDescription, getMouseScrollDescription } from "./key-descriptions";
import { modifierSymbols } from "./key-label-utils";
import type { KeyPosition } from "./PhysicalLayout";
import { resolveTooltipData } from "./tooltip-data";
import { hid_usage_page_and_id_from_usage } from "../hid-usages";

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;

export type KeyPresentationInput = {
  layout: PhysicalLayout;
  keymap: Keymap;
  behaviors: BehaviorMap;
  selectedLayerIndex: number;
  os: Parameters<typeof resolveTooltipData>[3];
};

type LayerName = {
  id: number;
  name: string;
};

function hidParamLabel(param: number): string {
  const [rawPage, id] = hid_usage_page_and_id_from_usage(param);
  return getHidKeyDescription(rawPage & 0xff, id).roleName;
}

/**
 * Text label for a binding that has already been determined not to be
 * Transparent. Transparency is editor state and must be resolved by the
 * realtime monitor before it asks for a label.
 */
export function getNonTransparentBindingLabel(
  binding: BehaviorBinding,
  displayName: string,
  layers: readonly LayerName[],
): string {
  switch (displayName) {
    case "Key Press":
      return hidParamLabel(binding.param1);
    case "Layer-Tap":
      return hidParamLabel(binding.param2);
    case "LAYER_TAP_MKP":
      return getMouseKeyDescription(binding.param2).roleName;
    case "Mod-Tap":
      return `${modifierSymbols(binding.param1)}+${hidParamLabel(binding.param2)}`;
    case "Hold-Tap":
      return hidParamLabel(binding.param2);
    case "Momentary Layer":
      return `MLayer ${shortLayerName(binding.param1, layers)}`;
    case "Toggle Layer":
      return `Toggle ${shortLayerName(binding.param1, layers)}`;
    case "To Layer":
      return binding.param1 === 0 ? "通常へ戻る" : `To ${shortLayerName(binding.param1, layers)}`;
    case "Sticky Layer":
      return `Sticky ${shortLayerName(binding.param1, layers)}`;
    case "Sticky Key":
      return `Sticky ${modifierSymbols(binding.param1)}`;
    case "Mouse Key Press":
      return getMouseKeyDescription(binding.param1).roleName;
    case "Mouse Scroll":
      return getMouseScrollDescription(binding.param1).roleName;
    case "Bluetooth":
      return `BT ${binding.param1}`;
    case "None":
      return "無効";
    default:
      return displayName;
  }
}

function shortLayerName(layerId: number, layers: readonly LayerName[]): string {
  const name = layers.find((layer) => layer.id === layerId)?.name;
  if (!name) return `L${layerId}`;
  if (name.length <= 6) return name;
  const first = name.split(/[\s&/]+/)[0];
  return first.length <= 6 ? first : first.substring(0, 5);
}

function keyDisplay(binding: BehaviorBinding, displayName: string, layers: readonly LayerName[]): { header: string; children: ReactNode } {
  switch (displayName) {
    case "Key Press": return { header: "", children: <HidUsageLabel hid_usage={binding.param1} /> };
    case "Layer-Tap": return { header: shortLayerName(binding.param1, layers), children: <span>{hidParamLabel(binding.param2)}</span> };
    case "LAYER_TAP_MKP": return { header: shortLayerName(binding.param1, layers), children: <span>{getMouseKeyDescription(binding.param2).roleName}</span> };
    case "Mod-Tap": return { header: modifierSymbols(binding.param1), children: <span>{hidParamLabel(binding.param2)}</span> };
    case "Hold-Tap": return { header: "Hold/Tap", children: <span>{hidParamLabel(binding.param2)}</span> };
    case "Momentary Layer": return { header: "MLayer", children: <span>{shortLayerName(binding.param1, layers)}</span> };
    case "Toggle Layer": return { header: "Toggle", children: <span>{shortLayerName(binding.param1, layers)}</span> };
    case "To Layer": return { header: "To", children: <span>{shortLayerName(binding.param1, layers)}</span> };
    case "Sticky Layer": return { header: "Sticky", children: <span>{shortLayerName(binding.param1, layers)}</span> };
    case "Sticky Key": return { header: "Sticky", children: <span>{modifierSymbols(binding.param1)}</span> };
    case "Mouse Key Press": return { header: "", children: <span>{getMouseKeyDescription(binding.param1).roleName}</span> };
    case "Mouse Scroll": return { header: "Scroll", children: <span>{getMouseScrollDescription(binding.param1).roleName}</span> };
    case "Bluetooth": return { header: "BT", children: <span>{binding.param1}</span> };
    case "None": return { header: "None", children: <span /> };
    case "Transparent": return { header: "Trans", children: <span /> };
    default: return { header: displayName, children: binding.param1 ? <HidUsageLabel hid_usage={binding.param1} /> : <span /> };
  }
}

/** Pure presentation selector. Selection and physical pixel size are intentionally absent. */
export function buildKeyPresentation({ layout, keymap, behaviors, selectedLayerIndex, os }: KeyPresentationInput): KeyPosition[] {
  const layer = keymap.layers[selectedLayerIndex];
  if (!layer) return [];
  const behaviorList = Object.values(behaviors);
  const layerNames = keymap.layers.map((item) => ({
    id: item.id,
    name: item.name || `L${item.id}`,
  }));
  return layout.keys.map((key, index) => {
    if (index >= layer.bindings.length) {
      return { id: `${layer.id}-${index}`, header: "Unknown", x: key.x / 100, y: key.y / 100, width: key.width / 100, height: key.height / 100, children: <span />, tooltipData: null };
    }
    const binding = layer.bindings[index];
    const displayName = behaviors[binding.behaviorId]?.displayName || "Unknown";
    const display = keyDisplay(binding, displayName, layerNames);
    return { id: `${layer.id}-${index}`, header: display.header, x: key.x / 100, y: key.y / 100, width: key.width / 100, height: key.height / 100, r: (key.r || 0) / 100, rx: (key.rx || 0) / 100, ry: (key.ry || 0) / 100, children: display.children, tooltipData: resolveTooltipData(binding, behaviorList, index, os) };
  });
}
