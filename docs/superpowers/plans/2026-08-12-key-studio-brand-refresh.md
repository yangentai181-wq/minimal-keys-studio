# Key Studio Brand Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the user-facing product to Key Studio and ship its approved silver, graphite, orange, and teal icon without changing existing settings, device identity, keymap files, or Studio communication.

**Architecture:** A small JSON identity contract is the source of truth for product copy and compatibility identifiers. React consumes it through a reusable `BrandLockup`; a Node verifier checks the duplicated HTML, PWA, Tauri, release, and compatibility metadata. One editable SVG is the icon source, and a reproducible script derives Tauri and PWA assets from it.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tailwind CSS, Vite/PWA metadata, Tauri 2, SVG/PNG/ICNS/ICO, Node.js verification scripts, Playwright visual checks.

## Global Constraints

- User-facing product name is exactly `Key Studio`.
- Product description is exactly `プロ向けキーボード設定・モニタリングツール`.
- Current-support copy is exactly `現在はminimal-keysに対応`.
- Approved icon is Precision Silver / Control Grid / Active + Status: silver squircle, graphite 3×3 grid, orange center key, teal status dot, and no text or `K`.
- Use existing UI colors `#F97316` for orange and `#0D9488` for teal; do not recolor the whole application.
- Preserve Bundle ID `com.hyhy-masa.minimal-keys-customize`.
- Preserve main binary name `minimal-keys-customize`.
- Preserve npm package name `minimal-keys-studio` and Vite base path `/minimal-keys-studio/`.
- Preserve keymap export format `minimal-keys-studio-keymap` and existing import compatibility.
- Preserve firmware, USB, and BLE device name `minimal-keys` and all RPC, proto, Raw HID, and Studio contracts.
- Keep ZMK attribution, `NOTICE`, and license text; move ZMK from primary branding to credits/about context only.
- Do not change stored application settings or their location.
- Do not publish, deploy, rename the repository, acquire a domain, notarize, or install over the current app in this implementation phase.
- Installing the built app requires a fresh user approval immediately before moving the current app to Trash.
- Public distribution remains blocked until a current trademark, app-store-name, domain, and repository-name conflict check is approved separately.

---

## File Structure

### New files

- `src/brand/identity.json` — product copy and protected compatibility identifiers.
- `src/brand/identity.test.ts` — exact-value contract for brand and compatibility fields.
- `src/brand/BrandLockup.tsx` — reusable icon/name/tagline presentation.
- `src/brand/BrandLockup.test.tsx` — accessible rendering contract.
- `src/brand/BrandLockup.stories.tsx` — compact, standard, small-size, light-Dock, and dark-Dock visual fixtures.
- `design/brand/key-studio-icon.svg` — the only editable icon source.
- `scripts/generate-brand-icons.mjs` — deterministic derivation into Tauri and PWA assets.
- `scripts/verify-brand-assets.mjs` — dimensions, SVG identity, and source-copy checks.
- `scripts/verify-brand-assets.test.ts` — brand-asset regression tests.
- `scripts/verify-brand-contract.mjs` — user-facing metadata and protected-identifier verifier.
- `scripts/verify-brand-contract.test.ts` — verifier behavior and repository contract tests.
- `src/AboutModal.test.tsx` — Key Studio-first About and retained ZMK credits.
- `src/AppFooter.test.tsx` — primary product name and credit-link copy.
- `src/misc/LicenseNoticeModal.test.tsx` — retained NOTICE and revised explanatory copy.

### Modified files

- `src/AppHeader.tsx`, `src/AppHeader.test.tsx` — compact Key Studio lockup.
- `src/ConnectModal.tsx`, `src/ConnectModal.test.tsx` — standard lockup and current-device support copy.
- `src/UnifiedStudioPreview.tsx` — Key Studio lockup in integrated preview.
- `src/AboutModal.tsx` — Key Studio description first, ZMK links and sponsors second.
- `src/AppFooter.tsx` — Key Studio-first footer with ZMK credits.
- `src/misc/LicenseNoticeModal.tsx` — Key Studio framing around unchanged NOTICE content.
- `index.html` — title, app names, favicon, and description metadata.
- `public/manifest.webmanifest` — PWA name, short name, description, and derived icons.
- `public/icons/*` — generated SVG/PNG browser assets.
- `src-tauri/icons/*` — generated Tauri, macOS, and Windows icons.
- `src-tauri/tauri.conf.json` — Key Studio product/window/package descriptions while preserving identifier and binary name.
- `src-tauri/Cargo.toml` — concrete package description only.
- `.github/workflows/release.yml` — draft release display name only.
- `package.json` — icon generation and brand verification scripts; package name remains unchanged.
- `README.md` — Key Studio purpose, current device support, and ZMK attribution.

---

### Task 1: Establish the brand and compatibility source of truth

