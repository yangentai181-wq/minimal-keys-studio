import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Writer } from "protobufjs/minimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DirtyRegistration } from "../navigation/DirtyStateContext";
import * as HT from "../proto/holdtap";
import { HoldTapSettings } from "./HoldTapSettings";

const mocks = vi.hoisted(() => ({
  subsystem: null as { callRPC: ReturnType<typeof vi.fn> } | null,
  registration: undefined as unknown,
  toast: vi.fn(),
  layers: [] as Array<{ id: number; index: number; name: string; bindings: Array<{ behaviorId: number; param1: number; param2: number }> }>,
  behaviors: [] as Array<{ id: number; displayName: string; metadata: [] }>,
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

vi.mock("../keyboard/useStudioKeymap", () => ({
  useStudioKeymap: () => ({ layers: mocks.layers, loading: false }),
}));

vi.mock("../behaviors/BehaviorsContext", () => ({
  useBehaviorList: () => mocks.behaviors,
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

function namedHoldTapInfo(id: number, name: string): Uint8Array {
  return Writer.create()
    .uint32(8).uint32(id)
    .uint32(18).string(name)
    .uint32(24).uint32(200)
    .uint32(32).uint32(100)
    .uint32(40).uint32(120)
    .uint32(48).uint32(1)
    .uint32(56).uint32(200)
    .uint32(64).uint32(100)
    .uint32(72).uint32(120)
    .uint32(80).uint32(1)
    .finish();
}

function multiListResponse(): Uint8Array {
  const list = Writer.create()
    .uint32(10).bytes(namedHoldTapInfo(1, "mod_tap"))
    .uint32(10).bytes(namedHoldTapInfo(2, "my_custom_hold_tap"))
    .finish();
  return Writer.create().uint32(18).bytes(list).finish();
}

function twoKnownHoldTapsResponse(): Uint8Array {
  const list = Writer.create()
    .uint32(10).bytes(namedHoldTapInfo(1, "mod_tap"))
    .uint32(10).bytes(namedHoldTapInfo(2, "layer_tap"))
    .finish();
  return Writer.create().uint32(18).bytes(list).finish();
}

function setTappingTermSuccess(): Uint8Array {
  const result = Writer.create().uint32(8).bool(true).finish();
  return Writer.create().uint32(26).bytes(result).finish();
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
    mocks.layers = [];
    mocks.behaviors = [];
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

describe("HoldTapSettings presentation", () => {
  beforeEach(() => {
    mocks.registration = undefined;
    mocks.toast.mockReset();
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValueOnce(multiListResponse()) };
    mocks.layers = [{
      id: 4,
      index: 0,
      name: "Base",
      bindings: [{ behaviorId: 10, param1: 0, param2: 0x00070004 }],
    }];
    mocks.behaviors = [{ id: 10, displayName: "Mod-Tap", metadata: [] }];
  });

  it("shows used settings with affected keys and beginner-facing headings", async () => {
    render(<HoldTapSettings />);

    expect(await screen.findByRole("button", { name: /Mod-Tap.*1キー/ })).toBeInTheDocument();
    expect(screen.getByText(/1キーで使用中/)).toBeInTheDocument();
    expect(screen.getByText(/Base \/ A/)).toBeInTheDocument();
    expect(screen.queryByText("My Custom Hold Tap")).not.toBeInTheDocument();
    expect(screen.getByText("長押し判定までの時間")).toBeInTheDocument();
    expect(screen.getByText("連打を単押しにする時間")).toBeInTheDocument();
    expect(screen.getByText("直前の入力を待つ時間")).toBeInTheDocument();
    expect(screen.getByText("判定方法")).toBeInTheDocument();
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    for (const slider of screen.getAllByRole("slider")) expect(slider).toHaveAttribute("step", "10");
  });

  it("keeps an edited fallback draft when late keymap data identifies another instance as used", async () => {
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValueOnce(twoKnownHoldTapsResponse()) };
    mocks.layers = [];
    mocks.behaviors = [];
    const view = render(<HoldTapSettings />);
    const slider = (await screen.findAllByRole("slider"))[0];
    fireEvent.change(slider, { target: { value: "250" } });

    mocks.layers = [{ id: 4, index: 0, name: "Base", bindings: [{ behaviorId: 20, param1: 0, param2: 0x00070004 }] }];
    mocks.behaviors = [{ id: 20, displayName: "Layer-Tap", metadata: [] }];
    view.rerender(<HoldTapSettings />);

    expect(slider).toHaveValue("250");
    expect(screen.getByText(/Mod-Tap/)).toBeInTheDocument();
  });

  it("automatically selects an in-use instance when late data arrives before edits", async () => {
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValueOnce(twoKnownHoldTapsResponse()) };
    mocks.layers = [];
    mocks.behaviors = [];
    const view = render(<HoldTapSettings />);
    await screen.findAllByRole("slider");

    mocks.layers = [{ id: 4, index: 0, name: "Base", bindings: [{ behaviorId: 20, param1: 0, param2: 0x00070004 }] }];
    mocks.behaviors = [{ id: 20, displayName: "Layer-Tap", metadata: [] }];
    view.rerender(<HoldTapSettings />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Layer-Tap.*1キー/ })).toBeInTheDocument());
  });

  it("saves only the selected unused instance after an edit", async () => {
    mocks.subsystem = {
      callRPC: vi.fn()
        .mockResolvedValueOnce(multiListResponse())
        .mockResolvedValueOnce(setTappingTermSuccess())
        .mockResolvedValueOnce(multiListResponse()),
    };
    render(<HoldTapSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "未使用の設定を表示" }));
    fireEvent.click(screen.getByRole("button", { name: /My Custom Hold Tap/ }));
    fireEvent.change(screen.getAllByRole("slider")[0], { target: { value: "250" } });

    await act(async () => { await expect(registration().save()).resolves.toBe(true); });
    expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(3);
    expect(Array.from(mocks.subsystem!.callRPC.mock.calls[1][0])).toEqual(
      Array.from(HT.encodeSetTappingTerm(2, 250)),
    );
    expect(screen.getAllByRole("slider")[0]).toHaveValue("200");
  });
});
