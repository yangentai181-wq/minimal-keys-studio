import { describe, expect, it } from "vitest";

import { ERROR_MESSAGES } from "./errorMessages";

const expectedOperations = [
  "keyboard.setBinding",
  "keyboard.undoBinding",
  "trackball.discover",
  "trackball.apply",
  "trackball.reset",
  "trackball.scrollFirmwareRequired",
  "trackball.layerUnavailable",
  "encoder.discover",
  "encoder.loadBindings",
  "encoder.setClockwiseBinding",
  "encoder.setCounterClockwiseBinding",
  "encoder.save",
  "bluetooth.loadInfo",
  "bluetooth.refreshProfiles",
  "bluetooth.switchProfile",
  "bluetooth.unpairProfile",
  "bluetooth.setProfileName",
  "bluetooth.setOutputPriority",
  "device.loadSettings",
  "device.applySettings",
  "device.syncSettings",
  "holdTap.discover",
  "holdTap.save",
  "holdTap.reset",
  "combo.firmwareRequired",
  "combo.readbackMismatch",
] as const;

const explanatoryOperations = new Set([
  "trackball.scrollFirmwareRequired",
  "trackball.layerUnavailable",
  "combo.firmwareRequired",
  "combo.readbackMismatch",
]);

describe("ERROR_MESSAGES", () => {
  it("provides Japanese recovery guidance for all 26 audited operations", () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual([...expectedOperations].sort());

    for (const operation of expectedOperations) {
      const message = ERROR_MESSAGES[operation];
      expect(message).toMatch(/[ぁ-んァ-ヶ一-龠]/);
      if (!explanatoryOperations.has(operation)) {
        expect(message).toMatch(/もう一度|確認/);
      }
      expect(message).not.toMatch(/failed|error|RPC/i);
    }
  });
});
