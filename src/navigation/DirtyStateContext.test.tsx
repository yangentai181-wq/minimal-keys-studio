import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DirtyStateProvider,
  useDirtyNavigation,
  useDirtyRegistration,
} from "./DirtyStateContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <DirtyStateProvider>{children}</DirtyStateProvider>;
}

describe("DirtyStateContext", () => {
  it("navigates immediately while every registered screen is clean", async () => {
    const { result } = renderHook(() => useDirtyNavigation(), { wrapper });

    await expect(result.current.requestNavigation(vi.fn())).resolves.toBe(true);
  });

  it("runs the save handler before completing dirty navigation", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => {
      useDirtyRegistration("keymap", { dirty: true, save, discard: vi.fn() });
      return useDirtyNavigation();
    }, { wrapper });
    const destination = vi.fn();

    const pending = result.current.requestNavigation(destination);
    await act(async () => result.current.confirmSave());

    await expect(pending).resolves.toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(destination).toHaveBeenCalledOnce();
  });

  it("discards dirty edits before completing navigation", async () => {
    const discard = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => {
      useDirtyRegistration("keymap", { dirty: true, save: vi.fn(), discard });
      return useDirtyNavigation();
    }, { wrapper });
    const destination = vi.fn();

    const pending = result.current.requestNavigation(destination);
    await act(async () => result.current.confirmDiscard());

    await expect(pending).resolves.toBe(true);
    expect(discard).toHaveBeenCalledOnce();
    expect(destination).toHaveBeenCalledOnce();
  });

  it("keeps the current screen when navigation is cancelled or saving fails", async () => {
    const save = vi.fn().mockRejectedValue(new Error("failed"));
    const { result } = renderHook(() => {
      useDirtyRegistration("keymap", { dirty: true, save, discard: vi.fn() });
      return useDirtyNavigation();
    }, { wrapper });
    const destination = vi.fn();

    const cancelled = result.current.requestNavigation(destination);
    act(() => result.current.cancelNavigation());
    await expect(cancelled).resolves.toBe(false);

    const failed = result.current.requestNavigation(destination);
    await act(async () => result.current.confirmSave());
    await expect(failed).resolves.toBe(false);
    expect(destination).not.toHaveBeenCalled();
  });
});
