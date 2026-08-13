# Trackball Precision Settings Implementation Plan

> **For Codex:** Execute this plan with `superpowers:executing-plans` for inline work, or `superpowers:subagent-driven-development` only if the user explicitly chooses delegated execution. Follow RED → GREEN → REFACTOR for every testable task.

**Goal:** Let the user configure normal CPI, precision CPI, and one freely chosen precision-mode key in Studio, while preserving that key's tap action and persisting the complete configuration on the right-hand keyboard.

**Architecture:** The PMW3610 module owns the authoritative configuration, sensor CPI switching, key-binding transaction, settings persistence, and custom Studio RPC. The release repository reserves transparent layer 8 and enables the module. Studio manually encodes the custom protobuf payload, keeps confirmed and draft state separate, renders a physical-key picker, and shares confirmed live mode with the monitor.

**Tech Stack:** Zephyr/ZMK C, nanopb protobuf, ZMK custom Studio RPC, React 18, TypeScript, protobufjs/minimal, Vitest, Testing Library.

## Locked constants and protocol

- Precision layer ID: `8`.
- CPI range: `200..3200`, step `200`.
- Initial firmware defaults: normal `800`, precision `200`, disabled until a key is selected.
- Custom subsystem identifier: `trackball_settings`.
- Stored schema version: `1`.
- Stale-write rule: `expected_revision` must equal the device's current revision.
- Position sentinel: selected position is meaningful only when `enabled == true`; do not overload position `0` as “none”.
- Firmware captures the original binding itself. The app never supplies or guesses the original binding.

Protocol shape to use in both C and TypeScript:

```proto
message BindingSnapshot {
  uint32 behavior_id = 1;
  uint32 param1 = 2;
  uint32 param2 = 3;
}

message TrackballConfig {
  uint32 schema_version = 1;
  uint32 normal_cpi = 2;
  uint32 precision_cpi = 3;
  bool enabled = 4;
  uint32 selected_position = 5;
  BindingSnapshot original_binding = 6;
  uint32 revision = 7;
  bool precision_active = 8;
  uint32 current_cpi = 9;
}

message ApplyRequest {
  uint32 normal_cpi = 1;
  uint32 precision_cpi = 2;
  bool enabled = 3;
  uint32 selected_position = 4;
  uint32 expected_revision = 5;
}

message ApplyResponse {
  enum Result { OK = 0; INVALID_CPI = 1; INVALID_POSITION = 2;
                UNSUPPORTED_BINDING = 3; STALE_REVISION = 4;
                KEYMAP_WRITE_FAILED = 5; SETTINGS_WRITE_FAILED = 6;
                SENSOR_WRITE_FAILED = 7; }
  Result result = 1;
  TrackballConfig config = 2;
}

message Request {
  oneof request_type {
    google.protobuf.Empty get = 1;
    ApplyRequest validate = 2;
    ApplyRequest apply = 3;
  }
}

message Response {
  oneof response_type {
    TrackballConfig get = 1;
    ApplyResponse validate = 2;
    ApplyResponse apply = 3;
  }
}

message Notification { TrackballConfig changed = 1; }
```

The byte fixtures used by both test suites are:

```text
get request                         0a00
apply 800/200/enabled/pos=5/rev=7  1a0c08a00610c801180120052807
apply 800/200/disabled/rev=7       1a0808a00610c8012807
```

## Task 1: Prepare the PMW3610 module repository and pin a test baseline

**Files:**
- Clone/create working tree: `/Users/iwanedaijun/repos/pmw3610-driver-minimal`
- Verify: `/Users/iwanedaijun/repos/minimal-keys-release/config/west.yml`

**Step 1: Clone the exact dependency revision**

```bash
git clone https://github.com/hyhy-masa/pmw3610-driver-minimal.git /Users/iwanedaijun/repos/pmw3610-driver-minimal
git -C /Users/iwanedaijun/repos/pmw3610-driver-minimal checkout ed93886
git -C /Users/iwanedaijun/repos/pmw3610-driver-minimal switch -c codex/trackball-precision-settings
```

Expected: HEAD starts at the exact revision currently pinned by `minimal-keys-release`.

**Step 2: Record baseline checks**

