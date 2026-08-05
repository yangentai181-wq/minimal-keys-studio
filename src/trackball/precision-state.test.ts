import { describe, expect, it } from "vitest";
import { ApplyResult, type ApplyResponse, type TrackballConfig } from "../proto/trackball-settings";
import {
  acceptConfig,
  beginSave,
  createPrecisionState,
  disconnectPrecisionState,
  handleApplyResponse,
  transportError,
  updateDraft,
  validateDraft,
} from "./precision-state";

const config = (revision = 1): TrackballConfig => ({
  schemaVersion: 1, normalCpi: 800, precisionCpi: 200, enabled: true, selectedPosition: 0,
  originalBinding: null, revision, precisionActive: false, currentCpi: 800,
});

describe("precision state", () => {
  it("keeps confirmed and draft values separate and derives dirty state", () => {
    const initial = acceptConfig(createPrecisionState(), config());
    const next = updateDraft(initial, { normalCpi: 1000 });
    expect(next.confirmed?.normalCpi).toBe(800);
    expect(next.draft?.normalCpi).toBe(1000);
    expect(next.dirty).toBe(true);
    expect(updateDraft(next, { normalCpi: 800 }).dirty).toBe(false);
  });

  it("validates CPI range, step, and ordering", () => {
    expect(validateDraft({ normalCpi: 800, precisionCpi: 200, enabled: false, selectedPosition: 0 })).toBeNull();
    expect(validateDraft({ normalCpi: 799, precisionCpi: 200, enabled: false, selectedPosition: 0 })).toContain("200");
    expect(validateDraft({ normalCpi: 3400, precisionCpi: 200, enabled: false, selectedPosition: 0 })).toContain("3200");
    expect(validateDraft({ normalCpi: 800, precisionCpi: 1000, enabled: false, selectedPosition: 0 })).toContain("精密");
  });

  it("preserves confirmed values when transport fails", () => {
    const state = updateDraft(acceptConfig(createPrecisionState(), config()), { normalCpi: 1000 });
    const next = transportError(state, "接続が切れました");
    expect(next.confirmed).toEqual(config());
    expect(next.draft).toEqual(state.draft);
    expect(next.error).toBe("接続が切れました");
  });

  it("preserves confirmed values and a dirty draft when disconnected during save", () => {
    const state = beginSave(updateDraft(acceptConfig(createPrecisionState(), config()), { normalCpi: 1000 }));
    expect(state.pending).toEqual(state.draft);
    expect(disconnectPrecisionState(state)).toEqual({
      confirmed: config(),
      draft: { normalCpi: 1000, precisionCpi: 200, enabled: true, selectedPosition: 0 },
      pending: null,
      dirty: true,
      error: null,
    });
  });

  it("accepts matching and newer revisions but rejects stale revisions", () => {
    const initial = acceptConfig(createPrecisionState(), config(3));
    expect(acceptConfig(initial, config(3)).confirmed?.revision).toBe(3);
    expect(acceptConfig(initial, config(4)).confirmed?.revision).toBe(4);
    const stale = acceptConfig(initial, config(2));
    expect(stale.confirmed?.revision).toBe(3);
    expect(stale.error).toBe("再読み込みが必要です");
  });

  it("keeps a dirty draft when a same-revision changed notification updates live state", () => {
    const state = updateDraft(acceptConfig(createPrecisionState(), config()), { normalCpi: 1000 });
    const changed = { ...config(), precisionActive: true, currentCpi: 200 };
    const next = acceptConfig(state, changed);
    expect(next.confirmed).toEqual(changed);
    expect(next.draft?.normalCpi).toBe(1000);
    expect(next.dirty).toBe(true);
    expect(next.pending).toBeNull();
  });

  it("keeps a dirty draft when a newer device revision arrives", () => {
    const dirty = updateDraft(acceptConfig(createPrecisionState(), config(4)), { normalCpi: 1000 });
    const next = acceptConfig(dirty, config(5));
    expect(next.draft?.normalCpi).toBe(1000);
    expect(next.confirmed?.revision).toBe(5);
    expect(next.dirty).toBe(true);
  });

  it("only confirms a pending draft from a matching successful apply response", () => {
    const state = beginSave(updateDraft(acceptConfig(createPrecisionState(), config()), { normalCpi: 1000 }));
    const response: ApplyResponse = { result: ApplyResult.OK, config: { ...config(2), normalCpi: 1000 } };
    const next = handleApplyResponse(state, response);
    expect(next.confirmed).toEqual(response.config);
    expect(next.draft).toEqual({ normalCpi: 1000, precisionCpi: 200, enabled: true, selectedPosition: 0 });
    expect(next.pending).toBeNull();
    expect(next.dirty).toBe(false);
  });

  it("maps stale apply responses without confirming the draft", () => {
    const state = beginSave(updateDraft(acceptConfig(createPrecisionState(), config()), { normalCpi: 1000 }));
    const response: ApplyResponse = { result: ApplyResult.STALE_REVISION, config: { ...config(2), normalCpi: 1200 } };
    const next = handleApplyResponse(state, response);
    expect(next.confirmed).toEqual(response.config);
    expect(next.draft?.normalCpi).toBe(1000);
    expect(next.pending).toBeNull();
    expect(next.dirty).toBe(true);
    expect(next.error).toBe("再読み込みが必要です");
  });

  it("accepts same-revision stale readback live state without replacing the draft", () => {
    const state = beginSave(updateDraft(acceptConfig(createPrecisionState(), config()), { normalCpi: 1000 }));
    const readback = { ...config(), precisionActive: true, currentCpi: 200 };
    const next = handleApplyResponse(state, { result: ApplyResult.STALE_REVISION, config: readback });
    expect(next.confirmed).toEqual(readback);
    expect(next.draft?.normalCpi).toBe(1000);
    expect(next.pending).toBeNull();
    expect(next.dirty).toBe(true);
    expect(next.error).toBe("再読み込みが必要です");
  });

  it("keeps confirmed state when a stale apply response carries an older config", () => {
    const state = beginSave(updateDraft(acceptConfig(createPrecisionState(), config(3)), { normalCpi: 1000 }));
    const next = handleApplyResponse(state, { result: ApplyResult.STALE_REVISION, config: config(2) });
    expect(next.confirmed).toEqual(config(3));
    expect(next.draft?.normalCpi).toBe(1000);
    expect(next.pending).toBeNull();
    expect(next.dirty).toBe(true);
    expect(next.error).toBe("再読み込みが必要です");
  });

  it.each([
    [ApplyResult.INVALID_CPI, "CPI の設定値が正しくありません"],
    [ApplyResult.INVALID_POSITION, "選択したキーは使用できません"],
    [ApplyResult.UNSUPPORTED_BINDING, "このキーの動作は精密モードに対応していません"],
    [ApplyResult.KEYMAP_WRITE_FAILED, "キーマップの保存に失敗しました"],
    [ApplyResult.SETTINGS_WRITE_FAILED, "設定の保存に失敗しました"],
    [ApplyResult.SENSOR_WRITE_FAILED, "トラックボール設定の反映に失敗しました"],
    [99 as ApplyResult, "不明なエラーが発生しました"],
  ])("clears pending and preserves state for apply failure %i", (result, error) => {
    const state = beginSave(updateDraft(acceptConfig(createPrecisionState(), config()), { normalCpi: 1000 }));
    const next = handleApplyResponse(state, { result, config: { ...config(2), normalCpi: 1200 } });
    expect(next.confirmed).toEqual(config());
    expect(next.draft?.normalCpi).toBe(1000);
    expect(next.pending).toBeNull();
    expect(next.dirty).toBe(true);
    expect(next.error).toBe(error);
  });
});
