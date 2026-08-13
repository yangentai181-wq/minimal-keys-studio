# v0.6 Trackball and Hold Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現在のStudio UIを保ったまま、Scroll対象レイヤー、Auto Mouse、長押し設定の説明と対象キー表示を安全に編集できるようにする。

**Architecture:** Studioはkeymapを共通hookで取得し、Scrollのlayer index bitmaskとAuto Mouseの永続layer IDを別の変換関数で扱う。Scroll書込みだけRIP protocolを拡張し、PMW3610 driverがruntime maskと永続化を所有する。長押しRPCは変更せず、表示名と利用箇所だけをStudioで導出する。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、Tauri 2、ZMK/Zephyr C、Nanopb、Zephyr settings

## Global Constraints

- 正本は `docs/superpowers/specs/2026-08-10-v060-trackball-and-hold-settings-design.md`。Scroll複数選択、Auto Mouse起動待ち時間、Precision再設計、layer並べ替えは追加しない。
- すべてRED→GREENで進め、各REDが意図した理由で失敗したことを確認してからproduction codeを変更する。
- Studioの `work/` と、4リポジトリ内の既存変更を保つ。各commitはそのTaskで列挙したファイルだけをstageする。
- Protocol変更はStudio、`zmk-module-runtime-input-processor`、`pmw3610-driver-minimal`、Firmware configの4境界を揃える。
- `active_layers` をScroll設定に使わない。Scrollは `1 << layer.index`、Auto Mouseは `layer.id` を送る。
- build、flash、公開、pushは別物。ここではbuildまでを自動化し、実機flashはユーザー承認後の手動ゲートにする。

---

## Task 1: RIP codecへScroll専用fieldを追加する

**Files:**
- Create: `src/proto/rip.test.ts`
- Modify: `src/proto/rip.ts`

- [ ] **Step 1: field 18 decodeとRequest field 20のRED testを書く**

```ts
it("decodes scroll_layers from InputProcessorInfo field 18", () => {
  const response = Uint8Array.from([
    0x1a, 0x06, 0x0a, 0x04, 0x90, 0x01, 0x80, 0x01,
  ]);
  expect(decodeResponse(response).getInputProcessor?.scrollLayers).toBe(128);
});

it("encodes SetScrollLayers as request field 20", () => {
  expect([...encodeSetScrollLayers(3, 128)]).toEqual([
    0xa2, 0x01, 0x05, 0x08, 0x03, 0x10, 0x80, 0x01,
  ]);
});

it("distinguishes an empty transport response from a SetScrollLayers response", () => {
  expect(decodeResponse(new Uint8Array()).responseType).toBeUndefined();
  expect(decodeResponse(Uint8Array.from([0xaa, 0x01, 0x00])).responseType)
    .toBe("setScrollLayers");
});
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/proto/rip.test.ts`

Expected: `scrollLayers` と `encodeSetScrollLayers` が存在しないため失敗。

- [ ] **Step 3: interface、default、decode、encoderを実装する**

`InputProcessorInfo` に `scrollLayers: number` を追加し、`decodeInputProcessorInfo()` のfield 18を `uint32` として読む。`RipResponse` にはempty oneofも識別できる `responseType` を追加し、既存Response field 2〜20と新規field 21をcamelCaseのunionへdecodeする。これにより0バイトのtransport応答と、payloadが空の正規setter responseを区別する。setterは次の形に固定する。

```ts
export function encodeSetScrollLayers(id: number, layers: number): Uint8Array {
  const inner = _m0.Writer.create();
  if (id !== 0) inner.uint32(8).uint32(id);
  if (layers !== 0) inner.uint32(16).uint32(layers >>> 0);
  return _m0.Writer.create().uint32(162).bytes(inner.finish()).finish();
}
```

- [ ] **Step 4: codec testをGREENにする**

Run: `npm test -- src/proto/rip.test.ts`

Expected: exit 0。

