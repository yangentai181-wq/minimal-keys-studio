import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCT_NAME = "Key Studio";
const DESCRIPTION = "プロ向けキーボード設定・モニタリングツール";
const SUPPORTED_DEVICE_COPY = "現在はminimal-keysに対応";
const COMPATIBILITY = {
  bundleIdentifier: "com.hyhy-masa.minimal-keys-customize",
  mainBinaryName: "minimal-keys-customize",
  npmPackageName: "minimal-keys-studio",
  viteBasePath: "/minimal-keys-studio/",
  keymapFormat: "minimal-keys-studio-keymap",
  deviceName: "minimal-keys",
};
const CARGO_DESCRIPTION = "Key Studio desktop keyboard configuration and monitoring app.";
const text = (root, path) => readFileSync(resolve(root, path), "utf8");
const json = (root, path) => JSON.parse(text(root, path));
const metaContent = (html, name) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];

export function findBrandContractViolations(root) {
  const violations = [];
  const identity = json(root, "src/brand/identity.json");
  const packageJson = json(root, "package.json");
  const tauri = json(root, "src-tauri/tauri.conf.json");
  const manifest = json(root, "public/manifest.webmanifest");
  const viteConfig = text(root, "vite.config.ts");
  const keymapSource = text(root, "src/keyboard/keymap-io.ts");
  const indexHtml = text(root, "index.html");
  const cargo = text(root, "src-tauri/Cargo.toml");
  const notice = text(root, "NOTICE");
  const releaseWorkflow = text(root, ".github/workflows/release.yml");
  const equal = (actual, expected, label) => {
    if (actual !== expected) violations.push(`${label}: expected ${expected}, received ${actual}`);
  };
  const includes = (content, expected, label) => {
    if (!content.includes(expected)) violations.push(`${label}: missing ${expected}`);
  };

  equal(identity.productName, PRODUCT_NAME, "Identity product name");
  for (const [key, expected] of Object.entries(COMPATIBILITY)) {
    equal(identity.compatibility[key], expected, key === "deviceName" ? "Device name" : `Identity compatibility ${key}`);
  }
  equal(tauri.productName, PRODUCT_NAME, "Tauri productName");
  equal(tauri.app.windows[0].title, PRODUCT_NAME, "Tauri window title");
  equal(tauri.identifier, COMPATIBILITY.bundleIdentifier, "Bundle identifier");
  equal(tauri.mainBinaryName, COMPATIBILITY.mainBinaryName, "Main binary name");
  equal(packageJson.name, COMPATIBILITY.npmPackageName, "npm package name");
  equal(manifest.name, PRODUCT_NAME, "PWA name");
  equal(manifest.short_name, PRODUCT_NAME, "PWA short name");
  equal(manifest.description, `${DESCRIPTION}。${SUPPORTED_DEVICE_COPY}。`, "PWA description");
  equal(metaContent(indexHtml, "application-name"), PRODUCT_NAME, "HTML application name");
  equal(metaContent(indexHtml, "apple-mobile-web-app-title"), PRODUCT_NAME, "HTML Apple title");
  equal(metaContent(indexHtml, "description"), `${DESCRIPTION}。${SUPPORTED_DEVICE_COPY}。`, "HTML description");
  includes(indexHtml, `<title>${PRODUCT_NAME}</title>`, "HTML title");
  includes(indexHtml, `href="${identity.iconPath}"`, "HTML favicon");
  equal(tauri.bundle.shortDescription, DESCRIPTION, "Tauri short description");
  equal(tauri.bundle.longDescription, `${PRODUCT_NAME}はキーボード設定とリアルタイムモニタリングを統合します。${SUPPORTED_DEVICE_COPY}しています。`, "Tauri long description");
  equal(cargo.match(/^description = "([^"]*)"$/m)?.[1], CARGO_DESCRIPTION, "Cargo description");
  includes(viteConfig, `base: isTauri ? "/" : "${COMPATIBILITY.viteBasePath}"`, "Vite base path");
  if (!new RegExp(`return\\s*\\{\\s*format: "${COMPATIBILITY.keymapFormat}"`, "s").test(keymapSource)) violations.push("Keymap export format: missing serializer literal");
  if (!new RegExp(`file\\.format !== "${COMPATIBILITY.keymapFormat}"`).test(keymapSource)) violations.push("Keymap export format: missing deserializer guard literal");
  includes(text(root, "src/UnifiedStudioPreview.tsx"), "deviceName={identity.compatibility.deviceName}", "Device name consumer binding");
  includes(releaseWorkflow, `releaseName: '${PRODUCT_NAME} \${{ github.ref_name }}'`, "Release display name");
  if (!notice.startsWith("ZMK Studio")) violations.push("NOTICE must retain upstream ZMK Studio attribution");

  for (const path of ["public/minimal-keys-logo.png", "public/zmk.svg", "public/zmk-mac.png", "public/zmk-mac-app-icon.webp", "public/vite.svg"]) {
    if (existsSync(resolve(root, path))) violations.push(`${path}: unused legacy brand asset must be removed`);
  }
  const activeFiles = [
    "src/AppHeader.tsx", "src/ConnectModal.tsx", "src/UnifiedStudioPreview.tsx", "src/keyboard/KeyboardWorkspace.stories.tsx",
    "index.html", "public/manifest.webmanifest", "src-tauri/tauri.conf.json", "README.md", ".github/workflows/release.yml",
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
