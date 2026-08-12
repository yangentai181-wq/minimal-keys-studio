import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { pngDimensions, verifyBrandAssets } from "./verify-brand-assets.mjs";

const root = resolve(import.meta.dirname, "..");

function fixtureRoot() {
  const fixture = mkdtempSync(join(tmpdir(), "key-studio-brand-assets-"));
  for (const relativePath of ["design/brand", "public/icons", "src-tauri/icons", "src/brand/identity.json"]) {
    cpSync(resolve(root, relativePath), resolve(fixture, relativePath), { recursive: true });
  }
  cpSync(resolve(root, "design/brand/key-studio-icon-assets.json"), resolve(fixture, "design/brand/key-studio-icon-assets.json"));
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

describe("Key Studio icon assets", () => {
  it("keeps every generated asset aligned with the SVG source", () => {
    expect(verifyBrandAssets(root)).toEqual([]);
  });

  it("detects a generated asset that no longer matches the SVG source", () => {
    withFixture((fixture) => {
      const iconPath = resolve(fixture, "src-tauri/icons/icon.ico");
      writeFileSync(iconPath, Buffer.concat([readFileSync(iconPath), Buffer.from("stale")]));

      expect(verifyBrandAssets(fixture)).toContain("Generated asset differs: src-tauri/icons/icon.ico");
    });
  });

  it("checks fixed asset hashes without invoking macOS generators outside macOS", () => {
    withFixture((fixture) => {
      writeFileSync(resolve(fixture, "src-tauri/icons/icon.ico"), "tampered");

      expect(verifyBrandAssets(fixture, { mode: "non-macos" })).toContain(
        "Asset hash mismatch: src-tauri/icons/icon.ico",
      );
    });
  });

  it("detects an SVG source change when its derived assets are not regenerated", () => {
    withFixture((fixture) => {
      const sourcePath = resolve(fixture, "design/brand/key-studio-icon.svg");
      const updatedSource = readFileSync(sourcePath, "utf8").replace('rx="28"/>', 'rx="27"/>');
      writeFileSync(sourcePath, updatedSource);
      writeFileSync(resolve(fixture, "public/icons/key-studio-icon.svg"), updatedSource);

      expect(verifyBrandAssets(fixture)).toContain("Generated asset differs: public/icons/icon-192.png");
    });
  });

  it("detects an invalid ICNS generated asset", () => {
    withFixture((fixture) => {
      writeFileSync(resolve(fixture, "src-tauri/icons/icon.icns"), "not an ICNS file");

      expect(verifyBrandAssets(fixture)).toContain("Generated asset differs: src-tauri/icons/icon.icns");
    });
  });

  it("detects SVG colors that no longer match identity.json", () => {
    withFixture((fixture) => {
      const identityPath = resolve(fixture, "src/brand/identity.json");
      const identity = JSON.parse(readFileSync(identityPath, "utf8"));
      identity.colors.orange = "#000000";
      writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`);

      expect(verifyBrandAssets(fixture)).toContain("SVG must contain identity orange #000000");
    });
  });

  it.each([
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
    ["public/icons/maskable-512.png", 512],
    ["public/icons/apple-touch-icon.png", 180],
    ["src-tauri/icons/icon.png", 1024],
    ["src-tauri/icons/32x32.png", 32],
    ["src-tauri/icons/128x128.png", 128],
    ["src-tauri/icons/128x128@2x.png", 256],
  ])("creates %s at %d px", (relativePath, size) => {
    expect(pngDimensions(resolve(root, relativePath))).toEqual({ width: size, height: size });
  });
});
