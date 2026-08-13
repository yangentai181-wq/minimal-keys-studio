# Opus 5 UI/UX Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every accepted Opus 5 UI/UX finding, including complete right-hand USB monitoring in the installed macOS application, truthful precision states, a usable responsive shell, Japanese errors, and all six performance fixes.

**Architecture:** Add a native Tauri Raw HID adapter behind the existing monitor contracts, then keep high-frequency monitor state at leaf components. Extend capability discovery and precision settings with explicit lifecycles. Render one active editor tab behind a shared dirty-navigation guard, and remove avoidable subscription, calculation, loading, and font costs.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tauri 2, Rust, `hidapi`, Tailwind CSS

## Global Constraints

- Follow red-green-refactor TDD: every behavior change begins with a failing test and the failure is observed.
- The Tauri macOS application must provide both Studio RPC editing and live Raw HID monitoring from the primary “右手をUSBで接続” flow.
- Raw HID filtering uses usage page `0xff60` and usage `0x61`.
- The default window is 1200×800; 800×600 remains supported and keeps the editor visible.
- User-facing errors are Japanese and never expose raw exception strings, RPC names, or English `Failed`/`failed` text.
- Loading, available, disconnected, firmware-update-required, and error states remain distinct.
- Dirty work is never silently lost when switching tabs, disconnecting, receiving a newer revision, or retrying.
- Pointer frames must not re-render `AppInner`, the header, or an editor tab.
- The application performs no runtime request to Google Fonts.
- No firmware protocol or protobuf change is allowed.

---

### Task 1: Native Tauri Raw HID transport and complete right-hand USB flow

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/transport/mod.rs`
- Create: `src-tauri/src/transport/hid.rs`
- Create: `src/tauri/rawHid.ts`
- Create: `src/tauri/rawHid.test.ts`
- Modify: `src/connection/useRightUsbConnection.ts`
- Modify: `src/connection/useRightUsbConnection.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/ConnectModal.tsx`
- Modify: `src/ConnectModal.test.tsx`

**Interfaces:**
- Rust commands: `raw_hid_open() -> Result<RawHidDeviceInfo, String>` and `raw_hid_close() -> Result<(), String>`.
- Rust event: `raw_hid_input` with `Vec<u8>` payload.
- Frontend: `connectTauriRawHidMonitor(onFrame): Promise<RawHidSubscription | undefined>`.
- `useRightUsbConnection` consumes injected/default platform operations instead of importing WebHID directly.

- [ ] **Step 0: Restore the Rust verification toolchain**

The current shell has no `cargo` executable. Install the official user-scoped stable Rust toolchain, then record `rustc --version` and `cargo --version`. Do not continue with a frontend-only implementation when the native backend cannot be compiled.

- [ ] **Step 1: Write failing frontend adapter tests**

Test that the Tauri adapter invokes `raw_hid_open`, forwards `raw_hid_input` bytes to the existing frame parser callback, unregisters the event listener, and invokes `raw_hid_close` exactly once.

```ts
it("forwards Tauri HID reports and closes the native reader", async () => {
  const onFrame = vi.fn();
  const subscription = await connectTauriRawHidMonitor(onFrame);
  emitRawHid([1, 23, 1]);
  expect(onFrame).toHaveBeenCalledTimes(1);
  await subscription?.close();
  expect(unlisten).toHaveBeenCalledOnce();
  expect(invoke).toHaveBeenCalledWith("raw_hid_close");
});
```

- [ ] **Step 2: Run the frontend test and observe RED**

Run: `npm test -- src/tauri/rawHid.test.ts`

Expected: FAIL because the native adapter does not exist.

- [ ] **Step 3: Write failing Rust unit tests**

Put pure filtering and lifecycle decisions behind testable helpers. Cover correct usage page/usage, rejected interfaces, duplicate open, close, and read-error cleanup.

```rust
#[test]
fn accepts_only_minimal_keys_vendor_interface() {
    assert!(matches_usage(0xff60, 0x61));
    assert!(!matches_usage(0x0001, 0x0006));
}
```

- [ ] **Step 4: Run Rust tests and observe RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml transport::hid`

Expected: FAIL because `transport::hid` is not implemented.

- [ ] **Step 5: Implement native HID and frontend adapter**

Add `hidapi` 2.6.6 with shared access on macOS. Use target-specific backends so CI remains portable:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
hidapi = { version = "2.6.6", default-features = false, features = ["macos-shared-device"] }

