# Task 3 report

## RED / GREEN evidence

- RED: `npm test -- src/StudioConnectionOverview.test.tsx` failed because `ライブ読み取り` was mounted before expanding connection details.
- GREEN: `npm test -- src/StudioConnectionOverview.test.tsx src/navigation` passed: 4 files, 12 tests.
- RED: `npm test -- src/navigation/DirtyStateContext.test.tsx src/navigation/UnsavedChangesDialog.test.tsx` initially failed to resolve the newly specified modules.
- GREEN: the same navigation tests pass and cover clean navigation, save, discard, cancel, and a rejected save.

## Changes

- Tauri now opens at 1200×800 and supports 800×600 as the minimum.
- The connection overview starts compact. Detail-only cards, monitor layout, and precision status mount after `接続の詳細` and use a bounded `overflow-y-auto` surface.
- Tabs now mount only the active screen. The keymap undo stack and the trackball precision draft register with one dirty-navigation guard. Tab switching and disconnect request confirmation before unmounting a dirty screen.
- The dialog uses `変更を保存しますか？`, `保存して移動`, `破棄して移動`, and `戻る`. Save/discard failures resolve navigation as false, retaining the current screen.

## Verification

```text
npm test -- src/StudioConnectionOverview.test.tsx src/navigation
4 files, 12 tests passed

npm test
98 files, 629 tests passed

npm run lint
passed

npm run build
passed
```

## Self-review and concerns

- The other listed settings screens do not expose a single discardable local draft contract: their controls issue RPC updates from their explicit save/apply actions, and their fetched selection state is not a pending edit. They are intentionally not registered rather than inventing unsafe discard behavior.
- Existing Vite chunk-size warning remains; it is unrelated to this task.

## Fix round 1

RED observed before this round's implementation: `npm run build` reported the new boolean dirty-navigation contract was not yet satisfied by the Trackball precision save callback. GREEN: `npm test -- src/navigation/DirtyStateContext.test.tsx src/trackball/TrackballPrecisionSettings.test.tsx` passed (2 files, 16 tests); `npm run build` and `npm run lint` passed.

Coverage added in `src/navigation/DirtyStateContext.test.tsx`: a resolved `false` save result keeps navigation at the current draft, in addition to rejected saves. Encoder and hold-tap now register their local form states with save/discard callbacks; failed RPC saves reject and keep the screen mounted.

## Fix round 1 continuation

GREEN: `npm test -- src/navigation/DirtyStateContext.test.tsx` passed (1 file, 8 tests); `npm run build` and `npm run lint` passed. The registry now snapshots dirty consumer-owned drafts before an unexpected notification-stream termination and restores them when the corresponding active screen registers after reconnect, with `未保存の変更を復元しました`.
