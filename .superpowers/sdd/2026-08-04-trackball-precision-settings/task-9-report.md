# Task 9 Report

## Summary

Added the precision settings section above the existing trackball runtime controls. The section uses the shared confirmed/draft precision context, provides bounded normal and precision CPI sliders, supports enabling the physical-key picker, and prevents invalid or unavailable saves.

Layer 8 is now identified as the internal precision role, hidden from the ordinary layer picker, omitted from keymap exports, and protected from nine-layer legacy imports so the device-owned layer cannot be overwritten or cause user layers to shift.

## TDD evidence

- RED: `npm test -- src/trackball/TrackballPrecisionSettings.test.tsx src/keyboard/LayerPicker.test.tsx src/keyboard/keymap-io.test.ts` exited 1 before implementation. The settings module was missing; layer 8 was displayed; and export included layer 8.
- GREEN: the same focused suite exited 0 after implementation (5 files, 49 tests).

## Verification

- `npm test -- src/trackball/TrackballPrecisionSettings.test.tsx src/keyboard/LayerPicker.test.tsx src/keyboard/keymap-io.test.ts` — passed (5 files, 49 tests)
- `npm test` — passed (87 files, 568 tests)
- `npm run build` — passed
- `npm run lint` — passed
- `git diff --check` — passed

## Notes

- The existing Task 7 context tests cover apply success, timeout rollback with retained draft, stale reload, and firmware availability. Task 8 covers draft-only physical-key selection before Save.
- Full tests print expected ErrorBoundary stack traces and Vite prints a pre-existing dependency-optimization warning; both commands exit successfully.