```bash
git -C /Users/iwanedaijun/repos/pmw3610-driver-minimal status --short --branch
git -C /Users/iwanedaijun/repos/minimal-keys-release diff -- config/west.yml
```

Expected: clean module branch and no release manifest change yet.

## Task 2: Add a tested runtime CPI profile to the driver

**Files:**
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/include/pmw3610/trackball_profile.h`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/src/trackball_profile.c`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/trackball_profile/CMakeLists.txt`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/trackball_profile/prj.conf`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/trackball_profile/testcase.yaml`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/trackball_profile/src/main.c`
- Modify: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/CMakeLists.txt`
- Modify: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/Kconfig`
- Modify: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/src/pmw3610.c`
- Modify: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/src/pmw3610.h`

**Step 1: Write failing profile tests**

Test these exact public invariants:

```c
ZTEST(trackball_profile, accepts_200_step_values) {
    zassert_ok(trackball_profile_validate(800, 200));
    zassert_ok(trackball_profile_validate(3200, 3200));
}

ZTEST(trackball_profile, rejects_invalid_values) {
    zassert_equal(-EINVAL, trackball_profile_validate(799, 200));
    zassert_equal(-EINVAL, trackball_profile_validate(800, 4000));
    zassert_equal(-EINVAL, trackball_profile_validate(400, 800));
}

ZTEST(trackball_profile, mode_selects_confirmed_cpi) {
    struct trackball_profile profile = {.normal_cpi = 800, .precision_cpi = 200};
    zassert_equal(800, trackball_profile_cpi(&profile, false));
    zassert_equal(200, trackball_profile_cpi(&profile, true));
}
```

**Step 2: Run the test and confirm RED**

```bash
west twister -T tests/trackball_profile -p native_posix_64
```

Expected: compile failure because the profile API does not exist.

**Step 3: Implement the minimal public profile API**

Use this interface:

```c
struct trackball_profile {
    uint16_t normal_cpi;
    uint16_t precision_cpi;
};

int trackball_profile_validate(uint16_t normal_cpi, uint16_t precision_cpi);
uint16_t trackball_profile_cpi(const struct trackball_profile *profile, bool precision_active);
int pmw3610_apply_profile(const struct trackball_profile *profile);
int pmw3610_set_precision_active(bool active);
uint16_t pmw3610_current_cpi(void);
```

`trackball_profile_validate` must enforce range, step, and `precision <= normal`. Replace direct `CONFIG_PMW3610_CPI` / `CONFIG_PMW3610_SNIPE_CPI` selection in `pmw3610_report_data()` with runtime profile values. Keep the compile-time options only as boot defaults. Apply a mode change immediately, not only after the next motion frame.

**Step 4: Run tests and confirm GREEN**

```bash
west twister -T tests/trackball_profile -p native_posix_64
```

Expected: all profile tests pass.

**Step 5: Commit**

```bash
git add CMakeLists.txt Kconfig include src tests/trackball_profile
git commit -m "feat: add runtime trackball CPI profiles"
```

## Task 3: Implement the firmware-side binding transaction and persistence

**Files:**
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/include/pmw3610/trackball_settings.h`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/src/trackball_settings.c`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/trackball_settings/CMakeLists.txt`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/trackball_settings/prj.conf`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/trackball_settings/testcase.yaml`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/trackball_settings/src/main.c`
- Modify: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/CMakeLists.txt`
- Modify: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/Kconfig`

**Step 1: Write failing transaction tests around an injected adapter**

The settings core must depend on an adapter instead of hard-coding flash and keymap calls:

```c
struct trackball_settings_adapter {
    const struct zmk_behavior_binding *(*get_binding)(uint8_t layer, uint8_t position);
    int (*set_binding)(uint8_t layer, uint8_t position, struct zmk_behavior_binding binding);
    int (*save_keymap)(void);
    int (*save_settings)(const struct trackball_settings_record *record);
    int (*apply_profile)(const struct trackball_profile *profile);
};
```

Tests must cover:

- enabling on `&kp`: store the exact original binding and install `&lt 8 <tap>`;
- enabling on `&lt` and `&mt`: preserve `param2` as tap and replace hold with layer 8;
- enabling on `&lt_mkp`: preserve mouse-button `param2` with the same behavior and layer 8;
- changing positions: restore the former complete original binding before wrapping the new one;
- disabling: restore the original binding and normal CPI;
- reject unsupported bindings without writes;
- reject stale revision without writes;
- if any set/save/profile stage fails, restore RAM bindings and the prior profile, then persist the prior record; return the stage-specific error;
- settings reload validates schema and reapplies the wrapper/profile;
- revision increments exactly once after a successful apply.

