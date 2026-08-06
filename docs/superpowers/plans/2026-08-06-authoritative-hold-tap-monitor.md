# Authoritative Hold-Tap Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display `判定中`, `単押し`, and orange `長押し` from ZMK's actual hold-tap decision instead of an application-side timing guess.

**Architecture:** The ZMK fork emits a version-neutral internal lifecycle event at the hold-tap decision source. The user-managed `zmk-input-notifier` converts that event to the versioned Raw HID `0xF4` packet. Studio parses the packet into typed frames, maintains per-position visual state with cleanup timers, and renders text plus color in the realtime physical layout.

**Tech Stack:** ZMK/Zephyr C, ZMK event manager, zmk-raw-hid, React 18, TypeScript, Vitest, React Testing Library, Tauri 2

## Global Constraints

- Raw HID bytes are exactly: marker `0xF4`, version `0x01`, `uint8` position, phase `0=PENDING`, `1=TAP`, `2=HOLD`, `3=RELEASED`, then zero-filled reserved bytes.
- Timers only remove visual confirmations; they never decide tap versus hold.
- Tap confirmation lasts 400 ms; hold afterglow lasts 250 ms.
- `PENDING` and `RELEASED` occur once per active instance; actual decision transitions may be `HOLD` then `TAP` for retro-tap.
- Existing `0xF1`, `0xF2`, `0xF3`, and `0xFF` reports remain unchanged.
- Old firmware continues ordinary press highlighting without fabricated decision states.
- External pushes and GitHub Actions are a publication/deployment gate and require explicit CEO confirmation at that step.
- No left-hand firmware change is expected.

---

## File Structure

### ZMK fork: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk`

- `app/include/zmk/events/hold_tap_state_changed.h` — public event struct and phase enum.
- `app/src/events/hold_tap_state_changed.c` — event implementation.
- `app/src/behaviors/behavior_hold_tap.c` — authoritative lifecycle emission and retro-tap update.
- `app/src/hold_tap_state_log.c` — test-only event subscriber that proves raised events reach listeners.
- `app/CMakeLists.txt` — event source and test logger registration.
- `app/Kconfig` — test logger option.
- `app/tests/hold-tap/monitor-events/*` — tap, hold, and retro-tap event snapshots.

### Raw HID module: `/Users/iwanedaijun/repos/zmk-input-notifier`

- `src/hold_tap_packet.h` — pure packet encoder interface.
- `src/hold_tap_packet.c` — validation and exact byte serialization.
- `src/input_notifier.c` — ZMK event subscriber and Raw HID send.
- `tests/hold_tap_packet_test.c` — host-compiled packet contract tests.
- `CMakeLists.txt` — packet encoder source registration.

### Studio: `/Users/iwanedaijun/repos/minimal-keys-studio`

- `src/connection/rawHidFrames.ts` / `.test.ts` — `0xF4` typed parser.
- `src/monitor/monitorStore.ts` / `.test.ts` — per-position decision state and cleanup scheduling.
- `src/monitor/MinimalKeysMonitorLayout.tsx` / `.test.tsx` — badges, ARIA text, and orange hold styling.
- `src/StudioConnectionOverview.tsx` / `.test.tsx` — pass live decision state into expanded monitor.
- `src/monitor/MonitorPanel.tsx` — pass live decision state into standalone monitor.

### Release: `/Users/iwanedaijun/repos/minimal-keys-release`

- `config/west.yml` — pin published ZMK and notifier commits.

### Task 1: Emit Authoritative ZMK Hold-Tap Events

**Files:**
- Create: `app/include/zmk/events/hold_tap_state_changed.h`
- Create: `app/src/events/hold_tap_state_changed.c`
- Create: `app/src/hold_tap_state_log.c`
- Modify: `app/CMakeLists.txt`
- Modify: `app/Kconfig`
- Modify: `app/src/behaviors/behavior_hold_tap.c`
- Create: `app/tests/hold-tap/monitor-events/tap/*`
- Create: `app/tests/hold-tap/monitor-events/hold/*`
- Create: `app/tests/hold-tap/monitor-events/retro-tap/*`

