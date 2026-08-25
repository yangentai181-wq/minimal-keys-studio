import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import App, { discardKeymapChanges, saveKeymapChanges } from "./App";

const mocks = vi.hoisted(() => ({
  createRpcConnection: vi.fn(),
  requestDeviceInfo: vi.fn(),
  callRpc: vi.fn(),
  publishKeymapChanged: vi.fn(),
}));

vi.mock("@zmkfirmware/zmk-studio-ts-client", () => ({
  create_rpc_connection: mocks.createRpcConnection,
}));

vi.mock("./rpc/deviceInfo", () => ({
  requestDeviceInfo: mocks.requestDeviceInfo,
}));
vi.mock("./rpc/logging", () => ({ call_rpc: mocks.callRpc }));
vi.mock("./keyboard/keymap-events", () => ({ publishKeymapChanged: mocks.publishKeymapChanged }));

vi.mock("./rpc/transportLifecycle", () => ({
  disposeTransport: vi.fn(),
}));

vi.mock("./transport/serial", () => ({
  connect: vi.fn(),
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

vi.mock("./AppHeader", () => ({
  AppHeader: () => <header>APP_HEADER</header>,
}));

vi.mock("./AppFooter", () => ({
  AppFooter: () => <footer>APP_FOOTER</footer>,
}));

vi.mock("./ConnectModal", async () => {
  const { useState } = await import("react");
  const { normalizeConnectionError } = await import("./copy/connectionErrors");
  return {
  ConnectModal: ({
    open,
    onTransportCreated,
  }: {
    open?: boolean;
    onTransportCreated: (transport: object) => Promise<void>;
  }) => {
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    if (!open) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => {
            void onTransportCreated({}).catch((error: unknown) => {
              setErrorMessage(normalizeConnectionError(error));
            });
          }}
        >
          CONNECT_MODAL_OPEN
        </button>
        {errorMessage && <p role="alert">{errorMessage}</p>}
      </>
    );
  },
  };
});

vi.mock("./UnlockModal", () => ({
  UnlockModal: () => null,
}));

vi.mock("./AboutModal", () => ({
  AboutModal: () => null,
}));

vi.mock("./misc/LicenseNoticeModal", () => ({
  LicenseNoticeModal: () => null,
}));

vi.mock("./telemetry/TelemetryProvider", () => ({
  TelemetryProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTelemetry: () => ({
    trackEvent: vi.fn(),
    trackKeymap: vi.fn(),
  }),
}));

vi.mock("./telemetry/OptInDialog", () => ({
  OptInDialog: () => null,
}));

vi.mock("./behaviors/BehaviorsContext", () => ({
  BehaviorsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./rpc/CustomSubsystemsProvider", () => ({
  CustomSubsystemsProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("./keyboard/Keyboard", () => ({
  default: () => <div>KEYBOARD_MOUNTED</div>,
}));

describe("App disconnected shell", () => {
  beforeEach(() => {
    mocks.createRpcConnection.mockReset();
    mocks.requestDeviceInfo.mockReset();
    mocks.callRpc.mockReset();
    mocks.publishKeymapChanged.mockReset();
  });

  it("shows the connection modal without mounting the keymap editor behind it", () => {
    render(<App />);

    expect(screen.getByText("CONNECT_MODAL_OPEN")).toBeInTheDocument();
    expect(screen.queryByText("APP_HEADER")).not.toBeInTheDocument();
    expect(screen.queryByText("APP_FOOTER")).not.toBeInTheDocument();
    expect(screen.queryByText("KEYBOARD_MOUNTED")).not.toBeInTheDocument();
  });

  it("uses the modal alert as the only failure surface after an App device-info failure", async () => {
    mocks.createRpcConnection.mockResolvedValue({});
    mocks.requestDeviceInfo.mockRejectedValue(
      new Error("RPC Failed: native Raw HID device-info request 0xff60"),
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "CONNECT_MODAL_OPEN" }));

    expect(
      await screen.findByText(
        "キーボードに接続できませんでした。接続を確認して、もう一度お試しください。",
      ),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getAllByText(
        "キーボードに接続できませんでした。接続を確認して、もう一度お試しください。",
      ),
    ).toHaveLength(1);
    expect(screen.queryByText(/RPC Failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Raw HID/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0xff60/)).not.toBeInTheDocument();
  });

  it("publishes the keymap-changed event after a successful discard", async () => {
    const reset = vi.fn();
    const setKeymapVersion = vi.fn();
    const toast = vi.fn();
    const trackEvent = vi.fn();
    mocks.callRpc.mockResolvedValue({ keymap: { discardChanges: true } });

    await discardKeymapChanges({} as never, reset, setKeymapVersion, toast, trackEvent);

    expect(mocks.publishKeymapChanged).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
    expect(setKeymapVersion).toHaveBeenCalledOnce();
  });

  it("clears the undo history only after keymap changes are saved", async () => {
    const reset = vi.fn();
    const toast = vi.fn();
    const trackEvent = vi.fn();
    mocks.callRpc.mockResolvedValue({ keymap: { saveChanges: {} } });

    await saveKeymapChanges({} as never, reset, toast, trackEvent);

    expect(reset).toHaveBeenCalledOnce();
  });

  it("keeps the undo history when saving keymap changes fails", async () => {
    const reset = vi.fn();
    const toast = vi.fn();
    const trackEvent = vi.fn();
    mocks.callRpc.mockResolvedValue({ keymap: { saveChanges: { err: 1 } } });

    await expect(saveKeymapChanges({} as never, reset, toast, trackEvent)).rejects.toThrow("保存できませんでした");

    expect(reset).not.toHaveBeenCalled();
  });
});
