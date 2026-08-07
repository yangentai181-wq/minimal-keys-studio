/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";

type MonitorKeymapContextValue = {
  keymap: Keymap | undefined;
  publish: (keymap: Keymap | undefined) => () => void;
};

const MonitorKeymapContext = createContext<MonitorKeymapContextValue | undefined>(
  undefined,
);

export function MonitorKeymapProvider({ children }: { children: ReactNode }) {
  const [keymap, setKeymap] = useState<Keymap | undefined>(undefined);
  const publicationRef = useRef(0);
  const publish = useCallback((nextKeymap: Keymap | undefined) => {
    const publication = ++publicationRef.current;
    setKeymap(nextKeymap);

    return () => {
      if (publication === publicationRef.current) {
        setKeymap(undefined);
      }
    };
  }, []);

  return (
    <MonitorKeymapContext.Provider value={{ keymap, publish }}>
      {children}
    </MonitorKeymapContext.Provider>
  );
}

function useMonitorKeymapContext(): MonitorKeymapContextValue {
  const value = useContext(MonitorKeymapContext);
  if (!value) {
    throw new Error("MonitorKeymapProvider is required");
  }
  return value;
}

export function useMonitorKeymap(): Keymap | undefined {
  return useMonitorKeymapContext().keymap;
}

export function usePublishMonitorKeymap(keymap: Keymap | undefined): void {
  const { publish } = useMonitorKeymapContext();
  useEffect(() => publish(keymap), [keymap, publish]);
}