**Interfaces:**
- Produces: `struct zmk_hold_tap_state_changed { uint32_t position; enum zmk_hold_tap_state state; }` and the generated `raise_zmk_hold_tap_state_changed(struct zmk_hold_tap_state_changed event)` helper.
- State values: `ZMK_HOLD_TAP_PENDING=0`, `ZMK_HOLD_TAP_TAP=1`, `ZMK_HOLD_TAP_HOLD=2`, `ZMK_HOLD_TAP_RELEASED=3`.

- [ ] **Step 1: Add failing listener-backed event fixtures**

Add `CONFIG_ZMK_HOLD_TAP_STATE_LOG=y` to each fixture and extract only listener output:

```sed
s/.*hold_tap_state_log: /hold_tap_state: /p
```

Use literal snapshots:

```text
# tap
hold_tap_state: position 0 pending
hold_tap_state: position 0 tap
hold_tap_state: position 0 released

# hold
hold_tap_state: position 0 pending
hold_tap_state: position 0 hold
hold_tap_state: position 0 released

# retro-tap
hold_tap_state: position 0 pending
hold_tap_state: position 0 hold
hold_tap_state: position 0 tap
hold_tap_state: position 0 released
```

The test logger subscribes to the real event; it does not call behavior internals.

- [ ] **Step 2: Run the fixtures and verify RED**

From `zmk/app`, run:

```bash
./run-test.sh tests/hold-tap/monitor-events
```

Expected: FAIL to compile because the event and logger option do not yet exist.

- [ ] **Step 3: Define the event and test subscriber**

Create the header:

```c
#pragma once

#include <stdint.h>
#include <zmk/event_manager.h>

enum zmk_hold_tap_state {
    ZMK_HOLD_TAP_PENDING = 0,
    ZMK_HOLD_TAP_TAP = 1,
    ZMK_HOLD_TAP_HOLD = 2,
    ZMK_HOLD_TAP_RELEASED = 3,
};

struct zmk_hold_tap_state_changed {
    uint32_t position;
    enum zmk_hold_tap_state state;
};

ZMK_EVENT_DECLARE(zmk_hold_tap_state_changed);
```

Implement it with `ZMK_EVENT_IMPL(zmk_hold_tap_state_changed);`. Register the event source unconditionally in `app/CMakeLists.txt`. Add a default-off `ZMK_HOLD_TAP_STATE_LOG` Kconfig boolean and compile `app/src/hold_tap_state_log.c` only when enabled. The logger converts the four enum values to the exact lowercase snapshot strings and subscribes with `ZMK_SUBSCRIPTION`.

- [ ] **Step 4: Emit lifecycle transitions from `behavior_hold_tap.c`**

Add a helper:

```c
static void raise_hold_tap_state(const struct active_hold_tap *hold_tap,
                                 enum zmk_hold_tap_state state) {
    raise_zmk_hold_tap_state_changed((struct zmk_hold_tap_state_changed){
        .position = hold_tap->position,
        .state = state,
    });
}
```

Call it at these authoritative points:

- after assigning `undecided_hold_tap`: `PENDING`
- after `decide_positional_hold` settles a new status: `TAP` or `HOLD`
- after `decide_retro_tap` changes `STATUS_HOLD_TIMER` to `STATUS_TAP`: `TAP`
- once in `on_hold_tap_binding_released`, after the final decision/release binding and before cleanup: `RELEASED`

Map both `STATUS_HOLD_INTERRUPT` and `STATUS_HOLD_TIMER` to `HOLD`. Existing early returns prevent duplicate unchanged decisions.

- [ ] **Step 5: Run fixtures and existing hold-tap regression tests**

Run:

```bash
./run-test.sh tests/hold-tap/monitor-events
./run-test.sh tests/hold-tap/tap-preferred
./run-test.sh tests/hold-tap/balanced
./run-test.sh tests/hold-tap/hold-preferred
```

Expected: monitor fixtures and existing behavior snapshots PASS.

- [ ] **Step 6: Commit in the ZMK repository**

```bash
git add app/CMakeLists.txt app/Kconfig app/include/zmk/events/hold_tap_state_changed.h app/src/events/hold_tap_state_changed.c app/src/hold_tap_state_log.c app/src/behaviors/behavior_hold_tap.c app/tests/hold-tap/monitor-events
git commit -m "feat: expose hold-tap decision lifecycle"
```

### Task 2: Serialize Decisions in `zmk-input-notifier`

**Files:**
- Create: `src/hold_tap_packet.h`
- Create: `src/hold_tap_packet.c`
- Create: `tests/hold_tap_packet_test.c`
- Modify: `src/input_notifier.c`
- Modify: `CMakeLists.txt`