**Files:**
- Create: `src/brand/identity.json`
- Create: `src/brand/identity.test.ts`

**Interfaces:**
- Consumes: exact approved copy and compatibility identifiers from the design spec.
- Produces: JSON properties `productName`, `description`, `supportedDeviceCopy`, `iconPath`, `colors`, and `compatibility` for React and Node verifiers.

- [ ] **Step 1: Write the failing identity contract test**

```ts
// src/brand/identity.test.ts
import { describe, expect, it } from "vitest";
import identity from "./identity.json";

describe("Key Studio identity", () => {
  it("locks the approved user-facing copy and colors", () => {
    expect(identity).toMatchObject({
      productName: "Key Studio",
      description: "プロ向けキーボード設定・モニタリングツール",
      supportedDeviceCopy: "現在はminimal-keysに対応",
      iconPath: "icons/key-studio-icon.svg",
      colors: { orange: "#F97316", teal: "#0D9488" },
    });
  });

  it("locks identifiers that the rebrand must not migrate", () => {
    expect(identity.compatibility).toEqual({
      bundleIdentifier: "com.hyhy-masa.minimal-keys-customize",
      mainBinaryName: "minimal-keys-customize",
      npmPackageName: "minimal-keys-studio",
      viteBasePath: "/minimal-keys-studio/",
      keymapFormat: "minimal-keys-studio-keymap",
      deviceName: "minimal-keys",
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/brand/identity.test.ts`

Expected: FAIL because `src/brand/identity.json` does not exist.

- [ ] **Step 3: Add the exact identity JSON**

```json
{
  "productName": "Key Studio",
  "description": "プロ向けキーボード設定・モニタリングツール",
  "supportedDeviceCopy": "現在はminimal-keysに対応",
  "iconPath": "icons/key-studio-icon.svg",
  "colors": {
    "orange": "#F97316",
    "teal": "#0D9488"
  },
  "compatibility": {
    "bundleIdentifier": "com.hyhy-masa.minimal-keys-customize",
    "mainBinaryName": "minimal-keys-customize",
    "npmPackageName": "minimal-keys-studio",
    "viteBasePath": "/minimal-keys-studio/",
    "keymapFormat": "minimal-keys-studio-keymap",
    "deviceName": "minimal-keys"
  }
}
```

- [ ] **Step 4: Run the identity contract test and verify GREEN**

Run: `npx vitest run src/brand/identity.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the identity contract**

```bash
git add src/brand/identity.json src/brand/identity.test.ts
git commit -m "feat: define Key Studio identity contract"
```

---

### Task 2: Create the vector icon source and deterministic derived assets

**Files:**
- Create: `design/brand/key-studio-icon.svg`
- Create: `scripts/generate-brand-icons.mjs`
- Create: `scripts/verify-brand-assets.mjs`
- Create: `scripts/verify-brand-assets.test.ts`
- Modify: `package.json`
- Generate: `public/icons/key-studio-icon.svg`
- Generate: `public/icons/icon-192.png`
- Generate: `public/icons/icon-512.png`
- Generate: `public/icons/maskable-512.png`
- Generate: `public/icons/apple-touch-icon.png`
- Generate: `src-tauri/icons/32x32.png`
- Generate: `src-tauri/icons/128x128.png`
- Generate: `src-tauri/icons/128x128@2x.png`
- Generate: `src-tauri/icons/icon.png`
- Generate: `src-tauri/icons/icon.icns`
- Generate: `src-tauri/icons/icon.ico`
- Generate: `src-tauri/icons/Square*.png`
- Generate: `src-tauri/icons/StoreLogo.png`

**Interfaces:**
- Consumes: `identity.json` colors and approved icon geometry.
- Produces: `design/brand/key-studio-icon.svg` as the only editable source and `public/icons/key-studio-icon.svg` as a byte-for-byte generated copy used by `BrandLockup` and the favicon.

- [ ] **Step 1: Write the failing asset verification test**

```ts
// scripts/verify-brand-assets.test.ts
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pngDimensions, verifyBrandAssets } from "./verify-brand-assets.mjs";

const root = resolve(import.meta.dirname, "..");

