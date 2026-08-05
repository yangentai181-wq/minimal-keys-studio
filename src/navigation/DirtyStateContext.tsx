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

import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

type DirtyRegistration = {
  dirty: boolean;
  save: () => Promise<void>;
  discard: () => Promise<void>;
};
type NavigationAction = () => void | Promise<void>;

type DirtyNavigation = {
  requestNavigation(action: NavigationAction): Promise<boolean>;
  confirmSave(): Promise<void>;
  confirmDiscard(): Promise<void>;
  cancelNavigation(): void;
  register(id: string, registration: DirtyRegistration): () => void;
};

const DirtyStateContext = createContext<DirtyNavigation | null>(null);

export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const registrations = useRef(new Map<string, DirtyRegistration>());
  const [pending, setPending] = useState<{
    action: NavigationAction;
    resolve: (allowed: boolean) => void;
  } | null>(null);
  const pendingRef = useRef<typeof pending>(null);
  const [busy, setBusy] = useState(false);

  const complete = useCallback(async (operation: "save" | "discard") => {
    const currentPending = pendingRef.current;
    if (!currentPending || busy) return;
    setBusy(true);
    try {
      const dirty = [...registrations.current.values()].filter((entry) => entry.dirty);
      await Promise.all(dirty.map((entry) => entry[operation]()));
      await currentPending.action();
      currentPending.resolve(true);
      pendingRef.current = null;
      setPending(null);
    } catch {
      currentPending.resolve(false);
      pendingRef.current = null;
      setPending(null);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const requestNavigation = useCallback((action: NavigationAction) => {
    const dirty = [...registrations.current.values()].some((entry) => entry.dirty);
    if (!dirty) {
      return Promise.resolve(action()).then(() => true);
    }
    return new Promise<boolean>((resolve) => {
      const next = { action, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const cancelNavigation = useCallback(() => {
    const currentPending = pendingRef.current;
    if (!currentPending || busy) return;
    currentPending.resolve(false);
    pendingRef.current = null;
    setPending(null);
  }, [busy]);

  const register = useCallback((id: string, registration: DirtyRegistration) => {
    registrations.current.set(id, registration);
    return () => registrations.current.delete(id);
  }, []);

  const value: DirtyNavigation = {
    requestNavigation,
    confirmSave: () => complete("save"),
    confirmDiscard: () => complete("discard"),
    cancelNavigation,
    register,
  };

  return (
    <DirtyStateContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={pending !== null}
        busy={busy}
        onSave={() => void complete("save")}
        onDiscard={() => void complete("discard")}
        onCancel={cancelNavigation}
      />
    </DirtyStateContext.Provider>
  );
}

export function useDirtyNavigation(): DirtyNavigation {
  const context = useContext(DirtyStateContext);
  if (!context) throw new Error("DirtyStateProvider が必要です");
  return context;
}

export function useDirtyRegistration(id: string, registration: DirtyRegistration): void {
  const context = useContext(DirtyStateContext);
  useEffect(() => {
    return context?.register(id, registration);
  }, [context, id, registration]);
}
