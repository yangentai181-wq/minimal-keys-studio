# Task 5 report — render isolation and memoized key presentation

## Changes

- Right USB connection now exposes one stable monitor store. `AppInner` no longer subscribes to Raw HID snapshots; monitor-only leaves subscribe through `useMonitorSnapshot`.
- `useSub` now keeps one proxy listener per event name, dispatches to the latest callback, and makes explicit/unmount cleanup idempotent.
- Key presentation is a pure selector with layer names and behavior lists prepared once per keymap revision. Pixel size and key selection do not invalidate its memoized presentation.

## TDD evidence

- `useRightUsbConnection.test.tsx` proves a pointer frame re-renders the monitor leaf while header/editor counters remain unchanged.
- `usePubSub.test.ts` covers callback replacement, event-name replacement, explicit unsubscribe, and cleanup.
- `key-presentation.test.tsx` covers the selector output and input invalidation boundary.

## Verification

```text
npm test -- src/monitor/monitorStore.test.ts src/connection/useRightUsbConnection.test.tsx src/usePubSub.test.ts src/keyboard/key-presentation.test.ts src/StudioConnectionOverview.test.tsx
9 files, 31 tests passed

npm test
105 files, 670 tests passed

npm run lint
passed

npm run build
passed (existing Vite chunk-size warning only)

npm run tauri build
passed (existing Vite chunk-size warning only)
```
