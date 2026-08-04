import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { useMemo } from "react";
import { useBehaviorList } from "../behaviors/BehaviorsContext";
import { useConnectedDeviceData } from "../rpc/useConnectedDeviceData";
import type { PrecisionBindingAnalysis } from "./precision-binding";
import { getPrecisionSelectionAnalysis } from "./precision-selection";
import { useTrackballPrecision } from "./TrackballPrecisionContext";

export interface ConnectedPrecisionSelection {
  keymap: Keymap | undefined;
  behaviors: GetBehaviorDetailsResponse[];
  analysis: PrecisionBindingAnalysis | null;
}

export function useConnectedPrecisionSelection(): ConnectedPrecisionSelection {
  const [keymap] = useConnectedDeviceData<Keymap>(
    { keymap: { getKeymap: true } },
    (response) => response.keymap?.getKeymap,
    true,
  );
  const behaviors = useBehaviorList();
  const { confirmed, draft } = useTrackballPrecision();
  const analysis = useMemo(() => (
    keymap && draft && behaviors.length > 0
      ? getPrecisionSelectionAnalysis(keymap, behaviors, confirmed, draft.selectedPosition)
      : null
  ), [behaviors, confirmed, draft, keymap]);

  return { keymap, behaviors, analysis };
}