- [ ] **Step 5: Studio変更をcommitする**

```bash
git add src/proto/rip.ts src/proto/rip.test.ts
git commit -m "feat: add scroll layer RIP codec"
```

## Task 2: 設定画面から直接使えるkeymap hookを追加する

**Files:**
- Create: `src/keyboard/useStudioKeymap.ts`
- Create: `src/keyboard/useStudioKeymap.test.tsx`

- [ ] **Step 1: 公開契約と接続境界のRED testを書く**

```ts
export interface StudioKeymapLayer {
  id: number;
  index: number;
  name: string;
  bindings: BehaviorBinding[];
}

export interface StudioKeymapSnapshot {
  layers: StudioKeymapLayer[];
  loading: boolean;
}
```

testは、unlocked接続で `getKeymap` を1回呼び、欠落したID/nameを `id ?? index` と `Layer ${index}` へ正規化すること、切断・lock・古い非同期応答では空配列へ戻ることを固定する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/keyboard/useStudioKeymap.test.tsx`

Expected: module未作成で失敗。

- [ ] **Step 3: `useStudioKeymap()` を実装する**

`ConnectionContext`、`LockStateContext`、`call_rpc` を使い、generation counterでStrictModeと切断後の古い応答を無視する。`MonitorKeymapContext` には依存しない。`KEYMAP_CHANGED_EVENT` を購読し、keymap保存後に再取得する。

- [ ] **Step 4: hook testをGREENにする**

Run: `npm test -- src/keyboard/useStudioKeymap.test.tsx`

Expected: exit 0。

- [ ] **Step 5: Studio変更をcommitする**

```bash
git add src/keyboard/useStudioKeymap.ts src/keyboard/useStudioKeymap.test.tsx
git commit -m "feat: add reusable Studio keymap loader"
```

## Task 3: Scroll indexとAuto Mouse IDの変換を型で分離する

**Files:**
- Create: `src/trackball/layer-settings.ts`
- Create: `src/trackball/layer-settings.test.ts`

- [ ] **Step 1: 0、単一bit、複数bit、欠落layer、index上限のRED testを書く**

```ts
export type ScrollLayerSelection =
  | { kind: "none" }
  | { kind: "single"; layerId: number }
  | { kind: "multiple"; mask: number }
  | { kind: "unavailable"; mask: number };
```

fixturesは `{ id: 40, index: 4, name: "Mouse" }` と `{ id: 70, index: 7, name: "Scroll" }` を使う。`128` はlayer ID 70のsingle、`144` はmultiple、対応layerがない `2` はunavailableと期待する。`encodeScrollLayerMask()` はindex 0〜31だけを許可し、`encodeAutoMouseLayerId()` は70をそのまま返す。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/trackball/layer-settings.test.ts`

Expected: module未作成で失敗。

- [ ] **Step 3: pure functionsを実装する**

```ts
export function encodeScrollLayerMask(layer: StudioKeymapLayer): number {
  if (!Number.isInteger(layer.index) || layer.index < 0 || layer.index > 31) {
    throw new RangeError("Scroll layer index must be between 0 and 31");
  }
  return (2 ** layer.index) >>> 0;
}

export function encodeAutoMouseLayerId(layer: StudioKeymapLayer): number {
  if (!Number.isInteger(layer.id) || layer.id < 0) {
    throw new RangeError("Auto Mouse layer ID must be a non-negative integer");
  }
  return layer.id;
}
```

decodeは0をnone、1bitかつindex一致をsingle、2bit以上をmultiple、1bitだが一致なしをunavailableにする。

- [ ] **Step 4: helper testをGREENにする**

Run: `npm test -- src/trackball/layer-settings.test.ts`

Expected: exit 0。

- [ ] **Step 5: Studio変更をcommitする**

```bash
git add src/trackball/layer-settings.ts src/trackball/layer-settings.test.ts
git commit -m "feat: separate layer ids from scroll indexes"
```