**Interfaces:**
- Consumes: `zmk_hold_tap_state_changed` from Task 1.
- Produces: `bool zin_encode_hold_tap_packet(uint8_t *buffer, size_t size, uint32_t position, uint8_t phase)`.

- [ ] **Step 1: Write the failing host packet test**

The test uses literal expected bytes and covers all validation branches:

```c
uint8_t report[8] = {0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA};
assert(zin_encode_hold_tap_packet(report, sizeof(report), 23, 2));
uint8_t expected[8] = {0xF4, 0x01, 23, 2, 0, 0, 0, 0};
assert(memcmp(report, expected, sizeof(report)) == 0);
assert(!zin_encode_hold_tap_packet(report, 3, 23, 2));
assert(!zin_encode_hold_tap_packet(report, sizeof(report), 256, 2));
assert(!zin_encode_hold_tap_packet(report, sizeof(report), 23, 4));
```

- [ ] **Step 2: Compile and verify RED**

Run:

```bash
zin_test_bin=$(mktemp /tmp/zin-hold-tap-test.XXXXXX)
cc -std=c11 -Wall -Wextra -Werror -Isrc tests/hold_tap_packet_test.c src/hold_tap_packet.c -o "$zin_test_bin"
```

Expected: FAIL because the encoder files do not exist.

- [ ] **Step 3: Implement the pure encoder**

```c
bool zin_encode_hold_tap_packet(uint8_t *buffer, size_t size,
                                uint32_t position, uint8_t phase) {
    if (buffer == NULL || size < 4 || position > UINT8_MAX || phase > 3) return false;
    memset(buffer, 0, size);
    buffer[0] = 0xF4;
    buffer[1] = 0x01;
    buffer[2] = (uint8_t)position;
    buffer[3] = phase;
    return true;
}
```

- [ ] **Step 4: Run the host test and verify GREEN**

Run the same compile command, then `"$zin_test_bin"`.

Expected: compile succeeds and the test exits 0.

- [ ] **Step 5: Subscribe and send the Raw HID report**

In `input_notifier.c`, include the new ZMK event header and packet encoder. Add a dedicated report buffer and listener:

```c
static int hold_tap_listener(const zmk_event_t *eh) {
    const struct zmk_hold_tap_state_changed *ev = as_zmk_hold_tap_state_changed(eh);
    if (ev == NULL || !zin_encode_hold_tap_packet(hid_hold_tap_buf,
            sizeof(hid_hold_tap_buf), ev->position, (uint8_t)ev->state)) {
        return ZMK_EV_EVENT_BUBBLE;
    }
    raise_raw_hid_sent_event((struct raw_hid_sent_event){
        .data = hid_hold_tap_buf,
        .length = sizeof(hid_hold_tap_buf),
    });
    return ZMK_EV_EVENT_BUBBLE;
}
```

Register `hold_tap_packet.c` in `CMakeLists.txt` and subscribe the listener.

- [ ] **Step 6: Build the right-hand firmware locally**

From `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace`, run:

```bash
west build -s zmk/app -d build/hold-tap-monitor -b seeeduino_xiao_ble -p -- \
  -DZMK_CONFIG=/Users/iwanedaijun/repos/minimal-keys-release/config \
  -DSHIELD="minimal-keys_R rgbled_adapter raw_hid_adapter" \
  -DSNIPPET=studio-rpc-usb-uart
```

Expected: firmware build succeeds with the local ZMK and notifier branches.

- [ ] **Step 7: Commit in the notifier repository**

```bash
git add CMakeLists.txt src/input_notifier.c src/hold_tap_packet.c src/hold_tap_packet.h tests/hold_tap_packet_test.c
git commit -m "feat: stream hold-tap decisions over Raw HID"
```

### Task 3: Parse and Store `0xF4` in Studio

**Files:**
- Modify: `src/connection/rawHidFrames.test.ts`
- Modify: `src/connection/rawHidFrames.ts`
- Modify: `src/monitor/monitorStore.test.ts`
- Modify: `src/monitor/monitorStore.ts`

