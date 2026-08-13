import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { pub, useSub } from "./usePubSub";

describe("useSub", () => {
  it("keeps one listener through ordinary rerenders and calls the latest callback", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ callback }) => useSub("updates", callback), {
      initialProps: { callback: first },
    });

    rerender({ callback: second });
    await act(async () => { await pub("updates", 42); });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(42);
  });

  it("replaces the listener only when the event name changes", async () => {
    const callback = vi.fn();
    const { rerender } = renderHook(({ name }) => useSub(name, callback), {
      initialProps: { name: "first" },
    });

    rerender({ name: "second" });
    await act(async () => {
      await pub("first", 1);
      await pub("second", 2);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);
  });

  it("supports explicit unsubscribe and does not clean the same listener twice", async () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useSub("updates", callback));

    act(() => result.current());
    act(() => result.current());
    unmount();
    await act(async () => { await pub("updates", 42); });

    expect(callback).not.toHaveBeenCalled();
  });
});
