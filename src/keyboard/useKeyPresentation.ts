import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { PhysicalLayout, Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { useMemo } from "react";
import type { UserOS } from "../behaviors/use-cases";
import { buildKeyPresentation } from "./key-presentation";

export function useKeyPresentation({
  layout,
  keymap,
  behaviors,
  selectedLayerIndex,
  os,
}: {
  layout: PhysicalLayout;
  keymap: Keymap;
  behaviors: Record<number, GetBehaviorDetailsResponse>;
  selectedLayerIndex: number;
  os: UserOS;
}) {
  return useMemo(
    () => buildKeyPresentation({ layout, keymap, behaviors, selectedLayerIndex, os }),
    [layout, keymap, behaviors, selectedLayerIndex, os],
  );
}
