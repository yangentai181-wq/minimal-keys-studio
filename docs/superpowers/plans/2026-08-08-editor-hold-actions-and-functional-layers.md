# Editor Hold Actions and Functional Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make hold-capable keys visible, complete the OS-aware Mod-Tap/Layer-Tap key list, expose Auto Mouse for editing, and assign scroll/precision as hold-only actions.

**Architecture:** Keep the existing RPC and firmware behavior. Centralize tap choices in one OS-aware catalog, identify functional layers by stable IDs, and build scroll/precision settings as ordinary `Layer-Tap` bindings targeting IDs 7 and 8. Add hold metadata to the existing key presentation model for the orange editor border.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tailwind CSS, Tauri 2.

**Global Constraints:** TDD for every testable change. Do not modify `work/`, add dependencies, or change RPC/proto/firmware. Preserve catalog-external bindings. Use `layer.id`, not array position, for Auto Mouse (4), Scroll (7), and Precision (8). Auto Mouse stays hidden only in the inactive monitor. Scroll and precision are momentary, never toggles.

---

## Task 1: Build one complete OS-aware tap-key catalog

**Files:**
- Modify: `src/behaviors/picker/common-tap-keys.ts`
- Create: `src/behaviors/picker/common-tap-keys.test.ts`

- [ ] Write failing tests for `getCommonTapKeys(osMode)`: macOS `ABC=LANG2`, `あいう=LANG1`; Windows `ABC=NonConvert`, `あいう=Convert`; arrows, navigation, F1-F24, left/right modifiers, common/system keys, symbols and shifted symbols; no duplicate encoded usages; OS-correct Cmd/Option versus Win/Alt labels.
- [ ] Run `npm test -- src/behaviors/picker/common-tap-keys.test.ts` and confirm RED.
- [ ] Implement `getCommonTapKeys(osMode: UserOS): TapKeyItem[]` and `encodeTapKey(item: TapKeyItem): number`, generating repeated ranges and keeping explicit special HID IDs.
- [ ] Rerun the focused test and confirm GREEN.
- [ ] Commit: `feat: add OS-aware tap key catalog`.

## Task 2: Use the catalog consistently in Mod-Tap and Layer-Tap

**Files:**
- Modify: `src/behaviors/picker/TapKeySelect.tsx`
- Modify: `src/behaviors/picker/TapKeySelect.test.tsx`
- Modify: `src/behaviors/picker/ModifiersTab.tsx`
- Modify: `src/behaviors/picker/LayersTab.tsx`
- Modify: `src/behaviors/picker/PickerTabs.tsx`
- Modify: `src/behaviors/picker/PickerTabs.test.tsx`
- Modify: `src/behaviors/picker/LayersTab.test.tsx`

- [ ] Write failing tests that both tabs show OS-correct labels, OS changes clear an unapplied semantic selection, and a current binding absent from the catalog remains representable rather than being dropped.
- [ ] Run the three focused picker test files and confirm RED.
- [ ] Add `osMode` and optional `currentExternal` to `TapKeySelect`; pass `osMode` through `PickerTabs`, `ModifiersTab`, and `LayersTab`; reset unapplied semantic selection on OS change; reuse `encodeTapKey` for param2.
- [ ] Rerun focused tests and confirm GREEN.
- [ ] Commit: `fix: share tap key choices across hold behaviors`.

## Task 3: Mark long-press behaviors with an orange editor border

**Files:**
- Modify: `src/keyboard/key-presentation.tsx`
- Modify: `src/keyboard/key-presentation.test.tsx`
- Modify: `src/keyboard/PhysicalLayout.tsx`
- Modify: `src/keyboard/PhysicalLayout.test.tsx`
- Modify: `src/keyboard/Key.tsx`
- Create: `src/keyboard/Key.test.tsx`

- [ ] Write failing tests that `Layer-Tap`, `LAYER_TAP_MKP`, `Mod-Tap`, and `Hold-Tap` set `hasHoldAction`, `Key Press` does not, hold keys have an orange border and `長押し動作あり` accessibility text, and selected hold keys retain orange plus an outer primary ring.
- [ ] Run the three focused keyboard tests and confirm RED.
- [ ] Add `isHoldActionBehavior`, extend `KeyPosition`/`KeyProps` with `hasHoldAction`, populate it in `buildKeyPresentation`, and render a 2px-equivalent orange border with a separate selection ring.
- [ ] Rerun focused tests and confirm GREEN.
- [ ] Commit: `feat: highlight hold actions in keyboard editor`.

