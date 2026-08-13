import { useCallback, useState } from "react";
import { useDirtyNavigation } from "./DirtyStateContext";

export type StudioTabId = "keymap" | "trackball" | "encoder" | "combo" | "bluetooth" | "battery" | "holdtap" | "settings";
export type StudioSessionAction = () => void | Promise<void>;
export interface StudioSessionNavigationOptions { initialTab?: StudioTabId; onTabChanged?(tab: StudioTabId): void; }
export interface StudioSessionNavigation { activeTab: StudioTabId; requestTab(tab: StudioTabId): Promise<boolean>; requestExplicitDisconnect(action: StudioSessionAction): Promise<boolean>; handleUnexpectedDisconnect(action: StudioSessionAction): Promise<void>; }

export function useStudioSessionNavigation(options?: StudioSessionNavigationOptions): StudioSessionNavigation {
  const initialTab = options?.initialTab ?? "keymap";
  const [activeTab, setActiveTab] = useState<StudioTabId>(initialTab);
  const { requestNavigation, preserveDirtyDrafts } = useDirtyNavigation();
  const requestTab = useCallback((tab: StudioTabId) => tab === activeTab ? Promise.resolve(true) : requestNavigation(() => { setActiveTab(tab); options?.onTabChanged?.(tab); }), [activeTab, options, requestNavigation]);
  const requestExplicitDisconnect = useCallback((action: StudioSessionAction) => requestNavigation(async () => { await action(); setActiveTab(initialTab); }), [initialTab, requestNavigation]);
  const handleUnexpectedDisconnect = useCallback(async (action: StudioSessionAction) => { preserveDirtyDrafts(); await action(); }, [preserveDirtyDrafts]);
  return { activeTab, requestTab, requestExplicitDisconnect, handleUnexpectedDisconnect };
}
