import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const forbiddenRemoteFonts = /fonts\.(?:googleapis|gstatic)\.com/i;

function filesRecursively(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesRecursively(path);
    return [path];
  });
}

function filesWithGoogleFontReferences(files: string[]): string[] {
  return files.filter((file) => forbiddenRemoteFonts.test(readFileSync(file, "utf8")));
}

describe("local typography", () => {
  it("does not request fonts from Google in production sources or Tailwind configuration", () => {
    const sourceFiles = [
      join(projectRoot, "src/index.css"),
      join(projectRoot, "tailwind.config.js"),
      join(projectRoot, "index.html"),
      ...filesRecursively(join(projectRoot, "src")).filter((file) => !/\.(?:test|stories)\.[jt]sx?$/.test(file)),
    ];

    expect(filesWithGoogleFontReferences(sourceFiles)).toEqual([]);
  });

});
