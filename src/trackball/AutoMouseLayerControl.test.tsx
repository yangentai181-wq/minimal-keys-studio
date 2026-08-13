import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callRPC: vi.fn(),
  decodeResponse: vi.fn(),
  toast: vi.fn(),
  currentSubsystem: null as null | {
    subsystemIndex: number;
    callRPC: ReturnType<typeof vi.fn>;
  },
}));
let notificationHandler: ((payload: Uint8Array) => void) | undefined;
let notification = { inputProcessorChanged: null as ReturnType<typeof processor> | null };

mocks.currentSubsystem = {
  subsystemIndex: 1,
  callRPC: mocks.callRPC,
};

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomNotification: (_index: number | undefined, handler: (payload: Uint8Array) => void) => {
    notificationHandler = handler;
  },
  useCustomSubsystem: () => mocks.currentSubsystem,
}));
vi.mock("../rpc/useLayers", () => ({
  useLayers: () => [
    { id: 4, index: 4, name: "ナビゲーション" },
    { id: 6, index: 6, name: "マウス" },
  ],
}));
vi.mock("../misc/Toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../proto/rip", () => ({
  SUBSYSTEM_ID: "cormoran_rip",
  decodeNotification: () => notification,
  decodeResponse: mocks.decodeResponse,
  encodeListInputProcessors: () => "list",
  encodeGetInputProcessor: () => "get",
  encodeSetTempLayerEnabled: () => "enabled",
  encodeSetTempLayerLayer: () => "layer",
  encodeSetTempLayerActivationDelay: (_id: number, delay: number) => `activation:${delay}`,
  encodeSetTempLayerDeactivationDelay: (_id: number, delay: number) => `deactivation:${delay}`,
}));

import { AutoMouseLayerControl, AutoMouseLayerControlView } from "./AutoMouseLayerControl";

const layers = [
  { id: 4, index: 4, name: "ナビゲーション" },
  { id: 6, index: 6, name: "マウス" },
];

function processor() {
  return {
    id: 1,
    name: "Trackball",
    scaleMultiplier: 1,
    scaleDivisor: 1,
    rotationDegrees: 0,
    tempLayerEnabled: true,
    tempLayerLayer: 6,
    tempLayerActivationDelayMs: 100,
    tempLayerDeactivationDelayMs: 500,
    activeLayers: 0,
    axisSnapMode: 0,
    axisSnapThreshold: 0,
    axisSnapTimeoutMs: 0,
    xyToScrollEnabled: false,
    xySwapEnabled: false,
    xInvert: false,
    yInvert: false,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderView(overrides = {}) {
  const onEnabledChange = vi.fn();
  const onLayerChange = vi.fn();
  const onActivationDelayChange = vi.fn();
  const onDeactivationDelayChange = vi.fn();

  render(
    <AutoMouseLayerControlView
      enabled={false}
      layerId={6}
      layers={layers}
      activationDelayMs={100}
      deactivationDelayMs={500}
      onEnabledChange={onEnabledChange}
      onLayerChange={onLayerChange}
      onActivationDelayChange={onActivationDelayChange}
      onDeactivationDelayChange={onDeactivationDelayChange}
      onActivationDelayCommit={() => {}}
      onDeactivationDelayCommit={() => {}}
      {...overrides}
    />
  );

  return { onEnabledChange, onLayerChange, onActivationDelayChange, onDeactivationDelayChange };
}

async function renderConnectedControl() {
  render(<AutoMouseLayerControl />);
  await act(async () => {
    notification = { inputProcessorChanged: processor() };
    notificationHandler?.(new Uint8Array());
  });
}

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  notificationHandler = undefined;
  notification = { inputProcessorChanged: null };
  mocks.currentSubsystem = {
    subsystemIndex: 1,
    callRPC: mocks.callRPC,
  };
});