[target.'cfg(target_os = "linux")'.dependencies]
hidapi = { version = "2.6.6", default-features = false, features = ["linux-native-basic-udev"] }

[target.'cfg(target_os = "windows")'.dependencies]
hidapi = { version = "2.6.6", default-features = false, features = ["windows-native"] }
```

Keep HID state separate from `ActiveConnection`, spawn one blocking reader task, emit `raw_hid_input`, and make close idempotent. Add platform selection:

```ts
const connectMonitor = window.__TAURI_INTERNALS__
  ? connectTauriRawHidMonitor
  : connectRawHidMonitor;
```

Do not alter the existing serial Studio RPC transport.

- [ ] **Step 6: Write failing Tauri connection-flow tests**

Cover that Tauri renders “右手をUSBで接続” as the primary action, passes native monitor open into `runRightUsbFlow`, and does not wait for BLE enumeration before showing USB choices.

- [ ] **Step 7: Implement the Tauri primary flow**

Refactor `ConnectModal` so a primary right-USB action can coexist with `pick_and_connect` transports. Keep BLE under a secondary section. Ensure the monitor-only BLE fallback supports Tauri `pick_and_connect`.

- [ ] **Step 8: Run focused tests and Rust checks**

Run:

```bash
npm test -- src/tauri/rawHid.test.ts src/connection/useRightUsbConnection.test.tsx src/ConnectModal.test.tsx src/connection/rightUsbFlow.test.ts
cargo test --manifest-path src-tauri/Cargo.toml transport::hid
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src src/tauri src/connection src/App.tsx src/ConnectModal.tsx src/ConnectModal.test.tsx
git commit -m "feat: support right USB monitoring in Tauri"
```

---

### Task 2: Truthful capability discovery and precision states

**Files:**
- Modify: `src/rpc/CustomSubsystemsContext.ts`
- Modify: `src/rpc/CustomSubsystemsProvider.tsx`
- Create: `src/rpc/CustomSubsystemsProvider.test.tsx`
- Modify: `src/rpc/useCustomSubsystem.tsx`
- Modify: `src/trackball/precision-state.ts`
- Modify: `src/trackball/precision-state.test.ts`
- Modify: `src/trackball/TrackballPrecisionContext.tsx`
- Modify: `src/trackball/TrackballPrecisionContext.test.tsx`
- Modify: `src/trackball/TrackballPrecisionSettings.tsx`
- Modify: `src/trackball/TrackballPrecisionSettings.test.tsx`

**Interfaces:**
- `CustomSubsystemsState = { status: "disconnected" | "loading" | "ready" | "error"; subsystems: CustomSubsystemInfo[]; retry(): void }`.
- `TrackballPrecisionAvailability = "loading" | "available" | "disconnected" | "firmware-update-required" | "error"`.
- `acceptConfig` preserves a dirty draft for any newer valid revision.
- `disconnectPrecisionState` preserves confirmed/draft/dirty and clears pending.

- [ ] **Step 1: Write failing capability-lifecycle tests**

Cover disconnected, loading, ready-empty, ready-with-subsystem, error, retry, and stale response ignored after connection generation changes.

- [ ] **Step 2: Run provider tests and observe RED**

Run: `npm test -- src/rpc/CustomSubsystemsProvider.test.tsx`

- [ ] **Step 3: Implement capability lifecycle**

Replace the array-only context with explicit state. Preserve a compatibility hook that returns the matching subsystem while exposing lifecycle and retry to precision settings.

- [ ] **Step 4: Write failing pure precision-state tests**

```ts
it("keeps a dirty draft when a newer device revision arrives", () => {
  const dirty = updateDraft(acceptConfig(createPrecisionState(), config(4)), { normalCpi: 1000 });
  const next = acceptConfig(dirty, config(5));
  expect(next.draft?.normalCpi).toBe(1000);
  expect(next.confirmed?.revision).toBe(5);
  expect(next.dirty).toBe(true);
});
```

Also cover disconnect during save, reconnect, save failure, and conflict reporting.

- [ ] **Step 5: Run pure state tests and observe RED**

Run: `npm test -- src/trackball/precision-state.test.ts`

- [ ] **Step 6: Implement precision draft preservation**

Replace destructive `reconnect()` behavior with explicit disconnect/reload transitions. Never show raw exception text to users.

- [ ] **Step 7: Write failing context and UI tests for all five states**

Assert exact Japanese text and retry behavior:

```ts
expect(screen.getByText("設定を読み込んでいます…")).toBeInTheDocument();
expect(screen.getByText("キーボードに接続すると設定できます")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "もう一度読み込む" })).toBeEnabled();
```

- [ ] **Step 8: Implement truthful precision UI and retry**

Show last confirmed values in disconnected mode as read-only context, expose the dirty badge, and route discovery retry before settings reload when discovery failed.

- [ ] **Step 9: Run focused tests**

Run:

```bash
npm test -- src/rpc/CustomSubsystemsProvider.test.tsx src/trackball/precision-state.test.ts src/trackball/TrackballPrecisionContext.test.tsx src/trackball/TrackballPrecisionSettings.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/rpc src/trackball
git commit -m "fix: make precision connection states truthful"
```

---

### Task 3: Responsive shell, compact connection details, and safe tab lifecycle

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/index.css`
- Modify: `src/App.tsx`
- Modify: `src/StudioConnectionOverview.tsx`
- Modify: `src/StudioConnectionOverview.test.tsx`
- Create: `src/navigation/DirtyStateContext.tsx`
- Create: `src/navigation/DirtyStateContext.test.tsx`
- Create: `src/navigation/UnsavedChangesDialog.tsx`
- Create: `src/navigation/UnsavedChangesDialog.test.tsx`
- Modify: `src/trackball/TrackballPrecisionSettings.tsx`
- Modify: `src/trackball/TrackballSettings.tsx`
- Modify: `src/encoder/EncoderSettings.tsx`
- Modify: `src/combos/ComboSettings.tsx`
- Modify: `src/bluetooth/BleManagement.tsx`
- Modify: `src/holdtap/HoldTapSettings.tsx`
- Modify: `src/settings/DeviceSettings.tsx`
- Modify: `src/keyboard/Keyboard.tsx`

