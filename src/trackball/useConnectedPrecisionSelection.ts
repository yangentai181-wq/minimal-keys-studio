import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  const generation = useRef(0);
  const behaviors = useBehaviorList();
  const { confirmed, draft } = useTrackballPrecision();
  const invalidate = useCallback(() => {
    generation.current++;
    setKeymap(undefined);
  }, []);
  useSub(KEYMAP_CHANGED_EVENT, () => {
    invalidate();
    setRefresh((current) => current + 1);
  });

  useEffect(() => {
    const requestGeneration = ++generation.current;
    if (!connection.conn || lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED) {
      invalidate();
      return invalidate;
    }
    void call_rpc(connection.conn, { keymap: { getKeymap: true } }).then((response: RequestResponse) => {
      if (requestGeneration === generation.current) setKeymap(response.keymap?.getKeymap);
    }).catch(() => {
      if (requestGeneration === generation.current) setKeymap(undefined);
    });
    return invalidate;
  }, [connection, invalidate, lockState, refresh]);
  const analysis = useMemo(() => (
    keymap && draft && behaviors.length > 0
      ? getPrecisionSelectionAnalysis(keymap, behaviors, confirmed, draft.selectedPosition)
      : null
  ), [behaviors, confirmed, draft, keymap]);

  return { keymap, behaviors, analysis };
}