## Task 4: Trackball画面をconfirmed/draft保存へ更新する

**Files:**
- Modify: `src/trackball/TrackballSettings.tsx`
- Modify: `src/trackball/TrackballSettings.test.tsx`
- Modify: `src/copy/errorMessages.ts`

- [ ] **Step 1: UIと保存フローのRED testを書く**

既存fixtureへ `scrollLayers`、`tempLayerEnabled`、`tempLayerLayer`、`tempLayerDeactivationDelayMs` を入れ、次を別testで固定する。

- `スクロールするレイヤー` は「なし」とkeymap layerを表示する。
- maskが複数bitなら警告を出し、選択を勝手に変えない。
- Auto Mouseはenabled、layer、100〜5000ms/step 50を編集できるがactivation delay入力はない。
- layer ID 40/index 4を選ぶとAuto Mouse setterへ40、Scroll setterへ16を送る。
- 差分のあるsetterだけ呼び、各responseの `error` を失敗にする。
- setter後に `encodeGetInputProcessor(id)` を呼び、readback一致時だけdirtyを解除する。
- timeout、空readback、途中失敗ではdraftを保持する。
- Scroll setterだけ未対応なら `trackball.scrollFirmwareRequired` を表示し、他のcontrolは残る。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/trackball/TrackballSettings.test.tsx`

Expected: 静的Auto Mouse cardと未decode応答のため失敗。

- [ ] **Step 3: draft型と共通keymap hookを接続する**

```ts
type TrackballDraft = {
  selectedId: number | null;
  multiplier: number;
  divisor: number;
  rotation: number;
  xInvert: boolean;
  yInvert: boolean;
  xySwap: boolean;
  xyToScroll: boolean;
  axisSnapMode: RIP.AxisSnapMode;
  axisSnapThreshold: number;
  axisSnapTimeout: number;
  scrollLayerId: number | null;
  autoMouseEnabled: boolean;
  autoMouseLayerId: number | null;
  autoMouseDeactivationDelayMs: number;
};
```

`useStudioKeymap()` のlayersからselectを作る。index 32以上はScroll選択肢でdisabled、Auto Mouse選択肢には有効なlayer IDだけを出す。

- [ ] **Step 4: RPC成功判定とreadbackを実装する**

`callWithTimeout(label, payload, expectedResponseType)` はraw dataを `RIP.decodeResponse()` し、`response.error`、空応答、期待と異なるoneofをthrowする。Applyは差分setterを順に送り、最後にGetInputProcessorを必須readbackする。readbackは全変更項目を照合し、一致した時だけprocessors/confirmedを更新してdirtyを解除する。途中失敗時は再読込したconfirmed値をprocessor listへ反映するが、入力draftは上書きしない。

- [ ] **Step 5: dirty navigationとReset再読込を実装する**

`useDirtyRegistration("trackball", ...)` へsnapshot/restore/save/discardを登録する。Resetも応答を捨てず、その後のGetInputProcessorをconfirmed値として採用する。activation delay setterはどの経路からも呼ばない。

- [ ] **Step 6: エラーcopyを追加する**

```ts
"trackball.scrollFirmwareRequired":
  "スクロールレイヤーを変更するには、キーボードのFirmware更新が必要です。",
"trackball.layerUnavailable":
  "選んだレイヤーが見つかりません。レイヤー一覧を読み直してください。",
