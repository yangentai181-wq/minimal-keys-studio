import { describe, expect, it, vi } from "vitest";
import { disposeTransport } from "./transportLifecycle";

describe("disposeTransport", () => {
  it("aborts the connection and settles stream cleanup failures", async () => {
    const abortController = new AbortController();
    const cancelReadable = vi.fn().mockRejectedValue(new Error("locked"));
    const abortWritable = vi.fn().mockRejectedValue(new Error("locked"));
    const readable = {
      cancel: cancelReadable,
    } as unknown as ReadableStream<Uint8Array>;
    const writable = {
      abort: abortWritable,
    } as unknown as WritableStream<Uint8Array>;

    await expect(
      disposeTransport(
        { abortController, readable, writable },
        "Device info request failed",
      ),
    ).resolves.toBeUndefined();

    expect(abortController.signal.aborted).toBe(true);
    expect(cancelReadable).toHaveBeenCalledWith("Device info request failed");
    expect(abortWritable).toHaveBeenCalledWith("Device info request failed");
  });

  it("settles cleanup methods that throw synchronously", async () => {
    const abortController = new AbortController();
    const cancelReadable = vi.fn(() => {
      throw new TypeError("ReadableStream is locked");
    });
    const abortWritable = vi.fn(() => {
      throw new TypeError("WritableStream is locked");
    });
    const readable = {
      cancel: cancelReadable,
    } as unknown as ReadableStream<Uint8Array>;
    const writable = {
      abort: abortWritable,
    } as unknown as WritableStream<Uint8Array>;

    await expect(
      disposeTransport({ abortController, readable, writable }, "cleanup"),
    ).resolves.toBeUndefined();

    expect(abortController.signal.aborted).toBe(true);
  });
});
