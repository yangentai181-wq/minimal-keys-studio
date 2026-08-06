import { Activity, Layers, MousePointer2, Radio } from "lucide-react";

import { MinimalKeysMonitorLayout } from "../monitor/MinimalKeysMonitorLayout";
import { MONITOR_LAYER_NAMES } from "../monitor/layerNames";
import { getMonitorKeyLabel } from "../monitor/minimalKeysMonitorLabels";
import type { MonitorStore } from "../monitor/monitorStore";
import { useMonitorSnapshot } from "../monitor/useMonitorSnapshot";

interface KeyboardMonitorSurfaceProps {
  monitorStore: MonitorStore;
  monitorActive: boolean;
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

export function KeyboardMonitorSurface({
  monitorStore,
  monitorActive,
}: KeyboardMonitorSurfaceProps) {
  const monitor = useMonitorSnapshot(monitorStore);
  const pressedPositions = [...monitor.pressed];
  const latestPosition = pressedPositions[pressedPositions.length - 1];
  const layerName =
    MONITOR_LAYER_NAMES[monitor.activeLayerIndex] ??
    `L${monitor.activeLayerIndex}`;
  const latestKey =
    latestPosition === undefined
      ? "待機中"
      : `#${latestPosition} ${getMonitorKeyLabel(latestPosition, monitor.activeLayerIndex).label}`;
  const pointer = monitor.pointer
    ? `dx ${signed(monitor.pointer.dx)} / dy ${signed(monitor.pointer.dy)}`
    : "待機中";

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
      label: "トラックボール",
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
        className="min-h-0 flex-1 bg-base-200"
      />

      <dl className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
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