**Step 2: Run the test and confirm RED**

```bash
west twister -T tests/trackball_settings -p native_posix_64
```

Expected: compile failure because the transaction API does not exist.

**Step 3: Implement the transaction core**

Use a versioned fixed-size settings record:

```c
struct trackball_settings_record {
    uint8_t schema_version;
    bool enabled;
    uint8_t selected_position;
    uint16_t normal_cpi;
    uint16_t precision_cpi;
    uint16_t original_behavior_id;
    uint32_t original_param1;
    uint32_t original_param2;
    uint32_t revision;
};
```

Store it under `trackball/settings`. Resolve behavior IDs through `zmk_behavior_get_local_id()` / `zmk_behavior_find_behavior_name_from_local_id()`. Use the exact pinned ZMK APIs:

```c
zmk_keymap_get_layer_binding_at_idx(0, position);
zmk_keymap_set_layer_binding_at_idx(0, position, binding);
zmk_keymap_save_changes();
```

Build wrapper bindings from device-tree behavior names for `&kp`, `&lt`, `&mt`, and `&lt_mkp`; do not compare unstable numeric IDs. Refuse layer 8 references, transparent bindings, encoder position, and any binding family whose tap cannot be represented exactly.

Persistence ordering is: validate all inputs and both bindings; snapshot old record/bindings/profile; mutate bindings in RAM; apply profile; save keymap; save new settings record. Every failure path executes compensation from the snapshot. Emit success only after readback matches the new record.

**Step 4: Run tests and confirm GREEN**

```bash
west twister -T tests/trackball_settings -p native_posix_64
```

Expected: all transaction and reload tests pass.

**Step 5: Commit**

```bash
git add CMakeLists.txt Kconfig include src tests/trackball_settings
git commit -m "feat: persist precision key transactions"
```

## Task 4: Add the custom Studio RPC subsystem and live notifications

**Files:**
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/proto/zmk/trackball_settings/trackball_settings.proto`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/proto/zmk/trackball_settings/trackball_settings.options`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/src/studio/trackball_settings_handler.c`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/studio_trackball_settings/CMakeLists.txt`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/studio_trackball_settings/prj.conf`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/studio_trackball_settings/testcase.yaml`
- Create: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/tests/studio_trackball_settings/src/main.c`
- Modify: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/CMakeLists.txt`
- Modify: `/Users/iwanedaijun/repos/pmw3610-driver-minimal/Kconfig`

**Step 1: Write failing codec and handler tests**

Assert the three locked request byte fixtures above. Add handler tests for get, validate-without-write, successful apply, stale revision, invalid CPI, unsupported position, and response config readback.

**Step 2: Run and confirm RED**

```bash
west twister -T tests/studio_trackball_settings -p native_posix_64
```

Expected: missing generated protocol/handler symbols.

**Step 3: Generate nanopb sources and register the subsystem**

Follow the established module pattern:

```cmake
zephyr_nanopb_sources(app proto/zmk/trackball_settings/trackball_settings.proto)
zephyr_library_sources_ifdef(CONFIG_PMW3610_STUDIO_RPC src/studio/trackball_settings_handler.c)
```

Register `trackball_settings`, expose get/validate/apply, and raise a custom notification after:

- a successful apply;
- precision layer 8 becomes active;
- precision layer 8 becomes inactive.

The layer-state listener calls `pmw3610_set_precision_active()` so CPI changes on hold/release even before motion. The notification contains authoritative `precision_active` and `current_cpi`.

**Step 4: Run and confirm GREEN**

```bash
west twister -T tests/studio_trackball_settings -p native_posix_64
```

Expected: protocol fixtures and handler behavior pass.

**Step 5: Commit**

```bash
git add CMakeLists.txt Kconfig proto src/studio tests/studio_trackball_settings
git commit -m "feat: expose trackball settings over Studio RPC"
```

## Task 5: Reserve the precision layer and enable firmware defaults

