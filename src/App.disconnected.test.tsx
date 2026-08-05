import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import App from "./App";

const mocks = vi.hoisted(() => ({
  createRpcConnection: vi.fn(),
  requestDeviceInfo: vi.fn(),
}));

vi.mock("@zmkfirmware/zmk-studio-ts-client", () => ({
  create_rpc_connection: mocks.createRpcConnection,
}));

vi.mock("./rpc/deviceInfo", () => ({
  requestDeviceInfo: mocks.requestDeviceInfo,
}));

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

vi.mock("./AppHeader", () => ({
  AppHeader: () => <header>APP_HEADER</header>,
}));

vi.mock("./AppFooter", () => ({
  AppFooter: () => <footer>APP_FOOTER</footer>,
}));

vi.mock("./ConnectModal", () => ({
  ConnectModal: ({
    open,
    onTransportCreated,
  }: {
    open?: boolean;
    onTransportCreated: (transport: object) => Promise<void>;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          void onTransportCreated({}).catch(() => {});
        }}
      >
        CONNECT_MODAL_OPEN
      </button>
    ) : null,
}));

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
  });

  it("shows the connection modal without mounting the keymap editor behind it", () => {
    render(<App />);

    expect(screen.getByText("CONNECT_MODAL_OPEN")).toBeInTheDocument();
    expect(screen.queryByText("APP_HEADER")).not.toBeInTheDocument();
    expect(screen.queryByText("APP_FOOTER")).not.toBeInTheDocument();
    expect(screen.queryByText("KEYBOARD_MOUNTED")).not.toBeInTheDocument();
  });

  it("normalizes device-info failures before the App connection flow reaches a toast", async () => {
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
    ).toBeInTheDocument();
    expect(screen.queryByText(/RPC Failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Raw HID/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0xff60/)).not.toBeInTheDocument();
  });
});
