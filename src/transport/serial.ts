import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { UserCancelledError } from "@zmkfirmware/zmk-studio-ts-client/transport/errors";

const SERIAL_BAUD_RATE = 9600;
const SERIAL_BUSY_ERROR_MESSAGE =
  "USBポートを開けませんでした。ほかのタブやアプリで同じキーボードを接続していないか確認してください。";
const SERIAL_CLOSE_ERROR_MESSAGE =
  "USBポートの前回接続を閉じきれませんでした。少し待ってからもう一度接続してください。";
const SERIAL_STILL_OPEN_ERROR_MESSAGE =
  "USBポートがまだ開かれています。少し待ってからもう一度接続してください。";
const SERIAL_ABORT_CLOSE_DELAY_MS = 50;

const closingPorts = new WeakMap<SerialPort, Promise<void>>();

function isAlreadyOpenError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "InvalidStateError" ||
      error.message.toLowerCase().includes("already open"))
  );
}

function isPermissionOrBusyError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NetworkError";
}

function settle(action: () => Promise<unknown>): Promise<unknown> {
  try {
    return action();
  } catch (error) {
    return Promise.reject(error);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function closeOpenSerialPort(
  port: SerialPort,
  reason: unknown,
): Promise<void> {
  const existingClose = closingPorts.get(port);
  if (existingClose) {
    await existingClose;
    return;
  }

  const closePromise = closeSerialPort(port, reason).finally(() => {
    closingPorts.delete(port);
  });
  closingPorts.set(port, closePromise);
  await closePromise;
}

async function closeSerialPort(
  port: SerialPort,
  reason: unknown,
): Promise<void> {
  const closeAttempts: Promise<unknown>[] = [];

  if (port.writable) {
    closeAttempts.push(settle(() => port.writable!.close()));
  }
  if (port.readable) {
    closeAttempts.push(settle(() => port.readable!.cancel(reason)));
  }

  await Promise.allSettled(closeAttempts);
  await port.close();
}

async function ensureSerialPortClosed(
  port: SerialPort,
  reason: unknown,
): Promise<void> {
  try {
    await closeOpenSerialPort(port, reason);
  } catch {
    throw new Error(SERIAL_CLOSE_ERROR_MESSAGE);
  }
}

async function openPort(port: SerialPort): Promise<void> {
  try {
    await port.open({ baudRate: SERIAL_BAUD_RATE });
    await port.setSignals({
      dataTerminalReady: true,
      requestToSend: true,
    });
  } catch (error) {
    if (isPermissionOrBusyError(error)) {
      throw new Error(SERIAL_BUSY_ERROR_MESSAGE);
    }

    throw error;
  }
}

export async function openSerialPort(port: SerialPort): Promise<void> {
  const pendingClose = closingPorts.get(port);
  if (pendingClose) {
    try {
      await pendingClose;
    } catch {
      throw new Error(SERIAL_CLOSE_ERROR_MESSAGE);
    }
  }

  if (port.readable || port.writable) {
    await ensureSerialPortClosed(
      port,
      "Reopening an already-open serial port",
    );
  }

  try {
    await openPort(port);
  } catch (error) {
    if (isAlreadyOpenError(error)) {
      await ensureSerialPortClosed(port, error);
      try {
        await openPort(port);
      } catch (retryError) {
        if (isAlreadyOpenError(retryError)) {
          throw new Error(SERIAL_STILL_OPEN_ERROR_MESSAGE);
        }

        throw retryError;
      }
      return;
    }

    throw error;
  }
}

export async function connect(): Promise<RpcTransport> {
  const abortController = new AbortController();
  const port = await navigator.serial.requestPort({}).catch((error) => {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      throw new UserCancelledError("User cancelled the connection attempt", {
        cause: error,
      });
    }
    throw error;
  });

  await openSerialPort(port);

  if (!port.readable || !port.writable) {
    await closeOpenSerialPort(port, "Serial port did not expose streams");
    throw new Error("USBポートの入出力ストリームを開けませんでした。");
  }

  const info = port.getInfo();
  const label = `${info.usbVendorId?.toLocaleString() || ""}:${
    info.usbProductId?.toLocaleString() || ""
  }`;

  const signal = abortController.signal;
  const abortCallback = async () => {
    signal.removeEventListener("abort", abortCallback);
    await delay(SERIAL_ABORT_CLOSE_DELAY_MS);
    await closeOpenSerialPort(port, "Serial transport aborted").catch((error) =>
      console.warn("Failed to close serial port:", error),
    );
  };
  signal.addEventListener("abort", abortCallback);

  return {
    label,
    abortController,
    readable: port.readable,
    writable: port.writable,
  };
}
