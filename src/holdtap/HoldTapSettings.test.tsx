import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Writer } from "protobufjs/minimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DirtyRegistration } from "../navigation/DirtyStateContext";
import { HoldTapSettings } from "./HoldTapSettings";

const mocks = vi.hoisted(() => ({
  subsystem: null as { callRPC: ReturnType<typeof vi.fn> } | null,
  registration: undefined as unknown,
  toast: vi.fn(),
}));

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => mocks.subsystem,
}));

vi.mock("../navigation/DirtyStateContext", () => ({
  useDirtyRegistration: (_id: string, registration: unknown) => {
    mocks.registration = registration;
  },
}));

vi.mock("../misc/Toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

function holdTapInfo(tappingTermMs = 200): Uint8Array {
  return Writer.create()
    .uint32(8).uint32(1)
    .uint32(18).string("Home row")
    .uint32(24).uint32(tappingTermMs)
    .uint32(32).uint32(100)
    .uint32(40).uint32(120)
    .uint32(48).uint32(1)
    .uint32(56).uint32(200)
    .uint32(64).uint32(100)
    .uint32(72).uint32(120)
    .uint32(80).uint32(1)
    .finish();
}

function listResponse(tappingTermMs = 200): Uint8Array {
  const list = Writer.create().uint32(10).bytes(holdTapInfo(tappingTermMs)).finish();
  return Writer.create().uint32(18).bytes(list).finish();
}

function errorResponse(message: string): Uint8Array {
  const error = Writer.create().uint32(10).string(message).finish();
  return Writer.create().uint32(10).bytes(error).finish();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function registration(): DirtyRegistration {
  return mocks.registration as DirtyRegistration;
}

describe("HoldTapSettings dirty drafts", () => {
  beforeEach(() => {
    mocks.registration = undefined;
    mocks.toast.mockReset();
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValueOnce(listResponse()) };
  });

  it("registers dirty after editing and discard restores confirmed timing values", async () => {
    render(<HoldTapSettings />);
    const slider = (await screen.findAllByRole("slider"))[0];
    fireEvent.change(slider, { target: { value: "250" } });

    await waitFor(() => expect(registration().dirty).toBe(true));
    await act(async () => { await expect(registration().discard()).resolves.toBe(true); });
    await waitFor(() => expect(registration().dirty).toBe(false));
    expect(slider).toHaveValue("200");
  });

  it("keeps the hold-tap draft dirty when an apply response fails", async () => {
    mocks.subsystem!.callRPC
      .mockResolvedValueOnce(errorResponse("device rejected the setting"))
      .mockResolvedValueOnce(listResponse());
    render(<HoldTapSettings />);
    const slider = (await screen.findAllByRole("slider"))[0];
    fireEvent.change(slider, { target: { value: "250" } });
    await waitFor(() => expect(registration().dirty).toBe(true));

    await act(async () => {
      await expect(registration().save()).rejects.toThrow("device rejected the setting");
    });
    expect(slider).toHaveValue("250");
    expect(registration().dirty).toBe(true);
  });

  it("reapplies a restored hold-tap snapshot after reconnect discovery resolves", async () => {
    const listing = deferred<Uint8Array>();
    mocks.subsystem!.callRPC = vi.fn().mockImplementationOnce(() => listing.promise);
    render(<HoldTapSettings />);
    await waitFor(() => expect(registration().restore).toBeTypeOf("function"));

    await act(async () => {
      registration().restore?.({
        selectedId: 1,
        tappingTerm: 330,
        quickTap: 220,
        requirePriorIdle: 180,
        flavor: 3,
      });
      listing.resolve(listResponse(200));
    });

    await waitFor(() => expect(screen.getAllByRole("slider")[0]).toHaveValue("330"));
    expect(registration().dirty).toBe(true);
    expect(screen.getByRole("combobox")).toHaveValue("3");
  });
});
