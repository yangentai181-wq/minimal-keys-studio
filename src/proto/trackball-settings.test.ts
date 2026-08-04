import { describe, expect, it } from "vitest";
import {
  ApplyResult,
  decodeNotification,
  decodeResponse,
  encodeApply,
  encodeGet,
  encodeValidate,
  SUBSYSTEM_ID,
  type PrecisionDraft,
} from "./trackball-settings";

const draft: PrecisionDraft = {
  normalCpi: 800,
  precisionCpi: 200,
  enabled: true,
  selectedPosition: 5,
};

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const bytes = (hexValue: string) => Uint8Array.from(hexValue.match(/../g)?.map((value) => Number.parseInt(value, 16)) ?? []);

describe("trackball settings protocol", () => {
  it("uses the locked request fixtures", () => {
    expect(hex(encodeGet())).toBe("0a00");
    expect(hex(encodeApply(draft, 7))).toBe("1a0c08a00610c801180120052807");
    expect(hex(encodeApply({ ...draft, enabled: false, selectedPosition: 0 }, 7))).toBe("1a0808a00610c8012807");
  });

  it("encodes validate separately from apply", () => {
    expect(hex(encodeValidate(draft, 7))).toBe("120c08a00610c801180120052807");
  });

  it("decodes get, validate, and apply responses", () => {
    const config = "080110a00618c80120012800320708ac021001180238e707400148c801";
    expect(decodeResponse(bytes(`0a${(config.length / 2).toString(16).padStart(2, "0")}${config}`))).toEqual({
      get: {
        schemaVersion: 1, normalCpi: 800, precisionCpi: 200, enabled: true, selectedPosition: 0,
        originalBinding: { behaviorId: 300, param1: 1, param2: 2 }, revision: 999,
        precisionActive: true, currentCpi: 200,
      },
    });
    const applyResponse = "08001208080110a00618c801";
    expect(decodeResponse(bytes(`12${(applyResponse.length / 2).toString(16).padStart(2, "0")}${applyResponse}`))).toEqual({
      validate: { result: ApplyResult.OK, config: { schemaVersion: 1, normalCpi: 800, precisionCpi: 200, enabled: false, selectedPosition: 0, originalBinding: null, revision: 0, precisionActive: false, currentCpi: 0 } },
    });
    expect(decodeResponse(bytes(`1a${(applyResponse.length / 2).toString(16).padStart(2, "0")}${applyResponse}`))).toEqual({
      apply: { result: ApplyResult.OK, config: { schemaVersion: 1, normalCpi: 800, precisionCpi: 200, enabled: false, selectedPosition: 0, originalBinding: null, revision: 0, precisionActive: false, currentCpi: 0 } },
    });
  });

  it("uses the last known response field when a oneof payload contains multiple fields", () => {
    expect(decodeResponse(bytes("0a0310a0061a06080012020801"))).toEqual({
      apply: {
        result: ApplyResult.OK,
        config: { schemaVersion: 1, normalCpi: 0, precisionCpi: 0, enabled: false, selectedPosition: 0, originalBinding: null, revision: 0, precisionActive: false, currentCpi: 0 },
      },
    });
  });

  it("preserves explicit false and zero-valued selected position", () => {
    const config = "20002800";
    expect(decodeResponse(bytes(`0a04${config}`))).toEqual({
      get: { schemaVersion: 0, normalCpi: 0, precisionCpi: 0, enabled: false, selectedPosition: 0, originalBinding: null, revision: 0, precisionActive: false, currentCpi: 0 },
    });
  });

  it("skips unknown fields", () => {
    expect(decodeResponse(bytes("0a0710a0069806b009"))).toEqual({
      get: { schemaVersion: 0, normalCpi: 800, precisionCpi: 0, enabled: false, selectedPosition: 0, originalBinding: null, revision: 0, precisionActive: false, currentCpi: 0 },
    });
  });

  it("rejects truncated and malformed payloads", () => {
    expect(() => decodeResponse(bytes("0a05"))).toThrow();
    expect(() => decodeResponse(bytes("0a0180"))).toThrow();
  });

  it("decodes changed notifications", () => {
    expect(decodeNotification(bytes("0a0b10a00618c801380148c801"))).toEqual({
      schemaVersion: 0, normalCpi: 800, precisionCpi: 200, enabled: false, selectedPosition: 0,
      originalBinding: null, revision: 1, precisionActive: false, currentCpi: 200,
    });
  });

  it("exports the registered subsystem id", () => {
    expect(SUBSYSTEM_ID).toBe("trackball_settings");
  });
});
