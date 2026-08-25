import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { SetLayerBindingResponse } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { BehaviorBinding, Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useBehaviorList } from "../behaviors/BehaviorsContext";
import { KEYMAP_CHANGED_EVENT, publishKeymapChanged } from "../keyboard/keymap-events";
import { GESTURE_LAYER_ID, hasGestureLayer } from "../keyboard/minimal-keys-layers";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { LockStateContext } from "../rpc/LockStateContext";
import { call_rpc } from "../rpc/logging";
import { UndoRedoContext } from "../undoRedo";
import { useSub } from "../usePubSub";
import { GESTURE_DIRECTIONS, type GestureDirection } from "./gesture-bindings";

export interface ConnectedGestureKeymap {
  availability: "loading" | "available" | "disconnected" | "firmware-update-required" | "error";
  keymap: Keymap | null;
  behaviors: GetBehaviorDetailsResponse[];
  error: string | null;
  updateBinding(direction: GestureDirection, binding: BehaviorBinding): Promise<boolean>;
}

const GESTURE_EDITOR_EVENT_SOURCE = "trackball-gesture-editor";

function setBinding(
  keymap: Keymap,
  layerId: number,
  keyPosition: number,
  binding: BehaviorBinding,
): Keymap {
  return {
    ...keymap,
    layers: keymap.layers.map((layer) => layer.id === layerId
      ? { ...layer, bindings: layer.bindings.map((current, position) => position === keyPosition ? binding : current) }
      : layer),
  };
}

/** The firmware-owned gesture layer, addressed by ID so reordering is safe. */
function gestureLayer(keymap: Keymap | null) {
  return keymap?.layers.find((layer) => layer.id === GESTURE_LAYER_ID) ?? null;
}

function hasCompleteGestureBindings(keymap: Keymap): boolean {
  const layer = gestureLayer(keymap);
  return layer !== null && GESTURE_DIRECTIONS.every(
    ({ position }) => layer.bindings[position] != null,
  );
}

export function useConnectedGestureKeymap(): ConnectedGestureKeymap {
  const connection = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);
  const undoRedo = useContext(UndoRedoContext);
  const behaviors = useBehaviorList();
  const [keymap, setKeymap] = useState<Keymap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);

  const invalidate = useCallback(() => {
    generation.current++;
    setKeymap(null);
  }, []);

  useSub(KEYMAP_CHANGED_EVENT, (source) => {
    if (source === GESTURE_EDITOR_EVENT_SOURCE) return;
    invalidate();
    setRefresh((current) => current + 1);
  });

  useEffect(() => {
    const requestGeneration = ++generation.current;
    if (!connection.conn || lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED) {
      invalidate();
      return invalidate;
    }

    void call_rpc(connection.conn, { keymap: { getKeymap: true } })
      .then((response) => {
        if (requestGeneration === generation.current) {
          setKeymap(response.keymap?.getKeymap ?? null);
        }
      })
      .catch((reason: unknown) => {
        if (requestGeneration === generation.current) {
          setError(reason instanceof Error ? reason.message : "キーマップを読み込めませんでした");
        }
      });
    return invalidate;
  }, [connection, invalidate, lockState, refresh]);

  const availability = useMemo<ConnectedGestureKeymap["availability"]>(() => {
    if (!connection.conn) return "disconnected";
    if (error && !keymap) return "error";
    if (!keymap) return "loading";
    return hasGestureLayer(keymap.layers) && hasCompleteGestureBindings(keymap)
      ? "available"
      : "firmware-update-required";
  }, [connection.conn, error, keymap]);

  const updateBinding = useCallback(async (direction: GestureDirection, binding: BehaviorBinding) => {
    const slot = GESTURE_DIRECTIONS.find((candidate) => candidate.id === direction);
    const layer = gestureLayer(keymap);
    if (!connection.conn || !keymap || !layer || !slot || !undoRedo || !hasCompleteGestureBindings(keymap)) {
      setError("ジェスチャー割当を更新できませんでした");
      return false;
    }

    const { id: layerId } = layer;
    const { position: keyPosition } = slot;
    const oldBinding = layer.bindings[keyPosition];

    try {
      return await undoRedo(async () => {
        const response = await call_rpc(connection.conn!, {
          keymap: { setLayerBinding: { layerId, keyPosition, binding } },
        });
        if (response.keymap?.setLayerBinding !== SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK) {
          setError("ジェスチャー割当を更新できませんでした");
          return null;
        }

        setError(null);
        setKeymap((current) => current ? setBinding(current, GESTURE_LAYER_ID, keyPosition, binding) : current);
        publishKeymapChanged(GESTURE_EDITOR_EVENT_SOURCE);

        return async () => {
          const undoResponse = await call_rpc(connection.conn!, {
            keymap: { setLayerBinding: { layerId, keyPosition, binding: oldBinding } },
          });
          if (undoResponse.keymap?.setLayerBinding !== SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK) {
            setError("ジェスチャー割当を元に戻せませんでした");
            return null;
          }

          setError(null);
          setKeymap((current) => current ? setBinding(current, GESTURE_LAYER_ID, keyPosition, oldBinding) : current);
          publishKeymapChanged(GESTURE_EDITOR_EVENT_SOURCE);
        };
      });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "ジェスチャー割当を更新できませんでした");
      return false;
    }
  }, [connection.conn, keymap, undoRedo]);

  return { availability, keymap, behaviors, error, updateBinding };
}
