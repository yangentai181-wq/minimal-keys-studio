# Studio Connect UI Design

## Scope

Improve the disconnected first screen for `minimal-keys-studio` and align the shared visual foundation with the Minimal Keys UI rules. This keeps the previous behavior fix: the editor shell is not mounted until a device is connected.

## Goals

- Show a calm, focused connection start screen before a keyboard is connected.
- Use the Minimal Keys palette: teal primary, orange accent, slate background, white card.
- Use JetBrains Mono as the app font.
- Make USB/BLE connection actions large enough for touch and visually distinct.
- Keep browser and Tauri connection flows working with the existing `ConnectModal` API.

## Non-Goals

- Redesign the connected keymap editor.
- Change the RPC, serial, BLE, or Tauri transport behavior.
- Add new connection modes.

## Implementation Targets

- `src/ConnectModal.tsx`
  - Replace small text buttons with accessible touch-size action buttons.
  - Add concise connection guidance and transport-specific labels.
  - Preserve current async connect handling and device list behavior.
- `src/GenericModal.tsx`
  - Update modal shell styling to white card, slate border, and soft shadow.
- `src/index.css`
  - Set JetBrains Mono and slate background on `html`, `body`, and `#root`.
- `tailwind.config.js`
  - Map `primary` to teal and `accent` to orange.
- `src/ConnectModal.test.tsx`
  - Add regression coverage for the redesigned connection actions.

## Verification

- `npm test`
- `npm run lint`
- `npm run build`
- Browser check at `/minimal-keys-studio/?chrome=1782631048` for disconnected state.
