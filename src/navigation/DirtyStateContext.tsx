/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

export interface DirtyRegistration {
  dirty: boolean;
  save: () => Promise<boolean>;
  discard: () => Promise<boolean>;
  snapshot?: () => unknown;
  restore?: (snapshot: unknown) => void;
}

type RegistrationGetter = () => DirtyRegistration;
type NavigationAction = () => void | Promise<void>;

type DirtyNavigation = {
  requestNavigation(action: NavigationAction): Promise<boolean>;
  confirmSave(): Promise<void>;
  confirmDiscard(): Promise<void>;
  cancelNavigation(): void;
  register(id: string, getRegistration: RegistrationGetter): () => void;
  preserveDirtyDrafts(): void;
};

const DirtyStateContext = createContext<DirtyNavigation | null>(null);

export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const registrations = useRef(new Map<string, RegistrationGetter>());
  const preserved = useRef(new Map<string, unknown>());
  const [restoredNotice, setRestoredNotice] = useState(false);
  const [pending, setPending] = useState<{
    action: NavigationAction;
    resolve: (allowed: boolean) => void;
  } | null>(null);
  const pendingRef = useRef<typeof pending>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const complete = useCallback(async (operation: "save" | "discard") => {
    const currentPending = pendingRef.current;
    if (!currentPending || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const dirty = [...registrations.current.values()]
        .map((getRegistration) => getRegistration())
        .filter((entry) => entry.dirty);
      const results = await Promise.all(dirty.map((entry) => entry[operation]()));
      if (results.some((result) => !result)) throw new Error("変更を確定できませんでした");
      await currentPending.action();
      currentPending.resolve(true);
      pendingRef.current = null;
      setPending(null);
    } catch {
      currentPending.resolve(false);
      pendingRef.current = null;
      setPending(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const requestNavigation = useCallback((action: NavigationAction) => {
    const dirty = [...registrations.current.values()].some(
      (getRegistration) => getRegistration().dirty,
    );
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
    if (!currentPending || busyRef.current) return;
    currentPending.resolve(false);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const register = useCallback((id: string, getRegistration: RegistrationGetter) => {
    registrations.current.set(id, getRegistration);
    if (preserved.current.has(id)) {
      const snapshot = preserved.current.get(id);
      const registration = getRegistration();
      if (registration.restore) {
        registration.restore(snapshot);
        preserved.current.delete(id);
        setRestoredNotice(true);
      }
    }
    return () => {
      if (registrations.current.get(id) === getRegistration) {
        registrations.current.delete(id);
      }
    };
  }, []);

  const preserveDirtyDrafts = useCallback(() => {
    for (const [id, getRegistration] of registrations.current) {
      const registration = getRegistration();
      if (registration.dirty && registration.snapshot) preserved.current.set(id, registration.snapshot());
    }
  }, []);

  const confirmSave = useCallback(() => complete("save"), [complete]);
  const confirmDiscard = useCallback(() => complete("discard"), [complete]);
  const value = useMemo<DirtyNavigation>(() => ({
    requestNavigation,
    confirmSave,
    confirmDiscard,
    cancelNavigation,
    register,
    preserveDirtyDrafts,
  }), [cancelNavigation, confirmDiscard, confirmSave, preserveDirtyDrafts, register, requestNavigation]);

  return (
    <DirtyStateContext.Provider value={value}>
      {children}
      {restoredNotice && <p role="status" className="fixed bottom-4 right-4 z-50 rounded bg-info px-3 py-2 text-sm text-info-content">未保存の変更を復元しました</p>}
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
  const latest = useRef(registration);
  latest.current = registration;

  useEffect(() => {
    if (!context) return;
    return context.register(id, () => latest.current);
  }, [context, id]);
}