**Interfaces:**
- Produces: `HoldTapFrame { kind: "hold-tap"; position: number; phase: "pending" | "tap" | "hold" | "released" }`.
- Produces: `MonitorSnapshot.holdTapStates: ReadonlyMap<number, HoldTapVisualState>` where visual state is `pending | tap | hold | hold-afterglow`.
- Produces: optional second `createMonitorStore` cleanup scheduler for deterministic fake-time tests.

- [ ] **Step 1: Write failing parser tests**

```ts
expect(parseRawHidFrame(view([0xf4, 1, 23, 2]))).toEqual({
  kind: "hold-tap", position: 23, phase: "hold",
});
expect(parseRawHidFrame(view([0xf4, 2, 23, 2]))).toBeNull();
expect(parseRawHidFrame(view([0xf4, 1, 23, 4]))).toBeNull();
```

Use a table with literal results for phases 0–3.

- [ ] **Step 2: Run parser tests and verify RED**

Run: `npm test -- src/connection/rawHidFrames.test.ts`

Expected: FAIL because marker `0xF4` is unknown.

- [ ] **Step 3: Implement the versioned typed parser**

Add `HOLD_TAP_PACKET_MARKER = 0xf4`, the frame type, literal phase lookup, and return `null` for unknown version/phase/truncation. Extend `RawHidFrame` with `HoldTapFrame`.

- [ ] **Step 4: Run parser tests and verify GREEN**

