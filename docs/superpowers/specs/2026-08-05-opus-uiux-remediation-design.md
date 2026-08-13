# Opus 5 UI/UX Remediation Design

**Date:** 2026-08-05
**Status:** Approved
**Scope:** `minimal-keys-studio` desktop and browser application

## Problem

The application has a sound protocol and state-machine foundation, but its user-facing behavior does not yet match the intended nontechnical workflow:

1. The installed macOS application does not provide the complete right-hand USB flow.
2. Precision settings conflate loading, disconnect, unsupported firmware, and communication failure.
3. The 800×600 window can leave no usable editing area.
4. Twenty-two failure toasts are still English.
5. Raw HID pointer updates can re-render the application root.
6. Every previously visited tab remains mounted.
7. Pub/sub listeners are detached and reattached after every render.
8. Key presentation data for all 43 keys is recalculated too often.
9. The loading indicator is artificially held for at least 500 ms.
10. Google Fonts are fetched externally at startup.

The target user connects the right half by USB, the left half wirelessly to the right half, edits settings, and uses the trackball without needing to understand Raw HID, Studio RPC, central/peripheral, or firmware protocol details.

## Goals

- Make the installed macOS application support the same complete right-hand USB workflow as the browser application: Studio RPC editing and live Raw HID monitoring.
- Show truthful, recoverable precision-setting states.
- Keep the editor usable at both the default 1200×800 window and the supported minimum 800×600 window.
- Make all named failure feedback understandable in Japanese.
- Remove the confirmed render, subscription, calculation, artificial-delay, and external-font performance costs.
- Preserve unsaved work when moving between settings screens.
- Verify behavior with automated tests, production builds, real window sizes, and the physical keyboard.

## Non-goals

- Redesigning the full visual identity.
- Replacing the ZMK Studio protocol.
- Changing firmware RPC or protobuf definitions.
- Adding analytics or new cloud services.
- General performance refactoring unrelated to the ten audited findings.

## Chosen Approach

Implement native Raw HID support in the Tauri backend and expose it through the same connection and monitor contracts already used by WebHID. This avoids a reduced desktop experience and avoids splitting monitoring into a separate browser companion.

Rejected alternatives:

- **Desktop editor only, monitor marked unavailable:** honest but does not satisfy full desktop support.
- **Open Chrome for monitoring:** fragments one product workflow across two applications and leaves connection state ambiguous.

## Architecture

### 1. Unified right-hand USB connection

The physical keyboard exposes two independent USB interfaces:

- USB serial for Studio RPC configuration.
- Vendor Raw HID for key, layer, encoder, reset, and pointer monitoring.

The browser keeps its existing Web Serial + WebHID adapters. The macOS application gains a native Raw HID adapter implemented in Rust using `hidapi`.

The native adapter must:

- Enumerate only the minimal-keys Vendor HID interface with usage page `0xff60` and usage `0x61`.
- Open and read reports without taking ownership of the serial interface.
- Emit report bytes to the frontend through a dedicated Tauri event.
- Stop the read task and close the device on disconnect, retry, window close, or explicit monitor close.
- Expose errors as typed connection outcomes rather than user-facing English strings.
- Avoid logging report contents in production.

The frontend selects the platform adapter:

- Browser: existing WebHID adapter.
- Tauri: native HID commands and events.

Both adapters feed the existing frame parser and monitor store. The connection coordinator remains the source of truth for the two contracts: live monitoring and settings editing.

The Tauri connection screen makes “右手をUSBで接続” the primary action. USB devices must be listed without waiting for the five-second BLE scan; BLE remains available as a secondary connection method.

### 2. Precision-setting state model

Custom subsystem discovery exposes an explicit lifecycle instead of collapsing every condition to an empty list:

- `disconnected`: no Studio RPC connection.
- `loading`: connected and discovering capabilities or loading settings.
- `ready`: discovery completed successfully, including a valid empty result.
- `error`: capability discovery failed.

The precision settings map this lifecycle to:

- `loading`: “設定を読み込んでいます…”
- `available`: settings form is usable.
- `disconnected`: “キーボードに接続すると設定できます” while retaining the last confirmed values as read-only context.
- `firmware-update-required`: discovery succeeded, but `trackball_settings` is absent.
- `error`: “設定を読み込めませんでした” with “もう一度読み込む”.

Retry restarts capability discovery when necessary and then reloads precision settings.

Precision draft rules:

- A new device revision updates the confirmed value but never silently overwrites a dirty draft.
- Disconnect clears an in-flight save but preserves the last confirmed value and dirty draft.
- Reconnection reloads the current device value and reports conflicts rather than discarding edits.
- Save failure retains the draft as dirty and allows retry.
- The UI explicitly labels unsaved changes.

### 3. Responsive application shell

The Tauri default window becomes 1200×800. The supported minimum remains 800×600.

The application shell uses the dynamic viewport height and guarantees the editor a minimum usable height. Connection status is a compact summary row by default. Detailed contract cards, live keyboard layout, and precision status move behind “接続の詳細” and render in a bounded, scrollable surface.

