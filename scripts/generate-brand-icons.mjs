import { copyFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const commandRoot = resolve(import.meta.dirname, "..");

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
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateBrandIcons(commandRoot);
}
