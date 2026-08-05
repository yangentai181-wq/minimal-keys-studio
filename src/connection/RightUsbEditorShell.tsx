import type { ReactNode } from "react";
import { StudioConnectionOverview } from "../StudioConnectionOverview";
import type { MonitorStore } from "../monitor/monitorStore";

/** Production editor boundary: Raw HID data enters only through monitor leaves. */
export function RightUsbEditorShell({
  header,
  editor,
  footer,
  monitorStore,
  monitorActive,
  editorAvailable,
  connectionTitle,
  connectionBody,
  deviceName,
  showLayout,
  actions,
}: {
  header: ReactNode;
  editor: ReactNode;
  footer: ReactNode;
  monitorStore: MonitorStore;
  monitorActive: boolean;
  editorAvailable: boolean;
  connectionTitle: string;
  connectionBody: string;
  deviceName?: string;
  showLayout?: boolean;
  actions?: ReactNode;
}) {
  return <div className="bg-base-100 text-base-content h-dvh w-full min-h-[600px] inline-grid grid-cols-[auto] grid-rows-[auto_auto_auto_minmax(250px,1fr)_auto] overflow-hidden">
    {header}
    <StudioConnectionOverview monitorStore={monitorStore} monitorActive={monitorActive} editorAvailable={editorAvailable} connectionTitle={connectionTitle} connectionBody={connectionBody} deviceName={deviceName} showLayout={showLayout} actions={actions} />
    {editor}
    {footer}
  </div>;
}
