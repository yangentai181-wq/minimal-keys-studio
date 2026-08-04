import { pub } from "../usePubSub";

export const KEYMAP_CHANGED_EVENT = "minimal-keys:keymap-changed" as const;

export function publishKeymapChanged(): void {
  void pub(KEYMAP_CHANGED_EVENT, undefined);
}
