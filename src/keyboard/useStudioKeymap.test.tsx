import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { LockStateContext } from "../rpc/LockStateContext";
import { KEYMAP_CHANGED_EVENT } from "./keymap-events";
import { useStudioKeymap } from "./useStudioKeymap";
import { pub } from "../usePubSub";

const callRpc = vi.fn();

vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: {
    ZMK_STUDIO_CORE_LOCK_STATE_LOCKED: 0,
    ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 1,
  },
}));

vi.mock("../rpc/logging", () => ({
  call_rpc: (...args: unknown[]) => callRpc(...args),
}));

afterEach(() => {
  cleanup();
  callRpc.mockReset();
});

function Consumer() {
  const { layers, loading } = useStudioKeymap();
  return <output>{JSON.stringify({ layers, loading })}</output>;
}

function renderConsumer(
  conn: object | null = {},
  lockState = LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED,
) {
  return render(
    <ConnectionContext.Provider value={{ conn: conn as never }}>
      <LockStateContext.Provider value={lockState}>
        <Consumer />
      </LockStateContext.Provider>
    </ConnectionContext.Provider>,
  );
}

describe("useStudioKeymap", () => {
  it("loads and normalizes layers for an unlocked connection", async () => {
    callRpc.mockResolvedValue({
      keymap: { getKeymap: { layers: [
        { bindings: [] },
        { id: 8, name: "Fn", bindings: [] },
      ] } },
    });

    renderConsumer();

    await waitFor(() => expect(screen.getByText('{"layers":[{"id":0,"index":0,"name":"Layer 0","bindings":[]},{"id":8,"index":1,"name":"Fn","bindings":[]}],"loading":false}')).toBeInTheDocument());
    expect(callRpc).toHaveBeenCalledTimes(1);
    expect(callRpc).toHaveBeenCalledWith({}, { keymap: { getKeymap: true } });
  });

  it("uses readable minimal-keys names when firmware layer names are empty", async () => {
    callRpc.mockResolvedValue({
      keymap: {
        getKeymap: {
          layers: Array.from({ length: 8 }, (_, id) => ({
            id,
            name: "",
            bindings: [],
          })),
        },
      },
    });

    renderConsumer();

    await waitFor(() => {
      expect(screen.getByText(/Auto Mouse/)).toBeInTheDocument();
      expect(screen.getByText(/スクロール/)).toBeInTheDocument();
    });
  });

  it("clears layers when the connection locks", async () => {
    callRpc.mockResolvedValue({ keymap: { getKeymap: { layers: [{ id: 0, name: "Base", bindings: [] }] } } });
    const view = renderConsumer();
    await waitFor(() => expect(screen.getByText(/Base/)).toBeInTheDocument());

    view.rerender(
      <ConnectionContext.Provider value={{ conn: {} as never }}>
        <LockStateContext.Provider value={LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED}>
          <Consumer />
        </LockStateContext.Provider>
      </ConnectionContext.Provider>,
    );

    expect(screen.getByText('{"layers":[],"loading":false}')).toBeInTheDocument();
    expect(callRpc).toHaveBeenCalledTimes(1);
  });

  it("discards an old response after disconnect", async () => {
    let resolveRequest!: (value: object) => void;
    callRpc.mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const view = renderConsumer();

    view.rerender(
      <ConnectionContext.Provider value={{ conn: null }}>
        <LockStateContext.Provider value={LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED}>
          <Consumer />
        </LockStateContext.Provider>
      </ConnectionContext.Provider>,
    );
    await act(async () => resolveRequest({ keymap: { getKeymap: { layers: [{ id: 0, name: "Base", bindings: [] }] } } }));

    expect(screen.getByText('{"layers":[],"loading":false}')).toBeInTheDocument();
  });

  it("reloads after a keymap-changed event", async () => {
    callRpc
      .mockResolvedValueOnce({ keymap: { getKeymap: { layers: [{ id: 0, name: "Base", bindings: [] }] } } })
      .mockResolvedValueOnce({ keymap: { getKeymap: { layers: [{ id: 1, name: "Nav", bindings: [] }] } } });
    renderConsumer();
    await waitFor(() => expect(screen.getByText(/Base/)).toBeInTheDocument());

    await act(async () => { await pub(KEYMAP_CHANGED_EVENT, undefined); });

    await waitFor(() => expect(screen.getByText(/Nav/)).toBeInTheDocument());
    expect(callRpc).toHaveBeenCalledTimes(2);
  });
});
