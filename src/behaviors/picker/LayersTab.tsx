import { useEffect, useMemo, useState } from "react";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { getBehaviorDescription } from "../behavior-descriptions";
import { mouseItems, type ActionItem } from "./actions-data";
import { getMinimalKeysLayerRole, isPrecisionLayerId } from "../../keyboard/minimal-keys-layers";

import { encodeTapKey, getCommonTapKeys, type TapKeyItem } from "./common-tap-keys";
import { buildFunctionalLayerTapBinding, type FunctionalLayerAction } from "./functional-layer-actions";
import { TapKeySelect } from "./TapKeySelect";

const layerBehaviorNames = [
  "Momentary Layer",
  "Toggle Layer",
  "Layer-Tap",
  "LAYER_TAP_MKP",
  "Sticky Layer",
  "To Layer",
  "Conditional Layer",
];

interface LayersTabProps {
  behaviors: GetBehaviorDetailsResponse[];
  layers: { id: number; index: number; name: string }[];
  osMode: import("../use-cases").UserOS;
  currentTapKey?: TapKeyItem;
  onApplyBinding: (binding: BehaviorBinding) => void;
}

export function LayersTab({
  behaviors,
  layers,
  osMode,
  currentTapKey,
  onApplyBinding,
}: LayersTabProps) {
  const [selectedBehavior, setSelectedBehavior] = useState<string | null>(null);
  const [selectedFunctionalAction, setSelectedFunctionalAction] = useState<FunctionalLayerAction | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);
  const [selectedTapKey, setSelectedTapKey] = useState<TapKeyItem | null>(null);
  const [selectedMouseButton, setSelectedMouseButton] =
    useState<ActionItem | null>(null);

  useEffect(() => {
    setSelectedTapKey(null);
  }, [osMode]);

  const availableBehaviors = useMemo(
    () => behaviors.filter((b) => layerBehaviorNames.includes(b.displayName)),
    [behaviors],
  );
  const selectableLayers = useMemo(
    // The gesture layer stays selectable: holding a key bound to it is how the
    // trackball enters gesture mode. Only the precision layer is off limits.
    () => layers.filter((layer) => !isPrecisionLayerId(layer.id)),
    [layers],
  );

  const behaviorIdMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of availableBehaviors) {
      map[b.displayName] = b.id;
    }
    return map;
  }, [availableBehaviors]);

  const needsTapKey = selectedBehavior === "Layer-Tap";
  const isFunctionalAction = selectedFunctionalAction !== null;
  const functionalAvailability = useMemo(() => {
    const tapKey = selectedTapKey ?? getCommonTapKeys(osMode)[0];
    return {
      scroll: buildFunctionalLayerTapBinding({ action: "scroll", tapKey, behaviors, layers }),
      precision: buildFunctionalLayerTapBinding({ action: "precision", tapKey, behaviors, layers }),
    };
  }, [behaviors, layers, osMode, selectedTapKey]);
  const functionalReason = selectedFunctionalAction
    ? (functionalAvailability[selectedFunctionalAction].ok ? null : functionalAvailability[selectedFunctionalAction].reason)
    : null;
  const needsFunctionalTapKey = needsTapKey || isFunctionalAction;
  const needsMouseButton = selectedBehavior === "LAYER_TAP_MKP";
  const is2Param = needsFunctionalTapKey || needsMouseButton;

  const handleBehaviorClick = (displayName: string) => {
    setSelectedBehavior(displayName);
    setSelectedFunctionalAction(null);
    setSelectedLayer(null);
    setSelectedTapKey(null);
    setSelectedMouseButton(null);
  };

  const handleFunctionalActionClick = (action: FunctionalLayerAction) => {
    setSelectedFunctionalAction(action);
    setSelectedBehavior(null);
    setSelectedLayer(null);
    setSelectedTapKey(null);
    setSelectedMouseButton(null);
  };

  const handleLayerClick = (layerId: number) => {
    setSelectedLayer(layerId);
    if (!is2Param && selectedBehavior) {
      const behaviorId = behaviorIdMap[selectedBehavior];
      if (behaviorId !== undefined) {
        onApplyBinding({ behaviorId, param1: layerId, param2: 0 });
      }
    }
  };

  const handleTapKeyClick = (item: TapKeyItem) => {
    setSelectedTapKey(item);
  };

  const handleMouseButtonClick = (item: ActionItem) => {
    setSelectedMouseButton(item);
  };

  const layerButtonLabel = (layer: { id: number; name: string; index: number }): string => {
    const role = getMinimalKeysLayerRole(layer.id);
    // The reserved gesture layer carries no user-facing name of its own.
    if (role === "gesture") return layer.name || "ジェスチャー";
    const base = layer.name || `Layer ${layer.index}`;
    if (role === "scroll") return `${base}（スクロール）`;
    if (role === "autoMouse") return `${base}（自動マウス）`;
    return base;
  };

  const handleApply = () => {
    if (selectedFunctionalAction) {
      if (!selectedTapKey) return;
      const result = buildFunctionalLayerTapBinding({
        action: selectedFunctionalAction,
        tapKey: selectedTapKey,
        behaviors,
        layers,
      });
      if (result.ok) onApplyBinding(result.binding);
      return;
    }
    if (!selectedBehavior || selectedLayer === null) return;
    const behaviorId = behaviorIdMap[selectedBehavior];
    if (behaviorId === undefined) return;
    if (needsTapKey && selectedTapKey === null) return;
    if (needsMouseButton && selectedMouseButton === null) return;
    let param2 = 0;
    if (needsTapKey && selectedTapKey) {
      param2 = encodeTapKey(selectedTapKey);
    }
    if (needsMouseButton && selectedMouseButton) {
      param2 = selectedMouseButton.param1;
    }
    onApplyBinding({
      behaviorId,
      param1: selectedLayer,
      param2,
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Step 1: Choose behavior type */}
      <div>
        <div className="text-sm text-base-content/60 mb-1">
          レイヤー機能を選択
        </div>
        <div className="flex flex-wrap gap-1">
          {availableBehaviors.map((b) => {
            const desc = getBehaviorDescription(b.displayName);
            return (
              <button
                key={b.id}
                className={`px-3 py-1.5 text-sm rounded-md border ${
                  selectedBehavior === b.displayName
                    ? "bg-primary/10 text-primary border-primary/30 font-medium"
                    : "border-base-300 bg-white hover:bg-base-200 text-base-content"
                }`}
                onClick={() => handleBehaviorClick(b.displayName)}
              >
                {desc.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-sm text-base-content/60 mb-1">機能レイヤー</div>
        <div className="flex flex-wrap gap-1">
          {(["scroll", "precision"] as const).map((action) => {
            const availability = functionalAvailability[action];
            const reasonId = `functional-layer-${action}-reason`;
            return (
              <div key={action}>
                <button
                  className={`px-3 py-1.5 text-sm rounded-md border disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedFunctionalAction === action
                      ? "bg-primary/10 text-primary border-primary/30 font-medium"
                      : "border-base-300 bg-white hover:bg-base-200 text-base-content"
                  }`}
                  disabled={!availability.ok}
                  aria-describedby={!availability.ok ? reasonId : undefined}
                  onClick={() => handleFunctionalActionClick(action)}
                >
                  {action === "scroll" ? "押している間スクロール" : "押している間ポインター精密"}
                </button>
                {!availability.ok && (
                  <div id={reasonId} className="mt-1 text-xs text-error">{availability.reason}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 2: Choose layer */}
      {selectedBehavior && (
        <div>
          <div className="text-sm text-base-content/60 mb-1">
            レイヤーを選択
          </div>
          <div className="flex flex-wrap gap-1">
            {selectableLayers.map((layer) => (
              <button
                key={layer.id}
                className={`px-3 py-1.5 text-sm rounded-md border ${
                  selectedLayer === layer.id
                    ? "bg-primary/10 text-primary border-primary/30 font-medium"
                    : "border-base-300 bg-white hover:bg-base-200 text-base-content"
                }`}
                onClick={() => handleLayerClick(layer.id)}
              >
                {layerButtonLabel(layer)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: For Layer-Tap, choose tap key */}
      {needsFunctionalTapKey && (selectedLayer !== null || isFunctionalAction) && (
        <TapKeySelect
          osMode={osMode}
          selected={selectedTapKey}
          currentExternal={currentTapKey}
          onChange={handleTapKeyClick}
        />
      )}

      {/* Step 3: For LAYER_TAP_MKP, choose mouse button */}
      {needsMouseButton && selectedLayer !== null && (
        <div>
          <div className="text-sm text-base-content/60 mb-1">
            マウスクリックを選択
          </div>
          <div className="grid grid-cols-2 gap-1">
            {mouseItems.map((item) => (
              <button
                key={item.param1}
                className={`px-2 py-1.5 text-sm rounded-md border text-center ${
                  selectedMouseButton?.param1 === item.param1
                    ? "bg-primary/10 text-primary border-primary/30 font-medium"
                    : "border-base-300 bg-white hover:bg-base-200 text-base-content"
                }`}
                onClick={() => handleMouseButtonClick(item)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Apply button for 2-param behaviors */}
      {is2Param && (
        <button
          className="self-start px-4 py-2 text-sm rounded-md bg-primary text-primary-content font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={
            (!isFunctionalAction && selectedLayer === null) ||
            (needsFunctionalTapKey && selectedTapKey === null) ||
            functionalReason !== null ||
            (needsMouseButton && selectedMouseButton === null)
          }
          onClick={handleApply}
        >
          適用する
        </button>
      )}
    </div>
  );
}
