import { Eye, Pencil, PlugZap } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { MonitorStore } from "../monitor/monitorStore";
import { KeyboardMonitorSurface } from "./KeyboardMonitorSurface";

export interface KeyboardWorkspaceProps {
  editor: ReactNode;
  monitorStore: MonitorStore;
  monitorActive: boolean;
  monitorBusy?: boolean;
  onConnectMonitor?: () => void;
}

type KeyboardWorkspaceMode = "editor" | "monitor";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function KeyboardWorkspace({
  editor,
  monitorStore,
  monitorActive,
  monitorBusy = false,
  onConnectMonitor,
}: KeyboardWorkspaceProps) {
  const [mode, setMode] = useState<KeyboardWorkspaceMode>("editor");
  const monitorSelected = mode === "monitor";
  const monitorUnavailable = !monitorActive && !monitorSelected;

  return (
    <main className="flex h-full min-h-0 flex-col bg-[#F8FAFC]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-base-300 bg-white px-3 py-2">
        <div
          role="group"
          aria-label="キーボード表示"
          className="inline-flex rounded-lg border border-base-300 bg-base-200 p-1 shadow-sm"
        >
          <button
            type="button"
            aria-pressed={mode === "editor"}
            onClick={() => setMode("editor")}
            className={cx(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              mode === "editor"
                ? "bg-primary text-primary-content shadow-sm"
                : "text-base-content/60 hover:bg-white hover:text-base-content",
            )}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            編集
          </button>
          <button
            type="button"
            aria-pressed={monitorSelected}
            aria-describedby={monitorUnavailable ? "monitor-unavailable" : undefined}
            disabled={monitorUnavailable}
            onClick={() => setMode("monitor")}
            className={cx(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45",
              monitorSelected
                ? "bg-primary text-primary-content shadow-sm"
                : "text-base-content/60 hover:bg-white hover:text-base-content",
            )}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            リアルタイム
          </button>
        </div>

        {!monitorActive && (
          <div className="flex min-w-0 items-center gap-2">
            <span
              id="monitor-unavailable"
              className="hidden text-xs text-base-content/60 sm:inline"
            >
              リアルタイム表示には右手USB接続が必要です
            </span>
            {onConnectMonitor && (
              <button
                type="button"
                disabled={monitorBusy}
                onClick={onConnectMonitor}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                <PlugZap className="h-4 w-4" aria-hidden="true" />
                {monitorBusy ? "接続中…" : "右手USBモニターを接続"}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 p-3">
        <div hidden={monitorSelected} className="h-full min-h-0">
          {editor}
        </div>
        {monitorSelected && (
          <KeyboardMonitorSurface
            monitorStore={monitorStore}
            monitorActive={monitorActive}
          />
        )}
      </div>
    </main>
  );
}