describe("Key Studio icon assets", () => {
  it("keeps every generated asset aligned with the SVG source", () => {
    expect(verifyBrandAssets(root)).toEqual([]);
  });

  it.each([
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
    ["public/icons/maskable-512.png", 512],
    ["public/icons/apple-touch-icon.png", 180],
    ["src-tauri/icons/icon.png", 1024],
    ["src-tauri/icons/32x32.png", 32],
    ["src-tauri/icons/128x128.png", 128],
    ["src-tauri/icons/128x128@2x.png", 256],
  ])("creates %s at %d px", (relativePath, size) => {
    expect(pngDimensions(resolve(root, relativePath))).toEqual({ width: size, height: size });
  });
});
```

- [ ] **Step 2: Run the asset test and verify RED**

Run: `npx vitest run scripts/verify-brand-assets.test.ts`

Expected: FAIL because the verifier and approved source SVG do not exist.

- [ ] **Step 3: Create the exact 1024×1024 editable SVG source**

Use these fixed colors and geometry in `design/brand/key-studio-icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">
  <title id="title">Key Studio icon</title>
  <desc id="desc">Silver rounded square with a graphite three by three key grid, an orange center key, and a teal status light.</desc>
  <defs>
    <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FAFBFC"/>
      <stop offset="0.52" stop-color="#C7CFD5"/>
      <stop offset="1" stop-color="#F1F3F5"/>
    </linearGradient>
    <linearGradient id="key" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#EEF1F3"/>
      <stop offset="1" stop-color="#929DA5"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="28" stdDeviation="28" flood-color="#141C26" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="220" fill="url(#silver)" filter="url(#shadow)"/>
  <rect x="246" y="246" width="532" height="532" rx="128" fill="#11161B"/>
  <g fill="url(#key)">
    <rect x="320" y="320" width="104" height="104" rx="28"/>
    <rect x="460" y="320" width="104" height="104" rx="28"/>
    <rect x="600" y="320" width="104" height="104" rx="28"/>
    <rect x="320" y="460" width="104" height="104" rx="28"/>
    <rect x="600" y="460" width="104" height="104" rx="28"/>
    <rect x="320" y="600" width="104" height="104" rx="28"/>
    <rect x="460" y="600" width="104" height="104" rx="28"/>
    <rect x="600" y="600" width="104" height="104" rx="28"/>
  </g>
  <rect x="460" y="460" width="104" height="104" rx="28" fill="#F97316"/>
  <circle cx="812" cy="212" r="34" fill="#0D9488"/>
</svg>
```

- [ ] **Step 4: Implement deterministic generation and verification**

Create `scripts/generate-brand-icons.mjs` with this implementation:

```js
import { copyFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "design/brand/key-studio-icon.svg");
const tauriIcons = resolve(root, "src-tauri/icons");
const publicIcons = resolve(root, "public/icons");

if (process.platform !== "darwin") {
  throw new Error("Brand icon generation requires macOS sips");
}

mkdirSync(tauriIcons, { recursive: true });
mkdirSync(publicIcons, { recursive: true });
execFileSync("npx", ["tauri", "icon", source, "--output", tauriIcons], {
  cwd: root,
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
    cwd: root,
    stdio: "inherit",
  });
}
```

Create `scripts/verify-brand-assets.mjs` with this implementation:

```js
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
```

- [ ] **Step 5: Add package scripts and generate the assets**

Add without changing `package.json.name`:

```json
"generate:brand-icons": "node scripts/generate-brand-icons.mjs",
"verify:brand-assets": "node scripts/verify-brand-assets.mjs"
```

Run: `npm run generate:brand-icons`

Expected: all Tauri/PWA assets are regenerated from the approved SVG; command exits 0.

- [ ] **Step 6: Run asset checks and verify GREEN**

Run: `npx vitest run scripts/verify-brand-assets.test.ts && npm run verify:brand-assets`

Expected: tests PASS and CLI prints `Key Studio brand assets verified`.

- [ ] **Step 7: Inspect large and small icon rendering**

Use the image viewer on `src-tauri/icons/icon.png`, `public/icons/icon-192.png`, and `src-tauri/icons/32x32.png`. Confirm the 3×3 grid does not become a black blob and orange/teal remain distinct. If not, change only the SVG source, regenerate, and rerun Step 6.

- [ ] **Step 8: Commit the icon source, scripts, and generated assets**

```bash
git add design/brand/key-studio-icon.svg scripts/generate-brand-icons.mjs scripts/verify-brand-assets.mjs scripts/verify-brand-assets.test.ts package.json public/icons src-tauri/icons
git commit -m "feat: add Key Studio icon assets"
```

---

### Task 3: Apply the reusable brand lockup to product surfaces

**Files:**
- Create: `src/brand/BrandLockup.tsx`
- Create: `src/brand/BrandLockup.test.tsx`
- Create: `src/brand/BrandLockup.stories.tsx`
- Modify: `src/AppHeader.tsx:86-91`
- Modify: `src/AppHeader.test.tsx`
- Modify: `src/ConnectModal.tsx:490-508`
- Modify: `src/ConnectModal.test.tsx`
- Modify: `src/UnifiedStudioPreview.tsx:228-243`

**Interfaces:**
- Consumes: `identity.json`, generated `public/icons/key-studio-icon.svg`, and optional `tagline`.
- Produces: `BrandLockup({ size, tagline, className })` with `size: "compact" | "standard"`, accessible icon alt text, exact product name, and optional secondary copy.

- [ ] **Step 1: Write the failing lockup tests**

```tsx
// src/brand/BrandLockup.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLockup } from "./BrandLockup";