**Files:**
- Modify: `/Users/iwanedaijun/repos/minimal-keys-release/config/minimal-keys.keymap`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-release/config/boards/shields/minimal-keys/minimal-keys_R.overlay`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-release/config/boards/shields/minimal-keys/minimal-keys_R.conf`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-release/config/west.yml`
- Create: `/Users/iwanedaijun/repos/minimal-keys-release/tests/test_precision_layer_config.py`

**Step 1: Write and run a failing release-wiring test**

The unittest must parse the keymap, overlay, conf, and manifest and assert: layer 8 exists with 43 transparent bindings; `snipe-layers = <8>`; defaults are 800/200 with 100% scaling; both trackball settings Kconfig switches are enabled; and the PMW module revision is not the old `ed93886` pin.

```bash
python3 -m unittest tests/test_precision_layer_config.py
```

Expected: failure because precision layer and settings are absent.

**Step 2: Add reserved transparent layer 8**

Append `precision_layer` after layer 7 with the exact same 43 transparent positions as the other layers. Give it a stable name/comment marking it internal and non-user-editable.

**Step 3: Wire the sensor and defaults**

Add to the trackball node:

```dts
snipe-layers = <8>;
```

Set:

```conf
CONFIG_PMW3610_CPI=800
CONFIG_PMW3610_SNIPE_CPI=200
CONFIG_PMW3610_X_SCALE=100
CONFIG_PMW3610_Y_SCALE=100
CONFIG_PMW3610_STUDIO_RPC=y
CONFIG_PMW3610_TRACKBALL_SETTINGS=y
```

Keep existing orientation, deadzone, polling, automouse layer 4, and scroll layer 7 settings unchanged.

**Step 4: Pin the module commit**

Replace `ed93886` in `config/west.yml` with the full commit SHA from Tasks 2–4. Do not use a moving branch name.

**Step 5: Run release-wiring tests and confirm GREEN**

```bash
python3 -m unittest discover -s tests
```

Expected: scroll-layer and precision-layer tests pass.

**Step 6: Build all release artifacts**

Create an isolated local ZMK workspace, exclude the remote PMW project whose new commit is not published yet, and inject the local module checkout:

```bash
python3 -m venv /tmp/minimal-keys-zmk-venv
/tmp/minimal-keys-zmk-venv/bin/pip install west
/tmp/minimal-keys-zmk-venv/bin/west init -l /Users/iwanedaijun/repos/minimal-keys-release/config /tmp/minimal-keys-zmk-workspace
cd /tmp/minimal-keys-zmk-workspace
/tmp/minimal-keys-zmk-venv/bin/west config manifest.project-filter -- -pmw3610-driver-minimal
/tmp/minimal-keys-zmk-venv/bin/west update
/tmp/minimal-keys-zmk-venv/bin/pip install -r zmk/app/requirements.txt
/tmp/minimal-keys-zmk-venv/bin/west zephyr-export
/tmp/minimal-keys-zmk-venv/bin/west build -s zmk/app -d build/right -b seeeduino_xiao_ble -- -DSHIELD="minimal-keys_R rgbled_adapter raw_hid_adapter" -DSNIPPET=studio-rpc-usb-uart -DZMK_CONFIG=/Users/iwanedaijun/repos/minimal-keys-release/config -DZEPHYR_EXTRA_MODULES=/Users/iwanedaijun/repos/pmw3610-driver-minimal
/tmp/minimal-keys-zmk-venv/bin/west build -s zmk/app -d build/left -b seeeduino_xiao_ble -- -DSHIELD="minimal-keys_L rgbled_adapter" -DZMK_CONFIG=/Users/iwanedaijun/repos/minimal-keys-release/config -DZEPHYR_EXTRA_MODULES=/Users/iwanedaijun/repos/pmw3610-driver-minimal
/tmp/minimal-keys-zmk-venv/bin/west build -s zmk/app -d build/reset -b seeeduino_xiao_ble -- -DSHIELD=settings_reset -DZMK_CONFIG=/Users/iwanedaijun/repos/minimal-keys-release/config
```

These commands cover:

- `minimal-keys_R-usb-studio-raw-hid`;
- `minimal-keys_L`;
- `minimal-keys-settings-reset`.

Expected: right build includes PMW3610 settings RPC; left and reset builds remain successful.

**Step 7: Commit**

```bash
git add config/minimal-keys.keymap config/boards/shields/minimal-keys/minimal-keys_R.overlay config/boards/shields/minimal-keys/minimal-keys_R.conf config/west.yml tests/test_precision_layer_config.py
git commit -m "feat: reserve trackball precision layer"
```

## Task 6: Add the TypeScript protocol codec and confirmed/draft state model

**Files:**
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/proto/trackball-settings.ts`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/proto/trackball-settings.test.ts`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/precision-state.ts`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/precision-state.test.ts`

**Step 1: Write failing protocol tests**

Cover the three locked fixtures, including explicit `false` and zero-valued position fields, plus get/apply response decoding, unknown-field skipping, truncated payload rejection, and changed-notification decoding.

Use this public TS model:

```ts
export interface TrackballConfig {
  schemaVersion: number;
  normalCpi: number;
  precisionCpi: number;
  enabled: boolean;
  selectedPosition: number;
  originalBinding: { behaviorId: number; param1: number; param2: number } | null;
  revision: number;
  precisionActive: boolean;
  currentCpi: number;
}
```

**Step 2: Run focused tests and confirm RED**

```bash
npm test -- src/proto/trackball-settings.test.ts src/trackball/precision-state.test.ts
```

Expected: modules are missing.

**Step 3: Implement minimal codec and reducer helpers**

Export:

```ts
export const SUBSYSTEM_ID = "trackball_settings";
export function encodeGet(): Uint8Array;
export function encodeValidate(draft: PrecisionDraft, expectedRevision: number): Uint8Array;
export function encodeApply(draft: PrecisionDraft, expectedRevision: number): Uint8Array;
export function decodeResponse(payload: Uint8Array): TrackballResponse;
export function decodeNotification(payload: Uint8Array): TrackballConfig;
```

State helpers must validate CPI range/step/order, derive dirty state, preserve confirmed values during transport errors, discard pending state on reconnect, accept only matching/newer revisions, and map stale revision to “再読み込みが必要です”.

**Step 4: Run focused tests and confirm GREEN**

```bash
npm test -- src/proto/trackball-settings.test.ts src/trackball/precision-state.test.ts
```

**Step 5: Commit**

```bash
git add src/proto/trackball-settings.ts src/proto/trackball-settings.test.ts src/trackball/precision-state.ts src/trackball/precision-state.test.ts
git commit -m "feat: add trackball precision protocol state"
```

## Task 7: Create the shared device-backed precision controller

**Files:**
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/TrackballPrecisionContext.tsx`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/TrackballPrecisionContext.test.tsx`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-studio/src/App.tsx`