Run: `npm test -- src/connection/rawHidFrames.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing store lifecycle tests**

Use a fake cleanup scheduler that records `{ delay, callback }` and assert:

```ts
store.push({ kind: "hold-tap", position: 23, phase: "pending" }, 100);
expect(store.getSnapshot().holdTapStates.get(23)).toBe("pending");
store.push({ kind: "hold-tap", position: 23, phase: "hold" }, 200);
expect(store.getSnapshot().holdTapStates.get(23)).toBe("hold");
store.push({ kind: "hold-tap", position: 23, phase: "released" }, 300);
expect(store.getSnapshot().holdTapStates.get(23)).toBe("hold-afterglow");
expect(scheduled.at(-1)?.delay).toBe(250);
```

Separate tests verify a `tap` survives the following `released` event for 400 ms, a new event cancels stale cleanup, and `reset()` cancels timers and clears all states.

- [ ] **Step 6: Run store tests and verify RED**

Run: `npm test -- src/monitor/monitorStore.test.ts`

Expected: FAIL because snapshots have no hold-tap state.

- [ ] **Step 7: Implement store transitions and cleanup ownership**

Clone the `Map` for every state change. Keep per-position cancellation callbacks inside `createMonitorStore`; do not put timers in `applyFrame`. Preserve an active `tap` on `RELEASED`, convert `hold` to `hold-afterglow`, clear `pending`, and ignore release without state. Cancel every cleanup on `reset()`.

- [ ] **Step 8: Run parser/store tests and commit**

Run: `npm test -- src/connection/rawHidFrames.test.ts src/monitor/monitorStore.test.ts`

Expected: PASS.

```bash
git add src/connection/rawHidFrames.ts src/connection/rawHidFrames.test.ts src/monitor/monitorStore.ts src/monitor/monitorStore.test.ts
git commit -m "feat: track hold-tap Raw HID decisions"
```

### Task 4: Render Decision Text and Orange Hold State

**Files:**
- Modify: `src/monitor/MinimalKeysMonitorLayout.test.tsx`
- Modify: `src/monitor/MinimalKeysMonitorLayout.tsx`
- Modify: `src/StudioConnectionOverview.test.tsx`
- Modify: `src/StudioConnectionOverview.tsx`
- Modify: `src/monitor/MonitorPanel.tsx`

**Interfaces:**
- Consumes: `holdTapStates: ReadonlyMap<number, HoldTapVisualState>`.
- Produces: visible badges `判定中`, `単押し`, `長押し`; hold and hold-afterglow use orange styling.

- [ ] **Step 1: Write failing accessible visual-state tests**

Render the real layout with positions 10–12 in each state and assert:

```tsx
expect(screen.getByLabelText(/pos 10 .* 判定中/)).toHaveTextContent("判定中");
expect(screen.getByLabelText(/pos 11 .* 単押し/)).toHaveTextContent("単押し");
expect(screen.getByLabelText(/pos 12 .* 長押し/)).toHaveClass("bg-orange-100", "ring-orange-400");
```

Also render with an empty map and verify an ordinary pressed key still says only `押下中`.

- [ ] **Step 2: Run layout tests and verify RED**

Run: `npm test -- src/monitor/MinimalKeysMonitorLayout.test.tsx`

Expected: FAIL because the prop and badges do not exist.

- [ ] **Step 3: Implement state mapping and styling**

Use a local mapping:

```ts
const decisionCopy = {
  pending: "判定中",
  tap: "単押し",
  hold: "長押し",
  "hold-afterglow": "長押し",
} as const;
```

Render the original binding label plus a small state badge. For hold states apply `border-orange-400 bg-orange-100 text-orange-900 ring-2 ring-orange-400/60`; pending remains teal; tap uses green. Append decision copy to `aria-label` and retain `aria-pressed` from physical `0xF1` state.

- [ ] **Step 4: Thread snapshot state through both monitor surfaces**

Pass `monitor.holdTapStates` from `StudioConnectionOverview` and `snapshot.holdTapStates` from `MonitorPanel`. Keep the prop optional with a module-level empty map so `UnifiedStudioPreview` and old callers remain compatible.

- [ ] **Step 5: Run focused and isolation tests**

Run:

```bash
npm test -- src/monitor/MinimalKeysMonitorLayout.test.tsx src/StudioConnectionOverview.test.tsx src/App.monitor-isolation.test.tsx src/connection/useRightUsbConnection.test.tsx
```

Expected: badges pass and high-rate pointer updates still do not re-render the editor root.

- [ ] **Step 6: Commit**

```bash
git add src/monitor/MinimalKeysMonitorLayout.tsx src/monitor/MinimalKeysMonitorLayout.test.tsx src/monitor/MonitorPanel.tsx src/StudioConnectionOverview.tsx src/StudioConnectionOverview.test.tsx
git commit -m "feat: show tap and orange hold decisions"
```

### Task 5: Integrate, Build, and Prepare Release

**Files:**
- Modify after publication approval: `/Users/iwanedaijun/repos/minimal-keys-release/config/west.yml`

**Interfaces:**
- Consumes: committed ZMK and `zmk-input-notifier` SHAs.
- Produces: right-hand UF2 and Tauri production application.

- [ ] **Step 1: Run all local Studio gates**

```bash
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run tauri build
```

Expected: every command exits 0.

- [ ] **Step 2: Run local firmware and packet gates**

Run the ZMK monitor fixtures, the existing hold-tap suites, the host packet test, and the right-hand `west build` command from Tasks 1–2.

Expected: all exit 0 and `build/hold-tap-monitor/zephyr/zmk.uf2` exists.

- [ ] **Step 3: Stop at the publication gate**

Before any push or GitHub Actions dispatch, report the exact repositories and branches to be published:

- `hyhy-masa/zmk` — `codex/hold-tap-monitor-event`
- `yangentai181-wq/zmk-input-notifier` — `codex/hold-tap-monitor-event`
- `yangentai181-wq/minimal-keys-release` — `codex/hold-tap-monitor-release`

Obtain explicit CEO confirmation because push and workflow dispatch are external publication/deployment actions.

- [ ] **Step 4: After approval, publish dependency branches and pin immutable SHAs**

Push ZMK and notifier branches, record the exact outputs of these commands, then replace the two existing `revision:` values in `minimal-keys-release/config/west.yml` with those literal 40-character outputs:

```bash
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk rev-parse HEAD
git -C /Users/iwanedaijun/repos/zmk-input-notifier rev-parse HEAD
```

Keep `remote: hyhy-masa` for `zmk` and `remote: yangentai181-wq` for `zmk-input-notifier`. No branch name is pinned.

- [ ] **Step 5: Commit and, after the same approval, push the release branch**

```bash
git add config/west.yml
git commit -m "build: include hold-tap monitor protocol"
git push -u origin codex/hold-tap-monitor-release
```

Verify the resulting GitHub Actions run succeeds and download `minimal-keys_R-usb-studio-raw-hid.uf2`.

- [ ] **Step 6: Verify the physical workflow without automatic flashing**

Provide the UF2 to the user and ask them to enter the right-hand bootloader and copy it. After reconnect:

- tap a configured hold-tap key and observe green `単押し`
- hold the same key and observe orange `長押し`
- press a left-hand hold-tap key over the wireless split and observe the same authoritative state on the right-hand USB monitor
- verify trackball movement and Studio RPC editing still work

Do not claim completion until these physical checks are reported successful.
