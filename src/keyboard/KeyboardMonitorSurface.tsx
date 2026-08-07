import { Activity, Layers, MousePointer2, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useBehaviorMap } from "../behaviors/BehaviorsContext";
import { MinimalKeysMonitorLayout } from "../monitor/MinimalKeysMonitorLayout";
import { MONITOR_LAYER_NAMES } from "../monitor/layerNames";
import { getMonitorKeyLabel } from "../monitor/minimalKeysMonitorLabels";
import {
  POINTER_DISPLAY_TIMEOUT_MS,
  type MonitorStore,
  type PointerSample,
} from "../monitor/monitorStore";
import { resolveMonitorBinding } from "../monitor/resolveMonitorBindings";
import { useMonitorSnapshot } from "../monitor/useMonitorSnapshot";
import { MINIMAL_KEYS_KEY_COUNT } from "./minimal-keys-layout";
import { useMonitorKeymap } from "./MonitorKeymapContext";

interface KeyboardMonitorSurfaceProps {
  monitorStore: MonitorStore;
  monitorActive: boolean;
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function usePointerSummary(pointer: PointerSample | null) {
  const [now, setNow] = useState(() => Date.now());
  const pointerAt = pointer?.at;

  useEffect(() => {
    if (pointerAt === undefined) return;
    setNow(Date.now());
    const delay = Math.max(0, pointerAt + POINTER_DISPLAY_TIMEOUT_MS - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [pointerAt]);

  if (pointer === null || now - pointer.at >= POINTER_DISPLAY_TIMEOUT_MS) {
    return "停止中";
  }
  return `dx ${signed(pointer.dx)} / dy ${signed(pointer.dy)}`;
}

export function KeyboardMonitorSurface({
  monitorStore,
  monitorActive,
}: KeyboardMonitorSurfaceProps) {
  const monitor = useMonitorSnapshot(monitorStore);
  const keymap = useMonitorKeymap();
  const behaviors = useBehaviorMap();
  const resolvedBindings = useMemo(
    () =>
      keymap
        ? Array.from({ length: MINIMAL_KEYS_KEY_COUNT }, (_, position) =>
            resolveMonitorBinding({
              keymap,
              behaviors,
              activeLayerMask: monitor.activeLayerMask,
              position,
            }),
          )
        : undefined,
    [behaviors, keymap, monitor.activeLayerMask],
  );
  const latestPosition = monitor.lastKeyEvent?.position;
  const layerName =
    MONITOR_LAYER_NAMES[monitor.activeLayerIndex] ??
    `L${monitor.activeLayerIndex}`;
  const latestKey =
    latestPosition === undefined
      ? "待機中"
      : `#${latestPosition} ${resolvedBindings?.[latestPosition]?.label ?? getMonitorKeyLabel(latestPosition, monitor.activeLayerIndex).label}`;
  const pointer = usePointerSummary(monitor.pointer);

  const summaries = [
    {
      label: "モニター",
      value: monitorActive ? "接続中" : "モニター未接続",
      icon: <Radio className="h-4 w-4" aria-hidden="true" />,
      active: monitorActive,
    },
    {
      label: "現在レイヤー",
      value: layerName,
      icon: <Layers className="h-4 w-4" aria-hidden="true" />,
    },
    {
      label: "最新キー",
      value: latestKey,
      icon: <Activity className="h-4 w-4" aria-hidden="true" />,
    },
    {
      label: "直近の移動",
      value: pointer,
      icon: <MousePointer2 className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  return (
    <section
      aria-label="リアルタイムモニター"
      className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border border-base-300 bg-white p-3 shadow-sm"
    >
      <MinimalKeysMonitorLayout
        activeLayerIndex={monitor.activeLayerIndex}
        pressed={monitor.pressed}
        holdTapStates={monitor.holdTapStates}
        resolvedBindings={resolvedBindings}
        className="min-h-0 flex-1 bg-base-200"
      />

      <dl className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        {summaries.map((summary) => (
          <div
            key={summary.label}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-base-300 bg-white px-3 py-2 shadow-sm"
          >
            <span
              className={summary.active ? "text-primary" : "text-base-content/50"}
            >
              {summary.icon}
            </span>
            <div className="min-w-0">
              <dt className="truncate text-[11px] font-medium text-base-content/50">
                {summary.label}
              </dt>
              <dd
                className={`truncate text-sm font-bold ${summary.active ? "text-primary" : "text-base-content"}`}
              >
                {summary.value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
