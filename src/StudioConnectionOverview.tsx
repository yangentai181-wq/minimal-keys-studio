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
import { useState, type ReactNode } from "react";

import { isLayerActive } from "./connection/rawHidFrames";
import { AUTO_MOUSE_LAYER_INDEX } from "./keyboard/minimal-keys-layers";
import { MinimalKeysMonitorLayout } from "./monitor/MinimalKeysMonitorLayout";
import { MONITOR_LAYER_NAMES } from "./monitor/layerNames";
import { getMonitorKeyLabel } from "./monitor/minimalKeysMonitorLabels";
import type { MonitorStore } from "./monitor/monitorStore";
import { useMonitorSnapshot } from "./monitor/useMonitorSnapshot";
import { TrackballPrecisionStatus } from "./monitor/TrackballPrecisionStatus";

interface StudioConnectionOverviewProps {
  monitorStore: MonitorStore;
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

function DeviceStatusIcon({
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
    <li
      aria-label={`${title}: ${active ? "接続中" : detail}`}
      title={`${title} — ${detail}`}
      className={cx(
        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-base-300 bg-white text-base-content/55",
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span
        aria-hidden="true"
        className={cx(
          "absolute right-0.5 top-0.5 h-2 w-2 rounded-full",
          active ? "bg-primary" : "bg-base-300",
        )}
      />
    </li>
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

function MonitorSummary({
  store,
  monitorActive,
  editorAvailable,
  connectionTitle,
  deviceName,
  showLayout,
}: {
  store: MonitorStore;
  monitorActive: boolean;
  editorAvailable: boolean;
  connectionTitle: string;
  deviceName?: string;
  showLayout?: boolean;
}) {
  const monitor = useMonitorSnapshot(store);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const pressedList = [...monitor.pressed].sort((a, b) => a - b);
  const latestPosition = pressedList[pressedList.length - 1];
  const latestKey = latestPosition === undefined ? "待機中" : `#${latestPosition} ${getMonitorKeyLabel(latestPosition, monitor.activeLayerIndex).label}`;
  const layerName = MONITOR_LAYER_NAMES[monitor.activeLayerIndex] ?? `L${monitor.activeLayerIndex}`;
  const pointerSummary = monitor.pointer ? `dx ${monitor.pointer.dx >= 0 ? "+" : ""}${monitor.pointer.dx} / dy ${monitor.pointer.dy >= 0 ? "+" : ""}${monitor.pointer.dy}` : "待機中";
  const autoMouseActive = isLayerActive(monitor.activeLayerMask, AUTO_MOUSE_LAYER_INDEX);
  const statusItems = [
    {
      active: monitorActive,
      icon: <Usb className="h-5 w-5" />,
      title: "右手USBモニター",
      detail: monitorActive ? "Raw HIDで監視中" : "未接続",
    },
    {
      active: editorAvailable,
      icon: <Cable className="h-5 w-5" />,
      title: "Studio RPCエディター",
      detail: editorAvailable
        ? deviceName
          ? `${deviceName} を編集中`
          : "編集保存が利用可能"
        : "未確認",
    },
    {
      active: editorAvailable && monitorActive,
      icon: <Keyboard className="h-5 w-5" />,
      title: "エディタ / モニタ統合",
      detail:
        editorAvailable && monitorActive ? "同じ画面で利用中" : connectionTitle,
    },
    {
      active: autoMouseActive,
      icon: <MousePointer2 className="h-5 w-5" />,
      title: "オートマウス",
      detail: autoMouseActive ? "使用中" : pointerSummary,
    },
  ];

  return <div className="min-w-0 flex-1">
    <div className="flex min-h-10 min-w-0 items-center gap-2">
      <ul aria-label="接続状況の概要" className="flex shrink-0 items-center gap-1.5">
        {statusItems.map((item) => (
          <DeviceStatusIcon key={item.title} {...item} />
        ))}
      </ul>
      <div className="hidden min-w-0 flex-1 truncate text-xs text-base-content/60 md:block">レイヤー: {layerName} / 最新キー: {latestKey}</div>
      <button type="button" className="shrink-0 rounded border border-base-300 px-2.5 py-1 text-xs font-medium" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen}>接続の詳細</button>
    </div>
    {detailsOpen && <div data-testid="connection-details" className="mt-3 max-h-[min(45dvh,360px)] space-y-3 overflow-y-auto pr-1">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {statusItems.map((item) => (
          <MetricCard
            key={item.title}
            label={item.title}
            value={item.detail}
            tone={item.active ? "primary" : undefined}
          />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="現在レイヤー" value={layerName} tone="accent" />
        <MetricCard label="最新キー" value={latestKey} tone="primary" />
        <MetricCard label="トラックボール" value={pointerSummary} />
      </div>
      {editorAvailable && <TrackballPrecisionStatus />}
      {showLayout && <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <MinimalKeysMonitorLayout activeLayerIndex={monitor.activeLayerIndex} pressed={monitor.pressed} className="bg-white" />
        <div className="rounded-lg border border-base-300 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" aria-hidden="true" /><h2 className="text-sm font-bold text-base-content">ライブ読み取り</h2></div><p className="mt-2 text-sm leading-6 text-base-content/70">Raw HIDのpositionを実配列に重ねて表示しています。Studio RPCが成立している場合は、この下のエディターで同じキーを編集できます。</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-lg bg-primary/10 px-3 py-1 text-primary">{monitorActive ? "monitor live" : "monitor idle"}</span><span className="rounded-lg bg-base-200 px-3 py-1 text-base-content/60">{editorAvailable ? "editor ready" : "editor pending"}</span><span className="inline-flex items-center gap-1 rounded-lg bg-base-200 px-3 py-1 text-base-content/60"><Layers className="h-3.5 w-3.5" aria-hidden="true" />L{monitor.activeLayerIndex}</span><span className="inline-flex items-center gap-1 rounded-lg bg-base-200 px-3 py-1 text-base-content/60"><Bluetooth className="h-3.5 w-3.5" aria-hidden="true" />split input via central</span></div></div>
      </div>}
    </div>}
  </div>;
}

export function StudioConnectionOverview({
  monitorStore,
  monitorActive,
  editorAvailable,
  connectionTitle,
  connectionBody,
  deviceName,
  showLayout,
  actions,
}: StudioConnectionOverviewProps) {
  return (
    <section className="border-b border-base-300 bg-base-200 px-3 py-1">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-lg border border-base-300 bg-white px-2 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 shrink">
              <div className="flex min-w-0 items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <h2 className="truncate whitespace-nowrap text-sm font-bold text-base-content">
                  接続状態
                </h2>
              </div>
              <p className="max-w-72 truncate text-xs text-base-content/60">
                {connectionBody}
              </p>
            </div>
            {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
            <MonitorSummary store={monitorStore} monitorActive={monitorActive} editorAvailable={editorAvailable} connectionTitle={connectionTitle} deviceName={deviceName} showLayout={showLayout} />
          </div>
        </div>
      </div>
    </section>
  );
}
