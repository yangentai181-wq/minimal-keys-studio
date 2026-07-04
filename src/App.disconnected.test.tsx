import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import App from "./App";

vi.mock("@zmkfirmware/zmk-studio-ts-client", () => ({
  create_rpc_connection: vi.fn(),
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
  ConnectModal: ({ open }: { open?: boolean }) =>
    open ? <div>CONNECT_MODAL_OPEN</div> : null,
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
  it("shows the connection modal without mounting the keymap editor behind it", () => {
    render(<App />);

    expect(screen.getByText("CONNECT_MODAL_OPEN")).toBeInTheDocument();
    expect(screen.queryByText("APP_HEADER")).not.toBeInTheDocument();
    expect(screen.queryByText("APP_FOOTER")).not.toBeInTheDocument();
    expect(screen.queryByText("KEYBOARD_MOUNTED")).not.toBeInTheDocument();
  });
});
