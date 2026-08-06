import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Keyboard from "./Keyboard";

const rpc = vi.hoisted(() => ({ call: vi.fn() }));

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: { ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 1 },
}));

vi.mock("@zmkfirmware/zmk-studio-ts-client/keymap", () => ({
  SetLayerBindingResponse: { SET_LAYER_BINDING_RESP_OK: 1 },
  SetLayerPropsResponse: { SET_LAYER_PROPS_RESP_OK: 1 },
}));

vi.mock("../rpc/logging", () => ({ call_rpc: rpc.call }));
vi.mock("../rpc/useConnectedDeviceData", () => ({
  useConnectedDeviceData: () => [{ layers: [], availableLayers: 0 }, vi.fn()],
}));
vi.mock("../rpc/ConnectionContext", async () => {
  const { createContext } = await import("react");
  return { ConnectionContext: createContext({ conn: {} }) };
});
vi.mock("../rpc/LockStateContext", async () => {
  const { createContext } = await import("react");
  return { LockStateContext: createContext(1) };
});
vi.mock("../undoRedo", async () => {
  const { createContext } = await import("react");
  return { UndoRedoContext: createContext(undefined) };
});
vi.mock("../misc/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../OsModeContext", () => ({ useOsMode: () => ({ osMode: "mac" }) }));
vi.mock("../telemetry/TelemetryProvider", () => ({ useTelemetry: () => ({ trackKeymap: vi.fn() }) }));
vi.mock("../behaviors/BehaviorsContext", () => ({
  useBehaviorMap: () => ({}),
  useBehaviorsLoading: () => false,
}));
vi.mock("./Keymap", () => ({
  Keymap: ({ layout }: { layout: unknown }) => <div>キーマップ本体: {layout ? "表示可能" : "不正"}</div>,
}));
vi.mock("./PhysicalLayoutPicker", () => ({ PhysicalLayoutPicker: () => <div>レイアウト</div> }));
vi.mock("./LayerPicker", () => ({ LayerPicker: () => <div>レイヤー</div> }));
vi.mock("./ModifierPanel", () => ({ ModifierPanel: () => null }));
vi.mock("../behaviors/BehaviorBindingPicker", () => ({ BehaviorBindingPicker: () => null }));
vi.mock("./useEncoderBindings", () => ({ useEncoderBindings: () => undefined }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function layoutResponse(layouts: unknown[], activeLayoutIndex = 0) {
  return { keymap: { getPhysicalLayouts: { layouts, activeLayoutIndex } } };
}

describe("Keyboard loading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rpc.call.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it("shows the keyboard immediately when required data resolves within 100ms", async () => {
    const request = deferred<ReturnType<typeof layoutResponse>>();
    rpc.call.mockReturnValue(request.promise);
    render(<Keyboard />);

    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByText("キーマップを読み込んでいます...")).toBeInTheDocument();

    await act(async () => {
      request.resolve(layoutResponse([{ keys: [] }]));
      await Promise.resolve();
    });

    expect(screen.getByText("キーマップ本体: 表示可能")).toBeInTheDocument();
    expect(screen.getByTestId("binding-picker-panel")).toHaveClass(
      "min-h-0",
      "overflow-hidden",
    );
  });

  it("keeps the spinner visible while the physical-layout request remains unresolved", async () => {
    const request = deferred<ReturnType<typeof layoutResponse>>();
    rpc.call.mockReturnValue(request.promise);
    render(<Keyboard />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
      await Promise.resolve();
    });

    expect(screen.getByText("キーマップを読み込んでいます...")).toBeInTheDocument();
    expect(screen.queryByText(/キーマップ本体/)).not.toBeInTheDocument();
  });

  it("keeps loading when the device returns no usable physical layout", async () => {
    rpc.call.mockResolvedValue(layoutResponse([]));
    render(<Keyboard />);

    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("キーマップを読み込んでいます...")).toBeInTheDocument();
    expect(screen.queryByText(/キーマップ本体/)).not.toBeInTheDocument();
  });

  it("keeps loading when the active physical-layout index does not exist", async () => {
    rpc.call.mockResolvedValue(layoutResponse([{ keys: [] }], 1));
    render(<Keyboard />);

    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("キーマップを読み込んでいます...")).toBeInTheDocument();
    expect(screen.queryByText(/キーマップ本体/)).not.toBeInTheDocument();
  });
});