**Step 1: Write failing provider tests**

Mock `useCustomSubsystem` and notifications. Cover:

- get on subsystem discovery;
- device response initializes confirmed and draft state;
- edits affect draft only;
- apply uses confirmed revision and stays pending until matching notification/readback;
- timeout/failure restores confirmed UI and leaves an unsaved/error state;
- stale response triggers get and does not overwrite device state;
- disconnect/reconnect drops browser-only draft and refetches;
- missing subsystem reports unavailable without breaking the existing runtime processor editor.

**Step 2: Run and confirm RED**

```bash
npm test -- src/trackball/TrackballPrecisionContext.test.tsx
```

**Step 3: Implement provider and hook**

Expose:

```ts
interface TrackballPrecisionContextValue {
  availability: "loading" | "available" | "firmware-update-required";
  confirmed: TrackballConfig | null;
  draft: PrecisionDraft | null;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  updateDraft(patch: Partial<PrecisionDraft>): void;
  save(): Promise<void>;
  reload(): Promise<void>;
}
```

Mount one provider in `App.tsx` above both the settings content and monitor content so they consume the same confirmed state. Use a 5-second timeout and a confirming get if the apply response lacks the matching revision.

**Step 4: Run and confirm GREEN**

```bash
npm test -- src/trackball/TrackballPrecisionContext.test.tsx
```

**Step 5: Commit**

```bash
git add src/trackball/TrackballPrecisionContext.tsx src/trackball/TrackballPrecisionContext.test.tsx src/App.tsx
git commit -m "feat: manage device-backed precision settings"
```

## Task 8: Add key support analysis and the physical-key picker

