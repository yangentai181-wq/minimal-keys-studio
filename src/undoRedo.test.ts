import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoRedo } from "./undoRedo";

describe("useUndoRedo", () => {
  it("reset is referentially stable across renders", () => {
    const { result, rerender } = renderHook(() => useUndoRedo());

    const resetFirst = result.current[5]; // reset is index 5
    rerender();
    const resetSecond = result.current[5];

    expect(resetFirst).toBe(resetSecond);
  });

  it("reset clears undo and redo stacks", async () => {
    const { result } = renderHook(() => useUndoRedo());

    const [doIt, , , , , reset] = result.current;

    // Add an operation to the undo stack
    await act(async () => {
      await doIt(async () => {
        return async () => {};
      });
    });

    // canUndo should be true
    expect(result.current[3]).toBe(true); // canUndo

    // Reset
    act(() => {
      reset();
    });

    // canUndo should be false after reset
    expect(result.current[3]).toBe(false); // canUndo
    expect(result.current[4]).toBe(false); // canRedo
  });

  describe("failure handling", () => {
    it("ignores a second doIt while one is in progress", async () => {
      const { result } = renderHook(() => useUndoRedo());

      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const second = vi.fn(async () => async () => {});

      let firstPromise!: Promise<boolean>;
      act(() => {
        firstPromise = result.current[0](async () => {
          await gate;
          return async () => {};
        });
      });

      await act(async () => {
        await result.current[0](second);
      });
      expect(second).not.toHaveBeenCalled();

      release();
      await act(async () => {
        await firstPromise;
      });
      expect(result.current[3]).toBe(true); // canUndo from the first op
    });
  });

  it("unlocks without adding history when an operation rejects", async () => {
    const { result } = renderHook(() => useUndoRedo());

    await expect(act(async () => {
      await result.current[0](async () => {
        throw new Error("write failed");
      });
    })).rejects.toThrow("write failed");

    expect(result.current[3]).toBe(false);
    expect(result.current[4]).toBe(false);
  });

  it("does not add history when an operation returns no undo callback", async () => {
    const { result } = renderHook(() => useUndoRedo());

    await act(async () => {
      await result.current[0](async () => null);
    });

    expect(result.current[3]).toBe(false);
    expect(result.current[4]).toBe(false);
  });

  it("keeps undo history and unlocks when undo rejects, then permits a later undo", async () => {
    const { result } = renderHook(() => useUndoRedo());
    const undoCallback = vi.fn().mockRejectedValueOnce(new Error("undo failed"));

    await act(async () => {
      await result.current[0](async () => undoCallback);
    });
    await expect(act(async () => {
      await result.current[1]();
    })).rejects.toThrow("undo failed");

    expect(result.current[3]).toBe(true);
    expect(result.current[4]).toBe(false);

    undoCallback.mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current[1]();
    });
    expect(result.current[3]).toBe(false);
    expect(result.current[4]).toBe(true);
  });

  it("keeps undo history when an undo callback reports no change", async () => {
    const { result } = renderHook(() => useUndoRedo());
    const undoCallback = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(undefined);

    await act(async () => { await result.current[0](async () => undoCallback); });
    await act(async () => { await result.current[1](); });

    expect(result.current[3]).toBe(true);
    expect(result.current[4]).toBe(false);

    await act(async () => { await result.current[1](); });
    expect(result.current[3]).toBe(false);
    expect(result.current[4]).toBe(true);
  });

  it("keeps redo history when a redo has no undo callback, then permits a later redo", async () => {
    const { result } = renderHook(() => useUndoRedo());
    const undoCallback = vi.fn(async () => {});
    const doCallback = vi.fn()
      .mockResolvedValueOnce(undoCallback)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(undoCallback);

    await act(async () => { await result.current[0](doCallback); });
    await act(async () => { await result.current[1](); });
    await act(async () => { await result.current[2](); });

    expect(result.current[3]).toBe(false);
    expect(result.current[4]).toBe(true);

    await act(async () => { await result.current[2](); });
    expect(result.current[3]).toBe(true);
    expect(result.current[4]).toBe(false);
  });

  it("keeps redo history and unlocks when redo rejects, then permits a later redo", async () => {
    const { result } = renderHook(() => useUndoRedo());
    const undoCallback = vi.fn(async () => {});
    const doCallback = vi.fn()
      .mockResolvedValueOnce(undoCallback)
      .mockRejectedValueOnce(new Error("redo failed"))
      .mockResolvedValueOnce(undoCallback);

    await act(async () => { await result.current[0](doCallback); });
    await act(async () => { await result.current[1](); });
    await expect(act(async () => {
      await result.current[2]();
    })).rejects.toThrow("redo failed");

    expect(result.current[3]).toBe(false);
    expect(result.current[4]).toBe(true);

    await act(async () => { await result.current[2](); });
    expect(result.current[3]).toBe(true);
    expect(result.current[4]).toBe(false);
  });
});
