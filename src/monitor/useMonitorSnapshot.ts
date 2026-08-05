import { useSyncExternalStore } from "react";
import type { MonitorStore } from "./monitorStore";

/** Subscribe only inside a monitor-specific UI leaf. */
export function useMonitorSnapshot(store: MonitorStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
