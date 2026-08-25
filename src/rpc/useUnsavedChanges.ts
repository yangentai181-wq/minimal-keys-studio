import { useCallback } from "react";

import { useConnectedDeviceData } from "./useConnectedDeviceData";
import { useSub } from "../usePubSub";

export interface UnsavedChangesState {
  /** True while the keyboard holds keymap edits that are not yet in flash. */
  unsaved: boolean;
  /** Clears the flag locally, e.g. right after a successful save. */
  setUnsaved: (unsaved: boolean) => void;
}

/**
 * Unsaved-changes state as reported by the keyboard itself.
 *
 * The local undo history is not a substitute: reloading the page empties it
 * while the keyboard still holds RAM-only edits that a power cycle would drop.
 */
export function useUnsavedChanges(): UnsavedChangesState {
  const [unsaved, setUnsavedState] = useConnectedDeviceData<boolean>(
    { keymap: { checkUnsavedChanges: true } },
    (r) => r.keymap?.checkUnsavedChanges,
  );

  useSub("rpc_notification.keymap.unsavedChangesStatusChanged", (next) =>
    setUnsavedState(next),
  );

  const setUnsaved = useCallback(
    (next: boolean) => setUnsavedState(next),
    [setUnsavedState],
  );

  return { unsaved: unsaved ?? false, setUnsaved };
}
