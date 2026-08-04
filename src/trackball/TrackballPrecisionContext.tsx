import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ApplyResult,
  decodeNotification,
  decodeResponse,
  encodeApply,
  encodeGet,
  SUBSYSTEM_ID,
  type PrecisionDraft,
  type TrackballConfig,
} from "../proto/trackball-settings";
import { useCustomNotification, useCustomSubsystem } from "../rpc/useCustomSubsystem";
import {
  acceptConfig,
  beginSave,
  createPrecisionState,
  handleApplyResponse,
  reconnect,
  transportError,
  updateDraft as updatePrecisionDraft,
  validateDraft,
  type PrecisionState,
} from "./precision-state";

const SAVE_TIMEOUT_MS = 5000;

export interface TrackballPrecisionContextValue {
  availability: "loading" | "available" | "firmware-update-required";
  confirmed: TrackballConfig | null;
  draft: PrecisionDraft | null;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  updateDraft(patch: Partial<PrecisionDraft>): void;
  save(): Promise<void>;
  reload(): Promise<void>;
}

const TrackballPrecisionContext = createContext<TrackballPrecisionContextValue | null>(null);

function matchesPending(config: TrackballConfig, pending: PrecisionDraft, expectedRevision: number): boolean {
  return config.revision > expectedRevision &&
    config.normalCpi === pending.normalCpi &&
    config.precisionCpi === pending.precisionCpi &&
    config.enabled === pending.enabled &&
    config.selectedPosition === pending.selectedPosition;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "デバイスとの通信に失敗しました";
}

export function TrackballPrecisionProvider({ children }: { children: React.ReactNode }) {
  const subsystem = useCustomSubsystem(SUBSYSTEM_ID);
  const [availability, setAvailability] = useState<TrackballPrecisionContextValue["availability"]>("loading");
  const [state, setState] = useState<PrecisionState>(createPrecisionState);
  const [saving, setSaving] = useState(false);
  const stateRef = useRef(state);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expectedRevisionRef = useRef<number | null>(null);
  const pendingDraftRef = useRef<PrecisionDraft | null>(null);

  stateRef.current = state;

  const finishSaving = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    expectedRevisionRef.current = null;
    pendingDraftRef.current = null;
    setSaving(false);
  }, []);

  const reload = useCallback(async () => {
    if (!subsystem) return;
    try {
      const response = decodeResponse(await subsystem.callRPC(encodeGet()));
      if (!response.get) throw new Error("トラックボール設定の応答が不正です");

      const expectedRevision = expectedRevisionRef.current;
      if (pendingDraftRef.current && expectedRevision !== null) {
        if (!matchesPending(response.get, pendingDraftRef.current, expectedRevision)) return;
        setState((previous) => acceptConfig(previous, response.get!));
        finishSaving();
        return;
      }
      setState((previous) => acceptConfig(previous, response.get!));
    } catch (error) {
      setState((previous) => transportError(previous, errorMessage(error)));
      finishSaving();
    }
  }, [finishSaving, subsystem]);

  useEffect(() => {
    if (!subsystem) {
      finishSaving();
      setAvailability("firmware-update-required");
      setState((previous) => reconnect(previous));
      return;
    }

    let cancelled = false;
    const activeSubsystem = subsystem;
    finishSaving();
    setAvailability("loading");
    setState((previous) => reconnect(previous));

    async function discover() {
      try {
        const response = decodeResponse(await activeSubsystem.callRPC(encodeGet()));
        if (cancelled) return;
        if (!response.get) throw new Error("トラックボール設定の応答が不正です");
        setState((previous) => acceptConfig(previous, response.get!));
        setAvailability("available");
      } catch (error) {
        if (cancelled) return;
        setState((previous) => transportError(previous, errorMessage(error)));
        setAvailability("available");
      }
    }

    void discover();
    return () => { cancelled = true; };
  }, [finishSaving, subsystem]);

  useEffect(() => () => {
    if (saveTimeoutRef.current !== null) clearTimeout(saveTimeoutRef.current);
  }, []);

  useCustomNotification(subsystem?.subsystemIndex, (payload) => {
    try {
      const config = decodeNotification(payload);
      const expectedRevision = expectedRevisionRef.current;
      if (pendingDraftRef.current && expectedRevision !== null) {
        if (!matchesPending(config, pendingDraftRef.current, expectedRevision)) return;
        setState((previous) => acceptConfig(previous, config));
        finishSaving();
        return;
      }
      setState((previous) => acceptConfig(previous, config));
    } catch (error) {
      setState((previous) => transportError(previous, errorMessage(error)));
    }
  });

  const updateDraft = useCallback((patch: Partial<PrecisionDraft>) => {
    setState((previous) => updatePrecisionDraft(previous, patch));
  }, []);

  const save = useCallback(async () => {
    if (!subsystem) return;
    const current = stateRef.current;
    if (!current.draft || !current.confirmed || current.pending) return;

    const validationError = validateDraft(current.draft);
    if (validationError) {
      setState((previous) => ({ ...previous, error: validationError }));
      return;
    }

    const draft = current.draft;
    const expectedRevision = current.confirmed.revision;
    expectedRevisionRef.current = expectedRevision;
    pendingDraftRef.current = draft;
    setState((previous) => beginSave(previous));
    setSaving(true);
    saveTimeoutRef.current = setTimeout(() => {
      setState((previous) => transportError(previous, "保存の確認がタイムアウトしました"));
      finishSaving();
    }, SAVE_TIMEOUT_MS);

    try {
      const response = decodeResponse(await subsystem.callRPC(encodeApply(draft, expectedRevision)));
      if (!response.apply) throw new Error("トラックボール設定の応答が不正です");

      if (response.apply.result === ApplyResult.STALE_REVISION) {
        setState((previous) => handleApplyResponse(previous, response.apply!));
        finishSaving();
        await reload();
        return;
      }
      if (response.apply.result !== ApplyResult.OK) {
        setState((previous) => handleApplyResponse(previous, response.apply!));
        finishSaving();
        return;
      }

      const config = response.apply.config;
      if (config && matchesPending(config, draft, expectedRevision)) {
        setState((previous) => handleApplyResponse(previous, response.apply!));
        finishSaving();
        return;
      }

      await reload();
    } catch (error) {
      setState((previous) => transportError(previous, errorMessage(error)));
      finishSaving();
    }
  }, [finishSaving, reload, subsystem]);

  const value: TrackballPrecisionContextValue = {
    availability,
    confirmed: state.confirmed,
    draft: state.draft,
    dirty: state.dirty,
    saving,
    error: state.error,
    updateDraft,
    save,
    reload,
  };

  return <TrackballPrecisionContext.Provider value={value}>{children}</TrackballPrecisionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTrackballPrecision(): TrackballPrecisionContextValue {
  const value = useContext(TrackballPrecisionContext);
  if (!value) throw new Error("useTrackballPrecision must be used within TrackballPrecisionProvider");
  return value;
}
