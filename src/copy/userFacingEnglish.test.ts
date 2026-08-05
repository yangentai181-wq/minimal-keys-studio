import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const userFacingSources = [
  "src/keyboard/Keyboard.tsx",
  "src/trackball/TrackballSettings.tsx",
  "src/encoder/EncoderSettings.tsx",
  "src/bluetooth/BleManagement.tsx",
  "src/settings/DeviceSettings.tsx",
  "src/holdtap/HoldTapSettings.tsx",
  "src/rpc/rpcCall.ts",
  "src/ConnectModal.tsx",
  "src/App.tsx",
];

describe("user-facing failure copy", () => {
  it("does not pass English failure text or raw caught errors to toasts", () => {
    for (const source of userFacingSources) {
      const contents = readFileSync(resolve(process.cwd(), source), "utf8");
      expect(contents).not.toMatch(/toast\(\s*[`'"][^`'"]*\bfailed\b/i);
      expect(contents).not.toMatch(/toast\(\s*(?:e|error|message)\b/);
      expect(contents).not.toMatch(/return error\.message/);
    }
  });
});
