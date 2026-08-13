import { createContext } from "react";
import type { CustomSubsystemInfo } from "@zmkfirmware/zmk-studio-ts-client/custom";

export interface CustomSubsystemConnection {
  subsystemIndex: number;
  callRPC: (payload: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>;
}

export interface CustomSubsystemsState {
  status: "disconnected" | "loading" | "ready" | "error";
  subsystems: CustomSubsystemInfo[];
  retry(): void;
}

export const CustomSubsystemsContext = createContext<CustomSubsystemsState>({
  status: "disconnected",
  subsystems: [],
  retry: () => {},
});
