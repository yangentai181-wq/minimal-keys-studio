import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findBrandContractViolations } from "./verify-brand-contract.mjs";

const repoRoot = resolve(import.meta.dirname, "..");

describe("Key Studio repository brand contract", () => {
  it("matches user-facing metadata and preserves compatibility identifiers", () => {
    expect(findBrandContractViolations(repoRoot)).toEqual([]);
  });

  it("runs brand verification after the production bundle is built", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    expect(packageJson.name).toBe("minimal-keys-studio");
    expect(packageJson.scripts.build).toContain("verify:brand");
  });
});
