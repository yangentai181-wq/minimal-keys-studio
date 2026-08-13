# Single Keyboard Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated monitor/editor keyboards with one large keymap workspace that switches between `編集` and `リアルタイム` modes.

**Architecture:** A new `KeyboardWorkspace` owns presentation mode and keeps the editor subtree mounted while hiding it in realtime mode. A separate `KeyboardMonitorSurface` is the only monitor-store subscriber and renders the existing physical monitor layout plus a compact Japanese status row. The connection overview returns to status-only duty and `App.tsx` injects the workspace only into the keymap tab.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, Storybook, Tauri 2.

## Global Constraints

- Show exactly one keyboard surface visually at a time.
- Realtime mode hides the key assignment panel and maximizes the keyboard.
- Switching modes must not reset the selected editor layer/key or in-memory editor state.
- Teal `#0D9488` is primary; orange `#F97316` remains hold-state emphasis; background is `#F8FAFC` with white bordered cards.
- All mode controls have at least a 44px hit area, visible focus rings, Japanese labels, and non-color state semantics.
- No firmware, Raw HID packet, Studio RPC, or non-keymap settings behavior changes.
- Preserve the untracked `work/` directory without editing or staging it.

---

### Task 1: Keyboard Monitor Surface

**Files:**
- Create: `src/keyboard/KeyboardMonitorSurface.tsx`
- Create: `src/keyboard/KeyboardMonitorSurface.test.tsx`

**Interfaces:**
- Consumes: `MonitorStore`, `useMonitorSnapshot`, `MinimalKeysMonitorLayout`, `MONITOR_LAYER_NAMES`, `getMonitorKeyLabel`.
- Produces: `KeyboardMonitorSurface({ monitorStore, monitorActive }: { monitorStore: MonitorStore; monitorActive: boolean })`.

- [ ] **Step 1: Write the failing monitor-surface test**

Render a fresh store, push a layer frame, key frame, hold-tap frame, and pointer frame, then assert the surface shows the single physical grid, `長押し`, the resolved layer name, latest key, and pointer delta. Also assert the disconnected copy is `モニター未接続` when `monitorActive={false}`.

```tsx
const store = createMonitorStore();
store.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 1 }, 1);
store.push({ kind: "key", position: 2, pressed: true }, 2);
store.push({ kind: "holdTap", position: 2, phase: "hold" }, 3);
store.push({ kind: "pointer", dx: 4, dy: -2, wheel: 0, hwheel: 0, buttons: 0 }, 4);
render(<KeyboardMonitorSurface monitorStore={store} monitorActive />);
expect(screen.getAllByRole("grid")).toHaveLength(1);
expect(screen.getByLabelText("pos 2 E 押下中 長押し")).toBeTruthy();
expect(screen.getByText(/dx \+4 \/ dy -2/)).toBeTruthy();
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- --run src/keyboard/KeyboardMonitorSurface.test.tsx`
Expected: FAIL because `KeyboardMonitorSurface.tsx` does not exist.

- [ ] **Step 3: Implement the monitor leaf**

Subscribe inside this component only. Render `MinimalKeysMonitorLayout` in a flex-growing white card. Derive `pressedList`, `latestPosition`, `layerName`, and `pointerSummary`; render four compact status items: connection, layer, latest key, pointer. Use Japanese copy and no explanatory paragraph.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- --run src/keyboard/KeyboardMonitorSurface.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/keyboard/KeyboardMonitorSurface.tsx src/keyboard/KeyboardMonitorSurface.test.tsx
git commit -m "feat: add large realtime keyboard surface"
```

### Task 2: Mode-Switching Keyboard Workspace

**Files:**
- Create: `src/keyboard/KeyboardWorkspace.tsx`
- Create: `src/keyboard/KeyboardWorkspace.test.tsx`

**Interfaces:**
- Consumes: `KeyboardMonitorSurface`, `MonitorStore`, a React `editor` node, optional reconnect action.
- Produces: `KeyboardWorkspaceProps` with `editor`, `monitorStore`, `monitorActive`, `monitorBusy?`, and `onConnectMonitor?`.

- [ ] **Step 1: Write failing workspace behavior tests**

Cover the following in separate tests:

```tsx
render(<KeyboardWorkspace editor={<StatefulEditor />} monitorStore={store} monitorActive />);
expect(screen.getByRole("button", { name: "編集" })).toHaveAttribute("aria-pressed", "true");
expect(screen.getAllByRole("grid")).toHaveLength(1);
fireEvent.change(screen.getByLabelText("編集メモ"), { target: { value: "保持" } });
fireEvent.click(screen.getByRole("button", { name: "リアルタイム" }));
expect(screen.getAllByRole("grid")).toHaveLength(1);
fireEvent.click(screen.getByRole("button", { name: "編集" }));
expect(screen.getByLabelText("編集メモ")).toHaveValue("保持");
```

Also verify that realtime is disabled when initially unavailable, `右手USBモニターを接続` calls `onConnectMonitor`, and a selected realtime view stays visible if `monitorActive` later becomes false.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- --run src/keyboard/KeyboardWorkspace.test.tsx`
Expected: FAIL because `KeyboardWorkspace.tsx` does not exist.

- [ ] **Step 3: Implement `KeyboardWorkspace`**

