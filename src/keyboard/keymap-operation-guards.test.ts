import { describe, expect, it, vi } from "vitest";
import { runGuardedKeymapWrite } from "./keymap-operation-guards";

describe("runGuardedKeymapWrite", () => {
  it.each(["add", "remove", "reorder across layer 8", "rename layer 8"])("does not invoke a keymap RPC write when %s is blocked", async () => {
    const write = vi.fn().mockResolvedValue({ ok: true });

    const result = await runGuardedKeymapWrite(false, write);

    expect(result).toBeUndefined();
    expect(write).not.toHaveBeenCalled();
  });
});
