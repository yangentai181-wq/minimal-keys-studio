import type { RequestResponse } from "@zmkfirmware/zmk-studio-ts-client";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { LockStateContext } from "../rpc/LockStateContext";
import { call_rpc } from "../rpc/logging";
import { useSub } from "../usePubSub";
import { KEYMAP_CHANGED_EVENT } from "./keymap-events";

export interface StudioKeymapLayer {
  id: number;
  index: number;
  name: string;
  bindings: BehaviorBinding[];
}

export interface StudioKeymapSnapshot {
  layers: StudioKeymapLayer[];
  loading: boolean;
}

const emptySnapshot: StudioKeymapSnapshot = { layers: [], loading: false };

export function useStudioKeymap(): StudioKeymapSnapshot {
  const connection = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);
  const [snapshot, setSnapshot] = useState<StudioKeymapSnapshot>(emptySnapshot);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
    setSnapshot(emptySnapshot);
  }, []);

  useSub(KEYMAP_CHANGED_EVENT, () => {
    invalidate();
    setRefresh((current) => current + 1);
  });

  useEffect(() => {
    const requestGeneration = ++generation.current;
    if (!connection.conn || lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED) {
      setSnapshot(emptySnapshot);
      return invalidate;
    }

    setSnapshot({ layers: [], loading: true });
    void call_rpc(connection.conn, { keymap: { getKeymap: true } })
      .then((response: RequestResponse) => {
        if (requestGeneration !== generation.current) return;
        const layers = response.keymap?.getKeymap?.layers ?? [];
        setSnapshot({
          layers: layers.map((layer, index) => ({
            id: layer.id ?? index,
            index,
            name: layer.name ?? `Layer ${index}`,
            bindings: layer.bindings,
          })),
          loading: false,
        });
      })
      .catch(() => {
        if (requestGeneration === generation.current) setSnapshot(emptySnapshot);
      });

    return invalidate;
  }, [connection, invalidate, lockState, refresh]);

  return snapshot;
}
