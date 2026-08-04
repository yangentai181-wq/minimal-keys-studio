import { describe, expect, it } from "vitest";
import type { TrackballConfig } from "../proto/trackball-settings";
import {
  acceptConfig,
  beginSave,
  createPrecisionState,
  reconnect,
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

  it("discards browser-only draft state on reconnect", () => {
    const state = beginSave(updateDraft(acceptConfig(createPrecisionState(), config()), { normalCpi: 1000 }));
    expect(state.pending).toEqual(state.draft);
    expect(reconnect(state)).toEqual({ confirmed: null, draft: null, pending: null, dirty: false, error: null });
  });

  it("accepts matching and newer revisions but rejects stale revisions", () => {
    const initial = acceptConfig(createPrecisionState(), config(3));
    expect(acceptConfig(initial, config(3)).confirmed?.revision).toBe(3);
    expect(acceptConfig(initial, config(4)).confirmed?.revision).toBe(4);
    const stale = acceptConfig(initial, config(2));
    expect(stale.confirmed?.revision).toBe(3);
    expect(stale.error).toBe("再読み込みが必要です");
  });
});