**Interfaces:**
- `useDirtyRegistration(id, { dirty, save, discard })`.
- `requestNavigation(action): Promise<boolean>` resolves only after clean/save/discard; cancel resolves false.
- `StudioConnectionOverview` defaults to compact and expands into a bounded scroll surface.

- [ ] **Step 1: Write failing compact-layout tests**

Assert the summary is visible, details are absent by default, “接続の詳細” expands them, and the expanded section has bounded overflow classes rather than permanent page height.

- [ ] **Step 2: Run layout tests and observe RED**

Run: `npm test -- src/StudioConnectionOverview.test.tsx`

- [ ] **Step 3: Implement responsive shell and window configuration**

Set `width: 1200`, `height: 800`, `minWidth: 800`, `minHeight: 600`. Use `h-dvh`, a compact status row, and a dialog/drawer for detailed monitoring. Preserve at least 250 px for the editor at 800×600.

- [ ] **Step 4: Write failing dirty-navigation tests**

Cover clean navigation, save-and-navigate, discard-and-navigate, cancel, save failure, and disconnect while dirty.

- [ ] **Step 5: Run dirty-navigation tests and observe RED**

Run: `npm test -- src/navigation/DirtyStateContext.test.tsx src/navigation/UnsavedChangesDialog.test.tsx`

- [ ] **Step 6: Implement dirty registry and dialog**

The dialog uses nontechnical Japanese: “変更を保存しますか？” with “保存して移動”, “破棄して移動”, and “戻る”. Saving failure keeps the current screen mounted.

- [ ] **Step 7: Write failing active-tab lifecycle test**

Render the app with instrumented tab components. Switch tabs and assert the old clean screen unmounts. Mark it dirty and assert navigation waits for the dialog decision.

- [ ] **Step 8: Replace `mountedTabs` with active-only rendering**

Remove the permanent `Set<ActiveTab>`. Render only the active settings screen after `requestNavigation` succeeds. Register existing keymap dirty behavior through the same guard.

- [ ] **Step 9: Run focused tests and build**

Run:

```bash
npm test -- src/StudioConnectionOverview.test.tsx src/navigation
npm run build
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src-tauri/tauri.conf.json src/index.css src/App.tsx src/StudioConnectionOverview* src/navigation src/trackball src/encoder src/combos src/bluetooth src/holdtap src/settings
git commit -m "fix: keep the editor usable and protect drafts"
```

---

### Task 4: Japanese failure messages and copy regression protection

