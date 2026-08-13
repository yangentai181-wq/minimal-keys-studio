import { useCallback, useContext, useEffect, useState } from "react";
import { ConnectionContext } from "./ConnectionContext";
import { call_rpc } from "./logging";
import { LockStateContext } from "./LockStateContext";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { CustomSubsystemsContext, type CustomSubsystemsState } from "./CustomSubsystemsContext";

export function CustomSubsystemsProvider({ children }: { children: React.ReactNode }) {
  const conn = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);
  const [state, setState] = useState<CustomSubsystemsState>({
    status: "disconnected",
    subsystems: [],
    retry: () => {},
  });
  const [retryGeneration, setRetryGeneration] = useState(0);
  const retry = useCallback(() => setRetryGeneration((generation) => generation + 1), []);

  useEffect(() => {
    if (
      !conn.conn ||
      lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
    ) {
      setState({ status: "disconnected", subsystems: [], retry });
      return;
    }

    let ignore = false;
    setState({ status: "loading", subsystems: [], retry });

    async function discover() {
      if (!conn.conn) return;
      try {
        const resp = await call_rpc(conn.conn, {
          custom: { listCustomSubsystems: {} },
        });
        if (ignore) return;

        const list = resp.custom?.listCustomSubsystems?.subsystems ?? [];
        setState({ status: "ready", subsystems: list, retry });
      } catch (e) {
        console.error("[CustomSubsystems] Discovery failed:", e);
        if (!ignore) setState({ status: "error", subsystems: [], retry });
      }
    }

    discover();
    return () => { ignore = true; };
  }, [conn.conn, lockState, retry, retryGeneration]);

  return (
    <CustomSubsystemsContext.Provider value={state}>
      {children}
    </CustomSubsystemsContext.Provider>
  );
}