```

- [ ] **Step 7: Trackball testをGREENにする**

Run: `npm test -- src/trackball/TrackballSettings.test.tsx src/trackball/layer-settings.test.ts src/proto/rip.test.ts`

Expected: exit 0。

- [ ] **Step 8: Studio変更をcommitする**

```bash
git add src/trackball/TrackballSettings.tsx src/trackball/TrackballSettings.test.tsx src/copy/errorMessages.ts
git commit -m "feat: make scroll and auto mouse settings editable"
```

## Task 5: PMW3610 driverへruntime Scroll maskと永続化を追加する

**Files:**
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/include/pmw3610/scroll_layers.h`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/include/zmk/drivers/pmw3610_runtime.h`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/src/scroll_layers.c`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/tests/scroll_layers/CMakeLists.txt`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/tests/scroll_layers/prj.conf`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/tests/scroll_layers/testcase.yaml`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/tests/scroll_layers/src/main.c`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/src/pixart.h`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/src/pmw3610.c`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/CMakeLists.txt`

- [ ] **Step 1: pure transactionのRED host testを書く**

`pmw3610_scroll_layers_state` をDT初期値mask 128で初期化し、0とsingle bitを更新できること、save callback成功後だけstateが変わること、save失敗時は128のままなこと、settings readで復元できることをtestする。保存keyは既存 `trackball/settings` と分けて `pmw3610/scroll_layers` に固定する。

- [ ] **Step 2: REDを確認する**

Run:

```bash
cmake -S /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal/tests/scroll_layers -B /tmp/minimal-keys-scroll-layers-test -DSCROLL_LAYERS_HOST_TEST=ON
cmake --build /tmp/minimal-keys-scroll-layers-test
ctest --test-dir /tmp/minimal-keys-scroll-layers-test --output-on-failure
```

Expected: source/API未作成でconfigureまたはcompile失敗。

- [ ] **Step 3: transaction helperとpublic driver APIを実装する**

public contractは次に固定する。

```c
int pmw3610_get_scroll_layers(const struct device *dev, uint32_t *layers);
int pmw3610_set_scroll_layers(const struct device *dev, uint32_t layers, bool persist);
```

`pixart_data` にruntime stateを持たせ、DTの `scroll-layers` 配列を起動時にbitmaskへ変換する。`pmw3610_set_scroll_layers(..., true)` はsettings保存成功後だけstateを公開し、falseはRAMだけ更新する。`get_input_mode_for_current_layer()` は配列走査をやめ、`mask & BIT(zmk_keymap_highest_layer_active())` でScrollを判定する。indexが32以上ならScrollにしない。

- [ ] **Step 4: driver CMakeとsettings restoreを接続する**

`src/scroll_layers.c` を `CONFIG_PMW3610` 時にcompileし、settings load時にmaskを復元する。既存CPI、回転、反転、deadzoneの処理順は変えない。

- [ ] **Step 5: host testをGREENにする**

前記3コマンドを再実行。Expected: すべてexit 0。

- [ ] **Step 6: driver変更をcommitする**

```bash
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal add CMakeLists.txt include/pmw3610/scroll_layers.h include/zmk/drivers/pmw3610_runtime.h src/pixart.h src/pmw3610.c src/scroll_layers.c tests/scroll_layers
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/modules/pmw3610-driver-minimal commit -m "feat: persist runtime scroll layers"
```

## Task 6: RIP Firmware handlerとminimal-keys配線を追加する

**Files:**
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor/proto/cormoran/rip/custom.proto`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor/dts/bindings/input_processors/zmk,input-processor-runtime.yaml`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor/include/zmk/pointing/input_processor_runtime.h`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor/src/pointing/input_processor_runtime.c`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor/src/studio/custom_handler.c`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor/tests/studio/native_posix_64.keymap`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor/tests/studio/events.patterns`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor/tests/studio/keycode_events.snapshot`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config/boards/shields/minimal-keys/minimal-keys_R.overlay`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config/west.yml`

- [ ] **Step 1: protocolとhandlerのRED fixtureを追加する**

protoへ次のfield番号を固定したfixtureを追加し、Getのnotificationにmaskが含まれること、Set成功、deviceなしの `-ENOTSUP`、PMW API失敗がerror responseになることを確認する。既存Auto Mouse setterについても、enabled、layer ID、deactivation delayがsettingsへ保存され、pointer eventで指定layerが有効になり、時間経過で解除されるfixtureを追加する。

```proto
uint32 scroll_layers = 18;
SetScrollLayersRequest set_scroll_layers = 20;
SetScrollLayersResponse set_scroll_layers = 21;
```

- [ ] **Step 2: firmware fixtureをREDで確認する**

Run:

```bash
PATH=/tmp/minimal-keys-zmk-venv/bin:$PATH ZMK_SRC_DIR=/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk/app ZMK_EXTRA_MODULES=/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk/app/run-test.sh /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor/tests/studio
```

Expected: 新しいfield/handlerがないためbuildまたはsnapshot失敗。

- [ ] **Step 3: 公開版互換のRIP変更を実装する**

`scroll-device-name` をruntime processor configへ保持し、`device_get_binding()` で遅延解決する。Get configはPMW APIのmaskをfield 18へ入れる。Set handlerはprocessor IDを解決し、専用PMW deviceへ `pmw3610_set_scroll_layers(dev, req->layers, true)` を呼ぶ。`set_xy_swap_enabled` caseの既存fall-throughなど、要求外のswitch修正は混ぜない。

- [ ] **Step 4: 右overlayとmanifest revisionを更新する**

`&mouse_runtime_input_processor` に次を設定する。

```dts
temp-layer-enabled;
temp-layer = <4>;
temp-layer-deactivation-delay-ms = <700>;
scroll-device-name = "trackball@0";
```

activation delayは既定の100msを維持し、値を新設・上書きしない。`trackball_listener` の固定layer 7の `scroll_layer` childを削除し、`trackball@0` へ `scroll-layers = <7>;` を初期値として移す。同じnodeの `automouse-layer = <4>;` は削除し、PMW内蔵Auto MouseとRIP temp-layerの二重発火を防ぐ。`west.yml` のRIPとPMW3610 revisionは、それぞれこの計画で作成したcommit SHAへ更新する。右だけに配線し、左overlayには追加しない。

- [ ] **Step 5: firmware fixtureをGREENにする**

Step 2のcommandを再実行。Expected: exit 0。

- [ ] **Step 6: moduleとconfigを別々にcommitする**

```bash
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor add proto/cormoran/rip/custom.proto dts/bindings/input_processors/zmk,input-processor-runtime.yaml include/zmk/pointing/input_processor_runtime.h src/pointing/input_processor_runtime.c src/studio/custom_handler.c tests/studio
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-input-processor commit -m "feat: expose runtime scroll layers over Studio RPC"
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config add config/boards/shields/minimal-keys/minimal-keys_R.overlay config/west.yml
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config commit -m "feat: wire runtime scroll layer settings"
```

## Task 7: 長押し設定を日本語名と利用キー中心に整える

**Files:**
- Create: `src/holdtap/holdtap-presentation.ts`
- Create: `src/holdtap/holdtap-presentation.test.ts`
- Modify: `src/holdtap/HoldTapSettings.tsx`
- Modify: `src/holdtap/HoldTapSettings.test.tsx`

- [ ] **Step 1: 名前変換と利用箇所解析のRED testを書く**

```ts
export interface HoldTapUsage {
  layerId: number;
  layerName: string;
  position: number;
  keyLabel: string;
}

