import { describe, expect, it } from "vitest";
import identity from "./identity.json";

describe("Key Studio identity", () => {
  it("locks the approved user-facing copy and colors", () => {
    expect(identity).toMatchObject({
      productName: "Key Studio",
      description: "プロ向けキーボード設定・モニタリングツール",
      supportedDeviceCopy: "現在はminimal-keysに対応",
      iconPath: "icons/key-studio-icon.svg",
      colors: { orange: "#F97316", teal: "#0D9488" },
    });
  });

  it("locks identifiers that the rebrand must not migrate", () => {
    expect(identity.compatibility).toEqual({
      bundleIdentifier: "com.hyhy-masa.minimal-keys-customize",
      mainBinaryName: "minimal-keys-customize",
      npmPackageName: "minimal-keys-studio",
      viteBasePath: "/minimal-keys-studio/",
      keymapFormat: "minimal-keys-studio-keymap",
      deviceName: "minimal-keys",
    });
  });
});