**Files:**
- Create: `src/copy/errorMessages.ts`
- Create: `src/copy/errorMessages.test.ts`
- Modify: `src/keyboard/Keyboard.tsx`
- Modify: `src/trackball/TrackballSettings.tsx`
- Modify: `src/encoder/EncoderSettings.tsx`
- Modify: `src/bluetooth/BleManagement.tsx`
- Modify: `src/settings/DeviceSettings.tsx`
- Modify: `src/holdtap/HoldTapSettings.tsx`
- Create: `src/copy/userFacingEnglish.test.ts`

**Interfaces:**
- Export named Japanese constants grouped by feature and action.
- A static regression test scans user-facing TSX source and rejects `toast("Failed` and raw exception interpolation in user copy.

- [ ] **Step 1: Write failing message-table and source-scan tests**

Assert all twenty-two named operations have Japanese text and that current source fails the English scan.

- [ ] **Step 2: Run tests and observe RED**

Run: `npm test -- src/copy/errorMessages.test.ts src/copy/userFacingEnglish.test.ts`

- [ ] **Step 3: Implement centralized Japanese copy**

Use operation-first messages, for example “トラックボール設定の保存に失敗しました。接続を確認して、もう一度お試しください”. Keep technical details in `console.error` only.

- [ ] **Step 4: Replace all twenty-two English toasts**

Replace exactly the audited paths. Do not change unrelated developer logs.

- [ ] **Step 5: Run regression tests and source search**

Run:

```bash
npm test -- src/copy/errorMessages.test.ts src/copy/userFacingEnglish.test.ts
rg -n 'toast\([^\n]*[Ff]ailed' src
```

Expected: tests PASS and search returns no user-facing matches.

- [ ] **Step 6: Commit**

```bash
git add src/copy src/keyboard/Keyboard.tsx src/trackball/TrackballSettings.tsx src/encoder/EncoderSettings.tsx src/bluetooth/BleManagement.tsx src/settings/DeviceSettings.tsx src/holdtap/HoldTapSettings.tsx
git commit -m "fix: translate failure feedback into Japanese"
```

---

### Task 5: Render isolation, stable subscriptions, and key calculation memoization

**Files:**
- Modify: `src/monitor/monitorStore.ts`
- Modify: `src/connection/useRightUsbConnection.ts`
- Modify: `src/connection/useRightUsbConnection.test.tsx`
- Create: `src/monitor/useMonitorSnapshot.ts`
- Modify: `src/StudioConnectionOverview.tsx`
- Modify: `src/monitor/MonitorPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/usePubSub.ts`
- Modify: `src/usePubSub.test.ts`
- Modify: `src/keyboard/Keymap.tsx`
- Create: `src/keyboard/key-presentation.ts`
- Create: `src/keyboard/key-presentation.test.ts`

**Interfaces:**
- `RightUsbConnection` exposes a stable `monitorStore`, not a subscribed `monitor` snapshot.
- `useMonitorSnapshot(store)` is called only inside monitor-specific leaves.
- `buildKeyPresentation(input)` is a pure memoizable selector.

- [ ] **Step 1: Write failing render-isolation test**

Mount an instrumented editor and monitor leaf. Push pointer frames into the store. Assert the monitor updates while the editor and header render counters stay unchanged.

- [ ] **Step 2: Run render test and observe RED**

Run: `npm test -- src/connection/useRightUsbConnection.test.tsx`

- [ ] **Step 3: Move monitor subscriptions to leaves**

Return the stable store from the connection hook. Subscribe inside `StudioConnectionOverview` details and `MonitorPanel`. Keep coordinator state at the root.

- [ ] **Step 4: Write failing `useSub` lifecycle tests**

Cover one registration across re-renders, latest callback invocation, event-name replacement, explicit unsubscribe, and unmount cleanup.

- [ ] **Step 5: Implement stable proxy subscription**

```ts
const callbackRef = useRef(callback);
callbackRef.current = callback;
useEffect(() => {
  const proxy = (data: unknown) => callbackRef.current(data);
  emitter.on(name, proxy);
  return () => emitter.off(name, proxy);
}, [name]);
```

Preserve the public unsubscribe behavior without allowing duplicate cleanup.

- [ ] **Step 6: Write failing key-presentation memoization tests**

Test the pure selector output and a component boundary that reuses presentation data when only selected position or `oneU` changes, while invalidating on keymap, layout, behavior, layer, or OS changes.

