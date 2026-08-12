import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const text = (root, path) => readFileSync(resolve(root, path), "utf8");
const json = (root, path) => JSON.parse(text(root, path));

export function findBrandContractViolations(root) {
  const violations = [];
  const identity = json(root, "src/brand/identity.json");
  const packageJson = json(root, "package.json");
  const tauri = json(root, "src-tauri/tauri.conf.json");
  const manifest = json(root, "public/manifest.webmanifest");
  const viteConfig = text(root, "vite.config.ts");
  const keymapSource = text(root, "src/keyboard/keymap-io.ts");
  const indexHtml = text(root, "index.html");
  const notice = text(root, "NOTICE");
  const releaseWorkflow = text(root, ".github/workflows/release.yml");

  const equal = (actual, expected, label) => {
    if (actual !== expected) violations.push(`${label}: expected ${expected}, received ${actual}`);
  };
  const includes = (content, expected, label) => {
    if (!content.includes(expected)) violations.push(`${label}: missing ${expected}`);
  };

  equal(tauri.productName, identity.productName, "Tauri productName");
  equal(tauri.app.windows[0].title, identity.productName, "Tauri window title");
  equal(tauri.identifier, identity.compatibility.bundleIdentifier, "Bundle identifier");
  equal(tauri.mainBinaryName, identity.compatibility.mainBinaryName, "Main binary name");
  equal(packageJson.name, identity.compatibility.npmPackageName, "npm package name");
  equal(manifest.name, identity.productName, "PWA name");
  equal(manifest.short_name, identity.productName, "PWA short name");
  equal(manifest.description, `${identity.description}。${identity.supportedDeviceCopy}。`, "PWA description");
  includes(viteConfig, `base: isTauri ? "/" : "${identity.compatibility.viteBasePath}"`, "Vite base path");
  includes(keymapSource, identity.compatibility.keymapFormat, "Keymap export format");
  includes(indexHtml, `<title>${identity.productName}</title>`, "HTML title");
  includes(indexHtml, `href="${identity.iconPath}"`, "HTML favicon");
  includes(releaseWorkflow, `releaseName: '${identity.productName} \${{ github.ref_name }}'`, "Release display name");
  if (!notice.startsWith("ZMK Studio")) violations.push("NOTICE must retain upstream ZMK Studio attribution");

  for (const path of [
    "public/minimal-keys-logo.png",
    "public/zmk.svg",
    "public/zmk-mac.png",
    "public/zmk-mac-app-icon.webp",
    "public/vite.svg",
  ]) {
    if (existsSync(resolve(root, path))) violations.push(`${path}: unused legacy brand asset must be removed`);
  }

  const activeFiles = [
    "src/AppHeader.tsx",
    "src/ConnectModal.tsx",
    "src/UnifiedStudioPreview.tsx",
    "index.html",
    "public/manifest.webmanifest",
    "src-tauri/tauri.conf.json",
    "README.md",
    ".github/workflows/release.yml",
  ];
  const forbidden = ["minimal-keys カスタマイズ", "Minimal Keys Studio", "minimal-keys studio"];
  for (const path of activeFiles) {
    const content = text(root, path);
    for (const legacyName of forbidden) {
      if (content.includes(legacyName)) violations.push(`${path}: contains legacy primary brand ${legacyName}`);
    }
  }

  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, "..");
  const violations = findBrandContractViolations(root);
  if (violations.length > 0) {
    for (const violation of violations) console.error(violation);
    process.exitCode = 1;
  } else {
    console.log("Key Studio brand contract verified");
  }
}
