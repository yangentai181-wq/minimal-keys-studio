import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";

function settle(action: () => Promise<unknown>): Promise<unknown> {
  try {
    return action();
  } catch (error) {
    return Promise.reject(error);
  }
}

export async function disposeTransport(
  transport: Pick<RpcTransport, "abortController" | "readable" | "writable">,
  reason: unknown,
): Promise<void> {
  if (!transport.abortController.signal.aborted) {
    transport.abortController.abort(reason);
  }

  await Promise.allSettled([
    settle(() => transport.readable.cancel(reason)),
    settle(() => transport.writable.abort(reason)),
  ]);
}
