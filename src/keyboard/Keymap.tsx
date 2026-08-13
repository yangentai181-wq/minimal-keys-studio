import {
  PhysicalLayout,
  Keymap as KeymapMsg,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";

import {
  PhysicalLayout as PhysicalLayoutComp,
} from "./PhysicalLayout";
import { useOsMode } from "../OsModeContext";
import { useKeyPresentation } from "./useKeyPresentation";

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;


export interface KeymapProps {
  layout: PhysicalLayout;
  keymap: KeymapMsg;
  behaviors: BehaviorMap;
  oneU: number;
  selectedLayerIndex: number;
  selectedKeyPosition: number | undefined;
  onKeyPositionClicked: (keyPosition: number) => void;
  encoderRotationLabel?: string;
}

export const Keymap = ({
  layout,
  keymap,
  behaviors,
  oneU,
  selectedLayerIndex,
  selectedKeyPosition,
  onKeyPositionClicked,
  encoderRotationLabel,
}: KeymapProps) => {
  const { osMode } = useOsMode();

  const os = osMode;

  const positions = useKeyPresentation({ layout, keymap, behaviors, selectedLayerIndex, os });

  if (!keymap.layers[selectedLayerIndex]) {
    return <></>;
  }

  return (
    <PhysicalLayoutComp
      positions={positions}
      oneU={oneU}
      selectedPosition={selectedKeyPosition}
      onPositionClicked={onKeyPositionClicked}
      encoderRotationLabel={encoderRotationLabel}
    />
  );
};
