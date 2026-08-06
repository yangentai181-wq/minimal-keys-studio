# Compact Editor and Hold-Tap Monitor Design

**Date:** 2026-08-06

**Status:** Approved direction; written-spec review pending

**Scope:** `minimal-keys-studio`, the minimal-keys ZMK fork, and the key-position Raw HID notifier

## Problem

The editor and realtime monitor work, but the current screen hierarchy makes the primary task harder than necessary:

1. Four connection-status cards consume a large part of the window even though they are secondary status information.
2. The key-assignment picker is pushed below the fold and requires vertical scrolling.
3. Labels inside the realtime keyboard keys are too small to read comfortably.
4. A pressed dual-function key is visible, but the monitor cannot say whether firmware resolved it as a tap or a hold.

The last item cannot be made authoritative from elapsed time in the desktop application. ZMK's hold-tap behavior may decide based on flavor, interruptions, other key positions, and release order. The exact result must therefore come from firmware at the point where ZMK makes the decision.

## Goals

- Replace the four large connection cards with one compact, icon-level status strip.
- Keep essential connection state and recovery actions available without occupying the editing area.
- Fit the key-assignment picker shown in the approved reference screen without vertical scrolling at 1200×800 and the supported minimum 800×600 window.
- Increase realtime-monitor key labels to a clear, bold size, including dual-function labels.
- Show `判定中`, `単押し`, and `長押し` from the firmware's actual hold-tap decision.
- Make an active hold unmistakable with orange fill/glow and a text label; color must not be the only signal.
- Preserve compatibility with firmware that does not yet emit hold-tap decision reports.

## Non-goals

- Changing hold-tap timing, flavor, keymap behavior, or trackball precision values.
- Inferring hold/tap decisions from a timer in the application.
- Redesigning unrelated settings screens or the application's visual identity.
- Replacing Studio RPC, BLE, or the existing Raw HID transport.
- Showing a permanent history of every key event; this remains a live monitor.

## Chosen Approach

Use two coordinated changes:

1. Make the editor shell vertically compact so the keyboard and assignment picker remain visible together.
2. Extend the existing Raw HID monitor protocol with an authoritative hold-tap lifecycle event emitted by the ZMK fork.

A timer-only desktop implementation is rejected because it would disagree with firmware in valid cases. Layer-state inference is also rejected because it cannot identify modifier-tap decisions and can confuse an already-active layer with a new hold decision.

## Visual Design

### 1. Compact connection status strip

The existing four cards become four status icons in a single strip:

- right-hand USB monitor
- Studio RPC editor
- editor/monitor integration
- pointer activity

Each item is a 36–40 px icon button or status indicator with:

- a small state dot or ring
- an accessible Japanese name
- a tooltip on pointer hover and keyboard focus
- a short error badge only when action is required

The strip stays on one row at 800 px window width. The ordinary connected state is no taller than 64 px including its heading and “接続の詳細” action. Full explanations and retry controls remain inside the existing expandable details surface.

### 2. Editor height allocation

The main editor prioritizes the active task instead of the status summary:

- connection summary: compact fixed-height strip
- keyboard diagram: approximately 40–45% of the remaining editor height
- assignment picker: approximately 55–60% of the remaining editor height

At window heights of 700 px or less, a dense layout activates:

- reduced outer padding and vertical gaps
- compact current-binding summary
- compact primary and secondary tab rows
- key-choice buttons sized to fit the largest visible category without an internal vertical scrollbar

The keyboard remains large enough to select a physical key. The picker does not hide choices below an internal scroll boundary. Horizontal overflow is also prohibited at 800 px width.

### 3. Realtime-monitor key labels

Normal key labels use a target size of 16–18 CSS px with weight 700. Long or dual-function labels use at least 14 px, may wrap to two centered lines, and must maintain readable contrast in every state.

The visual states are:

| State | Color | Visible label |
|---|---|---|
| idle | neutral | binding label |
| ordinary pressed | teal | binding label |
| hold-tap unresolved | teal pulse/ring | `判定中` |
| resolved tap | green confirmation | `単押し` |
| resolved hold | orange fill/glow | `長押し` |

For a dual-function key, the original binding remains readable while the state badge is shown. Screen-reader text includes the position, binding, and current decision.

Tap is normally resolved at release, so `単押し` remains visible for 400 ms as confirmation. `長押し` remains visible while held and has a 250 ms afterglow after release. These display durations do not affect keyboard behavior.

## Firmware and Protocol Design

### 1. Authoritative ZMK event

Add a small hold-tap decision event to the minimal-keys ZMK fork. The hold-tap behavior emits it from the same lifecycle that owns the active hold-tap instance:

- `PENDING`: a hold-tap binding has been pressed and is undecided
- `TAP`: ZMK resolves the instance as a tap
- `HOLD`: ZMK resolves the instance as a hold
- `RELEASED`: the physical hold-tap lifecycle ends

Each event includes the physical key position. Decision events are emitted exactly once per active instance. `RELEASED` clears live state even if the instance is cancelled or ends through an uncommon path.

This event is observational only. No listener may change the decision or delay behavior processing.

### 2. Raw HID report

The key-position notifier subscribes to the event and sends a new report using the existing Raw HID channel:

| Byte | Meaning |
|---|---|
| 0 | marker `0xF4` |
| 1 | protocol version `0x01` |
| 2 | physical key position (`uint8`) |
| 3 | phase: `0=PENDING`, `1=TAP`, `2=HOLD`, `3=RELEASED` |
| 4…end | zero/reserved |

Unknown versions, phases, or positions are ignored safely by the application. Existing `0xF1`, `0xF2`, `0xF3`, and `0xFF` reports do not change.

### 3. Desktop state handling

The Raw HID parser converts `0xF4` reports into typed monitor events. The monitor store keeps live decision state by physical position and separate short-lived visual confirmations:

- `PENDING` sets the position to pending.
- `HOLD` replaces pending with hold.
- `TAP` clears pending and starts the 400 ms tap confirmation.
- `RELEASED` clears pending/hold and starts the 250 ms hold afterglow only if the previous state was hold.

Timers are display cleanup only; they never decide tap versus hold. Reconnect, monitor close, or device reset clears all decision and afterglow state.

### 4. Backward compatibility

Older firmware continues to show ordinary physical press highlighting from `0xF1`. The application must not fabricate `判定中`, `単押し`, or `長押し` if no `0xF4` report has been received.

The connection details identify hold-tap decision monitoring as unavailable only when that information is useful for troubleshooting. It must not block the keymap editor, pointer monitor, or other Raw HID features.

## Error Handling

- A malformed decision report is ignored and recorded only in developer diagnostics.
- A decision for an unknown key position does not alter another key.
- Repeated or out-of-order events leave the monitor in a safe cleared state.
- USB disconnect clears all pressed and decision visuals immediately.
- Firmware build or flash failure leaves the currently installed firmware untouched and is reported before physical verification continues.

## Testing Strategy

All code changes follow red-green-refactor TDD.

Required automated coverage:

- connection summary renders four compact accessible status items and keeps details available
- compact shell and picker have no internal vertical overflow at 1200×800 and 800×600 fixtures
- key labels use the approved readable size for short and long bindings
- Raw HID `0xF4` parsing for every phase and rejection of malformed/unknown reports
- monitor-store transitions for pending, tap, hold, release, reconnect, and reset
- tap confirmation and hold afterglow cleanup with fake timers
- monitor keys expose state through text/ARIA as well as color
- older report streams retain ordinary press highlighting without false decisions
- ZMK event emission occurs once for pending and once for the actual decision
- ZMK event cleanup covers tap, hold, cancellation, and release paths
- notifier serializes the exact versioned `0xF4` byte contract

Verification gates:

- Studio unit tests, lint, TypeScript/Vite build, Rust tests, clippy, and Tauri production build
- firmware unit/build checks for the ZMK fork and notifier
- visual verification at 1200×800 and 800×600 with no picker scrolling
- physical right-hand USB test with an ordinary key and at least one hold-tap key
- physical proof that a tap shows `単押し` and a held key shows orange `長押し`
- regression check that left-hand wireless input is reported through the right-hand USB monitor

## Delivery and Flashing

The firmware protocol change requires a new right-hand firmware build. The application can be built and installed side-by-side first. The right-hand device is flashed only during the explicit physical-verification step; no left-hand firmware change is expected.

The existing serial-port duplicate-detection fix remains a separate change and must not be lost or silently folded into the UI/protocol implementation.

## Acceptance Criteria

The work is complete only when all of the following are proven:

1. The four status cards are replaced by a single compact icon strip that remains understandable and accessible.
2. The keyboard and the complete visible assignment picker fit without vertical scrolling at both 1200×800 and 800×600.
3. Realtime key labels are visibly larger, bold, and readable for normal and dual-function bindings.
4. The monitor shows `判定中` only for an actual undecided hold-tap binding.
5. A firmware-resolved tap shows `単押し` confirmation.
6. A firmware-resolved hold glows orange and shows `長押し` while held.
7. The displayed decision comes from ZMK, not an application-side timing guess.
8. Old firmware and malformed packets degrade safely without blocking editing or monitoring.
9. All automated gates pass, production app and firmware artifacts build, and the physical workflow is verified.
