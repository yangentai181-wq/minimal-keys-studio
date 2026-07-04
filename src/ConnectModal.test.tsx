import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConnectModal, type TransportFactory } from "./ConnectModal";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
  };
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
      name: "USBで接続 USB Studio対応ファーム用。反応しない時はBLE",
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
      name: "USBで接続 USB Studio対応ファーム用。反応しない時はBLE",
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
        name: "USBで接続 USB Studio対応ファーム用。反応しない時はBLE",
      }),
    );

    expect(
      await screen.findByText("デバイスへの接続に失敗しました"),
    ).toBeInTheDocument();
  });

  it("shows polished connection guidance for USB and BLE choices", () => {
    const transports: TransportFactory[] = [
      { label: "USB", connect: vi.fn() },
      { label: "BLE", isWireless: true, connect: vi.fn() },
    ];

    render(
      <ConnectModal
        open
        transports={transports}
        onTransportCreated={vi.fn()}
      />,
    );

    expect(screen.getByText("キーボードを接続")).toBeInTheDocument();
    expect(screen.getByText("電源を入れて、接続方法を選んでください。")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "USBで接続 USB Studio対応ファーム用。反応しない時はBLE",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "BLEで接続 minimal-keys推奨。ワイヤレスで編集する",
      }),
    ).toBeInTheDocument();
  });

  it("shows the BLE choice before USB when both are available", () => {
    const transports: TransportFactory[] = [
      { label: "USB", connect: vi.fn() },
      { label: "BLE", isWireless: true, connect: vi.fn() },
    ];

    render(
      <ConnectModal
        open
        transports={transports}
        onTransportCreated={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName(
      "BLEで接続 minimal-keys推奨。ワイヤレスで編集する",
    );
    expect(buttons[1]).toHaveAccessibleName(
      "USBで接続 USB Studio対応ファーム用。反応しない時はBLE",
    );
  });
});
