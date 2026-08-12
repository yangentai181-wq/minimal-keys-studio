import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { findBrandContractViolations } from "./verify-brand-contract.mjs";

const repoRoot = resolve(import.meta.dirname, "..");

function fixtureRoot() {
  const fixture = mkdtempSync(join(tmpdir(), "key-studio-brand-contract-"));
  for (const relativePath of [
    "src/brand/identity.json",
    "package.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "public/manifest.webmanifest",
    "vite.config.ts",
    "src/keyboard/keymap-io.ts",
    "src/keyboard/KeyboardWorkspace.stories.tsx",
    "src/AppHeader.tsx",
    "src/ConnectModal.tsx",
    "src/UnifiedStudioPreview.tsx",
    "index.html",
    "NOTICE",
    "README.md",
    ".github/workflows/release.yml",
  ]) cpSync(resolve(repoRoot, relativePath), resolve(fixture, relativePath));
  return fixture;
}

function withFixture(assertion: (fixture: string) => void) {
  const fixture = fixtureRoot();
  try {
    assertion(fixture);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe("Key Studio repository brand contract", () => {
  it("matches user-facing metadata and preserves compatibility identifiers", () => {
    expect(findBrandContractViolations(repoRoot)).toEqual([]);
  });

  it("runs brand verification after the production bundle is built", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    expect(packageJson.name).toBe("minimal-keys-studio");
    expect(packageJson.scripts.build).toContain("verify:brand");
  });

  it("rejects coordinated changes to compatibility contracts and device name", () => {
    withFixture((fixture) => {
      const identityPath = join(fixture, "src/brand/identity.json");
      const identity = JSON.parse(readFileSync(identityPath, "utf8"));
      identity.compatibility.bundleIdentifier = "com.example.changed";
      identity.compatibility.mainBinaryName = "changed-binary";
      identity.compatibility.npmPackageName = "changed-package";
      identity.compatibility.viteBasePath = "/changed/";
      identity.compatibility.keymapFormat = "changed-keymap";
      identity.compatibility.deviceName = "changed-device";
      writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`);
      writeFileSync(join(fixture, "package.json"), readFileSync(join(fixture, "package.json"), "utf8").replace("minimal-keys-studio", "changed-package"));
      writeFileSync(join(fixture, "src-tauri/tauri.conf.json"), readFileSync(join(fixture, "src-tauri/tauri.conf.json"), "utf8").replace("com.hyhy-masa.minimal-keys-customize", "com.example.changed").replace("minimal-keys-customize", "changed-binary"));
      writeFileSync(join(fixture, "vite.config.ts"), readFileSync(join(fixture, "vite.config.ts"), "utf8").replace("/minimal-keys-studio/", "/changed/"));
      writeFileSync(join(fixture, "src/keyboard/keymap-io.ts"), readFileSync(join(fixture, "src/keyboard/keymap-io.ts"), "utf8").replaceAll("minimal-keys-studio-keymap", "changed-keymap"));

      expect(findBrandContractViolations(fixture)).toContain("Bundle identifier: expected com.hyhy-masa.minimal-keys-customize, received com.example.changed");
      expect(findBrandContractViolations(fixture)).toContain("Device name: expected minimal-keys, received changed-device");
    });
  });

  it("requires both keymap serialization and deserialization compatibility guards", () => {
    withFixture((fixture) => {
      const keymapPath = join(fixture, "src/keyboard/keymap-io.ts");
      writeFileSync(keymapPath, readFileSync(keymapPath, "utf8").replace('format: "minimal-keys-studio-keymap",', "format: \"removed\","));

      expect(findBrandContractViolations(fixture)).toContain("Keymap export format: missing serializer literal");
    });
  });

  it.each([
    ["bundle identifier", "bundleIdentifier", "com.example.changed", "Identity compatibility bundleIdentifier: expected com.hyhy-masa.minimal-keys-customize, received com.example.changed"],
    ["main binary", "mainBinaryName", "changed-binary", "Identity compatibility mainBinaryName: expected minimal-keys-customize, received changed-binary"],
    ["npm package", "npmPackageName", "changed-package", "Identity compatibility npmPackageName: expected minimal-keys-studio, received changed-package"],
    ["Vite base", "viteBasePath", "/changed/", "Identity compatibility viteBasePath: expected /minimal-keys-studio/, received /changed/"],
    ["keymap format", "keymapFormat", "changed-keymap", "Identity compatibility keymapFormat: expected minimal-keys-studio-keymap, received changed-keymap"],
    ["device name", "deviceName", "changed-device", "Device name: expected minimal-keys, received changed-device"],
  ])("rejects an identity %s mutation", (_name, key, value, expectedViolation) => {
    withFixture((fixture) => {
      const identityPath = join(fixture, "src/brand/identity.json");
      const identity = JSON.parse(readFileSync(identityPath, "utf8"));
      identity.compatibility[key] = value;
      writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`);

      expect(findBrandContractViolations(fixture)).toContain(expectedViolation);
    });
  });

  it.each([
    ["Tauri binary", "src-tauri/tauri.conf.json", "minimal-keys-customize", "changed-binary", "Main binary name: expected minimal-keys-customize, received changed-binary"],
    ["npm package", "package.json", "minimal-keys-studio", "changed-package", "npm package name: expected minimal-keys-studio, received changed-package"],
    ["Vite base", "vite.config.ts", "/minimal-keys-studio/", "/changed/", "Vite base path: missing base: isTauri ? \"/\" : \"/minimal-keys-studio/\""],
  ])("rejects a protected %s consumer mutation", (_name, relativePath, from, to, expectedViolation) => {
    withFixture((fixture) => {
      const path = join(fixture, relativePath);
      writeFileSync(path, readFileSync(path, "utf8").replace(from, to));

      expect(findBrandContractViolations(fixture)).toContain(expectedViolation);
    });
  });

  it("rejects each keymap compatibility direction independently", () => {
    withFixture((fixture) => {
      const keymapPath = join(fixture, "src/keyboard/keymap-io.ts");
      writeFileSync(keymapPath, readFileSync(keymapPath, "utf8").replace('format: "minimal-keys-studio-keymap",', 'format: "changed-keymap",'));
      expect(findBrandContractViolations(fixture)).toContain("Keymap export format: missing serializer literal");
    });
    withFixture((fixture) => {
      const keymapPath = join(fixture, "src/keyboard/keymap-io.ts");
      writeFileSync(keymapPath, readFileSync(keymapPath, "utf8").replace('file.format !== "minimal-keys-studio-keymap"', 'file.format !== "changed-keymap"'));
      expect(findBrandContractViolations(fixture)).toContain("Keymap export format: missing deserializer guard literal");
    });
  });

  it("requires the active device display to bind to identity compatibility", () => {
    withFixture((fixture) => {
      const previewPath = join(fixture, "src/UnifiedStudioPreview.tsx");
      writeFileSync(previewPath, readFileSync(previewPath, "utf8").replace("deviceName={identity.compatibility.deviceName}", 'deviceName="minimal-keys"'));

      expect(findBrandContractViolations(fixture)).toContain("Device name consumer binding: missing deviceName={identity.compatibility.deviceName}");
    });
  });

  it("rejects stale metadata and active story display names", () => {
    withFixture((fixture) => {
      const indexPath = join(fixture, "index.html");
      writeFileSync(indexPath, readFileSync(indexPath, "utf8")
        .replace('name="application-name" content="Key Studio"', 'name="application-name" content="Wrong Studio"')
        .replace('name="apple-mobile-web-app-title" content="Key Studio"', 'name="apple-mobile-web-app-title" content="Wrong Studio"')
        .replace('name="description" content="プロ向けキーボード設定・モニタリングツール。現在はminimal-keysに対応。"', 'name="description" content="Wrong description"')
        .replace("<title>Key Studio</title>", "<title>Wrong Studio</title>")
        .replace('href="icons/key-studio-icon.svg"', 'href="icons/wrong.svg"'));
      const manifestPath = join(fixture, "public/manifest.webmanifest");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.name = "Wrong Studio";
      manifest.short_name = "Wrong Studio";
      manifest.description = "Wrong description";
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      const tauriPath = join(fixture, "src-tauri/tauri.conf.json");
      const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
      tauri.productName = "Wrong Studio";
      tauri.app.windows[0].title = "Wrong Studio";
      tauri.bundle.shortDescription = "Wrong description";
      tauri.bundle.longDescription = "Wrong description";
      writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);
      writeFileSync(join(fixture, "src-tauri/Cargo.toml"), readFileSync(join(fixture, "src-tauri/Cargo.toml"), "utf8").replace("Key Studio desktop keyboard configuration and monitoring app.", "Wrong description"));
      writeFileSync(join(fixture, "src/keyboard/KeyboardWorkspace.stories.tsx"), readFileSync(join(fixture, "src/keyboard/KeyboardWorkspace.stories.tsx"), "utf8").replace("Key Studio", "minimal-keys カスタマイズ"));

      const violations = findBrandContractViolations(fixture);
      expect(violations).toContain("HTML application name: expected Key Studio, received Wrong Studio");
      expect(violations).toContain("HTML Apple title: expected Key Studio, received Wrong Studio");
      expect(violations).toContain("HTML description: expected プロ向けキーボード設定・モニタリングツール。現在はminimal-keysに対応。, received Wrong description");
      expect(violations).toContain("HTML title: missing <title>Key Studio</title>");
      expect(violations).toContain("HTML favicon: missing href=\"icons/key-studio-icon.svg\"");
      expect(violations).toContain("PWA name: expected Key Studio, received Wrong Studio");
      expect(violations).toContain("PWA short name: expected Key Studio, received Wrong Studio");
      expect(violations).toContain("PWA description: expected プロ向けキーボード設定・モニタリングツール。現在はminimal-keysに対応。, received Wrong description");
      expect(violations).toContain("Tauri productName: expected Key Studio, received Wrong Studio");
      expect(violations).toContain("Tauri window title: expected Key Studio, received Wrong Studio");
      expect(violations).toContain("Tauri short description: expected プロ向けキーボード設定・モニタリングツール, received Wrong description");
      expect(violations).toContain("Tauri long description: expected Key Studioはキーボード設定とリアルタイムモニタリングを統合します。現在はminimal-keysに対応しています。, received Wrong description");
      expect(violations).toContain("Cargo description: expected Key Studio desktop keyboard configuration and monitoring app., received Wrong description");
      expect(violations).toContain("src/keyboard/KeyboardWorkspace.stories.tsx: contains legacy primary brand minimal-keys カスタマイズ");
    });
  });
});
