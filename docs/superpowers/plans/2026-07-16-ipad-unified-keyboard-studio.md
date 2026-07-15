# iPad Unified Keyboard Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one iPad-landscape keyboard workspace that toggles between live monitoring and editing, adds compact typing practice, and synchronizes Auto Mouse switches with the keyboard.

**Architecture:** `AppInner` keeps transport ownership and selects the visible studio mode. New focused components render the shared mode toggle, monitor workspace, typing practice, orientation notice, and Auto Mouse state. Existing `Keyboard`, Raw HID monitor state, Studio RPC editor actions, and protocol encoders remain the underlying engines.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Aria Components, Lucide icons, Vitest, Testing Library, Web Serial, WebHID, ZMK Studio RPC.

## Global Constraints

- Target iPad landscape viewports from 1024 x 768 upward; portrait displays a rotation notice.
- Show one keyboard surface at a time. Monitor and editor keyboards must never be visible together.
- Keep Raw HID and Studio RPC connection lifecycles unchanged.
- Use `#0D9488` teal, `#F97316` orange, `#F8FAFC` canvas, white surfaces, `#E2E8F0` borders, and JetBrains Mono.
- Keep interactive touch targets at least 44 x 44 CSS pixels.
- The practice surface defaults to collapsed and preserves input and timing across expand/collapse.
- Auto Mouse state comes from `cormoran_rip` device notifications, not browser-only state.
- Do not add dependencies or modify the Raw HID or Studio RPC wire formats.

---

### Task 1: Typing Practice Metrics

**Files:**
- Create: `src/practice/typingPractice.ts`
- Test: `src/practice/typingPractice.test.ts`

**Interfaces:**
- Produces: `PracticeMode`, `PracticeStats`, `PRACTICE_PROMPTS`, and `calculatePracticeStats(value, target, elapsedMs)`.

- [ ] **Step 1: Write failing metric tests**

Cover these exact cases: empty input returns zeros; free input reports character count and 100% accuracy; prompted input counts positional mismatches; WPM uses `characters / 5 / minutes`; prompted completion becomes true only on exact equality; elapsed time below one second does not produce infinity.

```ts
expect(calculatePracticeStats("hello", "hello", 60_000)).toEqual({
  characters: 5,
  errors: 0,
  accuracy: 100,
  wpm: 1,
  complete: true,
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/practice/typingPractice.test.ts`

Expected: FAIL because `./typingPractice` does not exist.

- [ ] **Step 3: Implement the pure calculator**

Use positional comparison for prompted errors and this stable WPM calculation:

```ts
const minutes = Math.max(elapsedMs, 1000) / 60_000;
const wpm = value.length === 0 ? 0 : Math.round(value.length / 5 / minutes);
const errors = target
  ? [...value].reduce((count, char, index) => count + (char === target[index] ? 0 : 1), 0)
  : 0;
const accuracy = value.length === 0 ? 0 : Math.round(((value.length - errors) / value.length) * 100);
```

Export three short Japanese and English practice prompts already stored in source; do not fetch prompts remotely.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/practice/typingPractice.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/typingPractice.ts src/practice/typingPractice.test.ts
git commit -m "feat: add typing practice metrics"
```

### Task 2: Compact Typing Practice Surface

**Files:**
- Create: `src/practice/TypingPractice.tsx`
- Test: `src/practice/TypingPractice.test.tsx`

**Interfaces:**
- Consumes: Task 1 metrics and prompts.
- Produces: `TypingPractice` with no transport dependencies.

- [ ] **Step 1: Write failing interaction tests**

Test that the component starts collapsed, places the textbox before the keyboard slot supplied by the test, switches between `自由` and `お題`, preserves entered text across expand/collapse, starts timing on the first character, resets all values, advances prompts, and exposes WPM/accuracy/error labels.

```tsx
const { rerender } = render(<><TypingPractice /><div data-testid="keyboard" /></>);
expect(screen.getByRole("textbox")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "入力練習を展開" })).toBeInTheDocument();
expect(screen.getByRole("textbox").compareDocumentPosition(screen.getByTestId("keyboard")))
  .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/practice/TypingPractice.test.tsx`

Expected: FAIL because `TypingPractice` does not exist.

- [ ] **Step 3: Implement collapsed and expanded states**

Use a controlled single-line input while collapsed and the same state in a larger textarea while expanded. Use `ChevronDown`, `ChevronUp`, `RotateCcw`, and `SkipForward` icons with tooltips and accessible labels. Keep all controls at least `h-11`. Start a 250ms display timer only after first input and stop it when a prompt is complete.

```tsx
<section className="border-b border-base-300 bg-white px-4 py-2">
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
    <PracticeModeToggle mode={mode} onChange={setMode} />
    <input className="h-11 min-w-0 rounded-md border-2 border-primary bg-teal-50 px-3" />
    <PracticeMetric label="速度" value={`${stats.wpm} WPM`} />
    <IconButton aria-label={expanded ? "入力練習を最小化" : "入力練習を展開"} />
  </div>
