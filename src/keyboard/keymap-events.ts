import { pub } from "../usePubSub";

export const KEYMAP_CHANGED_EVENT = "minimal-keys:keymap-changed" as const;

export function publishKeymapChanged(source?: string): void {
  void pub(KEYMAP_CHANGED_EVENT, source);
}