Use local state `"editor" | "monitor"`. Render a white card header with a labelled two-button segmented control. Give buttons `min-h-11`, `aria-pressed`, teal active styles, hover styles, and `focus-visible:ring-2`. Keep the editor mounted in a wrapper with the HTML `hidden` attribute while realtime is selected. Render `KeyboardMonitorSurface` only for realtime mode. Place the connect CTA beside the switch when monitoring is unavailable.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- --run src/keyboard/KeyboardWorkspace.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/keyboard/KeyboardWorkspace.tsx src/keyboard/KeyboardWorkspace.test.tsx
git commit -m "feat: switch keyboard editor and monitor modes"
```

### Task 3: Remove Overview Duplication and Integrate App

**Files:**
- Modify: `src/StudioConnectionOverview.tsx`
- Modify: `src/StudioConnectionOverview.test.tsx`
- Modify: `src/connection/RightUsbEditorShell.tsx`
- Modify: `src/connection/RightUsbEditorShell.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.monitor-isolation.test.tsx`

**Interfaces:**
- Consumes: `KeyboardWorkspace` from Task 2 and existing `rightUsb` monitor properties.
- Produces: the production keymap tab with one visual keyboard and a status-only connection overview.

- [ ] **Step 1: Add failing integration assertions**

In overview tests, render with an active monitor and assert `queryByRole("grid", { name: "minimal-keys 実配列モニター" })` is null. In shell tests, remove `showLayout` usage. In the App isolation test, select the keymap tab and assert the `キーボード表示` control exists while a pushed pointer frame does not rerender a stateful editor leaf.

- [ ] **Step 2: Run focused integration tests and confirm RED**

Run: `npm test -- --run src/StudioConnectionOverview.test.tsx src/connection/RightUsbEditorShell.test.tsx src/App.monitor-isolation.test.tsx`
Expected: at least the overview assertion fails because it still renders the monitor layout.

- [ ] **Step 3: Remove the overview keyboard branch**

Delete `showLayout` from `StudioConnectionOverviewProps`, `MonitorSummary`, and `RightUsbEditorShell`. Remove monitor-layout-only imports and the `ライブ読み取り` card. Keep the compact status row, details metrics, and `TrackballPrecisionStatus` unchanged.

- [ ] **Step 4: Wire `KeyboardWorkspace` into `App.tsx`**

Replace the keymap render branch with:

```tsx
<KeyboardWorkspace
  editor={<Keyboard key={keymapVersion} />}
  monitorStore={rightUsb.monitorStore}
  monitorActive={rightUsb.monitorActive}
  monitorBusy={rightUsb.connecting}
  onConnectMonitor={hasRightUsbFlow ? rightUsb.connectRightUsb : undefined}
/>
```

Do not change the monitor-only pre-editor path or other tabs.

- [ ] **Step 5: Run focused integration tests and confirm GREEN**

Run: `npm test -- --run src/StudioConnectionOverview.test.tsx src/connection/RightUsbEditorShell.test.tsx src/App.monitor-isolation.test.tsx src/keyboard/KeyboardWorkspace.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.monitor-isolation.test.tsx src/StudioConnectionOverview.tsx src/StudioConnectionOverview.test.tsx src/connection/RightUsbEditorShell.tsx src/connection/RightUsbEditorShell.test.tsx
git commit -m "refactor: show one keyboard workspace"
```

### Task 4: Visual Fixtures and Full Verification

**Files:**
- Create: `src/keyboard/KeyboardWorkspace.stories.tsx`
- Modify only if visual evidence exposes a defect: `src/keyboard/KeyboardWorkspace.tsx`, `src/keyboard/KeyboardMonitorSurface.tsx`

**Interfaces:**
- Consumes: the completed workspace and monitor store.
- Produces: deterministic editor and realtime fixtures at 800x600 and 1200x800.

- [ ] **Step 1: Add deterministic Storybook fixtures**

Create `Editor800x600`, `Monitor800x600`, and `Monitor1200x800`. Use a mock editor grid for the editor fixture and a pre-populated `MonitorStore` showing pressed, hold, layer, and pointer states. The monitor stories use a `play` function to select `リアルタイム`.

- [ ] **Step 2: Build Storybook**

Run: `npm run build-storybook`
Expected: exit 0.

- [ ] **Step 3: Capture and inspect headless screenshots**

Serve `storybook-static` on localhost and use headless Chrome with exact `--window-size=800,600` and `--window-size=1200,800`. Confirm one keyboard, no clipping, no nested vertical scrollbar, readable labels, and a visible mode control. Move generated static output to Trash after inspection; never delete user files.

- [ ] **Step 4: Run complete application verification**

Run all of:

```bash
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run tauri build
```

Expected: every command exits 0. Existing expected `ErrorBoundary` console output and the Rust `block v0.1.6` future-incompatibility warning are non-failing.

- [ ] **Step 5: Request code review and fix all Critical/Important findings**

Review the branch from `8eb7c78` through HEAD against the approved design. Re-run affected focused tests after every fix.

- [ ] **Step 6: Commit fixtures or review fixes**

```bash
git add src/keyboard/KeyboardWorkspace.stories.tsx src/keyboard/KeyboardWorkspace.tsx src/keyboard/KeyboardMonitorSurface.tsx
git commit -m "test: cover single keyboard workspace layouts"
```

### Task 5: Install and Verify the Latest App

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: Tauri bundle from Task 4.
- Produces: one clearly identified installed application matching the verified build.

- [ ] **Step 1: Compare the built bundle with `/Applications`**

Hash the executable inside the built `.app` and the installed `minimal-keys カスタマイズ.app`.

- [ ] **Step 2: Install only with explicit authorization if replacement is needed**

If the hashes differ, report the exact target and request permission before replacing the installed application. If they match, no write is needed.

- [ ] **Step 3: Verify installed identity**

Confirm bundle identifier, version, modification time, and SHA-256. Physical keyboard behavior remains a separate firmware validation and must not be inferred from the desktop bundle.