</section>
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- src/practice/TypingPractice.test.tsx`

Expected: PASS with no timer warnings.

- [ ] **Step 5: Commit**

```bash
git add src/practice/TypingPractice.tsx src/practice/TypingPractice.test.tsx
git commit -m "feat: add compact typing practice"
```

### Task 3: Shared Auto Mouse Device State

**Files:**
- Create: `src/auto-mouse/AutoMouseSettingContext.tsx`
- Test: `src/auto-mouse/AutoMouseSettingContext.test.tsx`
- Modify: `src/proto/rip.ts`
- Test: `src/proto/rip.test.ts`

**Interfaces:**
- Consumes: `useCustomSubsystem(RIP.SUBSYSTEM_ID)`, `useCustomNotification`, `encodeListInputProcessors`, `encodeSetTempLayerEnabled`, and `decodeNotification`.
- Produces: `AutoMouseSettingProvider` and `useAutoMouseSetting()` returning `{ available, enabled, pending, processors, selectedId, selectProcessor, setEnabled }`.

- [ ] **Step 1: Add failing protocol tests**

Assert that `encodeSetTempLayerEnabled(3, false)` includes an explicit boolean false field. The current proto3-style omission can be ambiguous for a setter request; the request must encode field 2 as `false` so disabling is transmitted intentionally.

```ts
expect([...encodeSetTempLayerEnabled(3, false)]).toEqual([58, 4, 8, 3, 16, 0]);
```

- [ ] **Step 2: Run the protocol test and verify RED**

Run: `npm test -- src/proto/rip.test.ts`

Expected: FAIL because the false value is currently omitted.

- [ ] **Step 3: Encode the boolean field unconditionally**

Change only the setter payload:

```ts
inner.uint32(16).bool(enabled);
```

Run: `npm test -- src/proto/rip.test.ts`

Expected: PASS.

- [ ] **Step 4: Write failing provider tests**

Mock the custom subsystem and notifications. Cover processor discovery, first-processor selection, notification-driven enabled state, synchronized consumers, pending display, successful confirmation, five-second timeout rollback, unavailable state, and processor selection.

- [ ] **Step 5: Run provider tests and verify RED**

Run: `npm test -- src/auto-mouse/AutoMouseSettingContext.test.tsx`

Expected: FAIL because the provider does not exist.

- [ ] **Step 6: Implement notification-confirmed writes**

Keep `confirmedEnabled` separate from `requestedEnabled`. `setEnabled` sets a pending request, sends the RPC, and waits up to five seconds for an `inputProcessorChanged` notification matching the selected processor and requested value. Matching notification commits and clears pending; timeout or RPC error clears the request, preserves the confirmed value, and shows `Auto Mouseの切り替えに失敗しました` through `useToast`.

```ts
const value = {
  available: subsystem !== null && selectedProcessor !== null,
  enabled: requestedEnabled ?? selectedProcessor?.tempLayerEnabled ?? null,
  pending: requestedEnabled !== null,
  processors,
  selectedId,
  selectProcessor: setSelectedId,
  setEnabled,
};
```

- [ ] **Step 7: Run provider and protocol tests and verify GREEN**

Run: `npm test -- src/auto-mouse/AutoMouseSettingContext.test.tsx src/proto/rip.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/auto-mouse src/proto/rip.ts src/proto/rip.test.ts
git commit -m "feat: synchronize auto mouse device state"
```

### Task 4: Mode Toggle And Landscape Shell

**Files:**
- Create: `src/studio/StudioModeToggle.tsx`
- Create: `src/studio/PortraitOrientationNotice.tsx`
- Create: `src/studio/StudioShell.tsx`
- Test: `src/studio/StudioShell.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `StudioMode = "monitor" | "editor"`, accessible `StudioModeToggle`, and `StudioShell` slots for header, monitor, and editor content.

- [ ] **Step 1: Write failing shell tests**

