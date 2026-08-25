import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMonitorStore } from "./monitor/monitorStore";
import App from "./App";

const mocks = vi.hoisted(() => ({
  createRpcConnection: vi.fn(),
  requestDeviceInfo: vi.fn(),
  callRpc: vi.fn(),
  toast: vi.fn(),
  trackEvent: vi.fn(),
  closeRequest: vi.fn(),
  rightUsb: undefined as unknown,
  renders: { appRoot: 0, appInner: 0, appHeader: 0, studioTabView: 0, activeEditor: 0 },
}));

vi.mock("@zmkfirmware/zmk-studio-ts-client", () => ({
  create_rpc_connection: mocks.createRpcConnection,
}));

vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: {
    ZMK_STUDIO_CORE_LOCK_STATE_LOCKED: 0,
    ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 1,
  },
}));

vi.mock("@zmkfirmware/zmk-studio-ts-client/keymap", () => ({
  SetLayerBindingResponse: { SET_LAYER_BINDING_RESP_OK: 0 },
}));

vi.mock("./rpc/deviceInfo", () => ({ requestDeviceInfo: mocks.requestDeviceInfo }));
vi.mock("./rpc/logging", () => ({ call_rpc: mocks.callRpc }));
vi.mock("./rpc/transportLifecycle", () => ({ disposeTransport: vi.fn() }));

vi.mock("./connection/useRightUsbConnection", () => ({
  useRightUsbConnection: () => {
    mocks.renders.appInner += 1;
    return mocks.rightUsb;
  },
}));

vi.mock("./ConnectModal", () => ({
  ConnectModal: ({ open, onTransportCreated }: { open?: boolean; onTransportCreated: (transport: object) => Promise<void> }) =>
    open ? <button type="button" onClick={() => { void onTransportCreated({}); }}>接続</button> : null,
}));

vi.mock("./AppHeader", () => ({
  AppHeader: ({ onFwUpdateOpenChange }: { onFwUpdateOpenChange?: (open: boolean) => void }) => {
    mocks.renders.appHeader += 1;
    return (
      <header>
        アプリヘッダー
        <button type="button" onClick={() => onFwUpdateOpenChange?.(true)}>
          ファーム更新を開く
        </button>
      </header>
    );
  },
}));

vi.mock("./keyboard/Keyboard", () => ({
  default: () => {
    mocks.renders.activeEditor += 1;
    return <main>アクティブエディター</main>;
  },
}));

vi.mock("./navigation/StudioTabView", () => ({
  StudioTabView: ({ activeTab, renderTab }: { activeTab: "keymap"; renderTab: (tab: "keymap") => ReactNode }) => {
    mocks.renders.studioTabView += 1;
    return <>{renderTab(activeTab)}</>;
  },
}));

vi.mock("./AppFooter", () => ({ AppFooter: () => <footer /> }));
vi.mock("./UnlockModal", () => ({ UnlockModal: () => null }));
vi.mock("./AboutModal", () => ({ AboutModal: () => null }));
vi.mock("./misc/LicenseNoticeModal", () => ({ LicenseNoticeModal: () => null }));
vi.mock("./telemetry/OptInDialog", () => ({ OptInDialog: () => null }));
vi.mock("./telemetry/TelemetryProvider", () => ({
  TelemetryProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTelemetry: () => ({ trackEvent: mocks.trackEvent, trackKeymap: vi.fn() }),
}));
vi.mock("./misc/Toast", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => {
    mocks.renders.appRoot += 1;
    return <>{children}</>;
  },
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("./behaviors/BehaviorsContext", () => ({
  BehaviorsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useBehaviorMap: () => ({}),
}));
vi.mock("./rpc/CustomSubsystemsProvider", () => ({
  CustomSubsystemsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./trackball/TrackballPrecisionContext", () => ({
  TrackballPrecisionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTrackballPrecision: () => ({ availability: "disconnected" }),
}));

describe("App monitor isolation", () => {
  beforeEach(() => {
    mocks.createRpcConnection.mockReset();
    mocks.requestDeviceInfo.mockReset();
    mocks.callRpc.mockReset();
    mocks.toast.mockReset();
    mocks.trackEvent.mockReset();
    mocks.closeRequest.mockReset();
    mocks.closeRequest.mockResolvedValue(undefined);
    mocks.renders.appHeader = 0;
    mocks.renders.appInner = 0;
    mocks.renders.appRoot = 0;
    mocks.renders.studioTabView = 0;
    mocks.renders.activeEditor = 0;
    const monitorStore = createMonitorStore((notify) => {
      notify();
      return () => {};
    });
    mocks.rightUsb = {
      state: { phase: "studio_rpc_ready" },
      description: { title: "接続中", body: "右手USBモニターを使用中" },
      monitorStore,
      monitorActive: false,
      connecting: false,
      connectRightUsb: vi.fn(),
      retryEditor: vi.fn(),
      closeMonitor: vi.fn(),
      notifyBleReady: vi.fn(),
      dispatch: vi.fn(),
    };
    mocks.createRpcConnection.mockResolvedValue({
      notification_readable: new ReadableStream(),
      request_writable: { close: mocks.closeRequest },
    });
    mocks.requestDeviceInfo.mockImplementation(async () => {
      (mocks.rightUsb as { monitorActive: boolean }).monitorActive = true;
      return { name: "minimal-keys" };
    });
    mocks.callRpc.mockResolvedValue({ core: { getLockState: 0 } });
  });

  it("renders the connected AppInner shell while pointer frames update only the monitor leaf", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "接続" }));

    await screen.findByText("アプリヘッダー");
    await screen.findByText("アクティブエディター");
    expect(screen.getByRole("group", { name: "キーボード表示" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "リアルタイム" }));
    expect(
      screen.getByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).toBeInTheDocument();
    const before = { ...mocks.renders };
    const rightUsb = mocks.rightUsb as { monitorStore: ReturnType<typeof createMonitorStore> };

    act(() => rightUsb.monitorStore.push({ kind: "pointer", dx: 9, dy: -2, wheel: 0, hwheel: 0, buttons: 0 }));

    await waitFor(() => expect(screen.getAllByText("dx +9 / dy -2").length).toBeGreaterThan(0));
    expect(mocks.renders.appHeader).toBe(before.appHeader);
    expect(mocks.renders.appRoot).toBe(before.appRoot);
    expect(mocks.renders.appInner).toBe(before.appInner);
    expect(mocks.renders.studioTabView).toBe(before.studioTabView);
    expect(mocks.renders.activeEditor).toBe(before.activeEditor);
  });

  it("closes the active Studio connection before opening firmware update", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    await screen.findByText("アクティブエディター");

    fireEvent.click(screen.getByRole("button", { name: "ファーム更新を開く" }));

    await waitFor(() => expect(mocks.closeRequest).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("アクティブエディター")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "接続" })).not.toBeInTheDocument();
  });
});
