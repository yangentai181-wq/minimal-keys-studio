import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const forbiddenRemoteFonts = /fonts\.(?:googleapis|gstatic)\.com/i;

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    if (/\.(?:test|stories)\.[jt]sx?$/.test(entry.name)) return [];
    return [path];
  });
}

describe("local typography", () => {
  it("does not request fonts from Google in production sources or Tailwind configuration", () => {
    const files = [
      join(projectRoot, "src/index.css"),
      join(projectRoot, "tailwind.config.js"),
      join(projectRoot, "index.html"),
      ...productionSources(join(projectRoot, "src")),
    ];

    const remoteFontReferences = files.filter((file) =>
      forbiddenRemoteFonts.test(readFileSync(file, "utf8")),
    );

    expect(remoteFontReferences).toEqual([]);
  });
});