Assert that monitor is initially visible when available, only one mode region is rendered, editor mode is disabled with a readable reason when unavailable, mode switching preserves mounted editor state, and portrait notice markup is present outside the landscape workspace.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/studio/StudioShell.test.tsx`

Expected: FAIL because the shell does not exist.

- [ ] **Step 3: Implement the shell and toggle**

Use two real buttons with `aria-pressed`; do not use a checkbox styled as two labels. Keep the editor content mounted with `hidden` after its first activation so key selection and undo state survive mode changes. Add CSS media rules:

```css
.portrait-orientation-notice { display: none; }
@media (orientation: portrait) {
  .studio-landscape-workspace { display: none; }
  .portrait-orientation-notice { display: flex; }
}
```

- [ ] **Step 4: Run the shell test and verify GREEN**

Run: `npm test -- src/studio/StudioShell.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/studio src/index.css
git commit -m "feat: add unified studio mode shell"
```

### Task 5: Monitor Workspace And Auto Mouse Quick Switch

**Files:**
- Create: `src/studio/MonitorWorkspace.tsx`
- Test: `src/studio/MonitorWorkspace.test.tsx`
- Modify: `src/monitor/MinimalKeysMonitorLayout.tsx`
- Test: `src/monitor/MinimalKeysMonitorLayout.test.tsx`

**Interfaces:**
- Consumes: `TypingPractice`, `MinimalKeysMonitorLayout`, `MonitorSnapshot`, `useAutoMouseSetting`, connection description, and retry action.
- Produces: the complete monitor-mode surface used by connected and monitor-only flows.

- [ ] **Step 1: Write failing workspace tests**

Assert DOM order `TypingPractice` before keyboard, live layer/latest key/pointer values, a 44px Auto Mouse switch, disabled switch with `エディター接続が必要` when RPC is unavailable, pending disabled state, and retry action visibility.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/studio/MonitorWorkspace.test.tsx src/monitor/MinimalKeysMonitorLayout.test.tsx`

Expected: new workspace tests FAIL.

- [ ] **Step 3: Implement the monitor surface**

Lay out `100dvh` as compact practice strip, `minmax(0, 1fr)` keyboard stage, and a fixed metrics/action bar. Replace permanent connection cards and prose with compact status. Use a native checkbox switch with an accessible label and visual track, calling `setEnabled(event.target.checked)`.

- [ ] **Step 4: Make the physical layout fit iPad landscape**

Remove the unconditional `min-w-[680px]` scroll dependency at supported landscape sizes. Use `aspect-ratio`, a constrained width, stable key dimensions, and no viewport-scaled fonts. Preserve `role="grid"`, every position label, pressed state, encoder, and ball markers.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/studio/MonitorWorkspace.test.tsx src/monitor/MinimalKeysMonitorLayout.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/studio/MonitorWorkspace.tsx src/studio/MonitorWorkspace.test.tsx src/monitor/MinimalKeysMonitorLayout.tsx src/monitor/MinimalKeysMonitorLayout.test.tsx
git commit -m "feat: build iPad monitor workspace"
```

### Task 6: Trackball Settings Auto Mouse Switch

**Files:**
- Modify: `src/trackball/TrackballSettings.tsx`
- Create: `src/trackball/TrackballSettings.test.tsx`

**Interfaces:**
- Consumes: shared processor data and `setEnabled` from `useAutoMouseSetting`.
- Produces: the detailed synchronized Auto Mouse switch in the editor.

- [ ] **Step 1: Write failing settings tests**

Assert the switch reflects provider state, toggling calls the shared action, pending disables the switch, processor selection calls `selectProcessor`, and the existing Apply action still sends non-Auto-Mouse processor changes.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/trackball/TrackballSettings.test.tsx`

Expected: FAIL because settings do not consume the provider.

- [ ] **Step 3: Refactor processor discovery into the provider**

