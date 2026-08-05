import {
  PhysicalLayout,
  Keymap as KeymapMsg,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { resolveBehaviorId } from "../behaviors/resolve-behavior";
import type { KeyRecommendation } from "./key-roles";

import {
  PhysicalLayout as PhysicalLayoutComp,
} from "./PhysicalLayout";
import { useOsMode } from "../OsModeContext";
import { useMemo } from "react";
import { buildKeyPresentation } from "./key-presentation";

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;


export interface KeymapProps {
  layout: PhysicalLayout;
  keymap: KeymapMsg;
  behaviors: BehaviorMap;
  oneU: number;
  selectedLayerIndex: number;
  selectedKeyPosition: number | undefined;
  onKeyPositionClicked: (keyPosition: number) => void;
  onBindingApply?: (binding: BehaviorBinding) => void;
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
  onBindingApply,
  encoderRotationLabel,
}: KeymapProps) => {
  const { osMode } = useOsMode();

  const behaviorList = useMemo(() => Object.values(behaviors), [behaviors]);
  const os = osMode;

  const handleRecommendationClick = (rec: KeyRecommendation) => {
    const behaviorId = resolveBehaviorId(rec.behaviorDisplayName, behaviorList);
    if (behaviorId !== undefined && onBindingApply) {
      onBindingApply({ behaviorId, param1: rec.param1, param2: rec.param2 });
    }
  };

  const positions = useMemo(() => buildKeyPresentation({ layout, keymap, behaviors, selectedLayerIndex, os }), [layout, keymap, behaviors, selectedLayerIndex, os]);

  if (!keymap.layers[selectedLayerIndex]) {
    return <></>;
  }

  return (
    <PhysicalLayoutComp
      positions={positions}
      oneU={oneU}
      selectedPosition={selectedKeyPosition}
      onPositionClicked={onKeyPositionClicked}
      onRecommendationClick={handleRecommendationClick}
      encoderRotationLabel={encoderRotationLabel}
    />
  );
};
