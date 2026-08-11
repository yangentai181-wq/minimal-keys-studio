import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";
import { OsModeProvider } from "./OsModeContext";

vi.mock("./rpc/useConnectedDeviceData", () => ({ useConnectedDeviceData: () => [true, vi.fn()] }));
vi.mock("./usePubSub", () => ({ useSub: () => undefined }));
vi.mock("./GenericModal", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return { GenericModal: forwardRef(({ children }: { children: React.ReactNode }, ref) => {
    useImperativeHandle(ref, () => ({ close: () => undefined, removeEventListener: () => undefined }));
    return <div>{children}</div>;
  }) };
});
vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: { ZMK_STUDIO_CORE_LOCK_STATE_LOCKED: 0, ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 1 },
}));

describe("AppHeader save feedback", () => {
  afterEach(() => vi.useRealTimers());

  it("shows saved for 800ms only after onSave resolves true", async () => {
    vi.useFakeTimers();
    render(<OsModeProvider><AppHeader onSave={vi.fn().mockResolvedValue(true)} /></OsModeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "保存済み" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("does not show saved after a rejected save", async () => {
    render(<OsModeProvider><AppHeader onSave={vi.fn().mockRejectedValue(new Error("save failed"))} /></OsModeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "保存済み" })).not.toBeInTheDocument();
  });
});