export interface HoldTapPresentation {
  title: string;
  behaviorDisplayName: string | null;
}
```

既知mappingは `mod_tap -> Mod-Tap`、`layer_tap -> Layer-Tap`、`layer_tap_mouse_press -> LAYER_TAP_MKP` とする。未知名 `my_custom_hold_tap` は `My Custom Hold Tap` へ整形し、利用箇所不明でも編集対象から消さない。keymap全layerのbindingとBehavior一覧を照合し、layer名、position、key labelを返す。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/holdtap/holdtap-presentation.test.ts`

Expected: module未作成で失敗。

- [ ] **Step 3: presentation helperを実装する**

名前mapping、未知名fallback、binding走査、`getHidKeyDescription()` を使ったtap側key labelをpure functionsとして実装する。キー名に解決できない時は `位置 ${position}` を返す。

- [ ] **Step 4: componentのRED testを書く**

`useStudioKeymap()` とBehavior一覧をmockし、使用中instanceだけ初期表示、`未使用の設定を表示` で0件instanceを展開、各instanceにキー数とlayer/キーを表示することを固定する。見出しは次の4つを正確に期待する。

- `長押し判定までの時間`
- `連打を単押しにする時間`
- `直前の入力を待つ時間`
- `判定方法`

sliderのstepはすべて既存どおり10で、選択中instance以外のsetterを呼ばないことも確認する。

