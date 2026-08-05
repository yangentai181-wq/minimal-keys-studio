import { UserCancelledError } from "@zmkfirmware/zmk-studio-ts-client/transport/errors";

import { CONNECTION_FAILURE_MESSAGE } from "./errorMessages";

export function normalizeConnectionError(error: unknown): string | undefined {
  if (error instanceof UserCancelledError) {
    return undefined;
  }

  return CONNECTION_FAILURE_MESSAGE;
}
