import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: {
    ZMK_STUDIO_CORE_LOCK_STATE_LOCKED: 0,
    ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 1,
  },
}));
vi.mock("./logging", () => ({
  call_rpc: vi.fn(),
}));

import { call_rpc } from "./logging";
import { ConnectionContext } from "./ConnectionContext";
import { LockStateContext } from "./LockStateContext";
import { useUnsavedChanges } from "./useUnsavedChanges";
import { pub } from "../usePubSub";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionContext.Provider value={{ conn: {} as never }}>
      <LockStateContext.Provider value={1 as never}>
        {children}
      </LockStateContext.Provider>
    </ConnectionContext.Provider>
  );
}

describe("useUnsavedChanges", () => {
  beforeEach(() => {
    vi.mocked(call_rpc).mockReset();
  });

  it("reports what the keyboard says on connect, not the local edit history", async () => {
    vi.mocked(call_rpc).mockResolvedValue({
      keymap: { checkUnsavedChanges: true },
    } as never);

    const { result } = renderHook(() => useUnsavedChanges(), { wrapper });

    await waitFor(() => expect(result.current.unsaved).toBe(true));
    expect(vi.mocked(call_rpc).mock.calls[0][1]).toEqual({
      keymap: { checkUnsavedChanges: true },
    });
  });

  it("follows the keyboard's unsaved notifications", async () => {
    vi.mocked(call_rpc).mockResolvedValue({
      keymap: { checkUnsavedChanges: false },
    } as never);

    const { result } = renderHook(() => useUnsavedChanges(), { wrapper });
    await waitFor(() => expect(result.current.unsaved).toBe(false));

    act(() => {
      pub("rpc_notification.keymap.unsavedChangesStatusChanged", true);
    });
    await waitFor(() => expect(result.current.unsaved).toBe(true));

    act(() => {
      pub("rpc_notification.keymap.unsavedChangesStatusChanged", false);
    });
    await waitFor(() => expect(result.current.unsaved).toBe(false));
  });
});
