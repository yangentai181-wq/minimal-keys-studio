import React, {
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { call_rpc } from "../rpc/logging";
import {
  PhysicalLayout,
  Keymap,
  SetLayerBindingResponse,
  SetLayerPropsResponse,
  BehaviorBinding,
  Layer,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";

import { LayerPicker } from "./LayerPicker";
import { PhysicalLayoutPicker } from "./PhysicalLayoutPicker";
import { Keymap as KeymapComp } from "./Keymap";
import { useConnectedDeviceData } from "../rpc/useConnectedDeviceData";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { UndoRedoContext } from "../undoRedo";
import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";
import {
  getModifierFlags,
  replaceModifierFlags,
} from "../behaviors/modifier-flags";
import { useBehaviorMap, useBehaviorsLoading } from "../behaviors/BehaviorsContext";
import { produce } from "immer";
import { useToast } from "../misc/Toast";
import { LockStateContext } from "../rpc/LockStateContext";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { useEncoderBindings } from "./useEncoderBindings";
import { computeOneU, DEFAULT_ONE_U } from "./compute-one-u";
import { LoadingSpinner } from "../misc/LoadingSkeleton";
import { useTelemetry } from "../telemetry/TelemetryProvider";
import { useSub } from "../usePubSub";
import { ModifierPanel } from "./ModifierPanel";
import { useOsMode } from "../OsModeContext";
import { Download, Upload } from "lucide-react";
import {
  serializeKeymap,
  deserializeKeymap,
  downloadJson,
  openFilePicker,
} from "./keymap-io";
import { canEditUserLayer, isPrecisionLayerId } from "./minimal-keys-layers";
import { publishKeymapChanged } from "./keymap-events";
import { AlphaLayoutToggle } from "./AlphaLayoutToggle";
import {
  ALPHA_LAYOUT_LABELS,
  buildAlphaLayoutChanges,
  detectAlphaLayout,
  readAlphaLayoutSnapshot,
  snapshotAlphaBlock,
  resolveCurrentAlphaLayout,
  storeAlphaSnapshot,
  storeAlphaLayout,
  type AlphaLayoutId,
} from "./alpha-layouts";
import { runGuardedKeymapWrite } from "./keymap-operation-guards";
import { ERROR_MESSAGES } from "../copy/errorMessages";
import { usePublishMonitorKeymap } from "./MonitorKeymapContext";
import {
  calculateImportChanges,
  calculateUnappliedLayerCount,
} from "./import-diff";
import { AutoMouseLayerControl } from "../trackball/AutoMouseLayerControl";

// Separate component for keyboard area — measures container and computes oneU.
// Isolated so ResizeObserver doesn't cause feedback loops with the keyboard rendering.
function KeyboardArea({
  layouts, keymap, behaviors, selectedPhysicalLayoutIndex,
  selectedLayerIndex, selectedKeyPosition, onKeyPositionClicked,
  encoderRotationLabel, showLoading,
}: {
  layouts: PhysicalLayout[] | undefined;
  keymap: Keymap | undefined;
  behaviors: Record<number, import("@zmkfirmware/zmk-studio-ts-client/behaviors").GetBehaviorDetailsResponse> | undefined;
  selectedPhysicalLayoutIndex: number;
  selectedLayerIndex: number;
  selectedKeyPosition: number | undefined;
  onKeyPositionClicked: (pos: number) => void;
  encoderRotationLabel?: string;
  showLoading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [oneU, setOneU] = useState(DEFAULT_ONE_U);

  const layout = layouts?.[selectedPhysicalLayoutIndex];

  // Compute keyboard extent in layout units
  const rightMost = layout?.keys
    .map((k) => k.x / 100 + k.width / 100)
    .reduce((a, b) => Math.max(a, b), 0) ?? 0;
  const bottomMost = layout?.keys
    .map((k) => k.y / 100 + k.height / 100)
    .reduce((a, b) => Math.max(a, b), 0) ?? 0;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const calculate = () => {
      setOneU(computeOneU(container.clientWidth, container.clientHeight, rightMost, bottomMost));
    };

    calculate();

    const resizeObserver = new ResizeObserver(calculate);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [rightMost, bottomMost]);

  return (
    <div
      ref={containerRef}
      className="p-4 col-start-2 row-start-1 flex items-center justify-center min-w-0 overflow-hidden bg-gray-200/50 rounded-lg"
    >
      {!showLoading && layout && keymap && behaviors ? (
        <KeymapComp
          keymap={keymap}
          layout={layout}
          behaviors={behaviors}
          oneU={oneU}
          selectedLayerIndex={selectedLayerIndex}
          selectedKeyPosition={selectedKeyPosition}
          onKeyPositionClicked={onKeyPositionClicked}
          encoderRotationLabel={encoderRotationLabel}
        />
      ) : (
        <LoadingSpinner label="キーマップを読み込んでいます..." />
      )}
    </div>
  );
}

function useLayouts(): [
  PhysicalLayout[] | undefined,
  React.Dispatch<SetStateAction<PhysicalLayout[] | undefined>>,
  number,
  React.Dispatch<SetStateAction<number>>
] {
  const connection = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);

  const [layouts, setLayouts] = useState<PhysicalLayout[] | undefined>(
    undefined
  );
  const [selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex] =
    useState<number>(0);

  useEffect(() => {
    if (
      !connection.conn ||
      lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
    ) {
      setLayouts(undefined);
      return;
    }

    async function startRequest() {
      setLayouts(undefined);

      if (!connection.conn) {
        return;
      }

      const response = await call_rpc(connection.conn, {
        keymap: { getPhysicalLayouts: true },
      });

      if (!ignore) {
        const responseLayouts = response?.keymap?.getPhysicalLayouts?.layouts;
        const activeLayoutIndex = response?.keymap?.getPhysicalLayouts?.activeLayoutIndex ?? 0;
        if (responseLayouts?.[activeLayoutIndex]) {
          setLayouts(responseLayouts);
          setSelectedPhysicalLayoutIndex(activeLayoutIndex);
        } else {
          setLayouts(undefined);
          setSelectedPhysicalLayoutIndex(0);
        }
      }
    }

    let ignore = false;
    startRequest();

    return () => {
      ignore = true;
    };
  }, [connection, lockState]);

  return [
    layouts,
    setLayouts,
    selectedPhysicalLayoutIndex,
    setSelectedPhysicalLayoutIndex,
  ];
}

export default function Keyboard() {
  const [
    layouts,
    ,
    selectedPhysicalLayoutIndex,
    setSelectedPhysicalLayoutIndex,
  ] = useLayouts();
  const [keymap, setKeymap] = useConnectedDeviceData<Keymap>(
    { keymap: { getKeymap: true } },
    (keymap) => keymap?.keymap?.getKeymap,
    true
  );
  usePublishMonitorKeymap(keymap);

  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0);
  const [selectedKeyPosition, setSelectedKeyPosition] = useState<
    number | undefined
  >(undefined);
  const [modifierFlags, setModifierFlags] = useState(0);
  const behaviors = useBehaviorMap();
  const behaviorsLoading = useBehaviorsLoading();
  const isDataLoading = !layouts || !layouts[selectedPhysicalLayoutIndex] || !keymap || behaviorsLoading;
  const showLoading = isDataLoading;

  const conn = useContext(ConnectionContext);
  const undoRedo = useContext(UndoRedoContext);
  const { toast } = useToast();
  const { osMode } = useOsMode();
  const { trackKeymap } = useTelemetry();

  useEffect(() => {
    setSelectedLayerIndex(0);
    setSelectedKeyPosition(undefined);
  }, [conn]);

  const keymapSentRef = useRef(false);
  useEffect(() => {
    if (!isDataLoading && keymap && !keymapSentRef.current) {
      keymapSentRef.current = true;
      try {
        trackKeymap("connect", JSON.stringify(keymap));
      } catch {
        // telemetry must never break the app
      }
    }
    if (isDataLoading) {
      keymapSentRef.current = false;
    }
  }, [isDataLoading, keymap, trackKeymap]);

  useSub("keymap_saved_success", () => {
    if (keymap) {
      try {
        trackKeymap("save", JSON.stringify(keymap));
      } catch {
        // telemetry must never break the app
      }
    }
  });

  useEffect(() => {
    async function performSetRequest() {
      if (!conn.conn || !layouts) {
        return;
      }

      const resp = await call_rpc(conn.conn, {
        keymap: { setActivePhysicalLayout: selectedPhysicalLayoutIndex },
      });

      const new_keymap = resp?.keymap?.setActivePhysicalLayout?.ok;
      if (new_keymap) {
        setKeymap(new_keymap);
        publishKeymapChanged();
      } else {
        console.error(
          "Failed to set the active physical layout err:",
          resp?.keymap?.setActivePhysicalLayout?.err
        );
      }
    }

    performSetRequest();
  }, [selectedPhysicalLayoutIndex, conn.conn, layouts, setKeymap]);

  const doSelectPhysicalLayout = useCallback(
    (i: number) => {
      const oldLayout = selectedPhysicalLayoutIndex;
      undoRedo?.(async () => {
        setSelectedPhysicalLayoutIndex(i);

        return async () => {
          setSelectedPhysicalLayoutIndex(oldLayout);
        };
      });
    },
    [undoRedo, selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex]
  );

  const doUpdateBinding = useCallback(
    (binding: BehaviorBinding) => {
      if (!keymap || selectedKeyPosition === undefined) {
        console.error(
          "Can't update binding without a selected key position and loaded keymap"
        );
        return;
      }

      const layer = selectedLayerIndex;
      const layerId = keymap.layers[layer].id;
      const keyPosition = selectedKeyPosition;
      const oldBinding = keymap.layers[layer].bindings[keyPosition];
      undoRedo?.(async () => {
        if (!conn.conn) {
          throw new Error("Not connected");
        }

        const resp = await call_rpc(conn.conn, {
          keymap: { setLayerBinding: { layerId, keyPosition, binding } },
        });

        if (
          resp.keymap?.setLayerBinding ===
          SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK
        ) {
          setKeymap(
            produce((draft: Keymap) => {
              draft.layers[layer].bindings[keyPosition] = binding;
            }) as (base: Keymap | undefined) => Keymap
          );
          publishKeymapChanged();
        } else {
          console.error("Failed to set binding", resp.keymap?.setLayerBinding);
          toast(ERROR_MESSAGES["keyboard.setBinding"], "error");
        }

        return async () => {
          if (!conn.conn) {
            return;
          }

          const resp = await call_rpc(conn.conn, {
            keymap: {
              setLayerBinding: { layerId, keyPosition, binding: oldBinding },
            },
          });
          if (
            resp.keymap?.setLayerBinding ===
            SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK
          ) {
            setKeymap(
              produce((draft: Keymap) => {
                draft.layers[layer].bindings[keyPosition] = oldBinding;
              }) as (base: Keymap | undefined) => Keymap
            );
            publishKeymapChanged();
          } else {
            toast(ERROR_MESSAGES["keyboard.undoBinding"], "error");
          }
        };
      });
    },
    [conn, keymap, undoRedo, selectedLayerIndex, selectedKeyPosition, setKeymap, toast]
  );

  const selectedBinding = useMemo(() => {
    if (keymap == null || selectedKeyPosition == null || !keymap.layers[selectedLayerIndex]) {
      return null;
    }

    return keymap.layers[selectedLayerIndex].bindings[selectedKeyPosition];
  }, [keymap, selectedLayerIndex, selectedKeyPosition]);

  useEffect(() => {
    setModifierFlags(
      getModifierFlags(selectedBinding, behaviors ? Object.values(behaviors) : []),
    );
  }, [behaviors, selectedBinding]);

  const handleModifierFlagsChanged = useCallback(
    (flags: number) => {
      setModifierFlags(flags);
      const behavior = selectedBinding
        ? behaviors?.[selectedBinding.behaviorId]
        : undefined;
      if (!selectedBinding || behavior?.displayName !== "Key Press") return;
      doUpdateBinding(replaceModifierFlags(selectedBinding, flags));
    },
    [behaviors, doUpdateBinding, selectedBinding],
  );

  const encoderSummary = useEncoderBindings(
    behaviors ? Object.values(behaviors) : [],
    selectedLayerIndex,
  );

  const changeLayerName = useCallback(
    (id: number, oldName: string, newName: string) => {
      if (!keymap || !canEditUserLayer(id)) return;
      async function changeName(layerId: number, name: string) {
        if (!conn.conn) {
          throw new Error("Not connected");
        }

        const resp = await runGuardedKeymapWrite(canEditUserLayer(layerId), () => call_rpc(conn.conn!, {
          keymap: { setLayerProps: { layerId, name } },
        }));

        if (
          resp?.keymap?.setLayerProps ==
          SetLayerPropsResponse.SET_LAYER_PROPS_RESP_OK
        ) {
          setKeymap(
            produce((draft: Keymap) => {
              const layer_index = draft.layers.findIndex(
                (l: Layer) => l.id == layerId
              );
              draft.layers[layer_index].name = name;
            }) as (base: Keymap | undefined) => Keymap
          );
          publishKeymapChanged();
        } else {
          throw new Error(
            "Failed to change layer name:" + resp?.keymap?.setLayerProps
          );
        }
      }

      undoRedo?.(async () => {
        await changeName(id, newName);
        return async () => {
          await changeName(id, oldName);
        };
      });
    },
    [conn, undoRedo, setKeymap, keymap]
  );

  useEffect(() => {
    if (!keymap?.layers) return;

    const selectedLayer = keymap.layers[selectedLayerIndex];
    if (!selectedLayer || !canEditUserLayer(selectedLayer.id)) {
      const firstEditableLayer = keymap.layers.findIndex((layer) =>
        canEditUserLayer(layer.id),
      );
      if (firstEditableLayer >= 0) {
        setSelectedLayerIndex(firstEditableLayer);
        setSelectedKeyPosition(undefined);
      }
    }
  }, [keymap, selectedLayerIndex]);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  const [switchingAlphaLayout, setSwitchingAlphaLayout] = useState(false);

  const alphaLayout = useMemo(
    () =>
      keymap?.layers[0]
        ? resolveCurrentAlphaLayout(keymap.layers[0].bindings, behaviors ?? {})
        : "qwerty",
    [keymap, behaviors],
  );
  const alphaLayoutCustomized = useMemo(
    () =>
      keymap?.layers[0]
        ? detectAlphaLayout(keymap.layers[0].bindings, behaviors ?? {}) === null
        : false,
    [keymap, behaviors],
  );

  // Swaps the alphabet block of the default layer between QWERTY and 大西配列.
  // Only the letter/symbol cells are touched; thumbs and layer keys stay put.
  const handleAlphaLayoutSelect = useCallback(
    async (layoutId: AlphaLayoutId) => {
      const baseLayer = keymap?.layers[0];
      if (!baseLayer || !conn.conn || switchingAlphaLayout) return;

      // Each layout remembers its own alpha block, so switching back restores
      // what the user last had there instead of a canned table.
      const result = buildAlphaLayoutChanges(
        baseLayer.bindings,
        behaviors ?? {},
        layoutId,
        readAlphaLayoutSnapshot(layoutId),
      );
      if (!result.ok) {
        toast(ERROR_MESSAGES["keyboard.setBinding"], "error");
        return;
      }
      if (result.changes.length === 0) return;

      const label = ALPHA_LAYOUT_LABELS[layoutId];
      if (
        !confirm(
          `デフォルトレイヤーの文字キー ${result.changes.length} 個を${label}に書き換えます。続けますか？`,
        )
      ) {
        return;
      }

      setSwitchingAlphaLayout(true);
      try {
        // Remember the block we are leaving, under the layout it belongs to.
        // Derived from the keymap itself so it survives a new browser/machine.
        const leaving = resolveCurrentAlphaLayout(
          baseLayer.bindings,
          behaviors ?? {},
        );
        if (leaving !== layoutId) {
          storeAlphaSnapshot(leaving, snapshotAlphaBlock(baseLayer.bindings));
        }

        for (const change of result.changes) {
          const resp = await call_rpc(conn.conn, {
            keymap: {
              setLayerBinding: {
                layerId: baseLayer.id,
                keyPosition: change.keyPosition,
                binding: change.binding,
              },
            },
          });
          if (
            resp.keymap?.setLayerBinding !==
            SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK
          ) {
            throw new Error(`setLayerBinding failed at ${change.keyPosition}`);
          }
        }

        const resp = await call_rpc(conn.conn, { keymap: { getKeymap: true } });
        const refreshed = resp?.keymap?.getKeymap;
        if (refreshed) {
          setKeymap(() => refreshed);
          publishKeymapChanged();
        }
        storeAlphaLayout(layoutId);
        toast(`${label}に切り替えました`, "success");
      } catch (e) {
        console.error("Alpha layout switch failed:", e);
        toast(ERROR_MESSAGES["keyboard.setBinding"], "error");
      } finally {
        setSwitchingAlphaLayout(false);
      }
    },
    [keymap, conn, behaviors, toast, setKeymap, switchingAlphaLayout],
  );

  const handleExport = useCallback(async () => {
    if (!keymap) return;
    const behaviorList = Object.values(behaviors);
    const exported = serializeKeymap(keymap, behaviorList, "1.0.0");
    const date = new Date().toISOString().slice(0, 10);
    const saved = await downloadJson(exported, `minimal-keys-keymap-${date}.json`);
    if (saved) {
      toast("キーマップをエクスポートしました", "success");
    }
  }, [keymap, behaviors, toast]);

  const handleImport = useCallback(async () => {
    if (!keymap || !conn.conn || !layouts) return;
    let json: string;
    try {
      json = await openFilePicker();
    } catch {
      return;
    }

    const behaviorList = Object.values(behaviors);
    const keyCount = layouts[selectedPhysicalLayoutIndex]?.keys?.length ?? 0;
    const maxLayers = keymap.layers.length + (keymap.availableLayers ?? 0);
    const runtimeUserLayers = keymap.layers.filter((layer) => !isPrecisionLayerId(layer.id));
    const result = deserializeKeymap(
      json,
      behaviorList,
      keyCount,
      maxLayers,
      keymap.layers.map((layer) => layer.id),
    );

    if (!result.ok) {
      const err = result.error;
      const messages: Record<string, string> = {
        parse: "JSONの形式が正しくありません",
        format: "対応していないファイル形式です",
        structure: "ファイル構造が不正です",
        layerCount: `レイヤー数が上限を超えています`,
        bindingCount: `キー数がデバイスと一致しません`,
        layerIndex: `レイヤー参照が範囲外です`,
      };
      const msg = err.type === "behavior"
        ? `未対応のキー動作: ${err.names.join(", ")}`
        : messages[err.type] ?? "インポートに失敗しました";
      toast(msg, "error");
      return;
    }

    const changes = calculateImportChanges(
      { layers: runtimeUserLayers },
      result.layers,
    );
    const unappliedLayerCount = calculateUnappliedLayerCount(
      runtimeUserLayers.length,
      result.layers.length,
    );
    const writeCount = changes.layerProps.length + changes.bindings.length;
    const layerLimitWarning = unappliedLayerCount > 0
      ? `\nこのファイルには${result.layers.length}つのレイヤーがありますが、書き込めるのは${runtimeUserLayers.length}つまでです。残り${unappliedLayerCount}つは反映されません。続けますか？`
      : "";
    if (!confirm(`${result.layers.length} レイヤー、${keyCount} キー/レイヤーをインポートします。\n変更のある ${writeCount} か所を書き込みます。\n現在のキーマップを上書きします。${layerLimitWarning || "続けますか？"}`)) {
      return;
    }

    setImporting(true);
    setImportProgress({ completed: 0, total: writeCount });
    try {
      if (writeCount === 0) {
        toast(
          unappliedLayerCount > 0
            ? `書き込める範囲に変更はありませんでした。残り${unappliedLayerCount}つのレイヤーは反映されていません`
            : "変更はありませんでした",
          unappliedLayerCount > 0 ? "info" : "success",
        );
        return;
      }

      let completed = 0;
      const advanceProgress = () => {
        completed += 1;
        setImportProgress({ completed, total: writeCount });
      };
      for (const { layerId, name } of changes.layerProps) {
        await call_rpc(conn.conn, {
          keymap: { setLayerProps: { layerId, name } },
        });
        advanceProgress();
      }
      for (const { layerId, keyPosition, binding } of changes.bindings) {
        await call_rpc(conn.conn, {
          keymap: { setLayerBinding: { layerId, keyPosition, binding } },
        });
        advanceProgress();
      }

      const resp = await call_rpc(conn.conn, { keymap: { getKeymap: true } });
      const refreshed = resp?.keymap?.getKeymap;
      if (refreshed) {
        setKeymap(() => refreshed);
        publishKeymapChanged();
      }

      toast("キーマップをインポートしました", "success");
    } catch (e) {
      console.error("Import failed:", e);
      toast("インポート中にエラーが発生しました", "error");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }, [keymap, conn, behaviors, layouts, selectedPhysicalLayoutIndex, toast, setKeymap]);

  return (
    <div className="grid h-full min-h-0 min-w-0 max-w-full grid-cols-[auto_1fr] grid-rows-[minmax(150px,55fr)_minmax(160px,45fr)] bg-base-300">
      <div className="p-2 flex min-h-0 flex-col gap-2 overflow-y-auto bg-gray-50 border-r border-gray-200 row-span-2">
        {!showLoading && layouts ? (
          <div className="col-start-3 row-start-1 row-end-2">
            <PhysicalLayoutPicker
              layouts={layouts}
              selectedPhysicalLayoutIndex={selectedPhysicalLayoutIndex}
              onPhysicalLayoutClicked={doSelectPhysicalLayout}
            />
          </div>
        ) : (
          <div className="w-20 space-y-2 animate-pulse">
            <div className="h-3 w-12 bg-base-300 rounded" />
            <div className="h-8 w-full bg-base-300 rounded" />
          </div>
        )}

        {!showLoading && keymap ? (
          <div className="col-start-1 row-start-1 row-end-2">
            <LayerPicker
              layers={keymap.layers}
              selectedLayerIndex={selectedLayerIndex}
              onLayerClicked={setSelectedLayerIndex}
              canReorder={false}
              onLayerNameChanged={changeLayerName}
            />
          </div>
        ) : (
          <div className="w-20 space-y-1.5 animate-pulse">
            <div className="h-3 w-14 bg-base-300 rounded" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 w-full bg-base-300 rounded" />
            ))}
          </div>
        )}

        {!showLoading && keymap && (
          <AlphaLayoutToggle
            value={alphaLayout}
            customized={alphaLayoutCustomized}
            onSelect={handleAlphaLayoutSelect}
            busy={switchingAlphaLayout}
            disabled={!conn.conn}
          />
        )}

        {!showLoading && keymap && (
          <div className="flex gap-1">
            <button
              className="flex items-center gap-1 px-2 py-1 text-sm rounded border border-base-300 bg-white hover:bg-base-200 text-base-content/70 hover:text-base-content transition-colors"
              onClick={handleExport}
              title="キーマップをエクスポート"
            >
              <Download className="w-4 h-4" />
              保存
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 text-sm rounded border border-base-300 bg-white hover:bg-base-200 text-base-content/70 hover:text-base-content transition-colors disabled:opacity-40"
              onClick={handleImport}
              disabled={importing}
              title="キーマップをインポート"
            >
              {importing ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  {importProgress
                    ? `送信中 ${importProgress.completed} / ${importProgress.total}`
                    : "準備中..."}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  読込
                </>
              )}
            </button>
          </div>
        )}

        <AutoMouseLayerControl />

        <ModifierPanel
          modifierFlags={modifierFlags}
          onModifierFlagsChanged={handleModifierFlagsChanged}
          osMode={osMode}
        />
      </div>
      <KeyboardArea
        layouts={layouts}
        keymap={keymap}
        behaviors={behaviors}
        selectedPhysicalLayoutIndex={selectedPhysicalLayoutIndex}
        selectedLayerIndex={selectedLayerIndex}
        selectedKeyPosition={selectedKeyPosition}
        onKeyPositionClicked={setSelectedKeyPosition}
        encoderRotationLabel={encoderSummary?.rotationLabel}
        showLoading={showLoading}
      />
      <div
        data-testid="binding-picker-panel"
        className="col-start-2 row-start-2 min-h-0 overflow-hidden border-t border-gray-200 bg-white p-2"
      >
        {!showLoading && keymap && selectedBinding != null ? (
          <BehaviorBindingPicker
            binding={selectedBinding}
            behaviors={Object.values(behaviors)}
            layers={keymap.layers.map(({ id, name }, li) => ({
              id,
              index: li,
              name: name || li.toLocaleString(),
            }))}
            onBindingChanged={doUpdateBinding}
            keyPosition={selectedKeyPosition}
            modifierFlags={modifierFlags}
          />
        ) : !showLoading && keymap ? (
          <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
            キーをクリックして設定を変更
          </div>
        ) : (
          <LoadingSpinner label="設定パネルを準備しています..." />
        )}
      </div>
    </div>
  );
}
