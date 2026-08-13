import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { UserCancelledError } from "@zmkfirmware/zmk-studio-ts-client/transport/errors";

vi.mock("./connect/autoConnectUsb", () => ({
  AutoConnectError: class AutoConnectError extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  },
  autoConnectUsb: vi.fn(),
}));

import { autoConnectUsb } from "./connect/autoConnectUsb";
import {
  ConnectModal,
  type TransportFactory,
} from "./ConnectModal";
import { normalizeConnectionError } from "./copy/connectionErrors";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const USB_TRANSPORT_NAME =
  "USBシリアルで接続 エディターのみ（Studio RPC）。通常は右手USBで接続";
const BLE_TRANSPORT_NAME =
  "BLEで接続 補助経路。ワイヤレスで編集のみ（モニター不可）";
const RIGHT_USB_BUTTON_NAME =
  "右手USBで接続 モニターとエディターをまとめて接続（推奨）";
const CONNECTION_FAILURE_MESSAGE =
  "キーボードに接続できませんでした。接続を確認して、もう一度お試しください。";

describe("normalizeConnectionError", () => {
  it("normalizes technical failures and keeps cancellation silent", () => {
    expect(normalizeConnectionError(new Error("RPC Failed: raw HID 0xff60"))).toBe(
      CONNECTION_FAILURE_MESSAGE,
    );
    expect(
      normalizeConnectionError(
        new UserCancelledError("User cancelled", { cause: undefined }),
      ),
    ).toBeUndefined();
  });
});

describe("ConnectModal product and USB auto-connect", () => {
  const transport = {} as RpcTransport;
  const transports = [{ label: "USB", connect: vi.fn() }];

  it("presents Key Studio and states the current supported keyboard", () => {
    render(<ConnectModal open transports={[]} onTransportCreated={vi.fn()} />);

    expect(screen.getByText("Key Studio")).toBeInTheDocument();
    expect(screen.getByText("現在はminimal-keysに対応")).toBeInTheDocument();
    expect(screen.queryByText("minimal-keys カスタマイズ")).not.toBeInTheDocument();
  });

  it("passes the fresh auto-detected USB transport as a wired connection", async () => {
    vi.mocked(autoConnectUsb).mockResolvedValue({
      transport,
      deviceId: "usb-test",
      deviceLabel: "USB test",
    });
    const onTransportCreated = vi.fn().mockResolvedValue(true);
    render(
      <ConnectModal
        open
        transports={transports}
        onTransportCreated={onTransportCreated}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /USBでつなぐ/, hidden: true }),
    );

    await waitFor(() =>
      expect(onTransportCreated).toHaveBeenCalledWith(transport, false),
    );
  });

  it("returns to a retryable failure view when app initialization rejects", async () => {
    vi.mocked(autoConnectUsb).mockResolvedValue({
      transport,
      deviceId: "usb-test",
      deviceLabel: "USB test",
    });
    render(
      <ConnectModal
        open
        transports={transports}
        onTransportCreated={vi.fn().mockRejectedValue(new Error("failed"))}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /USBでつなぐ/, hidden: true }),
    );

    expect(
      await screen.findByText("接続できませんでした。もう一度お試しください"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /USBでつなぐ/, hidden: true }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "手動で選ぶ", hidden: true }),
    ).toBeEnabled();
  });
});

describe("ConnectModal detailed transport choices", () => {
  it("keeps manual connection state visible until App initialization completes", async () => {
    const transport = {} as RpcTransport;
    let resolveInitialization: (() => void) | undefined;
    const connect = vi.fn().mockResolvedValue(transport);
    const onTransportCreated = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveInitialization = resolve;
        }),
    );
    vi.mocked(autoConnectUsb).mockRejectedValue(new Error("no response"));
    render(
      <ConnectModal
        open
        transports={[{ label: "USB", connect }]}
        onTransportCreated={onTransportCreated}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /USBでつなぐ/, hidden: true }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "手動で選ぶ", hidden: true }),
    );
    const manualButton = screen.getByRole("button", {
      name: USB_TRANSPORT_NAME,
      hidden: true,
    }) as HTMLButtonElement;
    fireEvent.click(manualButton);

    await waitFor(() =>
      expect(onTransportCreated).toHaveBeenCalledWith(transport, undefined),
    );
    expect(manualButton).toBeDisabled();
    expect(manualButton).toHaveTextContent("USB 接続中...");

    resolveInitialization?.();
    await waitFor(() => expect(manualButton).toBeEnabled());
  });

  it("shows a safe inline message instead of a raw BLE failure", async () => {
    const connect = vi
      .fn()
      .mockRejectedValue(new Error("Failed to connect to any BLE profile"));
    render(
      <ConnectModal
        open
        transports={[{ label: "BLE", isWireless: true, connect }]}
        onTransportCreated={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /ワイヤレスでつなぐ/,
        hidden: true,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: BLE_TRANSPORT_NAME, hidden: true }),
    );

    expect(await screen.findByText(CONNECTION_FAILURE_MESSAGE)).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.queryByText(/Failed to connect/)).not.toBeInTheDocument();
  });

  it("shows USB before BLE inside the selected detailed method", async () => {
    vi.mocked(autoConnectUsb).mockRejectedValue(new Error("no response"));
    const transports: TransportFactory[] = [
      { label: "BLE", isWireless: true, connect: vi.fn() },
      { label: "USB", connect: vi.fn() },
    ];
    render(
      <ConnectModal open transports={transports} onTransportCreated={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /USBでつなぐ/, hidden: true }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "手動で選ぶ", hidden: true }),
    );

    expect(
      screen.getByRole("button", { name: USB_TRANSPORT_NAME, hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: BLE_TRANSPORT_NAME, hidden: true }),
    ).toBeNull();
  });
});

describe("ConnectModal right-USB main flow", () => {
  it("renders the right-USB action above demoted detailed connection methods", () => {
    render(
      <ConnectModal
        open
        transports={[
          { label: "BLE", isWireless: true, connect: vi.fn() },
          { label: "USB", connect: vi.fn() },
        ]}
        onTransportCreated={vi.fn()}
        onConnectRightUsb={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: RIGHT_USB_BUTTON_NAME,
        hidden: true,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("詳細な接続方法（BLE / USBシリアルのみ）"),
    ).toBeInTheDocument();
  });

  it("keeps the primary button busy until the right-USB flow settles", async () => {
    let resolveFlow: (() => void) | undefined;
    const onConnectRightUsb = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFlow = resolve;
        }),
    );
    render(
      <ConnectModal
        open
        transports={[]}
        onTransportCreated={vi.fn()}
        onConnectRightUsb={onConnectRightUsb}
      />,
    );

    const button = screen.getByRole("button", {
      name: RIGHT_USB_BUTTON_NAME,
      hidden: true,
    }) as HTMLButtonElement;
    fireEvent.click(button);

    expect(onConnectRightUsb).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("右手USB 接続中...");

    resolveFlow?.();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("shows the coordinator notice describing the established contract", () => {
    render(
      <ConnectModal
        open
        transports={[]}
        onTransportCreated={vi.fn()}
        onConnectRightUsb={vi.fn()}
        connectionNotice={{
          title: "モニターのみ利用可（Studio RPC応答なし）",
          body: "USBシリアルは開けましたが、Studio RPCが応答しません。",
        }}
      />,
    );

    expect(
      screen.getByText("モニターのみ利用可（Studio RPC応答なし）"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("USBシリアルは開けましたが、Studio RPCが応答しません。"),
    ).toBeInTheDocument();
  });
});
