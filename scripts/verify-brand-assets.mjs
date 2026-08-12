import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { generateBrandIcons } from "./generate-brand-icons.mjs";

export function pngDimensions(path) {
  const png = readFileSync(path);
  const signature = png.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error(`${path} is not a PNG`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function filesIn(directory, root = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesIn(path, root));
    else if (entry.isFile()) files.push(relative(root, path));
  }
  return files.sort();
}

function icnsContentsMatch(generatedPath, actualPath, scratchDirectory) {
  const extracted = mkdtempSync(join(scratchDirectory, "icns-"));
  try {
    const generatedIconset = resolve(extracted, "generated.iconset");
    const actualIconset = resolve(extracted, "actual.iconset");
    try {
      execFileSync("iconutil", ["-c", "iconset", generatedPath, "-o", generatedIconset], { stdio: "ignore" });
      execFileSync("iconutil", ["-c", "iconset", actualPath, "-o", actualIconset], { stdio: "ignore" });
    } catch {
      return false;
    }
    const generatedFiles = filesIn(generatedIconset);
    const actualFiles = filesIn(actualIconset);
    return generatedFiles.length === actualFiles.length
      && generatedFiles.every((file, index) => file === actualFiles[index]
        && readFileSync(resolve(generatedIconset, file)).equals(readFileSync(resolve(actualIconset, file))));
  } finally {
    rmSync(extracted, { recursive: true, force: true });
  }
}

function compareGeneratedDirectory(violations, generatedDirectory, actualDirectory, root, scratchDirectory) {
  const generatedFiles = new Set(filesIn(generatedDirectory));
  const actualFiles = new Set(filesIn(actualDirectory));
  for (const relativePath of new Set([...generatedFiles, ...actualFiles])) {
    const displayPath = relative(root, resolve(actualDirectory, relativePath));
    if (!actualFiles.has(relativePath)) violations.push(`Missing generated asset: ${displayPath}`);
    else if (!generatedFiles.has(relativePath)) violations.push(`Unexpected generated asset: ${displayPath}`);
    else if (extname(relativePath) === ".icns"
      ? !icnsContentsMatch(resolve(generatedDirectory, relativePath), resolve(actualDirectory, relativePath), scratchDirectory)
      : !readFileSync(resolve(generatedDirectory, relativePath)).equals(readFileSync(resolve(actualDirectory, relativePath)))) {
      violations.push(`Generated asset differs: ${displayPath}`);
    }
  }
}

export function verifyBrandAssets(root) {
  const violations = [];
  const sourcePath = resolve(root, "design/brand/key-studio-icon.svg");
  const identityPath = resolve(root, "src/brand/identity.json");
  const publicSvgPath = resolve(root, "public/icons/key-studio-icon.svg");
  if (!existsSync(sourcePath)) return [`Missing ${sourcePath}`];
  if (!existsSync(identityPath)) return [`Missing ${identityPath}`];

  const source = readFileSync(sourcePath, "utf8");
  const identity = JSON.parse(readFileSync(identityPath, "utf8"));
  if (!source.includes('viewBox="0 0 1024 1024"')) violations.push("SVG viewBox must be 1024×1024");
  if (!source.includes(identity.colors.orange)) violations.push(`SVG must contain identity orange ${identity.colors.orange}`);
  if (!source.includes(identity.colors.teal)) violations.push(`SVG must contain identity teal ${identity.colors.teal}`);
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

  if (violations.length > 0) return violations;

  const temporaryRoot = mkdtempSync(join(tmpdir(), "key-studio-brand-assets-"));
  try {
    const generatedTauriIcons = resolve(temporaryRoot, "tauri-icons");
    const generatedPublicIcons = resolve(temporaryRoot, "public-icons");
    generateBrandIcons(root, { tauriIcons: generatedTauriIcons, publicIcons: generatedPublicIcons });
    compareGeneratedDirectory(violations, generatedTauriIcons, resolve(root, "src-tauri/icons"), root, temporaryRoot);
    compareGeneratedDirectory(violations, generatedPublicIcons, resolve(root, "public/icons"), root, temporaryRoot);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
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
