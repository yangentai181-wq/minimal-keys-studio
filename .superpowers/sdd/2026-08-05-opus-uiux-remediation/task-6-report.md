# Task 6 report — loading and local typography

## Delivered

- Removed the keyboard editor's artificial 500 ms minimum loading display; visibility now follows the actual readiness of layouts, keymap, and behaviors.
- Added fake-timer regression tests showing data that resolves within 100 ms renders immediately, while a pending physical-layout request remains a spinner past 600 ms.
- Treat empty or invalid active physical-layout responses as unresolved, so the keymap editor is never rendered with an undefined layout.
- Removed the Google Fonts import and configured Japanese system sans-serif typography for application text plus a system monospace stack for technical values and keycaps.
- Added source and generated-bundle scans which reject Google font endpoints. The bundle scan runs when `dist` exists, and is run again after production build verification.

## Verification

- `npm test -- src/keyboard/Keyboard.loading.test.tsx src/style/noRemoteFonts.test.ts` — 2 files, 6 tests passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `rg -n 'useMinLoadingTime|fonts\\.googleapis\\.com|fonts\\.gstatic\\.com' src dist tailwind.config.js` — no matches.
- `npm test` — 109 files, 679 tests passed.
- `npm run tauri build` — passed; macOS app and DMG produced.
