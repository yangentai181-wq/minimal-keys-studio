import { afterEach, describe, expect, it, vi } from "vitest";
import { connect, openSerialPort } from "./serial";

function fakeReadable(cancel = vi.fn().mockResolvedValue(undefined)) {
  return {
    cancel,
  } as unknown as ReadableStream<Uint8Array>;
}

function fakeWritable(close = vi.fn().mockResolvedValue(undefined)) {
  return {
    close,
  } as unknown as WritableStream<Uint8Array>;
}

function fakePort({
  readable = null,
  writable = null,
  open = vi.fn().mockResolvedValue(undefined),
  close = vi.fn().mockResolvedValue(undefined),
  setSignals = vi.fn().mockResolvedValue(undefined),
}: {
  readable?: ReadableStream<Uint8Array> | null;
  writable?: WritableStream<Uint8Array> | null;
  open?: ReturnType<typeof vi.fn>;
  close?: ReturnType<typeof vi.fn>;
  setSignals?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    readable,
    writable,
    open,
    close,
    setSignals,
    getInfo: vi.fn(() => ({})),
  } as unknown as SerialPort;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.defineProperty(navigator, "serial", {
    configurable: true,
    value: undefined,
  });
});

describe("openSerialPort", () => {
  it("closes existing streams before opening the selected serial port", async () => {
    const cancelReadable = vi.fn().mockResolvedValue(undefined);
    const closeWritable = vi.fn().mockResolvedValue(undefined);
    const closePort = vi.fn().mockResolvedValue(undefined);
    const openPort = vi.fn().mockResolvedValue(undefined);
    const setSignals = vi.fn().mockResolvedValue(undefined);
    const port = fakePort({
      readable: fakeReadable(cancelReadable),
      writable: fakeWritable(closeWritable),
      open: openPort,
      close: closePort,
      setSignals,
    });

    await openSerialPort(port);

    expect(cancelReadable).toHaveBeenCalledWith(
      "Reopening an already-open serial port",
    );
    expect(closeWritable).toHaveBeenCalledOnce();
    expect(closePort).toHaveBeenCalledOnce();
    expect(openPort).toHaveBeenCalledWith({ baudRate: 9600 });
    expect(setSignals).toHaveBeenCalledWith({
      dataTerminalReady: true,
      requestToSend: true,
    });
    expect(openPort.mock.invocationCallOrder[0]).toBeLessThan(
      setSignals.mock.invocationCallOrder[0],
    );
    expect(closePort.mock.invocationCallOrder[0]).toBeLessThan(
      openPort.mock.invocationCallOrder[0],
    );
  });

  it("still closes the port when stale streams throw during cleanup", async () => {
    const cancelReadable = vi.fn(() => {
      throw new TypeError("ReadableStream is locked");
    });
    const closeWritable = vi.fn(() => {
      throw new TypeError("WritableStream is locked");
    });
    const closePort = vi.fn().mockResolvedValue(undefined);
    const openPort = vi.fn().mockResolvedValue(undefined);
    const port = fakePort({
      readable: fakeReadable(cancelReadable),
      writable: fakeWritable(closeWritable),
      open: openPort,
      close: closePort,
    });

    await openSerialPort(port);

    expect(cancelReadable).toHaveBeenCalledOnce();
    expect(closeWritable).toHaveBeenCalledOnce();
    expect(closePort).toHaveBeenCalledOnce();
    expect(openPort).toHaveBeenCalledWith({ baudRate: 9600 });
  });

  it("reports a helpful cleanup error when the stale port cannot be closed", async () => {
    const closePort = vi
      .fn()
      .mockRejectedValue(new DOMException("Already closing", "InvalidStateError"));
    const openPort = vi.fn().mockResolvedValue(undefined);
    const port = fakePort({
      readable: fakeReadable(),
      writable: fakeWritable(),
      open: openPort,
      close: closePort,
    });

    await expect(openSerialPort(port)).rejects.toThrow(
      "USBポートの前回接続を閉じきれませんでした",
    );

    expect(closePort).toHaveBeenCalledOnce();
    expect(openPort).not.toHaveBeenCalled();
  });

  it("closes and retries when the browser reports the port is already open", async () => {
    const alreadyOpenError = new DOMException(
      "Failed to execute 'open' on 'SerialPort': The port is already open.",
      "InvalidStateError",
    );
    const closePort = vi.fn().mockResolvedValue(undefined);
    const openPort = vi
      .fn()
      .mockRejectedValueOnce(alreadyOpenError)
      .mockResolvedValueOnce(undefined);
    const port = fakePort({ open: openPort, close: closePort });

    await openSerialPort(port);

    expect(closePort).toHaveBeenCalledOnce();
    expect(openPort).toHaveBeenCalledTimes(2);
    expect(openPort).toHaveBeenLastCalledWith({ baudRate: 9600 });
  });

  it("translates a second already-open error after retry", async () => {
    const alreadyOpenError = new DOMException(
      "Failed to execute 'open' on 'SerialPort': The port is already open.",
      "InvalidStateError",
    );
    const closePort = vi.fn().mockResolvedValue(undefined);
    const openPort = vi
      .fn()
      .mockRejectedValueOnce(alreadyOpenError)
      .mockRejectedValueOnce(alreadyOpenError);
    const port = fakePort({ open: openPort, close: closePort });

    await expect(openSerialPort(port)).rejects.toThrow(
      "USBポートがまだ開かれています",
    );
  });

  it("shows a helpful error when another owner keeps the serial port busy", async () => {
    const openPort = vi
      .fn()
      .mockRejectedValue(
        new DOMException("The port is unavailable.", "NetworkError"),
      );
    const port = fakePort({ open: openPort });

    await expect(openSerialPort(port)).rejects.toThrow(
      "USBポートを開けませんでした",
    );
  });
});

