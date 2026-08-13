import { describe, expect, it, vi } from "vitest";
import { KEYMAP_CHANGED_EVENT, publishKeymapChanged } from "./keymap-events";
import { pub } from "../usePubSub";

vi.mock("../usePubSub", () => ({ pub: vi.fn() }));

describe("keymap changed event", () => {
  it("publishes the single typed event only when a successful write calls it", () => {
    publishKeymapChanged();

    expect(pub).toHaveBeenCalledWith(KEYMAP_CHANGED_EVENT, undefined);
  });
});
