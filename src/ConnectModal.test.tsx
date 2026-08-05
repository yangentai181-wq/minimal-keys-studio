import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ConnectModal,
  type TransportFactory,
} from "./ConnectModal";
import { normalizeConnectionError } from "./copy/connectionErrors";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { UserCancelledError } from "@zmkfirmware/zmk-studio-ts-client/transport/errors";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
  };
});

const USB_BUTTON_NAME =
  "USBシリアルで接続 エディターのみ（Studio RPC）。通常は右手USBで接続";
const BLE_BUTTON_NAME =
  "BLEで接続 補助経路。ワイヤレスで編集のみ（モニター不可）";
const RIGHT_USB_BUTTON_NAME =
  "右手USBで接続 モニターとエディターをまとめて接続（推奨）";
const CONNECTION_FAILURE_MESSAGE =
  "キーボードに接続できませんでした。接続を確認して、もう一度お試しください。";

describe("normalizeConnectionError", () => {
  it("normalizes technical connection failures without exposing their text", () => {
    expect(normalizeConnectionError(new Error("RPC Failed: raw HID 0xff60"))).toBe(
      CONNECTION_FAILURE_MESSAGE,
    );
    expect(normalizeConnectionError("Failed to open serial port")).toBe(
      CONNECTION_FAILURE_MESSAGE,
    );
  });

  it("keeps user cancellation silent", () => {
    expect(
      normalizeConnectionError(
        new UserCancelledError("User cancelled", { cause: undefined }),
      ),
    ).toBeUndefined();
  });
});

describe("ConnectModal browser transports", () => {
  it("starts a simple transport from the button click and shows connection state", async () => {
    const transport = {} as RpcTransport;
    let resolveConnect: ((transport: RpcTransport) => void) | undefined;
    const connect = vi.fn(
      () =>
        new Promise<RpcTransport>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const onTransportCreated = vi.fn();
    const transports: TransportFactory[] = [{ label: "USB", connect }];

    render(
      <ConnectModal
        open
        transports={transports}
        onTransportCreated={onTransportCreated}
      />,
    );

    const button = screen.getByRole("button", {
      name: USB_BUTTON_NAME,
    }) as HTMLButtonElement;
    fireEvent.click(button);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button).toHaveTextContent("USB 接続中...");

    resolveConnect?.(transport);

    await waitFor(() => {
      expect(onTransportCreated).toHaveBeenCalledWith(transport, undefined);
    });
  });

  it("keeps showing connection state until the app finishes initializing the transport", async () => {
    const transport = {} as RpcTransport;
    let resolveAppConnect: (() => void) | undefined;
    const connect = vi.fn().mockResolvedValue(transport);
    const onTransportCreated = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAppConnect = resolve;
        }),
    );
    const transports: TransportFactory[] = [{ label: "USB", connect }];

    render(
      <ConnectModal
        open
        transports={transports}
        onTransportCreated={onTransportCreated}
      />,
    );

    const button = screen.getByRole("button", {
      name: USB_BUTTON_NAME,
    }) as HTMLButtonElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(onTransportCreated).toHaveBeenCalledWith(transport, undefined);
    });

    expect(button.disabled).toBe(true);
    expect(button).toHaveTextContent("USB 接続中...");

    resolveAppConnect?.();

    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
  });

  it("shows an inline error when app initialization fails after transport creation", async () => {
    const transport = {} as RpcTransport;
    const connect = vi.fn().mockResolvedValue(transport);
    const onTransportCreated = vi
      .fn()
      .mockRejectedValue(new Error("デバイスへの接続に失敗しました"));
    const transports: TransportFactory[] = [{ label: "USB", connect }];

    render(
      <ConnectModal
        open
        transports={transports}
        onTransportCreated={onTransportCreated}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: USB_BUTTON_NAME,
      }),
    );

    expect(
      await screen.findByText(CONNECTION_FAILURE_MESSAGE),
    ).toBeInTheDocument();
  });

  it("does not display a raw transport or RPC error", async () => {
    const transports: TransportFactory[] = [
      {
        label: "USB",
        connect: vi.fn().mockRejectedValue(new Error("RPC Failed: vendor protocol 0xff60")),
      },
    ];

    render(
      <ConnectModal open transports={transports} onTransportCreated={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: USB_BUTTON_NAME }));

    expect(await screen.findByText(CONNECTION_FAILURE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/RPC Failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0xff60/)).not.toBeInTheDocument();
  });

  it("shows contract-oriented guidance for USB and BLE choices", () => {
    const transports: TransportFactory[] = [
      { label: "USB", connect: vi.fn() },
      { label: "BLE", isWireless: true, connect: vi.fn() },
    ];

    render(
      <ConnectModal open transports={transports} onTransportCreated={vi.fn()} />,
    );

    expect(screen.getByText("キーボードを接続")).toBeInTheDocument();
    expect(
      screen.getByText("電源を入れて、接続方法を選んでください。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: USB_BUTTON_NAME }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: BLE_BUTTON_NAME }),
    ).toBeInTheDocument();
  });

  it("shows the USB choice before BLE (BLE is the auxiliary path)", () => {
    const transports: TransportFactory[] = [
      { label: "BLE", isWireless: true, connect: vi.fn() },
      { label: "USB", connect: vi.fn() },
    ];

    render(
      <ConnectModal open transports={transports} onTransportCreated={vi.fn()} />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName(USB_BUTTON_NAME);
    expect(buttons[1]).toHaveAccessibleName(BLE_BUTTON_NAME);
  });
});

describe("ConnectModal right-USB main flow", () => {
  it("keeps the right-USB action available while native BLE devices enumerate", () => {
    const transports: TransportFactory[] = [
      {
        label: "BLE",
        isWireless: true,
        pick_and_connect: {
          list: vi.fn(
            () => new Promise<Array<{ label: string; id: string }>>(() => {}),
          ),
          connect: vi.fn(),
        },
      },
    ];

    render(
      <ConnectModal
        open
        transports={transports}
        onTransportCreated={vi.fn()}
        onConnectRightUsb={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: RIGHT_USB_BUTTON_NAME }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("詳細な接続方法（BLE / USBシリアルのみ）"),
    ).toBeInTheDocument();
  });

  it("renders the right-USB connect as the primary button above the transport list", () => {
    const transports: TransportFactory[] = [
      { label: "BLE", isWireless: true, connect: vi.fn() },
      { label: "USB", connect: vi.fn() },
    ];

    render(
      <ConnectModal
        open
        transports={transports}
        onTransportCreated={vi.fn()}
        onConnectRightUsb={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName(RIGHT_USB_BUTTON_NAME);
    // BLE/USB serial are demoted into the secondary details section.
    expect(
      screen.getByText("詳細な接続方法（BLE / USBシリアルのみ）"),
    ).toBeInTheDocument();
  });

  it("runs the right-USB flow from the primary button", async () => {
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
    }) as HTMLButtonElement;
    fireEvent.click(button);

    expect(onConnectRightUsb).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button).toHaveTextContent("右手USB 接続中...");

    resolveFlow?.();
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
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
