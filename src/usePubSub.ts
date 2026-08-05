import Emittery from "emittery";
import { useCallback, useEffect, useRef } from "react";

const emitter = new Emittery();

// Non-hook version for use outside React components
export const pub = (name: PropertyKey, data: unknown) =>
  emitter.emit(name, data);

export const usePub = () => pub;

export const useSub = (
  name: PropertyKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (data: any) => void | Promise<void>
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const unsubscribe = useCallback(() => {
    unsubscribeRef.current?.();
  }, []);

  useEffect(() => {
    const proxy = (data: unknown) => callbackRef.current(data);
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      emitter.off(name, proxy);
      if (unsubscribeRef.current === dispose) {
        unsubscribeRef.current = null;
      }
    };

    emitter.on(name, proxy);
    unsubscribeRef.current = dispose;
    return dispose;
  }, [name]);

  return unsubscribe;
};