- [ ] **Step 7: Extract and memoize key presentation**

Move layer-name construction out of the 43-key loop. Memoize behavior lists and tooltip-ready position data with explicit dependencies.

- [ ] **Step 8: Run focused performance tests**

Run:

```bash
npm test -- src/monitor/monitorStore.test.ts src/connection/useRightUsbConnection.test.tsx src/usePubSub.test.ts src/keyboard/key-presentation.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/monitor src/connection src/StudioConnectionOverview.tsx src/App.tsx src/usePubSub* src/keyboard
git commit -m "perf: isolate monitoring and memoize key rendering"
```

---

### Task 6: Remove artificial loading delay and remote font dependency

**Files:**
- Modify: `src/keyboard/Keyboard.tsx`
- Create: `src/keyboard/Keyboard.loading.test.tsx`
- Modify: `src/index.css`
- Modify: `tailwind.config.js`
- Create: `src/style/noRemoteFonts.test.ts`

**Interfaces:**
- Loading visibility is derived directly from unresolved required data.
- UI body uses the system sans-serif stack; technical values may use the system monospace stack.

- [ ] **Step 1: Write failing immediate-loading test**

Resolve required keyboard data within 100 ms under fake timers and assert the keyboard appears without advancing to 500 ms. Keep an unresolved-data assertion for the spinner.

- [ ] **Step 2: Run test and observe RED**

Run: `npm test -- src/keyboard/Keyboard.loading.test.tsx`

- [ ] **Step 3: Remove `useMinLoadingTime`**

Delete the minimum-duration hook and render loading solely from actual data readiness.

- [ ] **Step 4: Write failing remote-font test**

Read `src/index.css`, `tailwind.config.js`, and the production bundle fixture/source list; reject `fonts.googleapis.com` and `fonts.gstatic.com`.

- [ ] **Step 5: Remove Google Fonts and apply system typography**

Delete the `@import`. Use:

```css
font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", sans-serif;
```

Retain a separate system monospace stack for code/technical numeric elements.

- [ ] **Step 6: Run focused tests and production build**

Run:

```bash
npm test -- src/keyboard/Keyboard.loading.test.tsx src/style/noRemoteFonts.test.ts
npm run build
rg -n 'fonts\.googleapis\.com|fonts\.gstatic\.com' src dist tailwind.config.js
```

Expected: tests and build PASS; search returns no matches.

- [ ] **Step 7: Commit**

```bash
git add src/keyboard/Keyboard.tsx src/index.css tailwind.config.js src/style
git commit -m "perf: remove loading delay and remote fonts"
```

---

### Task 7: Integrated verification and acceptance audit

**Files:**
- Modify tests or implementation only when a failing acceptance check reveals a real defect.
- Update: `.superpowers` task ledger and final review artifacts only; do not add generated build outputs.

**Interfaces:**
- Every acceptance criterion in `docs/superpowers/specs/2026-08-05-opus-uiux-remediation-design.md` must have direct evidence.

- [ ] **Step 1: Run the complete frontend verification suite**

```bash
npm test
npm run lint
npm run build
npm run build-storybook
```

- [ ] **Step 2: Run the complete Tauri verification suite**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
npm run tauri build
```

- [ ] **Step 3: Verify window layouts**

Launch the application at 800×600 and 1200×800. Capture screenshots and confirm the compact status row, visible editor, bounded details, Japanese states, and active-only tab lifecycle.

- [ ] **Step 4: Verify real hardware workflow**

With the right half connected by USB and left half wireless through the right:

1. Use “右手をUSBで接続”.
2. Confirm monitor and editor contracts both become ready.
3. Confirm key, layer, and pointer monitoring updates.
4. Hold physical X and move the ball; current state must show precision/200 CPI.
5. Release X; current state must show normal/800 CPI.
6. Confirm left-half input remains stable.

- [ ] **Step 5: Run requirement-by-requirement audit**

For each of the twelve acceptance criteria, record the exact test, build output, screenshot, or hardware observation that proves it. Missing evidence is a failure, not a pass.

- [ ] **Step 6: Request independent whole-branch review**

Give the reviewer the approved spec, full branch diff from `6307852`, verification results, and acceptance evidence. Resolve every Critical/Important finding and re-review the fix diff.

- [ ] **Step 7: Commit any final fixes and final evidence**

```bash
git add src src-tauri docs/superpowers
git commit -m "test: verify Opus UI UX remediation"
```