**Files:**
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/precision-binding.ts`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/precision-binding.test.ts`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/PrecisionKeyPicker.tsx`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/PrecisionKeyPicker.test.tsx`

**Step 1: Write failing support-analysis tests**

Given behavior metadata and a base-layer `BehaviorBinding`, return the tap label and replaced hold label for `&kp`, `&lt`, `&mt`, and `&lt_mkp`. Reject `&trans`, layer 8, encoder position, and unknown behavior families with a user-facing reason. Verify position `0` is selectable.

**Step 2: Write failing component tests**

Render the existing `PhysicalLayout` using `minimalKeysPositions`. Verify:

- current selected position is highlighted;
- clicking a supported position updates draft only;
- unsupported positions are visibly disabled and explain why;
- the current tap and hold actions are shown;
- the exact warning “タップ動作は残り、長押し動作は精密モードに置き換わります” is visible;
- changing selection does not call RPC until Save.

**Step 3: Run and confirm RED**

```bash
npm test -- src/trackball/precision-binding.test.ts src/trackball/PrecisionKeyPicker.test.tsx
```

**Step 4: Implement analysis and picker**

Fetch the current keymap and behavior metadata with the existing connected-device hooks. Always analyze layer ID/index 0. The picker sends only `selectedPosition`; firmware remains responsible for capturing/restoring exact bindings.

When the confirmed selected position is already wrapped, derive its displayed tap/hold labels from `confirmed.originalBinding`, not from the wrapper now present in the base keymap. Resolve the stored behavior ID through the connected behavior metadata.

**Step 5: Run and confirm GREEN**

```bash
npm test -- src/trackball/precision-binding.test.ts src/trackball/PrecisionKeyPicker.test.tsx
```

**Step 6: Commit**

```bash
git add src/trackball/precision-binding.ts src/trackball/precision-binding.test.ts src/trackball/PrecisionKeyPicker.tsx src/trackball/PrecisionKeyPicker.test.tsx
git commit -m "feat: add precision mode key picker"
```

## Task 9: Integrate CPI controls and protect the internal layer

**Files:**
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/TrackballPrecisionSettings.tsx`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/TrackballPrecisionSettings.test.tsx`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-studio/src/trackball/TrackballSettings.tsx`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-studio/src/keyboard/minimal-keys-layers.ts`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-studio/src/keyboard/LayerPicker.tsx`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-studio/src/keyboard/LayerPicker.test.tsx`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-studio/src/keyboard/keymap-io.ts`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-studio/src/keyboard/keymap-io.test.ts`

**Step 1: Write failing settings tests**

Cover normal/precision sliders at `min=200`, `max=3200`, `step=200`; 800/200 confirmed defaults; precision-above-normal error; enable/disable; dirty Save state; apply success; timeout rollback; firmware-update-required message; and coexistence with the current rotation/inversion/scroll controls.

**Step 2: Write failing reserved-layer tests**

Add `PRECISION_LAYER_INDEX = 8` and role `precision`. Verify layer 8 is omitted from the ordinary picker, cannot be moved/removed/renamed, and import/export does not expose or overwrite it. Existing layer 4 and layer 7 badges/behavior must remain unchanged.

**Step 3: Run and confirm RED**

```bash
npm test -- src/trackball/TrackballPrecisionSettings.test.tsx src/keyboard/LayerPicker.test.tsx src/keyboard/keymap-io.test.ts
```

**Step 4: Implement the UI**

Place `TrackballPrecisionSettings` at the top of the existing `TrackballSettings` page. Keep existing advanced runtime processor controls below it. Save is disabled when clean, invalid, unsupported, unavailable, or already saving. Selecting a key never writes immediately.

For keymap import/export, filter layer ID 8 at the serialization boundary and preserve the device's existing layer 8 during import.

**Step 5: Run and confirm GREEN**

```bash
npm test -- src/trackball/TrackballPrecisionSettings.test.tsx src/keyboard/LayerPicker.test.tsx src/keyboard/keymap-io.test.ts
```

**Step 6: Commit**

```bash
git add src/trackball src/keyboard/minimal-keys-layers.ts src/keyboard/LayerPicker.tsx src/keyboard/LayerPicker.test.tsx src/keyboard/keymap-io.ts src/keyboard/keymap-io.test.ts
git commit -m "feat: add precision controls to trackball settings"
```

