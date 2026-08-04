# Trackball Precision Settings Design

## Goal

Add one focused trackball-settings feature to minimal-keys Studio. The user can choose a normal CPI, a precision CPI, and any supported physical key. Tapping the selected key preserves its existing tap action. Holding it replaces its previous hold action and enables precision CPI until release.

This work intentionally excludes broader connection, diagnostics, and application redesign work.

## User Experience

The existing trackball settings section gains three controls:

1. `通常の速さ`: 200–3200 CPI in 200-CPI steps.
2. `精密時の速さ`: 200–3200 CPI in 200-CPI steps and constrained to be no greater than the normal CPI.
3. `精密モードキー`: the existing physical keyboard layout becomes a position picker.

The initial recommended values are 800 CPI for normal movement and 200 CPI for precision movement. These remove the current 3200-CPI/25-percent software downscaling from the default path.

Selecting a key shows its current tap and hold actions and this explicit consequence:

- The tap action is preserved.
- The existing hold action is replaced by precision mode.

Only one precision key can be selected at a time. Selecting another key restores the former key's complete original binding before wrapping the new key. The UI highlights the selected key and requires an explicit `保存` action; selecting a key alone does not write to the keyboard.

While connected to the Raw HID monitor, the trackball panel displays the confirmed normal CPI, precision CPI, and current mode (`通常` or `精密`). The mode display follows the device's active precision layer rather than an optimistic browser state.

## Interaction Semantics

The chosen key behaves as follows:

- Press and release without holding: execute the original tap action.
- Hold past the configured hold-tap threshold: activate precision mode.
- Move the trackball while the key is held: use precision CPI.
- Release the key: restore normal CPI immediately.
- If the key previously had a hold action, that hold action is replaced. The original complete binding is retained on the keyboard so it can be restored when a different precision key is selected or precision mode is disabled.

The precision layer is a firmware-reserved transparent layer. Its bindings do not replace other key actions while precision mode is active. The Studio layer editor and ordinary layer picker do not expose this internal layer as a user-editable layer.

## Technical Approach

### Sensor-level CPI switching

Use the PMW3610 driver's existing layer-sensitive SNIPE path instead of multiplying pointer deltas in the app or host OS. The driver is extended so normal and precision CPI are runtime values rather than compile-time-only values. Both values retain the PMW3610 hardware constraints of 200–3200 CPI in 200-CPI increments.

The default movement path uses 100-percent X/Y scaling. This avoids the fractional accumulation caused by the current 3200-CPI/25-percent scaling combination. Precision mode writes the lower CPI to the sensor when the reserved layer becomes active; leaving the layer restores normal CPI.

### Precision key wrapping

The firmware keymap adds one reserved transparent precision layer. Studio converts the selected base-layer binding into the matching precision hold-tap wrapper:

- Plain key, layer-tap, and mod-tap bindings preserve their tap key and replace the hold side with the precision layer.
- Mouse-button layer-tap bindings preserve their mouse-button tap through the existing mouse hold-tap behavior and replace the hold layer.

The current base layer consists of these supported binding families. If a future keymap contains a binding whose tap action cannot be represented safely, Studio disables saving for that position and explains why instead of silently changing its behavior.

### Device-persisted settings

Add a `trackball_settings` custom Studio RPC subsystem with these confirmed device values:

- normal CPI;
- precision CPI;
- enabled state;
- selected physical position;
- original behavior identifier and binding parameters for the selected position;
- configuration revision used for stale-write protection.

Settings are stored through Zephyr settings storage on the right-hand central device. The app always reads the device on connection and does not treat browser storage as authoritative.

The subsystem exposes read, validate, apply, and notification operations. Apply is transactional from the app's perspective: the firmware validates both CPI values, the position, and the original binding before changing either the keymap binding or persisted trackball settings. On any failure, the previous binding and CPI configuration remain active.

### Repositories and boundary

The change crosses these boundaries:

- `minimal-keys-studio`: controls, key picker, protocol encoding/decoding, confirmed/pending state, and monitor presentation.
- `minimal-keys-release`: reserved layer, supported wrapper behaviors, defaults, module revisions, and built firmware artifacts.
- `pmw3610-driver-minimal`: public runtime CPI state, sensor switching, validation, persistence hook, and the trackball settings Studio RPC handler.

The TypeScript protocol and firmware protocol definitions must be updated together. No app-only fallback writes pointer scaling values because that would preserve the low-speed quantization this feature is intended to remove.

## App State and Data Flow

1. Studio connects to the right-hand central device.
2. It discovers `trackball_settings` and reads the confirmed configuration.
3. The settings UI initializes from the device response.
4. User edits remain local and are shown as unsaved.
5. `保存` sends one validated configuration request.
6. The UI stays pending until a matching device notification or confirmed readback arrives.
7. Success updates both the settings section and live monitor.
8. Error or timeout restores the last confirmed UI values and shows a concise recovery message.

Changing the selected key includes restoration of the previous original binding and capture of the new original binding within the same firmware-side apply operation. Reconnecting during an unfinished save discards browser-pending values and reads the device again.

## Validation and Error Handling

- CPI values outside 200–3200 or not divisible by 200 are rejected before transmission and by firmware.
- Precision CPI greater than normal CPI is rejected with an inline explanation.
- Unsupported or reserved key positions cannot be saved.
- A stale configuration revision is rejected and forces a fresh device read instead of overwriting newer device state.
- Transport loss leaves the last confirmed device configuration displayed and marks edits unsaved.
- A failed binding update restores the previous key binding before returning an error.
- Firmware without the new subsystem keeps the current trackball editor usable and shows that precision settings require updated firmware.

## Testing

### Studio

- Protocol tests cover get/apply messages, explicit zero/false fields, invalid payloads, and notifications.
- Pure state tests cover normal/precision validation, pending/confirmed rollback, stale revisions, and unsupported bindings.
- Binding-conversion tests cover plain key, layer-tap, mod-tap, and mouse-button layer-tap inputs and exact restoration of the original binding.
- Component tests cover sliders, 200-CPI steps, key selection, hold-action warning, unsaved state, save success, failure rollback, and unavailable firmware.
- Monitor tests cover device-confirmed normal/precision mode and current CPI display.

### Firmware and driver

- Unit tests cover CPI validation, runtime normal-to-precision transitions, release restoration, persistence reload, and transactional rollback.
- Build both left and right firmware artifacts; only the right artifact contains the sensor and settings subsystem.
- Verify the Studio and firmware protocol fixtures against the same byte-level examples.

### Hardware acceptance

- 800-CPI normal movement works without 25-percent software scaling.
- Holding the selected key produces 200-CPI movement and releasing it restores 800 CPI.
- A short tap still emits the selected key's original tap action.
- Selecting another key restores the previous key's complete binding.
- Settings survive right-hand reset, USB reconnect, app restart, and switching the host output between USB and Bluetooth.
- Left-hand wireless input continues working while the right hand is USB-connected.
- A 30-minute mixed test covers typing, precision movement, normal movement, scrolling, and repeated precision-key transitions without another input-path stall.

## Out of Scope

- Hardware changes to the ball, bearings, sensor mount, or enclosure.
- Pointer acceleration curves, smoothing-filter tuning, and automatic speed detection.
- Bluetooth pairing repair and broader connection diagnostics.
- General application navigation or visual redesign.
- More than one precision key or more than two CPI profiles.

