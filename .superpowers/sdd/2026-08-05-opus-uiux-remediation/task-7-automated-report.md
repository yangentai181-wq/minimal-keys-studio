# Task 7 automated verification and acceptance evidence

Date: 2026-08-05

## Automated verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Frontend tests | PASS | `npm test`: 110 files, 682 tests passed. Expected ErrorBoundary console output was emitted by its tests only. |
| Lint | PASS | `npm run lint` exited 0. |
| Production web build | PASS | `npm run build` exited 0; its mandatory `verify:local-fonts` gate passed on fresh `dist`. |
| Storybook build | PASS | `npm run build-storybook` exited 0. It reports only the existing no-MDX and third-party `eval` advisories. |
| Rust tests | PASS | `cargo test --manifest-path src-tauri/Cargo.toml`: 8 transport/HID lifecycle tests passed. |
| Rust strict lint | PASS | `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` exited 0. |
| Tauri production build | PASS | `npm run tauri build` exited 0 and produced the macOS bundle/DMG. |

`block v0.1.6` has a Cargo future-incompatibility advisory from a dependency; it is not a compiler or Clippy failure.

## Final Rust cleanup

The previously recorded 13 strict-Clippy diagnostics were resolved without `allow` attributes:

- Removed unused BLE helper/imports and replaced indexed first-element access with `.first()`.
- Named the active transport sink type rather than retaining a complex inline type.
- Removed the unused close-command request parameter.
- Replaced ignored Tauri event-emission results with error logging and a safe reader-loop stop where continuing would be wrong.
- Simplified the serial enumeration and CLI paths to their direct equivalents.

## Acceptance evidence

| # | Requirement | Direct evidence | Status |
| --- | --- | --- | --- |
| 1 | Desktop has primary `右手をUSBで接続` | `src/ConnectModal.test.tsx` and Task 1 focused suite cover the immediate Tauri primary action. | Automated proof complete |
| 2 | One USB connection supports monitor and Studio editing | `src/connection/rightUsbFlow.test.ts`, `src/connection/useRightUsbConnection.test.tsx`, `src/tauri/rawHid.test.ts`, and Rust lifecycle tests cover the adapter and independent monitor/editor contracts. `transport::commands::tests::failed_transport_notifies_only_when_its_session_is_still_current` proves a failed stale serial/BLE session cannot clear a newer editor session, while `transport::hid::tests::input_emit_failure_stops_and_clears_the_active_reader` proves monitor delivery failure stops and clears only its own reader. Actual native-device report forwarding remains physical evidence. | Automated contract proof complete; physical proof pending |
| 3 | Precision loading/disconnect/unsupported/error are distinct | `src/rpc/CustomSubsystemsProvider.test.tsx`, `src/trackball/precision-state.test.ts`, `src/trackball/TrackballPrecisionContext.test.tsx`, and `src/trackball/TrackballPrecisionSettings.test.tsx` cover all states and retry. | Automated proof complete |
| 4 | 800x600 remains usable; default is 1200x800 | `src/keyboard/compute-one-u.test.ts` covers 800x600 sizing and Task 3 tests cover compact/bounded connection details; `src-tauri/tauri.conf.json` sets default 1200x800 and minimum 800x600. | Automated/configuration proof complete; visual proof pending |
| 5 | Audited failures do not show English | `src/copy/errorMessages.test.ts`, `src/copy/userFacingEnglish.test.ts`, `src/ConnectModal.test.tsx`, `src/App.disconnected.test.tsx`, and `src/ErrorBoundary.test.tsx` cover the fixed Japanese surface and raw-error exclusion. | Automated proof complete |
| 6 | Pointer frames do not rerender shell/editor | `src/App.monitor-isolation.test.tsx` and `src/connection/useRightUsbConnection.test.tsx` assert only monitor leaves update. | Automated proof complete |
| 7 | Inactive tabs unmount; drafts are guarded | `src/navigation/StudioSessionNavigation.test.tsx`, `src/navigation/DirtyStateContext.test.tsx`, `src/navigation/UnsavedChangesDialog.test.tsx`, `src/encoder/EncoderSettings.test.tsx`, and `src/holdtap/HoldTapSettings.test.tsx` cover unmount, save, discard, cancel, failure, loss, and restoration. | Automated proof complete |
| 8 | `useSub` does not resubscribe on rerender | `src/usePubSub.test.ts` covers stable proxy registration, callback replacement, event changes, and cleanup. | Automated proof complete |
| 9 | Selection/resize does not recompute 43-key data | `src/keyboard/key-presentation.test.tsx` covers selector memoization and invalidation boundaries. | Automated proof complete |
| 10 | Resolved loading is immediate | `src/keyboard/Keyboard.loading.test.tsx` asserts ready data renders within 100 ms and no 500 ms floor remains. | Automated proof complete |
| 11 | No Google Fonts at runtime or build | `src/style/noRemoteFonts.test.ts` and mandatory `verify:local-fonts` after the fresh production build reject Google font URLs in source and output. | Automated proof complete |
| 12 | All automated gates and physical workflow | All automated gates above pass. No physical-keyboard observation was performed in this task. | Physical verification pending |

## Deliberately unverified manual evidence

No screenshots were captured at 800x600 or 1200x800, and no physical keyboard was connected during this automated task. The following must therefore be checked before declaring the overall work complete: actual compact layout/editor visibility, right-hand USB monitor and editor readiness, X-hold 200 CPI then release 800 CPI, and left-hand wireless input stability through the right half.

## Fix round 1/5

- Raw HID now treats an input-event emission failure as terminal for that reader: it logs the failure, requests reader stop, and clears the matching reader state. Failure to emit the subsequent raw-HID error is also logged.
- Serial and BLE writer failures now clear and notify through one session-identified helper. A stale task cannot clear or emit a disconnect for a newer connection; disconnect-event emission failures are logged.
- Rust regression coverage adds the Raw HID event-emission cleanup seam and both current/stale failed-transport notification paths.
- Re-run verification: Rust tests (8), strict Clippy, frontend tests (110 files / 682), lint, production build, Storybook build, and Tauri build all pass.

## Fix round 2/5

- BLE notification setup failure and an unrequested notification stream end now take the same session-safe cleanup/notification route as other transport failures.
- Explicit disconnect first removes the active session, so its resulting notification end is stale and produces no duplicate disconnect event.
- Regression tests cover setup failure, current stream end, and stale stream end. Requirement 2 now identifies adapter/lifecycle-contract coverage only; physical hardware remains the evidence for real native report forwarding.

## Fix round 3/5

- An unrequested BLE device-connection event-stream end is now an unexpected current-session failure, so it clears and notifies through the same session-safe helper.
- Requested close is still classified through the shutdown signal and does not produce a duplicate notification. If the notification stream and device-event stream both end unexpectedly, the first cleanup wins and the second is stale.
- Rust regression coverage proves that the two stream-end paths notify exactly once; strict Clippy remains clean.

## Fix round 4/5

- A regression test now models explicit close by removing the active session before both BLE stream-termination helpers run. Both helpers return stale and emit zero disconnect notifications.