## Task 10: Show authoritative precision status in the monitor

**Files:**
- Modify: `/Users/iwanedaijun/repos/minimal-keys-studio/src/monitor/MonitorPanel.tsx`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/monitor/TrackballPrecisionStatus.tsx`
- Create: `/Users/iwanedaijun/repos/minimal-keys-studio/src/monitor/TrackballPrecisionStatus.test.tsx`

**Step 1: Write failing status tests**

Verify confirmed normal CPI, precision CPI, current CPI, and mode labels `通常` / `精密`. A draft edit must not change monitor values. A device notification changing `precisionActive` and `currentCpi` must update the display.

**Step 2: Run and confirm RED**

```bash
npm test -- src/monitor/TrackballPrecisionStatus.test.tsx
```

**Step 3: Implement compact monitor status**

Consume `TrackballPrecisionContext`; do not infer mode from button press or browser state. Hide the card when the subsystem is unavailable so legacy firmware monitor behavior stays intact.

**Step 4: Run and confirm GREEN**

```bash
npm test -- src/monitor/TrackballPrecisionStatus.test.tsx
```

**Step 5: Commit**

```bash
git add src/monitor/MonitorPanel.tsx src/monitor/TrackballPrecisionStatus.tsx src/monitor/TrackballPrecisionStatus.test.tsx
git commit -m "feat: show live trackball precision status"
```

## Task 11: Full verification and hardware acceptance

**Files:**
- Modify only if verification finds a defect; add a regression test before each fix.

**Step 1: Verify Studio**

```bash
npm test
npm run lint
npm run build
npm run build-storybook
```

Expected: all pass with zero lint warnings.

**Step 2: Verify module tests and release artifacts**

```bash
west twister -T tests/trackball_profile -T tests/trackball_settings -T tests/studio_trackball_settings -p native_posix_64
```

Then rebuild all three `build.yaml` entries. Expected: all tests and builds pass.

**Step 3: Cross-check protocol fixtures**

Run the C and TypeScript codec suites and confirm they both assert the three byte strings listed at the top of this plan. If either changes, update both sides in the same commit; never update only one fixture.

**Step 4: Flash and perform hardware acceptance**

With right connected by USB and left connected wirelessly:

1. Confirm normal 800 CPI at 100% X/Y scaling.
2. Select a harmless test key in Studio and save.
3. Confirm short tap emits the original tap action.
4. Hold past 200 ms; monitor changes to `精密 / 200 CPI` before moving the ball.
5. Release; monitor and sensor return immediately to `通常 / 800 CPI`.
6. Select another key; confirm the former key's complete binding is restored.
7. Restart right, reconnect USB, restart Studio, and switch host output USB↔BLE; confirm settings persist.
8. Confirm left wireless typing throughout.
9. Run 30 minutes of mixed typing, normal movement, precision movement, scrolling, and repeated hold/release transitions.

**Step 5: Final review**

Review the complete diffs against the approved design. Confirm no acceleration curve, smoothing redesign, Bluetooth repair, hardware change, or general app redesign entered scope. Run `superpowers:requesting-code-review`, address findings with tests, then run `superpowers:verification-before-completion` before reporting completion.

## Implementation notes and risks

- The pinned ZMK revision `957c4b0c8443ba908d36f090c35cbf9af9037351` exposes the required getter/setter/save APIs in `app/include/zmk/keymap.h`; no ZMK fork modification is planned.
- `zmk_keymap_save_changes()` saves all currently pending keymap edits. The precision Apply handler must serialize execution and the UI must not issue Apply while another keymap save is active. Add a firmware mutex around the transaction and return a busy/generic error rather than racing.
- Flash write failure cannot be made physically atomic across two Zephyr settings keys. “Transactional from the app's perspective” is implemented with validate-first, in-memory snapshots, ordered writes, compensating restoration, and confirmed readback. A power cut during the write window is recovered on boot by validating the versioned record and restoring either the last complete record or safe defaults.
- The existing app hand-writes custom protobuf codecs, so this plan does not modify the `zmk-studio-ts-client` fork. Standard keymap/behavior reads continue through that dependency; only the `trackball_settings` payload is local.
- The driver repository currently has no checked-out workspace sibling; Task 1 creates it from the exact release pin before any changes.