## Task 4: Identify functional layers by stable ID and expose Auto Mouse

**Files:**
- Modify: `src/keyboard/minimal-keys-layers.ts`
- Modify: `src/keyboard/minimal-keys-layers.test.ts`
- Modify: `src/keyboard/LayerPicker.tsx`
- Modify: `src/keyboard/LayerPicker.test.tsx`
- Modify: `src/keyboard/Keyboard.tsx`
- Modify if required: `src/monitor/MonitorPanel.tsx`
- Modify: `src/behaviors/picker/LayersTab.tsx`
- Modify: `src/behaviors/picker/LayersTab.test.tsx`

- [ ] Write failing reordered-layer tests: IDs 4/7/8 keep their roles regardless of position; editor shows inactive Auto Mouse and hides Precision; monitor can still hide inactive Auto Mouse; applied bindings use persistent IDs.
- [ ] Run minimal-layer, LayerPicker, and LayersTab tests and confirm RED.
- [ ] Replace index constants/helpers with `AUTO_MOUSE_LAYER_ID=4`, `SCROLL_LAYER_ID=7`, `PRECISION_LAYER_ID=8`, `getMinimalKeysLayerRole(layerId)`, and `isPrecisionLayerId(layerId)`; explicitly resolve array positions only where an operation needs one.
- [ ] Remove `showInactiveAutoMouseLayer={false}` from editor `Keyboard`, retain it only in `MonitorPanel`, and pass `layer.id` to all role/filter helpers.
- [ ] Rerun focused tests and confirm GREEN.
- [ ] Commit: `fix: make functional layers stable and editable`.

## Task 5: Add hold-only Scroll and Precision actions

**Files:**
- Modify: `src/trackball/precision-binding.ts`
- Modify: `src/trackball/precision-binding.test.ts`
- Create: `src/behaviors/picker/functional-layer-actions.ts`
- Create: `src/behaviors/picker/functional-layer-actions.test.ts`
- Modify: `src/behaviors/picker/LayersTab.tsx`
- Modify: `src/behaviors/picker/LayersTab.test.tsx`

- [ ] Write failing tests: Scroll builds `Layer-Tap` with param1 7, Precision with param1 8, both encode chosen tap keys, and missing Layer-Tap/fixed layer returns a Japanese disabled reason.
- [ ] Run functional-action, LayersTab, and precision-binding tests and confirm RED.
- [ ] Implement `buildFunctionalLayerTapBinding({ action, tapKey, behaviors, layers })` returning either a valid existing Layer-Tap binding or `{ ok: false, reason }`; never create a toggle or firmware change.
- [ ] Add compact `押している間スクロール` and `押している間ポインター精密` choices to LayersTab, followed by the shared OS-aware tap selector and apply button. Keep Precision hidden from generic layer choices.
- [ ] Rerun focused tests and confirm GREEN.
- [ ] Commit: `feat: assign scroll and precision as hold actions`.

## Task 6: Integrate, review, build, and replace the app

**Files:** Modify only files needed for concrete integration/review findings.

- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `npm run tauri build` separately; record every exit code. Diagnose before fixing and add a regression test first when testable.
- [ ] Have a checker who did not write the code review the approved design, ID/index correctness, OS mappings, accessibility, and absence of RPC/firmware changes. Apply concrete findings and rerun affected checks.
- [ ] Inspect the built UI only through a display-guard-approved secondary-display path. Verify orange hold border, selection ring, OS labels, Auto Mouse visibility, and compact functional actions. If blocked, report visual verification as remaining.
- [ ] After Tauri build succeeds, identify the exact built app, move only the prior `/Applications/minimal-keys カスタマイズ.app` to Trash, install the new app, and verify hash/codesign/readability.
- [ ] Report exact exit codes, review outcome, installed path, and unverified physical-device checks. Never claim hardware behavior without an actual connected-device test.
- [ ] Commit integration fixes only if files changed: `fix: address editor integration review`.
