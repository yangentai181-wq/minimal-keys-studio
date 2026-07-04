// Realtime monitor surface driven purely by Raw HID frames.
// Works without any Studio RPC connection (degraded/monitor-only mode).

import { Activity, Bluetooth, Cable, MousePointer2, X } from "lucide-react";

import type { ConnectionDescription } from "../connection/coordinator";
import { isLayerActive } from "../connection/rawHidFrames";
import { LayerPicker } from "../keyboard/LayerPicker";
import { AUTO_MOUSE_LAYER_INDEX } from "../keyboard/minimal-keys-layers";
import type { MonitorSnapshot } from "./monitorStore";

import { MONITOR_LAYER_NAMES } from "./layerNames";

export interface MonitorPanelProps {
  snapshot: MonitorSnapshot;
  description: ConnectionDescription;
  editorAvailable: boolean;
  busy?: boolean;
  onRetryEditor?: () => void;
  onConnectBle?: () => void;
  onClose?: () => void;
}

export function MonitorPanel({
  snapshot,
  description,
  editorAvailable,
  busy,
  onRetryEditor,
  onConnectBle,
  onClose,
}: MonitorPanelProps) {
  const layers = MONITOR_LAYER_NAMES.map((name, id) => ({ id, name }));
  const pressedList = [...snapshot.pressed].sort((a, b) => a - b);
  const autoMouseActive = isLayerActive(
    snapshot.activeLayerMask,
    AUTO_MOUSE_LAYER_INDEX,
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-bold text-base-content">
            リアルタイムモニター（Raw HID）
          </h1>
        </div>
        {onClose && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-3 py-1.5 text-sm hover:bg-base-200"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            モニター終了
          </button>
        )}
      </header>

      <section
        className="rounded-xl border border-base-300 bg-base-100 px-4 py-3"
        role="status"
      >
        <p className="text-sm font-semibold text-base-content">
          {description.title}
        </p>
        <p className="mt-1 text-xs leading-5 text-base-content/70">
          {description.body}
        </p>
        {!editorAvailable && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetryEditor && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-content hover:bg-primary/90 disabled:opacity-50"
                onClick={onRetryEditor}
                disabled={busy}
              >
                <Cable className="h-4 w-4" aria-hidden="true" />
                エディター接続を再試行（USB Studio RPC）
              </button>
            )}
            {onConnectBle && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-1.5 text-sm hover:bg-base-200 disabled:opacity-50"
                onClick={onConnectBle}
                disabled={busy}
              >
                <Bluetooth className="h-4 w-4" aria-hidden="true" />
                BLEで編集接続（補助）
              </button>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <section className="rounded-xl border border-base-300 bg-base-100 px-4 py-3">
          {/* Layer display follows the Raw HID layer frames; manual layer
              switching is intentionally disabled in monitor mode. */}
          <LayerPicker
            layers={layers}
            selectedLayerIndex={snapshot.activeLayerIndex}
            selectionLocked
            showInactiveAutoMouseLayer={false}
          />
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-base-300 bg-base-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-base-content">
              押下中のキー
            </h2>
            {pressedList.length === 0 ? (
              <p className="mt-2 text-xs text-base-content/60">
                （キーを押すとここに表示されます）
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {pressedList.map((position) => (
                  <li
                    key={position}
                    className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary"
                  >
                    #{position}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-base-300 bg-base-100 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-base-content">
              <MousePointer2 className="h-4 w-4" aria-hidden="true" />
              トラックボール
              {autoMouseActive && (
                <span className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] leading-none text-orange-600">
                  Auto Mouse 使用中
                </span>
              )}
            </h2>
            {snapshot.pointer ? (
              <p className="mt-2 font-mono text-xs text-base-content/80">
                dx={snapshot.pointer.dx} dy={snapshot.pointer.dy} wheel=
                {snapshot.pointer.wheel} buttons={snapshot.pointer.buttons}
              </p>
            ) : (
              <p className="mt-2 text-xs text-base-content/60">
                （ボールを動かすとここに表示されます）
              </p>
            )}
          </section>

          <section className="rounded-xl border border-base-300 bg-base-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-base-content">
              エンコーダー
            </h2>
            {Object.keys(snapshot.encoders).length === 0 ? (
              <p className="mt-2 text-xs text-base-content/60">
                （回すとここに表示されます）
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {Object.entries(snapshot.encoders).map(([sensor, sample]) => (
                  <li
                    key={sensor}
                    className="rounded-md bg-base-200 px-2 py-1 font-mono text-xs"
                  >
                    #{sensor}: {sample.delta > 0 ? "+" : ""}
                    {sample.delta}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