The expanded details never sit permanently above the editor. At 800×600, the editor remains visible without maximizing the window.

### 4. Japanese failure feedback

The twenty-two audited English failure toasts are replaced with centralized Japanese copy. Each message names the operation that failed and, where a safe recovery exists, the next action.

Raw exception messages remain in developer logs only. User surfaces must not expose `Failed`, RPC names, stack traces, or protocol details.

A regression test scans user-facing toast calls and fails if English `Failed`/`failed` text is reintroduced.

### 5. Active-tab lifecycle and unsaved work

Only the active settings screen remains mounted. Previously visited screens are not retained as hidden React trees.

To avoid losing edits:

- Each settings screen reports dirty state through a shared registry.
- Switching tabs or disconnecting while dirty presents a Japanese save/discard/cancel decision.
- Saving or discarding clears the registry entry.
- Reopening a clean screen reloads current device state.

The keymap screen follows its existing save/discard semantics through the same navigation guard.

### 6. Render isolation

`useRightUsbConnection` owns connection commands and a stable monitor store, but it no longer subscribes to monitor snapshots at `AppInner`.

Only monitor-specific leaf components subscribe to the store. Pointer frames may update those leaves at most once per animation frame, but must not re-render the header, editor, active settings screen, or inactive tabs.

Connection-state changes may still re-render the shell because they change visible application state.

### 7. Stable pub/sub subscriptions

`useSub` registers one stable proxy listener per event name. A ref holds the latest callback. Ordinary component re-renders update the ref without calling `off` and `on` again.

The listener is replaced only when the event name changes and is removed on unmount or explicit unsubscribe.

### 8. Key rendering calculations

The keymap computes behavior lists, layer names, position presentation data, and tooltip data through memoized selectors. Layer names are created once per keymap revision rather than once per key.

Changing selection, hover state, or rendered key size must not rebuild presentation data for all 43 keys. Keymap, behavior, layer, physical layout, or OS-mode changes must invalidate the relevant memoized data.

### 9. Immediate loading completion

Remove the minimum 500 ms spinner duration. The loading UI appears only while required data is unresolved and disappears immediately when that data is ready.

This change does not shorten RPC timeouts or hide genuine loading states.

### 10. Local typography

Remove the Google Fonts `@import`. The application uses the macOS/system UI sans-serif stack for Japanese user-interface text and the system monospace stack only where alignment or technical values require it.

No font request may be made to `fonts.googleapis.com` or `fonts.gstatic.com`. No new remote runtime dependency is introduced.

## Error Handling

- Native HID open/read failures become coordinator events and Japanese recovery guidance.
- HID and serial lifecycles remain independent; one interface failing does not falsely mark the other as successful.
- Capability discovery errors expose retry and do not claim the firmware is unsupported.
- Dirty drafts survive recoverable errors.
- Unexpected exceptions are logged for developers and mapped to stable Japanese user messages.

## Testing Strategy

All behavior changes follow red-green-refactor TDD.

Required automated coverage:

- Rust HID device filtering, open/read/close lifecycle, duplicate-open protection, and error mapping.
- Tauri Raw HID frontend adapter event parsing and cleanup.
- Tauri connection modal primary USB flow and independent BLE listing.
- Connection coordinator behavior when monitoring or editing succeeds independently.
- Custom subsystem discovery lifecycle and stale-response rejection.
- All five precision availability states, retry, disconnect preservation, dirty conflict, and save failure.
- Compact connection summary and bounded details surface.
- Dirty navigation guard and inactive-tab unmounting.
- Japanese message table and English-toast regression scan.
- Monitor frames update leaf monitoring UI without re-rendering the application editor tree.
- `useSub` registers once across re-renders and calls the latest callback.
- Key presentation memoization invalidation boundaries.
- Loading content appears before 500 ms once data resolves.
- Source and production bundle contain no Google Fonts URLs.

Verification gates:

- `npm test`
- `npm run build`
- `npm run lint`
- `npm run tauri build`
- Rust tests and `cargo clippy` for the Tauri backend
- Visual verification at 800×600 and 1200×800
- Physical right-hand USB connection: monitor and editor both become ready
- Physical X hold: precision mode reports 200 CPI while held and 800 CPI after release
- Left half remains connected wirelessly through the right half

## Acceptance Criteria

The work is complete only when all of the following are proven:

1. The installed macOS application has a primary “右手をUSBで接続” action.
2. One right-hand USB connection can establish live monitoring and Studio RPC editing.
3. Loading, disconnect, unsupported firmware, and error states never impersonate one another.
4. The editor remains usable at 800×600, and 1200×800 is the default.
5. None of the twenty-two audited failure paths presents English user-facing copy.
6. Pointer frames do not re-render the application root or settings editor.
7. Inactive tabs are unmounted, and dirty work is never silently lost.
8. `useSub` does not resubscribe on ordinary re-render.
9. Selection or resize does not recompute presentation data for all 43 keys.
10. Resolved loading data is shown immediately without a 500 ms floor.
11. Runtime and build output contain no Google Fonts request.
12. All automated gates pass and the physical workflow is verified.