describe("connect", () => {
  it("gives stream pipelines a moment to release locks before closing on abort", async () => {
    vi.useFakeTimers();
    const readable = fakeReadable();
    const writable = fakeWritable();
    const closePort = vi.fn().mockResolvedValue(undefined);
    const port = fakePort({
      readable,
      writable,
      close: closePort,
    });
    const requestPort = vi.fn().mockResolvedValue(port);
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: { requestPort },
    });

    const transport = await connect();
    closePort.mockClear();
    transport.abortController.abort("Device info request failed");
    await Promise.resolve();

    expect(closePort).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);

    expect(closePort).toHaveBeenCalledOnce();
  });

  it("waits for an in-flight abort close before reopening the same serial port", async () => {
    const closeDeferred = deferred<void>();
    let isOpen = false;
    const readable = fakeReadable();
    const writable = fakeWritable();
    const openPort = vi.fn(async () => {
      if (isOpen) {
        throw new DOMException("The port is already open.", "InvalidStateError");
      }
      isOpen = true;
    });
    const closePort = vi.fn(async () => {
      await closeDeferred.promise;
      isOpen = false;
    });
    const setSignals = vi.fn().mockResolvedValue(undefined);
    const port = {
      get readable() {
        return isOpen ? readable : null;
      },
      get writable() {
        return isOpen ? writable : null;
      },
      open: openPort,
      close: closePort,
      setSignals,
      getInfo: vi.fn(() => ({
        usbProductId: 2,
        usbVendorId: 1,
      })),
    } as unknown as SerialPort;
    const requestPort = vi.fn().mockResolvedValue(port);
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: { requestPort },
    });

    const firstTransport = await connect();
    firstTransport.abortController.abort("User disconnected");

    const secondTransportPromise = connect();

    await vi.waitFor(() => expect(closePort).toHaveBeenCalledOnce());
    expect(openPort).toHaveBeenCalledOnce();

    closeDeferred.resolve();
    const secondTransport = await secondTransportPromise;

    expect(openPort).toHaveBeenCalledTimes(2);
    expect(secondTransport.readable).toBe(readable);

    secondTransport.abortController.abort("test cleanup");
  });
});
