import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pngDimensions, verifyBrandAssets } from "./verify-brand-assets.mjs";

const root = resolve(import.meta.dirname, "..");

describe("Key Studio icon assets", () => {
  it("keeps every generated asset aligned with the SVG source", () => {
    expect(verifyBrandAssets(root)).toEqual([]);
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