describe("BrandLockup", () => {
  it("renders the approved name, icon, and optional support copy", () => {
    render(<BrandLockup size="standard" tagline="現在はminimal-keysに対応" />);
    expect(screen.getByText("Key Studio")).toBeInTheDocument();
    expect(screen.getByText("現在はminimal-keysに対応")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Key Studio" })).toHaveAttribute(
      "src",
      expect.stringContaining("icons/key-studio-icon.svg"),
    );
  });

  it("keeps the compact lockup to name and icon only", () => {
    render(<BrandLockup size="compact" />);
    expect(screen.getByText("Key Studio")).toBeInTheDocument();
    expect(screen.queryByText("現在はminimal-keysに対応")).not.toBeInTheDocument();
  });
});
```

Add to `AppHeader.test.tsx`:

```tsx
it("uses Key Studio as the product brand while leaving the device label separate", () => {
  render(<OsModeProvider><AppHeader connectedDeviceLabel="minimal-keys_R" /></OsModeProvider>);
  expect(screen.getByText("Key Studio")).toBeInTheDocument();
  expect(screen.getByText("minimal-keys_R")).toBeInTheDocument();
  expect(screen.queryByText("minimal-keys カスタマイズ")).not.toBeInTheDocument();
});
```

Add to `ConnectModal.test.tsx`:

```tsx
it("presents Key Studio and states the current supported keyboard", () => {
  render(<ConnectModal open transports={[]} onTransportCreated={vi.fn()} />);
  expect(screen.getByText("Key Studio")).toBeInTheDocument();
  expect(screen.getByText("現在はminimal-keysに対応")).toBeInTheDocument();
  expect(screen.queryByText("minimal-keys カスタマイズ")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npx vitest run src/brand/BrandLockup.test.tsx src/AppHeader.test.tsx src/ConnectModal.test.tsx`

Expected: FAIL because `BrandLockup` does not exist and current surfaces still show the old name.

- [ ] **Step 3: Implement the reusable lockup**

```tsx
// src/brand/BrandLockup.tsx
import identity from "./identity.json";

export interface BrandLockupProps {
  size?: "compact" | "standard";
  tagline?: string;
  className?: string;
}

export function BrandLockup({ size = "standard", tagline, className = "" }: BrandLockupProps) {
  const compact = size === "compact";
  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3"} ${className}`.trim()}>
      <img
        src={`${import.meta.env.BASE_URL}${identity.iconPath}`}
        alt={identity.productName}
        className={compact ? "h-8 w-8 rounded-lg" : "h-12 w-12 rounded-xl shadow-sm"}
      />
      <div className="min-w-0">
        <p className={compact ? "truncate text-base font-semibold" : "truncate text-xl font-bold text-base-content"}>
          {identity.productName}
        </p>
        {tagline && <p className="truncate text-xs font-semibold text-base-content/55">{tagline}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace the three active product lockups**

- `AppHeader.tsx`: replace the old image/name block with `<BrandLockup size="compact" />`.
- `ConnectModal.tsx`: replace the old image/eyebrow/name block with `<BrandLockup tagline={identity.supportedDeviceCopy} />`; retain the existing editing-capabilities paragraph below it.
- `UnifiedStudioPreview.tsx`: replace the old logo/name block with `<BrandLockup tagline="エディタ / モニタ統合" />`.
- Import `identity` only where its support copy is needed; do not duplicate `Key Studio` literals in React surfaces.

- [ ] **Step 5: Add the visual story**

Create `BrandLockup.stories.tsx` with these complete fixtures:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { BrandLockup } from "./BrandLockup";
import identity from "./identity.json";

const meta = {
  title: "Brand/BrandLockup",
  component: BrandLockup,
  parameters: { layout: "centered" },
} satisfies Meta<typeof BrandLockup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = { args: { size: "compact" } };
export const Standard: Story = { args: { size: "standard", tagline: "現在はminimal-keysに対応" } };

export const IconScale: Story = {
  render: () => (
    <div className="flex items-end gap-6 bg-base-200 p-8">
      {[16, 32, 128, 512].map((size) => (
        <figure key={size} className="grid gap-2 text-center text-sm">
          <img
            src={`${import.meta.env.BASE_URL}${identity.iconPath}`}
            alt={`Key Studio ${size}px`}
            style={{ width: size, height: size }}
          />
          <figcaption>{size}px</figcaption>
        </figure>
      ))}
    </div>
  ),
};

export const LightAndDarkDock: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 bg-base-200 p-8">
      {["bg-white", "bg-slate-900"].map((background) => (
        <div key={background} className={`grid h-40 w-40 place-items-center rounded-3xl ${background}`}>
          <img
            src={`${import.meta.env.BASE_URL}${identity.iconPath}`}
            alt="Key Studio Dock icon"
            className="h-20 w-20"
          />
        </div>
      ))}
    </div>
  ),
};
```

- [ ] **Step 6: Run the focused tests and Storybook build**

Run: `npx vitest run src/brand/BrandLockup.test.tsx src/AppHeader.test.tsx src/ConnectModal.test.tsx && npm run build-storybook`

Expected: all focused tests PASS and Storybook exits 0.

- [ ] **Step 7: Commit the product-surface rebrand**

```bash
git add src/brand/BrandLockup.tsx src/brand/BrandLockup.test.tsx src/brand/BrandLockup.stories.tsx src/AppHeader.tsx src/AppHeader.test.tsx src/ConnectModal.tsx src/ConnectModal.test.tsx src/UnifiedStudioPreview.tsx
git commit -m "feat: apply Key Studio product lockup"
```

---

### Task 4: Make Key Studio primary while preserving ZMK credits and NOTICE

**Files:**
- Create: `src/AboutModal.test.tsx`
- Create: `src/AppFooter.test.tsx`
- Create: `src/misc/LicenseNoticeModal.test.tsx`
- Modify: `src/AboutModal.tsx:178-253`
- Modify: `src/AppFooter.tsx:10-21`
- Modify: `src/misc/LicenseNoticeModal.tsx:23-37`
- Modify: `README.md`

**Interfaces:**
- Consumes: `identity.json`, existing sponsor data, ZMK external links, and raw `NOTICE`.
- Produces: Key Studio-first About/footer copy while retaining the ZMK Project links, sponsor grid, Apache 2.0 explanation, and unmodified NOTICE contents.

- [ ] **Step 1: Write failing attribution tests**

```tsx
// src/AboutModal.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AboutModal } from "./AboutModal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close ??= function close() { this.open = false; };
});

describe("AboutModal branding", () => {
  it("introduces Key Studio before ZMK credits", () => {
    render(<AboutModal open onClose={vi.fn()} />);
    const keyStudio = screen.getByRole("heading", { name: "Key Studio" });
    const credits = screen.getByRole("heading", { name: "ZMKへの謝辞" });
    expect(keyStudio.compareDocumentPosition(credits) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("プロ向けキーボード設定・モニタリングツール")).toBeInTheDocument();
    expect(screen.getByText("現在はminimal-keysに対応")).toBeInTheDocument();
    expect(screen.getByText(/ZMK Studioを基盤/)).toBeInTheDocument();
  });
});
```

```tsx
// src/AppFooter.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppFooter } from "./AppFooter";

it("shows Key Studio first and keeps ZMK credits accessible", () => {
  render(<AppFooter onShowAbout={vi.fn()} onShowLicenseNotice={vi.fn()} />);
  expect(screen.getByText("Key Studio")).toBeInTheDocument();
  expect(screen.getByText("ZMK Contributorsへの謝辞")).toBeInTheDocument();
  expect(screen.getByText("License NOTICE")).toBeInTheDocument();
  expect(screen.queryByText("About ZMK Studio")).not.toBeInTheDocument();
});
```

```tsx
// src/misc/LicenseNoticeModal.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { LicenseNoticeModal } from "./LicenseNoticeModal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close ??= function close() { this.open = false; };
});

