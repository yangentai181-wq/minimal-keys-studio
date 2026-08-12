import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function pngDimensions(path) {
  const png = readFileSync(path);
  const signature = png.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error(`${path} is not a PNG`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

export function verifyBrandAssets(root) {
  const violations = [];
  const sourcePath = resolve(root, "design/brand/key-studio-icon.svg");
  const publicSvgPath = resolve(root, "public/icons/key-studio-icon.svg");
  if (!existsSync(sourcePath)) return [`Missing ${sourcePath}`];

  const source = readFileSync(sourcePath, "utf8");
  if (!source.includes('viewBox="0 0 1024 1024"')) violations.push("SVG viewBox must be 1024×1024");
  if (!source.includes("#F97316")) violations.push("SVG must contain approved orange #F97316");
  if (!source.includes("#0D9488")) violations.push("SVG must contain approved teal #0D9488");
  if ((source.match(/width="104" height="104"/g) ?? []).length !== 9) violations.push("SVG must contain exactly nine key faces");
  if (!existsSync(publicSvgPath) || !readFileSync(sourcePath).equals(readFileSync(publicSvgPath))) violations.push("Public SVG must be a byte-equal generated copy");

  const expectedPngs = new Map([
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
    ["public/icons/maskable-512.png", 512],
    ["public/icons/apple-touch-icon.png", 180],
    ["src-tauri/icons/icon.png", 1024],
    ["src-tauri/icons/32x32.png", 32],
    ["src-tauri/icons/128x128.png", 128],
    ["src-tauri/icons/128x128@2x.png", 256],
  ]);
  for (const [relativePath, size] of expectedPngs) {
    const path = resolve(root, relativePath);
    if (!existsSync(path)) {
      violations.push(`Missing ${relativePath}`);
      continue;
    }
    const dimensions = pngDimensions(path);
    if (dimensions.width !== size || dimensions.height !== size) violations.push(`${relativePath} must be ${size}×${size}`);
  }

  for (const relativePath of ["src-tauri/icons/icon.icns", "src-tauri/icons/icon.ico"]) {
    const path = resolve(root, relativePath);
    if (!existsSync(path) || statSync(path).size === 0) violations.push(`Missing or empty ${relativePath}`);
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, "..");
  const violations = verifyBrandAssets(root);
  if (violations.length > 0) {
    for (const violation of violations) console.error(violation);
    process.exitCode = 1;
  } else {
    console.log("Key Studio brand assets verified");
  }
}
