import type { BehaviorBinding, Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { LockStateContext } from "../rpc/LockStateContext";
import { publishKeymapChanged } from "../keyboard/keymap-events";
import { UndoRedoContext } from "../undoRedo";
import type { DoCallback } from "../undoRedo";
import { useUndoRedo } from "../undoRedo";
import { useConnectedGestureKeymap } from "./useConnectedGestureKeymap";

const callRpc = vi.fn();
const { LockState, SetLayerBindingResponse } = vi.hoisted(() => ({
  LockState: { ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 0 },
  SetLayerBindingResponse: { SET_LAYER_BINDING_RESP_OK: 1 },
}));
const behaviors = [{ id: 1, displayName: "Key Press", metadata: [] }];
const oldBinding: BehaviorBinding = { behaviorId: 1, param1: 0, param2: 0 };
const nextBinding: BehaviorBinding = { behaviorId: 2, param1: 3, param2: 4 };

vi.mock("../rpc/logging", () => ({ call_rpc: (...args: unknown[]) => callRpc(...args) }));
vi.mock("../behaviors/BehaviorsContext", () => ({ useBehaviorList: () => behaviors }));
vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({ LockState }));
vi.mock("@zmkfirmware/zmk-studio-ts-client/keymap", () => ({ SetLayerBindingResponse }));

afterEach(() => {
  cleanup();
  callRpc.mockReset();
});

function keymapWithLayers(count: number): Keymap {
  return {
    layers: Array.from({ length: count }, (_, id) => ({
      id: id + 100,
      name: `Layer ${id}`,
      bindings: Array.from({ length: 43 }, () => oldBinding),
    })),
    availableLayers: count,
    maxLayerNameLength: 16,
  };
}

function renderConnectedHook({
  conn = {} as never,
  doIt = vi.fn(async (operation: () => Promise<() => Promise<void>>) => { await operation(); }),
}: {
  conn?: never | null;
  doIt?: ReturnType<typeof vi.fn>;
} = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConnectionContext.Provider value={{ conn }}>
      <LockStateContext.Provider value={LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED}>
        <UndoRedoContext.Provider value={doIt as (dc: DoCallback) => Promise<boolean>}>{children}</UndoRedoContext.Provider>
      </LockStateContext.Provider>
    </ConnectionContext.Provider>
  );
  return { ...renderHook(() => useConnectedGestureKeymap(), { wrapper }), doIt };
}

function renderWithUndoRedo() {
  let undoRedo: ReturnType<typeof useUndoRedo> | undefined;
  const conn = {} as never;
  function UndoRedoWrapper({ children }: { children: ReactNode }) {
    undoRedo = useUndoRedo();
    return (
      <ConnectionContext.Provider value={{ conn }}>
        <LockStateContext.Provider value={LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED}>
          <UndoRedoContext.Provider value={undoRedo[0]}>{children}</UndoRedoContext.Provider>
        </LockStateContext.Provider>
      </ConnectionContext.Provider>
    );
  }
  return { ...renderHook(() => useConnectedGestureKeymap(), { wrapper: UndoRedoWrapper }), getUndoRedo: () => undoRedo! };
}

