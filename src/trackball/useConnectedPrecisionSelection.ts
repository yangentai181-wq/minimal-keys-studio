import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { useMemo } from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { useBehaviorList } from "../behaviors/BehaviorsContext";
import { KEYMAP_CHANGED_EVENT } from "../keyboard/keymap-events";
import type { RequestResponse } from "@zmkfirmware/zmk-studio-ts-client";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { LockStateContext } from "../rpc/LockStateContext";
import { call_rpc } from "../rpc/logging";
import { useSub } from "../usePubSub";
import type { PrecisionBindingAnalysis } from "./precision-binding";
import { getPrecisionSelectionAnalysis } from "./precision-selection";
import { useTrackballPrecision } from "./TrackballPrecisionContext";

export interface ConnectedPrecisionSelection {
  keymap: Keymap | undefined;
  behaviors: GetBehaviorDetailsResponse[];
  analysis: PrecisionBindingAnalysis | null;
}

export function useConnectedPrecisionSelection(): ConnectedPrecisionSelection {
  const connection = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);
  const [keymap, setKeymap] = useState<Keymap>();
  const [refresh, setRefresh] = useState(0);
  const requestSequence = useRef(0);
  const behaviors = useBehaviorList();
  const { confirmed, draft } = useTrackballPrecision();
  useSub(KEYMAP_CHANGED_EVENT, () => setRefresh((current) => current + 1));

  useEffect(() => {
    if (!connection.conn || lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED) {
      setKeymap(undefined);
      return;
    }
    const sequence = ++requestSequence.current;
    void call_rpc(connection.conn, { keymap: { getKeymap: true } }).then((response: RequestResponse) => {
      if (sequence === requestSequence.current) setKeymap(response.keymap?.getKeymap);
    }).catch(() => {
      if (sequence === requestSequence.current) setKeymap(undefined);
    });
  }, [connection, lockState, refresh]);
  const analysis = useMemo(() => (
    keymap && draft && behaviors.length > 0
      ? getPrecisionSelectionAnalysis(keymap, behaviors, confirmed, draft.selectedPosition)
      : null
  ), [behaviors, confirmed, draft, keymap]);

  return { keymap, behaviors, analysis };
}
