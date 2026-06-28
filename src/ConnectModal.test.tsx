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
      name: "USB",
    }) as HTMLButtonElement;
    fireEvent.click(button);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);

    resolveConnect?.(transport);

    await waitFor(() => {
      expect(onTransportCreated).toHaveBeenCalledWith(transport, undefined);
    });
  });
});