describe("useConnectedGestureKeymap", () => {
  it("writes the reserved gesture slot through undo/redo and restores its original binding on undo", async () => {
    const gestureLayer = keymapWithLayers(10).layers[9];
    const keymap = keymapWithLayers(10);
    let deviceKeymap = keymap;
    let undo: (() => Promise<void>) | undefined;
    const doIt = vi.fn(async (operation: () => Promise<() => Promise<void>>) => {
      undo = await operation();
    });
    callRpc.mockImplementation(async (_connection, request) => {
      if (request.keymap?.getKeymap) return { keymap: { getKeymap: deviceKeymap } };
      const change = request.keymap?.setLayerBinding;
      if (change) {
        deviceKeymap = {
          ...deviceKeymap,
          layers: deviceKeymap.layers.map((layer) => layer.id === change.layerId
            ? { ...layer, bindings: layer.bindings.map((current, position) => position === change.keyPosition ? change.binding : current) }
            : layer),
        };
      }
      return { keymap: { setLayerBinding: SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK } };
    });
    const { result } = renderConnectedHook({ doIt });

    await waitFor(() => expect(result.current.availability).toBe("available"));
    await act(async () => { await result.current.updateBinding("up", nextBinding); });

    expect(callRpc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      keymap: { setLayerBinding: { layerId: gestureLayer.id, keyPosition: 7, binding: nextBinding } },
    }));
    expect(doIt).toHaveBeenCalledOnce();
    expect(result.current.keymap?.layers[9].bindings[7]).toEqual(nextBinding);

    await act(async () => { await undo?.(); });

    expect(callRpc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      keymap: { setLayerBinding: { layerId: gestureLayer.id, keyPosition: 7, binding: oldBinding } },
    }));
    expect(result.current.keymap?.layers[9].bindings[7]).toEqual(oldBinding);
  });

  it("requires firmware with the reserved gesture layer", async () => {
    callRpc.mockResolvedValue({ keymap: { getKeymap: keymapWithLayers(9) } });
    const { result } = renderConnectedHook();

    await waitFor(() => expect(result.current.availability).toBe("firmware-update-required"));
  });

  it("requires every reserved gesture binding before making the layer available or writing", async () => {
    const keymap = keymapWithLayers(10);
    keymap.layers[9].bindings = keymap.layers[9].bindings.slice(0, 21);
    callRpc.mockResolvedValue({ keymap: { getKeymap: keymap } });
    const { result } = renderConnectedHook();

    await waitFor(() => expect(result.current.availability).toBe("firmware-update-required"));
    await act(async () => { await result.current.updateBinding("up", nextBinding); });

    expect(callRpc).toHaveBeenCalledTimes(1);
  });

  it("reports a disconnected device without requesting the keymap", () => {
    const { result } = renderConnectedHook({ conn: null });

    expect(result.current.availability).toBe("disconnected");
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("reports a keymap request failure", async () => {
    callRpc.mockRejectedValueOnce(new Error("request failed"));
    const { result } = renderConnectedHook();

    await waitFor(() => expect(result.current.availability).toBe("error"));
    expect(result.current.error).toBe("request failed");
  });

  it("keeps the local binding unchanged and reports an error when the firmware rejects a write", async () => {
    const keymap = keymapWithLayers(10);
    callRpc.mockResolvedValueOnce({ keymap: { getKeymap: keymap } })
      .mockResolvedValueOnce({ keymap: { setLayerBinding: 0 } });
    const { result } = renderConnectedHook();

    await waitFor(() => expect(result.current.availability).toBe("available"));
    await act(async () => { await result.current.updateBinding("up", nextBinding); });

    await waitFor(() => expect(result.current.availability).toBe("error"));
    expect(result.current.keymap?.layers[9].bindings[7]).toEqual(oldBinding);
  });

  it("unlocks, preserves undo state, and reports an error when the write RPC rejects", async () => {
    const keymap = keymapWithLayers(10);
    callRpc.mockResolvedValueOnce({ keymap: { getKeymap: keymap } })
      .mockRejectedValueOnce(new Error("write failed"));
    const { result, getUndoRedo } = renderWithUndoRedo();

    await waitFor(() => expect(result.current.availability).toBe("available"));
    await act(async () => { await result.current.updateBinding("up", nextBinding); });

    expect(result.current.availability).toBe("error");
    expect(result.current.error).toBe("write failed");
    expect(result.current.keymap?.layers[9].bindings[7]).toEqual(oldBinding);
    expect(getUndoRedo()[3]).toBe(false);
    expect(getUndoRedo()[4]).toBe(false);
  });

  it("does not add an undo entry when the firmware rejects the write response", async () => {
    const keymap = keymapWithLayers(10);
    callRpc.mockResolvedValueOnce({ keymap: { getKeymap: keymap } })
      .mockResolvedValueOnce({ keymap: { setLayerBinding: 0 } });
    const { result, getUndoRedo } = renderWithUndoRedo();

    await waitFor(() => expect(result.current.availability).toBe("available"));
    await act(async () => { await result.current.updateBinding("up", nextBinding); });

    expect(result.current.availability).toBe("error");
    expect(result.current.keymap?.layers[9].bindings[7]).toEqual(oldBinding);
    expect(getUndoRedo()[3]).toBe(false);
    expect(getUndoRedo()[4]).toBe(false);
  });

  it("keeps the gesture binding and undo entry when firmware rejects the undo write", async () => {
    const keymap = keymapWithLayers(10);
    let deviceKeymap = keymap;
    callRpc.mockImplementation(async (_connection, request) => {
      if (request.keymap?.getKeymap) return { keymap: { getKeymap: deviceKeymap } };
      const change = request.keymap?.setLayerBinding;
      if (change?.binding === oldBinding) return { keymap: { setLayerBinding: 0 } };
      if (change) {
        deviceKeymap = {
          ...deviceKeymap,
          layers: deviceKeymap.layers.map((layer) => layer.id === change.layerId
            ? { ...layer, bindings: layer.bindings.map((current, position) => position === change.keyPosition ? change.binding : current) }
            : layer),
        };
      }
      return { keymap: { setLayerBinding: SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK } };
    });
    const { result, getUndoRedo } = renderWithUndoRedo();

    await waitFor(() => expect(result.current.availability).toBe("available"));
    await act(async () => { await result.current.updateBinding("up", nextBinding); });
    await act(async () => { await getUndoRedo()[1](); });

    await waitFor(() => expect(result.current.availability).toBe("error"));
    expect(result.current.keymap?.layers[9].bindings[7]).toEqual(nextBinding);
    expect(getUndoRedo()[3]).toBe(true);
    expect(getUndoRedo()[4]).toBe(false);
  });

  it("reloads availability and bindings when the existing keymap-change publisher fires", async () => {
    const initial = keymapWithLayers(10);
    const afterDiscard = keymapWithLayers(10);
    afterDiscard.layers[9].bindings[7] = nextBinding;
    callRpc.mockResolvedValueOnce({ keymap: { getKeymap: initial } })
      .mockResolvedValueOnce({ keymap: { getKeymap: afterDiscard } });
    const { result } = renderConnectedHook();

    await waitFor(() => expect(result.current.keymap?.layers[9].bindings[7]).toEqual(oldBinding));
    await act(async () => { publishKeymapChanged(); });

    await waitFor(() => expect(result.current.availability).toBe("available"));
    await waitFor(() => expect(result.current.keymap?.layers[9].bindings[7]).toEqual(nextBinding));
  });
});
