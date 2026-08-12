import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const commandRoot = resolve(import.meta.dirname, "..");

function filesIn(directory, root = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesIn(path, root));
    else if (entry.isFile()) files.push(relative(root, path));
  }
  return files.sort();
}

export function writeBrandIconAssetManifest(root) {
  const files = [
    "design/brand/key-studio-icon.svg",
    ...filesIn(resolve(root, "public/icons")).map((path) => `public/icons/${path}`),
    ...filesIn(resolve(root, "src-tauri/icons")).map((path) => `src-tauri/icons/${path}`),
  ].sort();
  const assets = Object.fromEntries(files.map((path) => [
    path,
    createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex"),
  ]));
  writeFileSync(resolve(root, "design/brand/key-studio-icon-assets.json"), `${JSON.stringify({ assets }, null, 2)}\n`);
}

export function generateBrandIcons(root, destinations = {}) {
  const source = resolve(root, "design/brand/key-studio-icon.svg");
  const tauriIcons = destinations.tauriIcons ?? resolve(root, "src-tauri/icons");
  const publicIcons = destinations.publicIcons ?? resolve(root, "public/icons");

  if (process.platform !== "darwin") {
    throw new Error("Brand icon generation requires macOS sips");
  }

  mkdirSync(tauriIcons, { recursive: true });
  mkdirSync(publicIcons, { recursive: true });
  execFileSync("npx", ["tauri", "icon", source, "--output", tauriIcons], {
    cwd: commandRoot,
    stdio: "inherit",
  });
  execFileSync("sips", ["-s", "format", "png", source, "--out", resolve(tauriIcons, "icon.png")], {
    cwd: commandRoot,
    stdio: "inherit",
  });
  copyFileSync(source, resolve(publicIcons, "key-studio-icon.svg"));

  const input = resolve(tauriIcons, "icon.png");
  for (const [size, filename] of [
    [192, "icon-192.png"],
    [512, "icon-512.png"],
    [512, "maskable-512.png"],
    [180, "apple-touch-icon.png"],
  ]) {
    execFileSync("sips", ["-z", String(size), String(size), input, "--out", resolve(publicIcons, filename)], {
      cwd: commandRoot,
      stdio: "inherit",
    });
  }

  if (destinations.tauriIcons === undefined && destinations.publicIcons === undefined) {
    writeBrandIconAssetManifest(root);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateBrandIcons(commandRoot);
}
