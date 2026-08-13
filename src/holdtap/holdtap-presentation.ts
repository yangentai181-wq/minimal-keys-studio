import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { StudioKeymapLayer } from "../keyboard/useStudioKeymap";
import { hid_usage_page_and_id_from_usage } from "../hid-usages";
import { getHidKeyDescription } from "../keyboard/key-descriptions";

export interface HoldTapUsage {
  layerId: number;
  layerName: string;
  position: number;
  keyLabel: string;
}

export interface HoldTapPresentation {
  title: string;
  behaviorDisplayName: string | null;
}

const knownNames: Record<string, string> = {
  mod_tap: "Mod-Tap",
  layer_tap: "Layer-Tap",
  layer_tap_mouse_press: "LAYER_TAP_MKP",
};

function titleCaseSnakeCase(name: string): string {
  return name
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function presentHoldTap(name: string): HoldTapPresentation {
  const behaviorDisplayName = knownNames[name] ?? null;
  return {
    title: behaviorDisplayName ?? titleCaseSnakeCase(name),
    behaviorDisplayName,
  };
}

export function findHoldTapUsages(
  presentation: HoldTapPresentation,
  layers: readonly StudioKeymapLayer[],
  behaviors: readonly GetBehaviorDetailsResponse[],
): HoldTapUsage[] {
  if (!presentation.behaviorDisplayName) return [];
  const behaviorIds = new Set(
    behaviors
      .filter((behavior) => behavior.displayName === presentation.behaviorDisplayName)
      .map((behavior) => behavior.id),
  );
  if (behaviorIds.size === 0) return [];

  return layers.flatMap((layer) =>
    layer.bindings.flatMap((binding, position) => {
      if (!behaviorIds.has(binding.behaviorId)) return [];
      const [rawPage, id] = hid_usage_page_and_id_from_usage(binding.param2);
      const page = rawPage & 0xff;
      const keyLabel = page === 7 && id <= 255
        ? getHidKeyDescription(page, id).roleName
        : `位置 ${position}`;
      return [{ layerId: layer.id, layerName: layer.name, position, keyLabel }];
    }),
  );
}