describe("AutoMouseLayerControlView", () => {
  it("スイッチ操作で変更を通知する", () => {
    const { onEnabledChange } = renderView();

    fireEvent.click(screen.getByRole("switch"));

    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("OFF のときレイヤー選択とスライダーを操作できない", () => {
    renderView();

    expect(screen.getByLabelText("切り替えるレイヤー")).toBeDisabled();
    expect(screen.getByLabelText("切り替わるまでの時間")).toBeDisabled();
    expect(screen.getByLabelText("もとに戻るまでの時間")).toBeDisabled();
  });

  it("既定の遅延値を表示する", () => {
    renderView({ enabled: true });

    expect(screen.getByText("100 ms")).toBeTruthy();
    expect(screen.getByText("500 ms")).toBeTruthy();
  });

  it("切り替わるまでを2000msまで設定できる", () => {
    renderView({ enabled: true, activationDelayMs: 2000 });

    expect(screen.getByLabelText("切り替わるまでの時間")).toHaveAttribute("max", "2000");
  });

  it("レイヤーが空でも読み込み表示を壊さない", () => {
    renderView({ layers: [] });

    expect(screen.getByText("レイヤーを読み込んでいます…")).toBeTruthy();
  });
});

describe("AutoMouseLayerControl", () => {
  it("再接続前の遅延readbackで新しい接続状態を上書きしない", async () => {
    const oldAck = deferred<Uint8Array>();
    const oldCall = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(oldAck.promise)
      .mockResolvedValueOnce(new Uint8Array());
    mocks.currentSubsystem = { subsystemIndex: 1, callRPC: oldCall };
    mocks.decodeResponse
      .mockReturnValueOnce({ responseType: "setTempLayerEnabled" })
      .mockReturnValueOnce({
        responseType: "getInputProcessor",
        getInputProcessor: { ...processor(), tempLayerEnabled: false },
      });
    const view = render(<AutoMouseLayerControl />);
    await act(async () => {
      notification = { inputProcessorChanged: processor() };
      notificationHandler?.(new Uint8Array());
    });
    fireEvent.click(screen.getByRole("switch"));

    const newCall = vi.fn().mockResolvedValue(undefined);
    mocks.currentSubsystem = { subsystemIndex: 2, callRPC: newCall };
    view.rerender(<AutoMouseLayerControl />);
    await act(async () => {
      notification = {
        inputProcessorChanged: { ...processor(), tempLayerLayer: 4 },
      };
      notificationHandler?.(new Uint8Array());
      oldAck.resolve(new Uint8Array());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByLabelText("切り替えるレイヤー")).toHaveValue("4");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("再接続時に保留中の遅延設定を破棄する", async () => {
    vi.useFakeTimers();
    const oldCall = vi.fn().mockResolvedValue(undefined);
    mocks.currentSubsystem = { subsystemIndex: 1, callRPC: oldCall };
    const view = render(<AutoMouseLayerControl />);
    await act(async () => {
      notification = { inputProcessorChanged: processor() };
      notificationHandler?.(new Uint8Array());
    });
    fireEvent.change(screen.getByLabelText("切り替わるまでの時間"), {
      target: { value: "300" },
    });

    mocks.currentSubsystem = {
      subsystemIndex: 2,
      callRPC: vi.fn().mockResolvedValue(undefined),
    };
    view.rerender(<AutoMouseLayerControl />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(oldCall).toHaveBeenCalledTimes(1);
  });

  it("setter応答が成立しない変更を画面に残さない", async () => {
    mocks.callRPC.mockResolvedValue(new Uint8Array());
    mocks.decodeResponse.mockReturnValue({});
    await renderConnectedControl();

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(
      "自動マウスレイヤーの設定を更新できませんでした",
      "error",
    ));
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("setter成功後に実機値を読み戻してから変更を確定する", async () => {
    mocks.callRPC.mockResolvedValue(new Uint8Array());
    mocks.decodeResponse
      .mockReturnValueOnce({ responseType: "setTempLayerEnabled" })
      .mockReturnValueOnce({
        responseType: "getInputProcessor",
        getInputProcessor: { ...processor(), tempLayerEnabled: false },
      });
    await renderConnectedControl();

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(mocks.callRPC).toHaveBeenLastCalledWith("get", 5000));
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("スライダー操作の直後には遅延設定を送信しない", async () => {
    vi.useFakeTimers();
    await renderConnectedControl();

    fireEvent.change(screen.getByLabelText("切り替わるまでの時間"), { target: { value: "200" } });

    expect(mocks.callRPC).toHaveBeenCalledTimes(1);
    expect(screen.getByText("200 ms")).toBeTruthy();
  });

  it("スライダー停止から300ms後に遅延設定を一度だけ送信する", async () => {
    vi.useFakeTimers();
    mocks.callRPC.mockResolvedValue(new Uint8Array());
    mocks.decodeResponse
      .mockReturnValueOnce({ responseType: "setTempLayerActivationDelay" })
      .mockReturnValueOnce({
        responseType: "getInputProcessor",
        getInputProcessor: { ...processor(), tempLayerActivationDelayMs: 300 },
      });
    await renderConnectedControl();

    fireEvent.change(screen.getByLabelText("切り替わるまでの時間"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("切り替わるまでの時間"), { target: { value: "300" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(mocks.callRPC).toHaveBeenCalledTimes(3);
    expect(mocks.callRPC).toHaveBeenLastCalledWith("get", 5000);
  });
});
