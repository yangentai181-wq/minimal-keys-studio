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
const keymapIO = vi.hoisted(() => ({
  openFilePicker: vi.fn(),
  deserializeKeymap: vi.fn(),
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
vi.mock("./keymap-io", () => ({
  downloadJson: vi.fn(),
  openFilePicker: keymapIO.openFilePicker,
  serializeKeymap: vi.fn(),
  deserializeKeymap: keymapIO.deserializeKeymap,
}));
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
  return { UndoRedoContext: createContext((operation: () => Promise<unknown>) => { void operation(); }) };
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
    onLayerMoved,
    selectionLocked,
  }: {
    onLayerClicked?: (index: number) => void;
    onLayerMoved?: (startLayerId: number, destinationLayerId: number) => void;
    selectionLocked?: boolean;
  }) => (
    <div>
      <span>レイヤー</span>
      <button type="button" onClick={() => onLayerClicked?.(2)}>
        Layer 2
      </button>
      <button type="button" onClick={() => onLayerMoved?.(4, 7)}>
        Move Auto Mouse to Scroll
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
    keymapIO.openFilePicker.mockReset();
    keymapIO.deserializeKeymap.mockReset();
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

  it("keeps fixed runtime layers selectable without exposing layer reordering", async () => {
    rpc.keymap.layers = [
      { id: 7, name: "Scroll", bindings: [] },
      { id: 0, name: "Base", bindings: [] },
      { id: 4, name: "Auto Mouse", bindings: [] },
    ];
    rpc.call.mockImplementation((_connection, request) => {
      if ("keymap" in request && "getPhysicalLayouts" in request.keymap) {
        return Promise.resolve(layoutResponse([{ keys: [] }]));
      }
      if ("keymap" in request && "setActivePhysicalLayout" in request.keymap) {
        return Promise.resolve({
          keymap: {
            setActivePhysicalLayout: {
              ok: { ...rpc.keymap, maxLayerNameLength: 16 },
            },
          },
        });
      }
      return Promise.resolve({});
    });
    renderKeyboard();

    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Move Auto Mouse to Scroll" }));

    await act(async () => { await Promise.resolve(); });
    expect(rpc.call.mock.calls.some(([, request]) => (
      "keymap" in request && "moveLayer" in request.keymap
    ))).toBe(false);
  });

  it("never opens the internal Precision layer when firmware returns it first", async () => {
    rpc.keymap.layers = [
      { id: 8, name: "Precision", bindings: [] },
      { id: 0, name: "Base", bindings: [] },
      { id: 4, name: "Auto Mouse", bindings: [] },
    ];
    rpc.call.mockResolvedValue(layoutResponse([{ keys: [] }]));

    renderKeyboard();
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId("selected-layer-index")).toHaveTextContent("1");
  });

  it("imports user layers into reordered non-Precision runtime layers", async () => {
    rpc.keymap.layers = [
      { id: 0, name: "Base", bindings: [] },
      { id: 8, name: "Precision", bindings: [] },
      { id: 4, name: "Auto Mouse", bindings: [] },
      { id: 7, name: "Scroll", bindings: [] },
    ];
    rpc.call.mockResolvedValue(layoutResponse([{ keys: [{}] }]));
    keymapIO.openFilePicker.mockResolvedValue("{} ");
    keymapIO.deserializeKeymap.mockReturnValue({
      ok: true,
      layers: [
        { name: "Base", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] },
        { name: "Auto Mouse", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] },
        { name: "Scroll", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] },
      ],
    });
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderKeyboard();

    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "読込" }));
    await act(async () => { await Promise.resolve(); });

    const writes = rpc.call.mock.calls
      .map(([, request]) => request)
      .filter((request) => "keymap" in request && "setLayerBinding" in request.keymap)
      .map((request) => request.keymap.setLayerBinding.layerId);
    expect(writes).toEqual([0, 4, 7]);
    expect(writes).not.toContain(8);
  });
});
