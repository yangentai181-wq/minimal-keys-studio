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
import { useCustomNotification, useCustomSubsystem, useCustomSubsystems } from "../rpc/useCustomSubsystem";
import {
  acceptConfig,
  beginSave,
  createPrecisionState,
  handleApplyResponse,
  disconnectPrecisionState,
  transportError,
  updateDraft as updatePrecisionDraft,
  validateDraft,
  type PrecisionState,
} from "./precision-state";

const SAVE_TIMEOUT_MS = 5000;

export interface TrackballPrecisionContextValue {
  availability: "loading" | "available" | "disconnected" | "firmware-update-required" | "error";
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
  void error;
  return "デバイスとの通信に失敗しました";
}

export function TrackballPrecisionProvider({ children }: { children: React.ReactNode }) {
  const subsystem = useCustomSubsystem(SUBSYSTEM_ID);
  const customSubsystems = useCustomSubsystems();
  const [availability, setAvailability] = useState<TrackballPrecisionContextValue["availability"]>("loading");
  const [state, setState] = useState<PrecisionState>(createPrecisionState);
  const [saving, setSaving] = useState(false);
  const stateRef = useRef(state);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expectedRevisionRef = useRef<number | null>(null);
  const pendingDraftRef = useRef<PrecisionDraft | null>(null);
  const generationRef = useRef(0);

  stateRef.current = state;

  const finishSaving = useCallback((generation?: number) => {
    if (generation !== undefined && generation !== generationRef.current) return;
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    expectedRevisionRef.current = null;
    pendingDraftRef.current = null;
    setSaving((current) => generation !== undefined && generation !== generationRef.current ? current : false);
  }, []);

  const reloadFrom = useCallback(async (activeSubsystem: NonNullable<typeof subsystem>, generation: number) => {
    if (generation !== generationRef.current) return;
    try {
      const response = decodeResponse(await activeSubsystem.callRPC(encodeGet()));
      if (generation !== generationRef.current) return;
      if (!response.get) throw new Error("トラックボール設定の応答が不正です");

      const expectedRevision = expectedRevisionRef.current;
      if (pendingDraftRef.current && expectedRevision !== null) {
        if (!matchesPending(response.get, pendingDraftRef.current, expectedRevision)) return;
        setState((previous) => generation === generationRef.current ? acceptConfig(previous, response.get!) : previous);
        setAvailability("available");
        finishSaving(generation);
        return;
      }
      setState((previous) => generation === generationRef.current ? acceptConfig(previous, response.get!) : previous);
      setAvailability("available");
    } catch (error) {
      if (generation !== generationRef.current) return;
      setState((previous) => generation === generationRef.current ? transportError(previous, errorMessage(error)) : previous);
      setAvailability("error");
      finishSaving(generation);
    }
  }, [finishSaving]);

  const reload = useCallback(async () => {
    if (customSubsystems.status === "error") {
      customSubsystems.retry();
      return;
    }
    if (!subsystem) return;
    setAvailability("loading");
    await reloadFrom(subsystem, generationRef.current);
  }, [customSubsystems, reloadFrom, subsystem]);

  useEffect(() => {
    const generation = ++generationRef.current;
    if (customSubsystems.status === "disconnected") {
      finishSaving();
      setAvailability("disconnected");
      setState((previous) => disconnectPrecisionState(previous));
      return;
    }
    if (customSubsystems.status === "loading") {
      finishSaving();
      setAvailability("loading");
      return;
    }
    if (customSubsystems.status === "error") {
      finishSaving();
      setAvailability("error");
      return;
    }
    if (!subsystem) {
      finishSaving();
      setAvailability("firmware-update-required");
      return;
    }

    let cancelled = false;
    const activeSubsystem = subsystem;
    finishSaving();
    setAvailability("loading");

    async function discover() {
      try {
        const response = decodeResponse(await activeSubsystem.callRPC(encodeGet()));
        if (cancelled || generation !== generationRef.current) return;
        if (!response.get) throw new Error("トラックボール設定の応答が不正です");
        setState((previous) => generation === generationRef.current ? acceptConfig(previous, response.get!) : previous);
        setAvailability((current) => generation === generationRef.current ? "available" : current);
      } catch (error) {
        if (cancelled || generation !== generationRef.current) return;
        setState((previous) => generation === generationRef.current ? transportError(previous, errorMessage(error)) : previous);
        setAvailability((current) => generation === generationRef.current ? "error" : current);
      }
    }

    void discover();
    return () => { cancelled = true; };
  }, [customSubsystems.status, finishSaving, subsystem]);

  useEffect(() => () => {
    if (saveTimeoutRef.current !== null) clearTimeout(saveTimeoutRef.current);
  }, []);

  useCustomNotification(subsystem?.subsystemIndex, (payload) => {
    const generation = generationRef.current;
    try {
      const config = decodeNotification(payload);
      const expectedRevision = expectedRevisionRef.current;
      if (pendingDraftRef.current && expectedRevision !== null) {
        if (!matchesPending(config, pendingDraftRef.current, expectedRevision)) return;
        setState((previous) => generation === generationRef.current ? acceptConfig(previous, config) : previous);
        finishSaving(generation);
        return;
      }
      setState((previous) => generation === generationRef.current ? acceptConfig(previous, config) : previous);
    } catch (error) {
      setState((previous) => generation === generationRef.current ? transportError(previous, errorMessage(error)) : previous);
    }
  });

  const updateDraft = useCallback((patch: Partial<PrecisionDraft>) => {
    setState((previous) => updatePrecisionDraft(previous, patch));
  }, []);

  const save = useCallback(async () => {
    if (!subsystem) return;
    const activeSubsystem = subsystem;
    const generation = generationRef.current;
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
    setState((previous) => generation === generationRef.current ? beginSave(previous) : previous);
    setSaving(true);
    saveTimeoutRef.current = setTimeout(() => {
      if (generation !== generationRef.current) return;
      setState((previous) => generation === generationRef.current ? transportError(previous, "保存の確認がタイムアウトしました") : previous);
      finishSaving(generation);
    }, SAVE_TIMEOUT_MS);

    try {
      const response = decodeResponse(await activeSubsystem.callRPC(encodeApply(draft, expectedRevision)));
      if (generation !== generationRef.current) return;
      if (!response.apply) throw new Error("トラックボール設定の応答が不正です");

      if (response.apply.result === ApplyResult.STALE_REVISION) {
        setState((previous) => generation === generationRef.current ? handleApplyResponse(previous, response.apply!) : previous);
        finishSaving(generation);
        await reloadFrom(activeSubsystem, generation);
        return;
      }
      if (response.apply.result !== ApplyResult.OK) {
        setState((previous) => generation === generationRef.current ? handleApplyResponse(previous, response.apply!) : previous);
        finishSaving(generation);
        return;
      }

      const config = response.apply.config;
      if (config && matchesPending(config, draft, expectedRevision)) {
        setState((previous) => generation === generationRef.current ? handleApplyResponse(previous, response.apply!) : previous);
        finishSaving(generation);
        return;
      }

      await reloadFrom(activeSubsystem, generation);
    } catch (error) {
      if (generation !== generationRef.current) return;
      setState((previous) => generation === generationRef.current ? transportError(previous, errorMessage(error)) : previous);
      finishSaving(generation);
    }
  }, [finishSaving, reloadFrom, subsystem]);

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
