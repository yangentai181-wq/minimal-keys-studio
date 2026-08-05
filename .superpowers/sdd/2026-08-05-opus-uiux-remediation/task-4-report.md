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
