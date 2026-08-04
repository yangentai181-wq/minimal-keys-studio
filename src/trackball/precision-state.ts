import type { PrecisionDraft, TrackballConfig } from "../proto/trackball-settings";

export type { PrecisionDraft } from "../proto/trackball-settings";

export interface PrecisionState {
  confirmed: TrackballConfig | null;
  draft: PrecisionDraft | null;
  pending: PrecisionDraft | null;
  dirty: boolean;
  error: string | null;
}

export function createPrecisionState(): PrecisionState {
  return { confirmed: null, draft: null, pending: null, dirty: false, error: null };
}

function draftFromConfig(config: TrackballConfig): PrecisionDraft {
  return {
    normalCpi: config.normalCpi,
    precisionCpi: config.precisionCpi,
    enabled: config.enabled,
    selectedPosition: config.selectedPosition,
  };
}

function isDirty(confirmed: TrackballConfig | null, draft: PrecisionDraft | null): boolean {
  if (confirmed === null || draft === null) return false;
  const baseline = draftFromConfig(confirmed);
  return baseline.normalCpi !== draft.normalCpi || baseline.precisionCpi !== draft.precisionCpi ||
    baseline.enabled !== draft.enabled || baseline.selectedPosition !== draft.selectedPosition;
}

export function validateDraft(draft: PrecisionDraft): string | null {
  const validCpi = (cpi: number) => cpi >= 200 && cpi <= 3200 && cpi % 200 === 0;
  if (!validCpi(draft.normalCpi) || !validCpi(draft.precisionCpi)) {
    return "CPI は 200 から 3200 まで、200 刻みで設定してください";
  }
  if (draft.precisionCpi > draft.normalCpi) return "精密 CPI は通常 CPI 以下にしてください";
  return null;
}

export function updateDraft(state: PrecisionState, patch: Partial<PrecisionDraft>): PrecisionState {
  if (state.draft === null) return state;
  const draft = { ...state.draft, ...patch };
  return { ...state, draft, dirty: isDirty(state.confirmed, draft), error: validateDraft(draft) };
}

export function beginSave(state: PrecisionState): PrecisionState {
  return state.draft === null ? state : { ...state, pending: state.draft, error: null };
}

export function acceptConfig(state: PrecisionState, config: TrackballConfig): PrecisionState {
  if (state.confirmed !== null && config.revision < state.confirmed.revision) {
    return { ...state, error: "再読み込みが必要です" };
  }
  const draft = draftFromConfig(config);
  return { confirmed: config, draft, pending: null, dirty: false, error: null };
}

export function transportError(state: PrecisionState, error: string): PrecisionState {
  return { ...state, pending: null, error };
}

export function reconnect(state: PrecisionState): PrecisionState {
  void state;
  return createPrecisionState();
}
