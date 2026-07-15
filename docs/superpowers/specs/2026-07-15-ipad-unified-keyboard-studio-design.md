# iPad Unified Keyboard Studio Design

## Goal

Replace the currently stacked monitor and editor surfaces with one iPad-landscape workspace. The screen shows one keyboard at a time and switches its behavior with a prominent `MONITOR | EDITOR` toggle. Monitor mode also provides free typing and prompted typing practice above the physical keyboard.

## Product Principles

- The physical keyboard is the visual center of the application.
- Monitor and editor are modes of one workspace, not separate sections joined together.
- The reading order in monitor mode is: practice prompt and input, live physical keyboard, results.
- Connection information stays visible but does not compete with the keyboard.
- The primary target is iPad in landscape orientation, from 1024 x 768 upward.
- Portrait orientation shows a dedicated rotation notice instead of compressing the workspace.
- Existing Raw HID monitoring, Studio RPC editing, save, undo, redo, discard, and disconnect behavior remain intact.

## Information Architecture

The connected application uses four vertical regions:

1. A compact header with the product name, centered mode toggle, and connection status.
2. A mode-specific upper panel: typing practice in monitor mode, editor navigation in editor mode.
3. A single keyboard stage occupying the largest available area.
4. A bottom action and metrics area sized for touch.

The existing multi-card connection overview is removed from the main workflow. Its essential state is reduced to a compact status indicator and contextual recovery action.

## Mode Toggle

- The toggle is centered in the header and has exactly two states: `MONITOR` and `EDITOR`.
- Only the active mode's keyboard is mounted visibly. The monitor layout and editor keyboard never appear together.
- `MONITOR` is the initial mode when Raw HID is available.
- `EDITOR` is disabled when Studio RPC is unavailable. The control explains the unavailable state through accessible text and exposes the existing retry action nearby.
- Switching modes preserves the current Raw HID snapshot and editor state. It must not reconnect or discard changes.

## Monitor Mode

The upper panel contains the typing practice surface. The keyboard stage uses `MinimalKeysMonitorLayout` and reflects the current Raw HID layer and pressed positions.

The result bar below the keyboard contains:

- Current layer.
- Latest pressed key.
- Trackball delta.
- Typing speed in words per minute.
- Accuracy percentage.
- Error count.

Low-frequency diagnostic detail for encoder samples and connection recovery is available through compact secondary controls, not permanent large cards.

## Typing Practice

Typing practice supports two local modes:

### Free Input

- The user can type arbitrary text into a multi-line input.
- The surface reports elapsed time, character count, and words per minute.
- Reset clears text and statistics.

### Prompted Input

- The surface presents a short built-in prompt.
- Correct, current, and incorrect characters have distinct visual states.
- Statistics include words per minute, accuracy, and error count.
- Reset starts the current prompt again; a next action selects the next built-in prompt.

Practice state remains local to the browser and is not sent to the keyboard, telemetry, or a remote service. Timing starts on the first entered character and stops when the prompted text is complete. Input from the browser text field drives the practice calculation, while Raw HID continues to drive the physical key highlights.

## Editor Mode

- The keyboard stage contains the existing `Keyboard` editor so its RPC data loading, key selection, layer picker, behavior picker, and undo history remain unchanged.
- Existing editor sections remain available through a compact touch-friendly navigation row: keymap, hold-tap, encoder, combo, trackball, Bluetooth, battery, and settings.
- Selecting a non-keymap section replaces the keyboard stage with that editor section. Returning to keymap restores the same editor keyboard and selection state.
- Save, undo, redo, discard, and disconnect remain in the header or bottom action area according to available width.

## iPad Landscape Behavior

- The primary layout targets CSS landscape viewports with a minimum width of 1024px and minimum height of 700px.
- The workspace fits within `100dvh` without page-level vertical scrolling during monitor and keymap editing workflows.
- Touch targets are at least 44 x 44 CSS pixels.
- The keyboard stage uses responsive constraints rather than viewport-scaled font sizes.
- The bottom result/action area remains reachable without covering the keyboard.
- In portrait orientation, the application shows a rotation notice with the current connection preserved. Returning to landscape restores the previous mode and state.

## Visual System

- Canvas: light gray `#F8FAFC`.
- Surfaces: white with `#E2E8F0` borders, restrained `shadow-sm`, and radius no greater than 8px.
- Primary state and active key: teal `#0D9488`.
- Live, current-character, warning, and error emphasis: orange `#F97316`.
- Main text: `#0F172A`; secondary text uses reduced opacity.
- Font: JetBrains Mono.
- Animations are limited to short opacity and color transitions. Layout does not shift when keys activate or metrics change.

## Components And Responsibilities

### `StudioWorkspace`

Owns `monitor | editor` mode, orientation handling, shared header layout, and the single visible stage. It receives existing connection and action props from `AppInner` and does not own transport lifecycle logic.

### `StudioModeToggle`

Renders the accessible two-state toggle, disabled editor state, and keyboard focus behavior.

### `MonitorWorkspace`

Composes typing practice, `MinimalKeysMonitorLayout`, live Raw HID metrics, and monitor recovery actions.

### `TypingPractice`

Owns practice mode, input text, prompt selection, timer state, reset behavior, and derived metrics. Pure metric calculations live in a separate module so they can be tested without rendering React.

### Existing `Keyboard`

Remains the editor implementation. It is placed in the shared keyboard stage only while the keymap editor is active.

### `PortraitOrientationNotice`

Replaces the workspace only when the viewport is portrait. It does not alter connection, editor, monitor, or practice state.

## Data Flow

- `useRightUsbConnection` continues to produce the Raw HID `MonitorSnapshot`.
- `AppInner` continues to own Studio RPC connection and editor actions.
- `AppInner` passes both into `StudioWorkspace`.
- `StudioWorkspace` passes the snapshot to `MonitorWorkspace` and connection availability to `StudioModeToggle`.
- Practice input and statistics remain inside `TypingPractice`.
- Mode changes affect presentation only and do not call connection APIs.

## Failure And Empty States

- Raw HID unavailable: monitor mode shows an idle keyboard and a compact connect action.
- Studio RPC unavailable: editor mode is disabled and the retry action remains available.
- Both unavailable: the existing connection modal remains the entry point.
- Practice input empty: statistics show zero values without starting a timer.
- Portrait viewport: rotation notice replaces the workspace without disconnecting devices.

## Accessibility

- Mode controls use button semantics with `aria-pressed` or an equivalent accessible selected state.
- Disabled editor mode provides a readable reason.
- Practice mode controls, reset, next prompt, and recovery actions have visible focus styles.
- Live monitor metrics use a non-intrusive status region and do not announce every pointer frame.
- Color is not the only signal for correct, current, incorrect, connected, or disabled states.

## Testing

- Unit tests cover practice metrics for empty input, correct text, mistakes, elapsed time, completion, and reset.
- Component tests cover free/prompt mode switching, input placement before the keyboard, reset, next prompt, and visible statistics.
- Workspace tests assert that only one keyboard surface is visible and that mode switching preserves connection state.
- Orientation tests assert that portrait shows the rotation notice and landscape restores the workspace.
- Existing Raw HID, Studio RPC, keyboard editor, lint, and production build tests must continue to pass.
- Browser verification uses iPad landscape viewports at 1024 x 768 and 1366 x 1024, checking for overflow, overlap, touch target size, and live hardware behavior.

## Out Of Scope

- Cloud accounts, saved practice history, leaderboards, and online prompt downloads.
- Changes to Raw HID frame format or Studio RPC protocol.
- A redesigned keymap data model.
- Portrait editing support.
