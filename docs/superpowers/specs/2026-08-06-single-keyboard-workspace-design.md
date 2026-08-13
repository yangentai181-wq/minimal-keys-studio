# Single Keyboard Workspace Design

Date: 2026-08-06
Status: Approved for planning

## Problem

The connected Studio screen currently renders the keyboard twice: once as a
Raw HID monitor in the connection overview and again as the editable keymap.
This duplicates the main object, reduces its size, and forces unnecessary
vertical scrolling.

## User-approved outcome

- Show one large keyboard surface at a time.
- Add a two-option control for `編集` and `リアルタイム`.
- In realtime mode, hide the key assignment panel and maximize the keyboard.
- Preserve the current editing session when switching modes.
- Keep connection state available without placing another keyboard in it.

## Chosen approach

Add a mode switch inside the keymap tab and swap the visible workspace in the
same center-stage region.

The alternatives considered were:

1. Overlay Raw HID state directly on the editable keymap DOM. This is the most
   literal single component, but couples two different layout/data models and
   makes editing and monitoring regressions more likely.
2. Keep both keyboards and collapse one. This retains duplication and does not
   solve the visual hierarchy problem.
3. Use one visual slot with two modes. This keeps the responsibilities isolated,
   preserves the existing proven editor and monitor renderers, and is the chosen
   approach.

## Architecture

### `KeyboardWorkspace`

Create a focused component under `src/keyboard/` that owns the local workspace
mode:

```ts
type KeyboardWorkspaceMode = "editor" | "monitor";
```

Inputs:

- the editor content (`Keyboard`)
- `MonitorStore`
- whether Raw HID monitoring is available
- the action that starts the right-hand USB monitor
- connection busy state

Responsibilities:

- render an accessible segmented control labelled `キーボード表示`
- show exactly one keyboard surface visually
- keep the editor mounted but hidden while realtime mode is visible, so selected
  layer/key and in-memory edits are not reset by toggling
- unmount the entire workspace normally when the user leaves the keymap tab
- prevent monitor selection when Raw HID is unavailable and show the existing
  connection action nearby

The segmented control uses two buttons with `aria-pressed`, a minimum 44px hit
area, teal for the active mode, and visible focus rings. It appears above the
keyboard on desktop and remains easy to reach in the compact layout.

### Realtime workspace

The realtime view uses `MinimalKeysMonitorLayout` as the only visible keyboard.
It receives:

- active layer
- pressed positions
- hold-tap state (`判定中`, `単押し`, `長押し`)

The keyboard occupies the main white card at the maximum available width.
Below or beside it, depending on width, a compact status row shows current
layer, latest key, pointer delta, and monitor connection state. It does not
repeat explanatory paragraphs or technical English badges.

### Connection overview

`StudioConnectionOverview` remains a compact connection/status strip. Remove
its `showLayout` branch and the large `ライブ読み取り` card. Detailed connection
metrics and trackball precision status remain available through `接続の詳細`.

### App integration

In the `keymap` branch of `StudioTabView`, render `KeyboardWorkspace` instead of
rendering `Keyboard` directly. Other Studio tabs are unchanged. The monitor-only
screen used before Studio RPC connects remains unchanged because no editor is
available there.

## State and data flow

1. `useRightUsbConnection` continues to own the monitor store and connection.
2. `KeyboardWorkspace` subscribes to that store only in the monitor leaf via
   `useMonitorSnapshot`; monitor frames do not rerender the editor.
3. Switching modes changes local presentation state only. It does not reconnect,
   reload the keymap, or mutate firmware.
4. If monitoring stops while realtime mode is selected, the realtime surface
   remains visible with a clear disconnected state and a reconnect action.
5. Disconnecting Studio unmounts the whole connected application as it does now.

## Visual rules

- Center-stage layout with one large white card, slate border, and `shadow-sm`.
- Teal `#0D9488` is the active/primary color.
- Orange `#F97316` remains reserved for hold state and emphasis.
- Slate `#F8FAFC` is the page background.
- Existing local JetBrains Mono font remains in use; no network font request.
- No duplicate keyboard, explanatory card, or nested vertical scrollbar.

## Error and empty states

- Raw HID unavailable: realtime button is disabled and labelled through its
  accessible description; show `右手USBモニターを接続` as the recovery action.
- Raw HID connected but no input yet: show the keyboard normally and display
  `入力待ち` in the compact status row.
- Studio editor remains available independently of monitor availability.

## Tests

1. Component tests for switching editor/realtime modes.
2. Verify only one keyboard surface is visible in each mode.
3. Verify editor child state survives a round-trip to realtime mode.
4. Verify realtime state displays pressed and hold-tap states from the monitor
   store.
5. Verify unavailable monitoring disables the realtime choice and exposes the
   recovery action.
6. Update connection overview tests to ensure it no longer renders a keyboard.
7. Add 800x600 and 1200x800 visual fixtures and inspect them headlessly.
8. Run the full Vitest suite, lint, production build, Rust tests/clippy, and
   Tauri build.

## Out of scope

- Rewriting the editable keymap and monitor to share the same DOM nodes.
- Changing firmware, Raw HID packet formats, or keymap RPC behavior.
- Redesigning non-keymap settings tabs.
