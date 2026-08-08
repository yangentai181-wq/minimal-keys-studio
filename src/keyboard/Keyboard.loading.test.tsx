import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Keyboard from "./Keyboard";
import { MonitorKeymapProvider } from "./MonitorKeymapContext";

const rpc = vi.hoisted(() => ({
  call: vi.fn(),
  keymap: {
    layers: [] as Array<{ id: number; name: string; bindings: unknown[] }>,
    availableLayers: 0,
  },
}));

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
  useConnectedDeviceData: () => [rpc.keymap, vi.fn()],
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
  Keymap: ({ layout, selectedLayerIndex }: { layout: unknown; selectedLayerIndex: number }) => (
    <div>
      キーマップ本体: {layout ? "表示可能" : "不正"}
      <output data-testid="selected-layer-index">{selectedLayerIndex}</output>
    </div>
  ),
}));
vi.mock("./PhysicalLayoutPicker", () => ({ PhysicalLayoutPicker: () => <div>レイアウト</div> }));
vi.mock("./LayerPicker", () => ({
  LayerPicker: ({
    onLayerClicked,
    selectionLocked,
  }: {
    onLayerClicked?: (index: number) => void;
    selectionLocked?: boolean;
  }) => (
    <div>
      <span>レイヤー</span>
      <button type="button" onClick={() => onLayerClicked?.(2)}>
        Layer 2
      </button>
      <output data-testid="layer-selection-locked">
        {selectionLocked ? "locked" : "editable"}
      </output>
    </div>
  ),
}));
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

function renderKeyboard() {
  return render(
    <MonitorKeymapProvider>
      <Keyboard />
    </MonitorKeymapProvider>,
  );
}

describe("Keyboard loading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rpc.call.mockReset();
    rpc.keymap.layers = [];
  });

  afterEach(() => vi.useRealTimers());

  it("shows the keyboard immediately when required data resolves within 100ms", async () => {
    const request = deferred<ReturnType<typeof layoutResponse>>();
    rpc.call.mockReturnValue(request.promise);
    renderKeyboard();

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
    renderKeyboard();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
      await Promise.resolve();
    });

    expect(screen.getByText("キーマップを読み込んでいます...")).toBeInTheDocument();
    expect(screen.queryByText(/キーマップ本体/)).not.toBeInTheDocument();
  });

  it("keeps loading when the device returns no usable physical layout", async () => {
    rpc.call.mockResolvedValue(layoutResponse([]));
    renderKeyboard();

    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("キーマップを読み込んでいます...")).toBeInTheDocument();
    expect(screen.queryByText(/キーマップ本体/)).not.toBeInTheDocument();
  });

  it("keeps loading when the active physical-layout index does not exist", async () => {
    rpc.call.mockResolvedValue(layoutResponse([{ keys: [] }], 1));
    renderKeyboard();

    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("キーマップを読み込んでいます...")).toBeInTheDocument();
    expect(screen.queryByText(/キーマップ本体/)).not.toBeInTheDocument();
  });

  it("allows selecting a nonzero layer for editing", async () => {
    rpc.keymap.layers = Array.from({ length: 3 }, (_, index) => ({
      id: index,
      name: `Layer ${index}`,
      bindings: [],
    }));
    rpc.call.mockResolvedValue(layoutResponse([{ keys: [] }]));
    renderKeyboard();

    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId("layer-selection-locked")).toHaveTextContent("editable");
    fireEvent.click(screen.getByRole("button", { name: "Layer 2" }));
    expect(screen.getByTestId("selected-layer-index")).toHaveTextContent("2");
  });
});
