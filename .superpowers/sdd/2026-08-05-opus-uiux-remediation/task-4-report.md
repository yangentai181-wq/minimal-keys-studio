# Task 4 report — Japanese failure messages

## Scope

- Centralized the 22 failure paths identified by the Opus audit in `src/copy/errorMessages.ts`.
- Replaced each audited user-facing toast with operation-first Japanese guidance that tells the user to check the connection and try again.
- Kept raw error objects and protocol details in `console.error` only.

## TDD evidence

- RED: `npm test -- src/copy/errorMessages.test.ts src/copy/userFacingEnglish.test.ts` failed because the message module did not exist and English `Failed` toast text remained.
- GREEN: the same focused command passes after the replacements.

## Verification

- `rg -n 'toast\\([^\\n]*[Ff]ailed' src --glob '*.{ts,tsx}'` finds no user-facing toast. The shared RPC helper also uses safe Japanese copy rather than exposing its caller label.
- `npm test` — 104 files / 660 tests passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run tauri build` — passed.

## Fix round 1

- Connection failures now use a tested normalizer: cancellation remains silent, while all other failures use fixed Japanese recovery guidance and preserve the original error only in developer logs.
- The source regression scan now covers the connection error renderer in addition to toasts.
- Clockwise and counter-clockwise encoder binding failures now each invoke their corresponding audited messages; the 22-entry table is no longer carrying unused keys.
- Focused: 5 files / 27 tests passed. Full: 104 files / 665 tests passed. Lint, web build, and Tauri build passed.

## Fix round 2

- The App's device-information initialization failure route now calls the shared `normalizeConnectionError` function before it reaches the toast callback.
- The original error remains available to `console.error`; raw RPC, device-info, native transport, and English error text cannot reach the App toast.
- The integration test invokes the App transport callback and proves that a raw device-information failure reaches the fixed Japanese message instead.
- Focused: 5 files / 24 tests passed. Full: 104 files / 666 tests passed. Lint, web build, and Tauri build passed.