Remove TrackballSettings' duplicate `encodeListInputProcessors` call and notification list. Initialize its editable form from `selectedProcessor`; keep dirty form values from being overwritten by unrelated notifications. Replace the current static Auto Mouse Layer card with a labeled switch, Layer 4, and 700ms summary.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- src/trackball/TrackballSettings.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/trackball/TrackballSettings.tsx src/trackball/TrackballSettings.test.tsx
git commit -m "feat: edit auto mouse from trackball settings"
```

### Task 7: App Header And Single-Keyboard Integration

**Files:**
- Modify: `src/AppHeader.tsx`
- Create: `src/AppHeader.test.tsx`
- Create: `src/App.connected.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.disconnected.test.tsx`
- Modify: `src/monitor/MonitorPanel.tsx`
- Modify: `src/UnifiedStudioPreview.tsx`
- Remove superseded working-tree file after consumers migrate: `src/StudioConnectionOverview.tsx`
- Remove superseded working-tree file after consumers migrate: `src/StudioConnectionOverview.test.tsx`

**Interfaces:**
- Consumes: Tasks 3-6 and existing editor components/actions.
- Produces: the final connected and monitor-only application flow.

- [ ] **Step 1: Write failing header and app integration tests**

Add `centerContent` and `showEditorActions` expectations to AppHeader. In `App.connected.test.tsx`, mock monitor and editor keyboards with distinct labels, provide a connected RPC state, switch modes, and assert that exactly one label is visible at a time. Assert switching does not invoke connect, disconnect, save, or discard.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `npm test -- src/AppHeader.test.tsx src/App.connected.test.tsx src/App.disconnected.test.tsx`

Expected: FAIL for missing unified shell integration.

- [ ] **Step 3: Extend AppHeader for the centered toggle**

Add `centerContent?: ReactNode` and `showEditorActions?: boolean`. Render product identity left, the supplied mode toggle centered, and device/OS/editor actions right. Hide save/undo/redo/discard in monitor mode without unmounting their state providers.

- [ ] **Step 4: Integrate the connected app**

Wrap the studio surfaces with `AutoMouseSettingProvider`. Replace `StudioConnectionOverview + nav + editor content` stacking with `StudioShell`. Use this exact shell contract:

```tsx
const monitorSurface = (
  <MonitorWorkspace
    snapshot={rightUsb.monitor}
    monitorActive={rightUsb.monitorActive}
    editorAvailable={Boolean(conn.conn)}
    description={rightUsb.description}
    busy={rightUsb.connecting}
    onConnectMonitor={rightUsb.connectRightUsb}
    onRetryEditor={rightUsb.retryEditor}
  />
);

<StudioShell
  monitorAvailable={rightUsb.monitorActive}
  editorAvailable={Boolean(conn.conn)}
  renderHeader={({ mode, setMode }) => (
    <AppHeader
      connectedDeviceLabel={connectedDeviceName}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undo}
      onRedo={redo}
      onSave={save}
      onDiscard={discard}
      onDisconnect={disconnect}
      onResetSettings={resetSettings}
      centerContent={
        <StudioModeToggle
          mode={mode}
          editorAvailable={Boolean(conn.conn)}
          onChange={setMode}
        />
      }
      showEditorActions={mode === "editor"}
    />
  )}
  monitor={monitorSurface}
  editor={editorWorkspace}
/>
```

Define `editorWorkspace` immediately above this render as the existing editor nav and mounted tab-content block, without adding another keyboard component.

Keep the existing tab mounting strategy inside editor mode. Do not render `MinimalKeysMonitorLayout` anywhere outside monitor mode.

- [ ] **Step 5: Reuse MonitorWorkspace in monitor-only mode**

Simplify `MonitorPanel` to a thin shell around `MonitorWorkspace`, keep close/retry/BLE actions, and show the editor side of the toggle disabled until Studio RPC succeeds.

- [ ] **Step 6: Update the integrated preview**

Render the new shell with deterministic fake snapshot and connection state so browser verification can inspect both modes without hardware.

- [ ] **Step 7: Remove superseded overview files**

Confirm `rg "StudioConnectionOverview" src` has no consumers, then delete its component and test. Do not remove the existing monitor label helpers or physical layout.

- [ ] **Step 8: Run integration tests and verify GREEN**

Run: `npm test -- src/AppHeader.test.tsx src/App.connected.test.tsx src/App.disconnected.test.tsx src/studio src/practice src/auto-mouse`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/AppHeader.tsx src/AppHeader.test.tsx src/App.connected.test.tsx src/App.disconnected.test.tsx src/monitor/MonitorPanel.tsx src/UnifiedStudioPreview.tsx
git commit -m "feat: unify monitor and editor workspace"
```

### Task 8: Full Verification And iPad Acceptance

**Files:**
- Modify only if verification exposes a defect in files already listed above.

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0 with no new warnings.

- [ ] **Step 2: Start the application on an unused local port**

Run: `npm run dev -- --host 127.0.0.1 --port 5174`

Expected: Vite prints a reachable local URL.

- [ ] **Step 3: Verify the integrated preview with Playwright**

At 1024 x 768 and 1366 x 1024 landscape viewports, capture monitor collapsed, monitor expanded, editor keymap, editor trackball settings, and portrait notice. Verify no page overflow, no overlapping controls, keyboard remains visible, touch controls are at least 44px, and only one keyboard exists.

- [ ] **Step 4: Verify real hardware**

With the right half connected by USB, confirm Raw HID key highlights, layer changes, pointer deltas, typing practice, Studio RPC editor mode, and mode switching. Toggle Auto Mouse from the monitor and trackball settings; confirm both controls synchronize and trackball movement enters Layer 4 only when enabled. Reconnect once and record the device-reported state.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~7
```

Confirm `.superpowers/brainstorm` artifacts are not staged and unrelated user changes remain untouched.
