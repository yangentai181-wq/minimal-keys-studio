import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { findGoogleFontReferences } from "./verify-local-fonts.mjs";

const temporaryDirectories: string[] = [];

function temporaryBundle() {
  const directory = mkdtempSync(join(tmpdir(), "minimal-keys-fonts-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("verify-local-fonts", () => {
  it("reports Google font URLs in a production bundle fixture", () => {
    const bundle = temporaryBundle();
    writeFileSync(join(bundle, "app.css"), '@import url("https://fonts.googleapis.com/css2?family=Example");');

    expect(findGoogleFontReferences(bundle)).toEqual([join(bundle, "app.css")]);
  });

  it("fails the build gate for a bundle fixture with a Google font URL", () => {
    const bundle = temporaryBundle();
    writeFileSync(join(bundle, "app.css"), '@import url("https://fonts.gstatic.com/example");');

    expect(() => execFileSync(process.execPath, [resolve(import.meta.dirname, "verify-local-fonts.mjs"), bundle], { stdio: "pipe" })).toThrow();
  });

  it("accepts a bundle fixture without remote font URLs", () => {
    const bundle = temporaryBundle();
    writeFileSync(join(bundle, "app.css"), "body { font-family: system-ui; }");

    expect(findGoogleFontReferences(bundle)).toEqual([]);
  });

  it("runs the scanner after each production build", () => {
    const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"));

    expect(packageJson.scripts.build).toContain("vite build");
    expect(packageJson.scripts.build).toContain("verify:local-fonts");
  });
});