it("frames the unchanged ZMK NOTICE as a Key Studio dependency credit", () => {
  render(<LicenseNoticeModal open onClose={vi.fn()} />);
  expect(screen.getByText(/Key Studioには/)).toBeInTheDocument();
  expect(screen.getByText(/Apache 2.0/)).toBeInTheDocument();
  expect(screen.getByText(/ZMK Studio/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run attribution tests and verify RED**

Run: `npx vitest run src/AboutModal.test.tsx src/AppFooter.test.tsx src/misc/LicenseNoticeModal.test.tsx`

Expected: FAIL because Key Studio-first headings and copy are absent.

- [ ] **Step 3: Reframe About without deleting upstream credits**

At the start of `AboutModal`, render:

```tsx
<section>
  <h2 className="text-xl font-bold">{identity.productName}</h2>
  <p>{identity.description}</p>
  <p className="text-sm text-base-content/60">{identity.supportedDeviceCopy}</p>
  <p className="mt-3 text-sm leading-6">
    Key StudioはZMK Studioを基盤に、minimal-keys向けの編集・モニタリング機能を統合したアプリです。
  </p>
</section>
<section className="mt-6">
  <h3 className="text-lg font-semibold">ZMKへの謝辞</h3>
  {/* existing ZMK links, sponsor explanation, and sponsor grid remain here */}
</section>
```

Change only presentation and explanatory copy; keep every existing sponsor entry and URL.

- [ ] **Step 4: Update footer and license framing**

Render the footer in this order:

```tsx
<span>Key Studio</span> — <button onClick={onShowAbout}>ZMK Contributorsへの謝辞</button> — <button onClick={onShowLicenseNotice}>License NOTICE</button>
```

Use real `<button type="button">` controls styled like text links rather than click-only anchors without `href`.

In `LicenseNoticeModal`, replace only the explanatory paragraph with:

```tsx
<p className="mr-2">
  Key Studioには、Apache 2.0で公開されたZMK Studio由来のコードが含まれています。以下は同梱している原文のNOTICEです。
</p>
```

Do not modify `NOTICE` or the rendered `<pre>{NOTICE}</pre>`.

- [ ] **Step 5: Rewrite README as the product entry point**

Use this exact opening and retain license/attribution links:

```md
# Key Studio

プロ向けキーボード設定・モニタリングツール。現在はminimal-keysに対応しています。

Key Studioは、キーマップ、トラックボール、コンボ、Bluetooth、長押し設定とリアルタイムモニターを一つのデスクトップアプリにまとめます。

## 対応状況

- 対応キーボード: minimal-keys
- デスクトップ: macOS / Windows（Tauri）
- 接続: USB Raw HID / Studio RPC / BLE

## ZMKへの謝辞

このアプリには[ZMK Studio](https://github.com/zmkfirmware/zmk-studio)由来のコードが含まれています。ライセンスと帰属は[LICENSE](LICENSE)および[NOTICE](NOTICE)を確認してください。
```

- [ ] **Step 6: Run attribution tests and verify GREEN**

Run: `npx vitest run src/AboutModal.test.tsx src/AppFooter.test.tsx src/misc/LicenseNoticeModal.test.tsx`

Expected: all tests PASS and existing sponsor entries still render.

- [ ] **Step 7: Commit credits and documentation**

```bash
git add src/AboutModal.tsx src/AboutModal.test.tsx src/AppFooter.tsx src/AppFooter.test.tsx src/misc/LicenseNoticeModal.tsx src/misc/LicenseNoticeModal.test.tsx README.md
git commit -m "docs: present Key Studio with ZMK credits"
```

---

### Task 5: Update web, desktop, installer, and release metadata with a compatibility gate

**Files:**
- Create: `scripts/verify-brand-contract.mjs`
- Create: `scripts/verify-brand-contract.test.ts`
- Modify: `index.html:6-16`
- Modify: `public/manifest.webmanifest:1-28`
- Modify: `src-tauri/tauri.conf.json:9-12,23-40,69-77`
- Modify: `src-tauri/Cargo.toml:1-9`
- Modify: `.github/workflows/release.yml:57-64`
- Modify: `package.json`
- Delete after all references are replaced: `public/minimal-keys-logo.png`
- Delete after favicon replacement: `public/zmk.svg`
- Delete as already unreferenced legacy assets: `public/zmk-mac.png`
- Delete as already unreferenced legacy assets: `public/zmk-mac-app-icon.webp`
- Delete as already unreferenced scaffold asset: `public/vite.svg`

**Interfaces:**
- Consumes: `identity.json` and every user-facing metadata file.
- Produces: `findBrandContractViolations(root): string[]` and CLI `npm run verify:brand`, run by `npm run build`.

- [ ] **Step 1: Write the failing repository contract test**

```ts
// scripts/verify-brand-contract.test.ts
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
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx vitest run scripts/verify-brand-contract.test.ts`

Expected: FAIL because the verifier does not exist and current metadata uses old names.

- [ ] **Step 3: Update browser and PWA metadata**

Set in `index.html`:

```html
<meta name="application-name" content="Key Studio" />
<meta name="apple-mobile-web-app-title" content="Key Studio" />
<meta name="description" content="プロ向けキーボード設定・モニタリングツール。現在はminimal-keysに対応。" />
<link rel="icon" type="image/svg+xml" href="icons/key-studio-icon.svg" />
<title>Key Studio</title>
```

Set in `public/manifest.webmanifest`:

```json
"name": "Key Studio",
"short_name": "Key Studio",
"description": "プロ向けキーボード設定・モニタリングツール。現在はminimal-keysに対応。"
```

Keep start URL, scope, display, orientation, theme colors, and icon paths unchanged.

After the HTML favicon and all React lockups reference Key Studio assets, verify `rg` finds no references and remove the tracked legacy assets:

```bash
rg -n "minimal-keys-logo\.png|zmk\.svg|zmk-mac\.png|zmk-mac-app-icon\.webp|vite\.svg" src index.html public README.md || true
git rm public/minimal-keys-logo.png public/zmk.svg public/zmk-mac.png public/zmk-mac-app-icon.webp public/vite.svg
```

- [ ] **Step 4: Update Tauri and release display metadata only**

Set in `src-tauri/tauri.conf.json`:

```json
"productName": "Key Studio",
"mainBinaryName": "minimal-keys-customize",
"identifier": "com.hyhy-masa.minimal-keys-customize",
"bundle": {
  "shortDescription": "プロ向けキーボード設定・モニタリングツール",
  "longDescription": "Key Studioはキーボード設定とリアルタイムモニタリングを統合します。現在はminimal-keysに対応しています。"
},
"app": { "windows": [{ "title": "Key Studio" }] }
```

Retain all omitted existing bundle/security/window fields exactly.

Set `src-tauri/Cargo.toml` package description to `Key Studio desktop keyboard configuration and monitoring app.`; leave Rust package name/default-run unchanged.

Set `.github/workflows/release.yml` draft release display to:

```yaml
releaseName: 'Key Studio ${{ github.ref_name }}'
```

Do not trigger the workflow or publish a release.

- [ ] **Step 5: Implement the metadata and compatibility verifier**

Create `scripts/verify-brand-contract.mjs` with this implementation:

```js
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
```

Do not expand the legacy-name scan into technical docs, `NOTICE`, protocol source, or historical changelogs; `ZMK Studio` remains valid in attribution and protocol contexts.

- [ ] **Step 6: Add the brand build gate**

Add:

```json
"verify:brand": "node scripts/verify-brand-contract.mjs && npm run verify:brand-assets"
```

Append `&& npm run verify:brand` to the existing `build` script after `verify:local-fonts`; do not remove any existing build step.

- [ ] **Step 7: Run focused contract checks and verify GREEN**

Run: `npx vitest run scripts/verify-brand-contract.test.ts src/brand/identity.test.ts scripts/verify-brand-assets.test.ts && npm run verify:brand`

Expected: tests PASS, CLI exits 0, package name/base path/Bundle ID/binary/keymap format remain unchanged.

- [ ] **Step 8: Commit metadata and verification gate**

```bash
git add index.html public/manifest.webmanifest public src-tauri/tauri.conf.json src-tauri/Cargo.toml .github/workflows/release.yml package.json scripts/verify-brand-contract.mjs scripts/verify-brand-contract.test.ts
git commit -m "feat: rename product metadata to Key Studio"
```

---

### Task 6: Run full regression, visual, packaging, and approval-gated installation checks

**Files:**
- Verify: all changed files from Tasks 1–5
- Verify: built `dist/`, `storybook-static/`, and `src-tauri/target/release/bundle/` outputs
- Do not modify tracked source unless a check finds a real defect; fix any defect with a new RED test and a separate commit.

**Interfaces:**
- Consumes: completed Key Studio implementation and existing minimal-keys hardware/settings contracts.
- Produces: evidence for code, browser layout, desktop packaging, and—only after fresh approval—installed-app and device behavior.

- [ ] **Step 1: Run focused brand and preserved-feature tests**

Run:

```bash
npx vitest run \
  src/brand/identity.test.ts \
  src/brand/BrandLockup.test.tsx \
  scripts/verify-brand-assets.test.ts \
  scripts/verify-brand-contract.test.ts \
  src/AppHeader.test.tsx \
  src/ConnectModal.test.tsx \
  src/AboutModal.test.tsx \
  src/AppFooter.test.tsx \
  src/misc/LicenseNoticeModal.test.tsx \
  src/keyboard/Keyboard.loading.test.tsx \
  src/keyboard/Key.test.tsx \
  src/behaviors/BehaviorBindingPicker.test.tsx \
  src/behaviors/picker/PickerTabs.test.tsx \
  src/trackball/TrackballSettings.test.tsx \
  src/trackball/TrackballPrecisionSettings.test.tsx \
  src/combos/ComboSettings.test.tsx
```

Expected: all tests PASS, including Auto Mouse editing, orange hold-action borders, candidate-only scrolling, Transparent selection, trackball settings, and combo saving.

- [ ] **Step 2: Run the full static and automated gate**

Run in this order and record every exit code:

```bash
npm test
npm run lint
npm run build
npm run build-storybook
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
git diff --check
```

Expected: every command exits 0. Existing bundle-size warnings may be recorded but are not failures. Do not infer browser or hardware correctness from these commands.

- [ ] **Step 3: Verify browser layouts with Playwright**

Start Storybook on port 6006 and Vite on port 5173. In a fresh Chromium context at 800×600 and 1200×800:

1. Open the `BrandLockup/LightAndDarkDock` story and capture a screenshot.
2. Assert the 16/32/128/512 samples are visible and the orange center key and teal dot remain distinct.
3. Open the disconnected app and assert `Key Studio`, `現在はminimal-keysに対応`, and the new SVG icon are visible.
4. Open `/?preview=integrated` and assert `Key Studio` and `エディタ / モニタ統合` are visible.
5. Confirm no horizontal document scroll and no clipping of the lockup at either viewport.
6. Re-run the existing key-picker geometry checks: candidate viewport scrolls independently, outer page stays fixed, Transparent is visible, and bottom inset is at least 8px.

Stop both servers and verify ports 5173 and 6006 are no longer listening.

- [ ] **Step 4: Inspect desktop artifacts without installing them**

Resolve the actual files under `src-tauri/target/release/bundle/`, require exactly one app, then verify:

```bash
KEY_STUDIO_APP_COUNT=$(find src-tauri/target/release/bundle -type d -name 'Key Studio.app' | wc -l | tr -d ' ')
test "$KEY_STUDIO_APP_COUNT" = "1"
KEY_STUDIO_BUILT_APP=$(find src-tauri/target/release/bundle -type d -name 'Key Studio.app' -print -quit)
KEY_STUDIO_BUILT_EXECUTABLE="$KEY_STUDIO_BUILT_APP/Contents/MacOS/minimal-keys-customize"
plutil -extract CFBundleDisplayName raw "$KEY_STUDIO_BUILT_APP/Contents/Info.plist"
plutil -extract CFBundleIdentifier raw "$KEY_STUDIO_BUILT_APP/Contents/Info.plist"
codesign --verify --deep --strict "$KEY_STUDIO_BUILT_APP"
shasum -a 256 "$KEY_STUDIO_BUILT_EXECUTABLE"
find src-tauri/target/release/bundle -maxdepth 3 -type f -o -type d
```

Expected:

- Display name: `Key Studio`
- Bundle identifier: `com.hyhy-masa.minimal-keys-customize`
- Executable: `minimal-keys-customize`
- Artifacts include `Key Studio.app`, a Key Studio DMG, and a Windows NSIS bundle when built on Windows.
- Signature verification passes; ad-hoc signing and absence of notarization must be reported as such.

- [ ] **Step 5: Audit scope before any installation**

Run:

```bash
git status --short
git diff --stat c638e7b..HEAD
git diff --name-only c638e7b..HEAD
rg -n "minimal-keys カスタマイズ|Minimal Keys Studio|minimal-keys studio" src index.html public src-tauri README.md .github/workflows/release.yml
npm run verify:brand
```

Expected: only planned files changed; old primary-brand strings are absent from active product surfaces; legitimate `minimal-keys` device/support and ZMK attribution references remain.

- [ ] **Step 6: Stop for a fresh installation approval**

Report the exact built app path, DMG path, executable SHA-256, codesign status, Bundle ID, and all Unknowns. Ask permission to replace the installed app. Do not move, delete, overwrite, launch, or install anything until the user explicitly approves at this point.

- [ ] **Step 7: After approval, install recoverably and verify the exact binary**

Resolve explicit paths first. Move only `/Applications/minimal-keys カスタマイズ.app` to a new non-colliding Trash path such as `/Users/iwanedaijun/.Trash/minimal-keys カスタマイズ (before Key Studio 2026-08-12).app`. Copy the verified `Key Studio.app` into `/Applications/Key Studio.app`.

Then verify:

```bash
test -d '/Applications/Key Studio.app'
plutil -extract CFBundleIdentifier raw '/Applications/Key Studio.app/Contents/Info.plist'
codesign --verify --deep --strict '/Applications/Key Studio.app'
shasum -a 256 '/Applications/Key Studio.app/Contents/MacOS/minimal-keys-customize'
```

Expected: installed hash equals the built hash; Bundle ID remains unchanged; old app exists only at the reported recoverable Trash path.

- [ ] **Step 8: Verify existing settings and real-device behavior without inventing success**

Launch the installed app only through the approved display-guarded macOS path. With the right half connected over USB, verify and record separately:

1. Key Studio name/icon in Finder, Dock, app switcher, title bar, header, connection screen, and About.
2. Existing keymap and settings load without migration prompts or reset.
3. Right USB, Raw HID, and Studio RPC connect.
4. Auto Mouse layer remains visible/editable.
5. Layer-switch/hold-action keys retain orange borders.
6. Candidate list scrolls independently and Transparent is assignable.
7. Trackball pointer and scroll both work in both directions.
8. Existing combo list loads and saving produces matching immediate readback.

Do not change device settings solely to manufacture evidence. If a temporary device change is needed for save/readback, first snapshot the value, use one explicitly harmless change, restore it, save again, and confirm restored readback. Mark any unperformed real-device item `Unknown`, not PASS.

- [ ] **Step 9: Final verification commit only if Task 6 required source fixes**

If no source fix was needed, do not create an empty commit. If a defect was fixed with a RED test, stage only that fix and its test:

```bash
git status --short
git ls-files --modified --others --exclude-standard -z | xargs -0 git add --
git diff --cached --check
git commit -m "fix: complete Key Studio verification"
```

Final report must separate: implementation evidence, browser evidence, package evidence, installed-app evidence, device evidence, and remaining Unknowns.
