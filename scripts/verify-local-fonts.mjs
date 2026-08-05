import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const forbiddenRemoteFonts = /fonts\.(?:googleapis|gstatic)\.com/i;

function filesRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(path) : [path];
  });
}

export function findGoogleFontReferences(directory) {
  return filesRecursively(directory).filter((file) => forbiddenRemoteFonts.test(readFileSync(file, "utf8")));
}

function main() {
  const directory = resolve(process.argv[2] ?? "dist");
  const references = findGoogleFontReferences(directory);
  if (references.length > 0) {
    console.error(`Google Fonts references found in production bundle:\n${references.join("\n")}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
