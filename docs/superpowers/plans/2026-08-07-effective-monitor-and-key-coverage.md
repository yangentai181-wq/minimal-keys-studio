# Effective Monitor and Key Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Show the actual key/action that will fire in realtime and add the important conventional keyboard keys missing from the factory keymap.

**Architecture:** A pure monitor resolver combines the live Studio RPC keymap, behavior metadata, and Raw HID active-layer mask using persistent layer IDs. The editor publishes its already-loaded keymap through a small context so the monitor never performs a duplicate RPC request. Firmware config remains the source of factory assignments; the Studio fallback table mirrors it only when live keymap data is unavailable.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tauri 2, ZMK devicetree keymap, Python config tests.

## Global Constraints

- Editing continues to display the raw \`Transparent\` setting; realtime never displays unresolved \`Trans\`.
- Only \`Transparent\` falls through; \`None\` and \`To Layer\` are terminal actions.
- Raw HID layer bits and layer behavior parameters are persistent layer IDs, not array indexes.
- Do not add dependencies or change RPC/protobuf contracts.
- Preserve the 43 physical positions and protected precision layer L8.
- Use local fonts and the existing teal/orange/slate design tokens.

---

### Task 1: Pure effective-binding resolver

**Files:**
- Create: \`src/monitor/resolveMonitorBindings.ts\`
- Create: \`src/monitor/resolveMonitorBindings.test.ts\`
- Modify: \`src/keyboard/key-presentation.tsx\`

**Interfaces:**
- Consumes: \`Keymap\`, \`BehaviorBinding\`, \`Record<number, GetBehaviorDetailsResponse>\`, \`activeLayerMask\`, physical position.
- Produces: \`resolveMonitorBinding(input): ResolvedMonitorBinding\` and \`resolveMonitorLayer(keymap, activeLayerMask)\`.

- [ ] **Step 1: Write failing resolver tests**

Cover L8→L3, multiple transparent layers→L0, \`None\`, \`To Layer 0\`, unknown behavior, edited binding, and reordered layers whose \`id\` differs from array index.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: \`npm test -- --run src/monitor/resolveMonitorBindings.test.ts\`

Expected: non-zero because the resolver module does not exist.

- [ ] **Step 3: Implement the minimal pure resolver**

Use this result shape:

\`\`\`ts
export type ResolvedMonitorBinding = {
  label: string;
  sourceLayerId: number | null;
  sourceLayerIndex: number | null;
  inherited: boolean;
  unknown: boolean;
};
\`\`\`

Walk \`keymap.layers\` from highest priority to lowest, filter active layers with \`activeLayerMask & (1 << layer.id)\`, continue only when behavior \`displayName === \"Transparent\"\`, and reuse presentation label helpers without reusing the editor's raw \`Trans\` branch.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: \`npm test -- --run src/monitor/resolveMonitorBindings.test.ts\`

Expected: exit 0.

### Task 2: Share the editor's live keymap

**Files:**
- Create: \`src/keyboard/MonitorKeymapContext.tsx\`
- Create: \`src/keyboard/MonitorKeymapContext.test.tsx\`
- Modify: \`src/keyboard/Keyboard.tsx\`
- Modify: \`src/App.tsx\`

**Interfaces:**
- Produces: \`MonitorKeymapProvider\`, \`useMonitorKeymap()\`, and \`usePublishMonitorKeymap(keymap)\`.
- Consumes: the existing local \`keymap\` state in \`Keyboard\`.

- [ ] **Step 1: Write failing provider tests**

Test initial undefined state, publish, replacement after an edit, and cleanup that cannot clear a newer publication.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: \`npm test -- --run src/keyboard/MonitorKeymapContext.test.tsx\`

- [ ] **Step 3: Implement provider and publish from Keyboard**

Wrap \`RightUsbEditorShell\` and its overview/workspace inside one provider. Publish the exact in-memory keymap after load and every local edit; do not issue another RPC.

- [ ] **Step 4: Run context and loading tests**

Run: \`npm test -- --run src/keyboard/MonitorKeymapContext.test.tsx src/keyboard/Keyboard.loading.test.tsx src/App.monitor-isolation.test.tsx\`

Expected: exit 0.

### Task 3: Integrate resolved labels into realtime UI

**Files:**
- Modify: \`src/monitor/MinimalKeysMonitorLayout.tsx\`
- Modify: \`src/monitor/MinimalKeysMonitorLayout.test.tsx\`
- Modify: \`src/keyboard/KeyboardMonitorSurface.tsx\`
- Modify: \`src/keyboard/KeyboardMonitorSurface.test.tsx\`
- Modify: \`src/StudioConnectionOverview.tsx\`
- Modify: \`src/StudioConnectionOverview.test.tsx\`
- Modify: \`src/monitor/MonitorPanel.tsx\`

**Interfaces:**
- \`MinimalKeysMonitorLayout\` accepts optional \`resolvedBindings: readonly ResolvedMonitorBinding[]\`.

- [ ] **Step 1: Write failing UI tests**

Assert that live keymap labels replace \`Trans\`, an inherited key has an accessible “下位レイヤーから継承” description, L4 says “通常へ戻る”, and monitor-only mode says “出荷時設定の目安”.

- [ ] **Step 2: Run focused UI tests and confirm RED**

Run: \`npm test -- --run src/monitor/MinimalKeysMonitorLayout.test.tsx src/keyboard/KeyboardMonitorSurface.test.tsx src/StudioConnectionOverview.test.tsx\`

- [ ] **Step 3: Memoize and render resolved bindings**

Compute the 43 results with \`useMemo\` keyed by keymap, behaviors, and layer mask. Keep monitor-store subscription inside monitor leaves so pointer traffic does not re-render the editor.

- [ ] **Step 4: Run focused UI tests and confirm GREEN**

Run the command from Step 2; expected exit 0.

### Task 4: Correct event and layer-ID semantics

**Files:**
- Modify: \`src/monitor/monitorStore.ts\`
- Modify: \`src/monitor/monitorStore.test.ts\`
- Modify: \`src/connection/rawHidFrames.ts\`
- Modify: \`src/connection/rawHidFrames.test.ts\`
- Modify: \`src/behaviors/binding-display.ts\`
- Modify: \`src/behaviors/__tests__/binding-display.test.ts\`
- Modify: \`src/keyboard/key-presentation.tsx\`
- Modify: \`src/keyboard/key-presentation.test.tsx\`
- Modify: \`src/behaviors/picker/LayersTab.tsx\`
- Modify: \`src/behaviors/picker/LayersTab.test.tsx\`

**Interfaces:**
- Add \`lastKeyEvent: { position: number; pressed: boolean; at: number } | null\` to \`MonitorSnapshot\`.
- Layer-name lookup accepts \`layers\` and resolves \`param1\` by \`layer.id\`.

- [ ] **Step 1: Write failing semantics tests**

Cover simultaneous key ordering, release events, reordered layer IDs, and a pointer sample older than the display timeout.

- [ ] **Step 2: Run tests and confirm RED**

Run: \`npm test -- --run src/monitor/monitorStore.test.ts src/connection/rawHidFrames.test.ts src/behaviors/__tests__/binding-display.test.ts src/keyboard/key-presentation.test.tsx src/behaviors/picker/LayersTab.test.tsx\`

- [ ] **Step 3: Implement the shared last-event source and ID lookups**

All latest-key displays consume \`lastKeyEvent\`. Rename pointer copy to “直近の移動” and render “停止中” after 500ms. Resolve all layer behavior labels and picker values through persistent IDs.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the command from Step 2; expected exit 0.

### Task 5: Add missing conventional keys to firmware config

**Files:**
- Modify: \`/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config/minimal-keys.keymap\`
- Create: \`/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/tests/test_standard_key_coverage.py\`

**Interfaces:**
- Factory layer positions and exact bindings are defined in the approved design specification.

- [ ] **Step 1: Write the failing config coverage test**

Parse each layer's \`bindings\` block and assert 43 entries. Assert L2 positions 10/21, L3 positions 28/29, L5 positions 4–9/22, L1 main-number HID aliases, and all-transparent protected L8.

- [ ] **Step 2: Run test and confirm RED**

Run: \`python3 -m unittest tests/test_standard_key_coverage.py\`

Expected: non-zero because required bindings are absent.

- [ ] **Step 3: Apply the approved assignments**

Add Forward Delete, Insert, brackets, Caps Lock, macOS screenshots, brightness, and explicit volume controls. Update comments so L1 is “Numbers”, not “Numpad”.

- [ ] **Step 4: Run config test and firmware build**

Run: \`python3 -m unittest tests/test_standard_key_coverage.py\`

Then run the repository's existing right-half firmware build command from CI/local scripts. Both must exit 0.

### Task 6: Synchronize honest factory fallback labels

**Files:**
- Modify: \`src/monitor/minimalKeysMonitorLabels.ts\`
- Modify: \`src/monitor/layerNames.ts\`
- Modify: \`src/monitor/MinimalKeysMonitorLayout.test.tsx\`
- Modify: \`src/keyboard/minimal-keys-layers.ts\`

- [ ] **Step 1: Write failing fallback tests**

Assert L1 “数字”, L8 “精密モード”, the new factory bindings, “通常へ戻る”, and exactly 43 labels on all nine layers.

- [ ] **Step 2: Run and confirm RED**

Run: \`npm test -- --run src/monitor/MinimalKeysMonitorLayout.test.tsx\`

- [ ] **Step 3: Update fallback tables and names**

Mirror firmware config exactly. Never label \`&to 0\` as transparent or a base letter.

- [ ] **Step 4: Run and confirm GREEN**

Run the command from Step 2; expected exit 0.

### Task 7: Final verification and application replacement

**Files:**
- Update only verification evidence if the repository's existing workflow requires it.

- [ ] **Step 1: Run all Studio gates**

Run \`npm test\`, \`npm run build\`, \`npm run lint\`, and \`npm run tauri build\`; record each exit code.

- [ ] **Step 2: Render headless screenshots**

Capture realtime/editor at 800×600 and 1200×800. Verify realtime has no unresolved \`Trans\`, labels are legible, and the editor still shows raw “透過”.

- [ ] **Step 3: Run independent code review**

Review the final diffs against the design, TDD evidence, UI rules, and both firmware/Studio sources of truth. Fix findings and rerun affected gates.

- [ ] **Step 4: Replace the installed app**

Back up the previous \`/Applications/minimal-keys カスタマイズ.app\` recoverably, install the newly built bundle, and compare bundle hash/version with the build output.
