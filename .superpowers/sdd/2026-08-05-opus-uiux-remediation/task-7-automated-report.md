# Task 7 automated verification and acceptance evidence

Date: 2026-08-05

## Automated verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Frontend tests | PASS | `npm test`: 110 files, 682 tests passed. Expected ErrorBoundary console output was emitted by its tests only. |
| Lint | PASS | `npm run lint` exited 0. |
| Production web build | PASS | `npm run build` exited 0; its mandatory `verify:local-fonts` gate passed on fresh `dist`. |
| Storybook build | PASS | `npm run build-storybook` exited 0. It reports only the existing no-MDX and third-party `eval` advisories. |
| Rust tests | PASS | `cargo test --manifest-path src-tauri/Cargo.toml`: 5 HID tests passed. |
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
| 2 | One USB connection supports monitor and Studio editing | `src/connection/rightUsbFlow.test.ts`, `src/connection/useRightUsbConnection.test.tsx`, `src/tauri/rawHid.test.ts`, and Rust HID lifecycle tests cover independent monitor/RPC contracts and native event forwarding. | Automated proof complete; physical proof pending |
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
