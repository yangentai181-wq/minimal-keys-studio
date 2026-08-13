import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { LockStateContext } from "../rpc/LockStateContext";
import { pub } from "../usePubSub";
import { KEYMAP_CHANGED_EVENT } from "../keyboard/keymap-events";
import { useConnectedPrecisionSelection } from "./useConnectedPrecisionSelection";

const callRpc = vi.fn();
afterEach(() => {
  cleanup();
  callRpc.mockReset();
});
vi.mock("../rpc/logging", () => ({ call_rpc: (...args: unknown[]) => callRpc(...args) }));
vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({ LockState: { ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 0 } }));
vi.mock("../behaviors/BehaviorsContext", () => ({ useBehaviorList: () => [{ id: 1, displayName: "Key Press", metadata: [] }, { id: 2, displayName: "Transparent", metadata: [] }] }));
vi.mock("./TrackballPrecisionContext", () => ({ useTrackballPrecision: () => ({ confirmed: null, draft: { normalCpi: 800, precisionCpi: 200, enabled: true, selectedPosition: 0 } }) }));

const supported = { keymap: { getKeymap: { layers: [{ id: 0, name: "Base", bindings: [{ behaviorId: 1, param1: (7 << 16) + 4, param2: 0 }] }], availableLayers: 9, maxLayerNameLength: 16 } } };
const unsupported = { keymap: { getKeymap: { layers: [{ id: 0, name: "Base", bindings: [{ behaviorId: 2, param1: 0, param2: 0 }] }], availableLayers: 9, maxLayerNameLength: 16 } } };

function Consumer() {
  const { analysis } = useConnectedPrecisionSelection();
  return <output>{analysis?.supported ? "supported" : analysis?.reason ?? "loading"}</output>;
}

function renderConsumer() {
  return render(<ConnectionContext.Provider value={{ conn: {} as never }}><LockStateContext.Provider value={0}><Consumer /></LockStateContext.Provider></ConnectionContext.Provider>);
}

describe("useConnectedPrecisionSelection", () => {
  it("refetches on a successful keymap-change event and immediately gates an unsupported current binding", async () => {
    callRpc.mockResolvedValueOnce(supported).mockResolvedValueOnce(unsupported);
    renderConsumer();
    await waitFor(() => expect(screen.getByText("supported")).toBeInTheDocument());

    await act(async () => { await pub(KEYMAP_CHANGED_EVENT, undefined); });

    await waitFor(() => expect(screen.getByText("透明キーは選択できません")).toBeInTheDocument());
    expect(callRpc).toHaveBeenCalledTimes(2);
  });

  it("discards an older refetch response after a newer keymap response arrives", async () => {
    let resolveFirst: (value: typeof supported) => void;
    let resolveSecond: (value: typeof unsupported) => void;
    callRpc.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    renderConsumer();
    await act(async () => { await pub(KEYMAP_CHANGED_EVENT, undefined); });
    await act(async () => resolveSecond!(unsupported));
    await waitFor(() => expect(screen.getByText("透明キーは選択できません")).toBeInTheDocument());
    await act(async () => resolveFirst!(supported));

    expect(screen.getByText("透明キーは選択できません")).toBeInTheDocument();
  });

  it("invalidates synchronously after an event until its latest refetch resolves", async () => {
    let resolveRefresh: (value: typeof unsupported) => void;
    callRpc.mockResolvedValueOnce(supported).mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    renderConsumer();
    await waitFor(() => expect(screen.getByText("supported")).toBeInTheDocument());

    await act(async () => { await pub(KEYMAP_CHANGED_EVENT, undefined); });

    expect(screen.getByText("loading")).toBeInTheDocument();
    await act(async () => resolveRefresh!(unsupported));
    await waitFor(() => expect(screen.getByText("透明キーは選択できません")).toBeInTheDocument());
  });

  it("does not restore a pending keymap after disconnect", async () => {
    let resolveOld: (value: typeof supported) => void;
    callRpc.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = renderConsumer();
    view.rerender(<ConnectionContext.Provider value={{ conn: null }}><LockStateContext.Provider value={0}><Consumer /></LockStateContext.Provider></ConnectionContext.Provider>);

    await act(async () => resolveOld!(supported));

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("keeps the newest confirmed analysis when an older request rejects afterwards", async () => {
    let rejectOld: (error: Error) => void;
    let resolveLatest: (value: typeof unsupported) => void;
    callRpc.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLatest = resolve; }));
    renderConsumer();
    await act(async () => { await pub(KEYMAP_CHANGED_EVENT, undefined); });
    await act(async () => resolveLatest!(unsupported));
    await waitFor(() => expect(screen.getByText("透明キーは選択できません")).toBeInTheDocument());

    await act(async () => rejectOld!(new Error("old request failed")));

    expect(screen.getByText("透明キーは選択できません")).toBeInTheDocument();
  });

  it("accepts only the final generation after rapid events complete in arbitrary order", async () => {
    let resolveSecond: (value: typeof supported) => void;
    let rejectThird: (error: Error) => void;
    let resolveFinal: (value: typeof unsupported) => void;
    callRpc.mockResolvedValueOnce(supported)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectThird = reject; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFinal = resolve; }));
    renderConsumer();
    await waitFor(() => expect(screen.getByText("supported")).toBeInTheDocument());
    await act(async () => { await pub(KEYMAP_CHANGED_EVENT, undefined); });
    await waitFor(() => expect(callRpc).toHaveBeenCalledTimes(2));
    await act(async () => { await pub(KEYMAP_CHANGED_EVENT, undefined); });
    await waitFor(() => expect(callRpc).toHaveBeenCalledTimes(3));
    await act(async () => { await pub(KEYMAP_CHANGED_EVENT, undefined); });
    await waitFor(() => expect(callRpc).toHaveBeenCalledTimes(4));
    await act(async () => resolveSecond!(supported));
    await act(async () => rejectThird!(new Error("superseded")));
    await act(async () => resolveFinal!(unsupported));

    await waitFor(() => expect(screen.getByText("透明キーは選択できません")).toBeInTheDocument());
  });
});