- [ ] **Step 5: HoldTap UIを実装する**

`useStudioKeymap()` と `useBehaviorList()` を接続し、instance selectorを「使用中」と折りたたみ可能な「未使用」に分ける。既存のconfirmed/draft、保存、reset、dirty registrationは保ち、内部RPC名ではなくpresentation titleを表示する。

- [ ] **Step 6: HoldTap testをGREENにする**

Run: `npm test -- src/holdtap/holdtap-presentation.test.ts src/holdtap/HoldTapSettings.test.tsx`

Expected: exit 0。

- [ ] **Step 7: Studio変更をcommitする**

```bash
git add src/holdtap/holdtap-presentation.ts src/holdtap/holdtap-presentation.test.ts src/holdtap/HoldTapSettings.tsx src/holdtap/HoldTapSettings.test.tsx
git commit -m "feat: explain hold settings with affected keys"
```

## Task 8: 全自動検証と左右Firmware buildを通す

**Files:**
- Verify only; unexpected failures require a new failing regression test before code changes.

- [ ] **Step 1: Studioの関連testと全testを実行する**

```bash
npm test -- src/proto/rip.test.ts src/keyboard/useStudioKeymap.test.tsx src/trackball src/holdtap
npm test
```

Expected: 両方exit 0。

- [ ] **Step 2: Studioの静的検証とdesktop buildを実行する**

```bash
npm run lint
npm run build
npm run tauri build
```

Expected: 3件ともexit 0。

- [ ] **Step 3: PMWとRIPのtestを再実行する**

Task 5のhost test 3コマンドとTask 6のZMK fixture commandを再実行する。Expected: すべてexit 0。

- [ ] **Step 4: 右Firmwareをpristine buildする**

```bash
cd /Users/iwanedaijun/repos/minimal-keys-zmk-workspace
/tmp/minimal-keys-zmk-venv/bin/west build -s zmk/app -d build/v060-trackball-right -b seeeduino_xiao_ble -p -S studio-rpc-usb-uart -- -DSHIELD="minimal-keys_R rgbled_adapter raw_hid_adapter" -DZMK_CONFIG=/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config
```

Expected: exit 0。生成 `.config` でRIP/PMW settingsがy、overlay生成物に `scroll-device-name` があることを確認する。

- [ ] **Step 5: 左Firmwareをpristine buildする**

```bash
cd /Users/iwanedaijun/repos/minimal-keys-zmk-workspace
/tmp/minimal-keys-zmk-venv/bin/west build -s zmk/app -d build/v060-trackball-left -b seeeduino_xiao_ble -p -- -DSHIELD="minimal-keys_L rgbled_adapter" -DZMK_CONFIG=/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config
```

Expected: exit 0。生成 `.config` で右専用Studio RPC/PMW Scroll handlerが有効になっていないことを確認する。

- [ ] **Step 6: dev smoke testを行う**

Run: `npm run dev`

Expected: Viteが起動し、TrackballとHoldTap画面を直接開いても例外が出ない。確認後Ctrl-Cで終了する。

- [ ] **Step 7: 実機確認を手動ゲートとして記録する**

Firmware flashの明示承認を得た後だけ、設計書の「実機」6項目を確認する。未実施なら「自動検証済み・実機未確認」と明記し、完了扱いにしない。
