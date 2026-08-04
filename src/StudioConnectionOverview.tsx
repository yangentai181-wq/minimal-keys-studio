import {
  Activity,
  Bluetooth,
  Cable,
  Keyboard,
  Layers,
  Link2,
  MousePointer2,
  Usb,
} from "lucide-react";
import type { ReactNode } from "react";

import { isLayerActive } from "./connection/rawHidFrames";
import { AUTO_MOUSE_LAYER_INDEX } from "./keyboard/minimal-keys-layers";
import { MinimalKeysMonitorLayout } from "./monitor/MinimalKeysMonitorLayout";
import { MONITOR_LAYER_NAMES } from "./monitor/layerNames";
import { getMonitorKeyLabel } from "./monitor/minimalKeysMonitorLabels";
import type { MonitorSnapshot } from "./monitor/monitorStore";
import { TrackballPrecisionStatus } from "./monitor/TrackballPrecisionStatus";

interface StudioConnectionOverviewProps {
  monitor: MonitorSnapshot;
  monitorActive: boolean;
  editorAvailable: boolean;
  connectionTitle: string;
  connectionBody: string;
  deviceName?: string;
  showLayout?: boolean;
  actions?: ReactNode;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function DeviceCard({
  icon,
  title,
  detail,
  active,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-lg border px-4 py-3 shadow-sm",
        active ? "border-primary/30 bg-primary/10" : "border-base-300 bg-white",
      )}
    >
      <div
        className={cx(
          "flex min-w-0 items-center gap-2 text-sm font-bold",
          active ? "text-primary" : "text-base-content",
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 truncate whitespace-nowrap">{title}</span>
      </div>
      <p className="mt-1 truncate whitespace-nowrap text-xs text-base-content/60">
        {detail}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "accent";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-base-300 bg-white px-4 py-3 shadow-sm">
      <p className="truncate whitespace-nowrap text-xs text-base-content/50">
        {label}
      </p>
      <p
        className={cx(
          "mt-1 truncate whitespace-nowrap text-sm font-bold",
          tone === "primary"
            ? "text-primary"
            : tone === "accent"
              ? "text-accent"
              : "text-base-content",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function StudioConnectionOverview({
  monitor,
  monitorActive,
  editorAvailable,
  connectionTitle,
  connectionBody,
  deviceName,
  showLayout,
  actions,
}: StudioConnectionOverviewProps) {
  const pressedList = [...monitor.pressed].sort((a, b) => a - b);
  const latestPosition = pressedList[pressedList.length - 1];
  const latestKey =
    latestPosition === undefined
      ? "待機中"
      : `#${latestPosition} ${getMonitorKeyLabel(latestPosition, monitor.activeLayerIndex).label}`;
  const layerName =
    MONITOR_LAYER_NAMES[monitor.activeLayerIndex] ??
    `L${monitor.activeLayerIndex}`;
  const pointerSummary = monitor.pointer
    ? `dx ${monitor.pointer.dx >= 0 ? "+" : ""}${monitor.pointer.dx} / dy ${
        monitor.pointer.dy >= 0 ? "+" : ""
      }${monitor.pointer.dy}`
    : "待機中";
  const autoMouseActive = isLayerActive(
    monitor.activeLayerMask,
    AUTO_MOUSE_LAYER_INDEX,
  );

  return (
    <section className="border-b border-base-300 bg-base-200 px-3 py-3">
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        <div className="grid gap-3 lg:grid-cols-4">
          <DeviceCard
            active={monitorActive}
            icon={<Usb className="h-4 w-4" aria-hidden="true" />}
            title="右手USBモニター"
            detail={monitorActive ? "Raw HIDで監視中" : "未接続"}
          />
          <DeviceCard
            active={editorAvailable}
            icon={<Cable className="h-4 w-4" aria-hidden="true" />}
            title="Studio RPCエディター"
            detail={
              editorAvailable
                ? deviceName
                  ? `${deviceName} を編集中`
                  : "編集保存が利用可能"
                : "未確認"
            }
          />
          <DeviceCard
            active={editorAvailable && monitorActive}
            icon={<Keyboard className="h-4 w-4" aria-hidden="true" />}
            title="エディタ / モニタ統合"
            detail={
              editorAvailable && monitorActive
                ? "同じ画面で利用中"
                : connectionTitle
            }
          />
          <DeviceCard
            active={autoMouseActive}
            icon={<MousePointer2 className="h-4 w-4" aria-hidden="true" />}
            title="オートマウス"
            detail={autoMouseActive ? "使用中" : pointerSummary}
          />
        </div>

        <div className="rounded-lg border border-base-300 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <h2 className="truncate whitespace-nowrap text-sm font-bold text-base-content">
                  接続状態
                </h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-base-content/60">
                {connectionBody}
              </p>
            </div>
            {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <MetricCard label="現在レイヤー" value={layerName} tone="accent" />
            <MetricCard label="最新キー" value={latestKey} tone="primary" />
            <MetricCard label="トラックボール" value={pointerSummary} />
          </div>
        </div>

        {editorAvailable && <TrackballPrecisionStatus />}

        {showLayout && (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <MinimalKeysMonitorLayout
              activeLayerIndex={monitor.activeLayerIndex}
              pressed={monitor.pressed}
              className="bg-white"
            />
            <div className="rounded-lg border border-base-300 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-bold text-base-content">
                  ライブ読み取り
                </h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-base-content/70">
                Raw HIDのpositionを実配列に重ねて表示しています。
                Studio RPCが成立している場合は、この下のエディターで同じキーを編集できます。
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-lg bg-primary/10 px-3 py-1 text-primary">
                  {monitorActive ? "monitor live" : "monitor idle"}
                </span>
                <span className="rounded-lg bg-base-200 px-3 py-1 text-base-content/60">
                  {editorAvailable ? "editor ready" : "editor pending"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-base-200 px-3 py-1 text-base-content/60">
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  L{monitor.activeLayerIndex}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-base-200 px-3 py-1 text-base-content/60">
                  <Bluetooth className="h-3.5 w-3.5" aria-hidden="true" />
                  split input via central
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
