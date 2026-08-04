import { ApplyResult, type ApplyResponse, type PrecisionDraft, type TrackballConfig } from "../proto/trackball-settings";

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
  if (state.confirmed !== null && state.dirty && config.revision === state.confirmed.revision) {
    return updateConfirmedKeepingDraft(state, config, state.error, state.pending);
  }
  const draft = draftFromConfig(config);
  return { confirmed: config, draft, pending: null, dirty: false, error: null };
}

function updateConfirmedKeepingDraft(
  state: PrecisionState,
  config: TrackballConfig,
  error: string | null,
  pending: PrecisionDraft | null,
): PrecisionState {
  if (state.confirmed !== null && config.revision < state.confirmed.revision) {
    return { ...state, pending, error };
  }
  const draft = state.draft ?? draftFromConfig(config);
  return { confirmed: config, draft, pending, dirty: isDirty(config, draft), error };
}

function matchesDraft(config: TrackballConfig, draft: PrecisionDraft): boolean {
  return config.normalCpi === draft.normalCpi && config.precisionCpi === draft.precisionCpi &&
    config.enabled === draft.enabled && config.selectedPosition === draft.selectedPosition;
}

export function handleApplyResponse(state: PrecisionState, response: ApplyResponse): PrecisionState {
  if (response.result !== ApplyResult.OK) return { ...state, pending: null, error: applyErrorMessage(response.result) };
  if (response.config === null) return state;
  if (state.pending !== null && matchesDraft(response.config, state.pending)) {
    return acceptConfig(state, response.config);
  }
  if (state.dirty) return updateConfirmedKeepingDraft(state, response.config, state.error, state.pending);
  return acceptConfig(state, response.config);
}

function applyErrorMessage(result: ApplyResult): string {
  switch (result) {
    case ApplyResult.INVALID_CPI: return "CPI の設定値が正しくありません";
    case ApplyResult.INVALID_POSITION: return "選択したキーは使用できません";
    case ApplyResult.UNSUPPORTED_BINDING: return "このキーの動作は精密モードに対応していません";
    case ApplyResult.STALE_REVISION: return "再読み込みが必要です";
    case ApplyResult.KEYMAP_WRITE_FAILED: return "キーマップの保存に失敗しました";
    case ApplyResult.SETTINGS_WRITE_FAILED: return "設定の保存に失敗しました";
    case ApplyResult.SENSOR_WRITE_FAILED: return "トラックボール設定の反映に失敗しました";
    default: return "不明なエラーが発生しました";
  }
}

export function transportError(state: PrecisionState, error: string): PrecisionState {
  return { ...state, pending: null, error };
}

export function reconnect(state: PrecisionState): PrecisionState {
  void state;
  return createPrecisionState();
}
