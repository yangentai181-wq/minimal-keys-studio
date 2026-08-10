# Runtime Combo Save and Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FとJへMission Controlを割り当てたコンボを保存・即時実行・再起動復元できるようにし、失敗を成功表示しない。

**Architecture:** 右FirmwareのStudio RPC受信枠を合法な最大要求へ広げる。Runtime Combos moduleがtransactionalなsettings保存とposition-event engineを所有し、静的ZMK combo engineは無効にする。Studioは入力を正規化し、明示的successと完全readbackを確認してから編集を閉じる。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、ZMK/Zephyr C、ZMK events、Zephyr settings/mutex/work queue、Nanopb

## Global Constraints

- 正本は `docs/superpowers/specs/2026-08-10-runtime-combo-save-and-execution-design.md`。5キー、sequence、macro、静的combo混在、UI全面変更は追加しない。
- 保存だけを直して終了しない。event capture、Behavior press/release、再起動復元までを同じ機能として検証する。
- すべてRED→GREENで進める。Studio、storage、engine、build configを別々にtestする。
- `rtc/cN` と `runtime_combo_config` の保存形式を維持する。migrationが不要な差分にする。
- flash保存はmutex外で先に行い、成功後だけRAM tableを短いmutex区間で交換する。Behavior実行とevent再送中はflashへ書かない。
- `work/` と各リポジトリの既存変更を保ち、Task記載外のファイルをstageしない。flash、push、公開は行わない。

---

## Task 1: Combo codecの最大fixtureとresponse判定を固定する

**Files:**
- Create: `src/proto/combos.test.ts`

- [ ] **Step 1: F+J Mission Controlの正確なpayload characterization testを書く**

```ts
const missionControl: ComboConfig = {
  comboId: 1,
  keyPositions: [13, 18],
  timeoutMs: 50,
  binding: { behaviorId: 1, param1: 0x01070052, param2: 0 },
  layerMask: 0,
  slowRelease: false,
};

expect([...encodeSetCombo(missionControl)]).toEqual([
  10, 19, 10, 17, 8, 1, 16, 13, 16, 18, 24, 50,
  34, 7, 8, 1, 16, 210, 128, 156, 8,
]);
expect(encodeSetCombo(missionControl)).toHaveLength(21);
```

position 13はF、18はJ、`0x01070052` はCtrl修飾付きKeyboard Upである。加えて4キー、`0xffffffff` parameters/layerMask、slow releaseのencode/decode fixtureを置く。

- [ ] **Step 2: 空responseとsuccess=falseのdecode testを書く**

空byte列は `setCombo` を持たず、明示的falseは `{ setCombo: { success: false } }`、trueだけがtrueになることを固定する。deleteも同じ規則にする。

- [ ] **Step 3: 現行codecのbaselineを確認する**

Run: `npm test -- src/proto/combos.test.ts`

Expected: exit 0。ここはwire formatを変更するTaskではなく、原因となった21-byte custom payloadと最大値を固定するcharacterization testである。失敗した場合だけproto定義と実装の差を診断し、期待値を都合よく変更しない。

- [ ] **Step 4: public codecを変更せずround-tripを確認する**

wire field番号とuint32を維持し、round-trip test用APIは増やさず、GetAll response fixtureを通してdecodeを検証する。production APIの成功条件は変更せず、component側で `response.setCombo?.success === true` を必須にする。

- [ ] **Step 5: codec testをGREENにする**

Run: `npm test -- src/proto/combos.test.ts`

Expected: exit 0。

- [ ] **Step 6: Studio変更をcommitする**

```bash
git add src/proto/combos.test.ts
git commit -m "test: lock runtime combo wire format"
```

## Task 2: Studio入力検証をpure functionへ分離する

**Files:**
- Create: `src/combos/combo-validation.ts`
- Create: `src/combos/combo-validation.test.ts`

- [ ] **Step 1: public contractとRED testを書く**

```ts
export type ComboValidationResult =
  | { ok: true; normalized: ComboConfig }
  | { ok: false; message: string };

export function validateComboDraft(
  draft: ComboConfig,
  existing: ComboConfig[],
): ComboValidationResult;
```

2〜4キー、behaviorあり、timeout 1〜1000ms、非負position、position重複、昇順正規化をtestする。同一キー集合については、自分自身のcombo IDを除外し、`layerMask=0` 同士、0と任意mask、またはbit積が非0なら重複として拒否する。重ならないlayer maskだけ許可する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/combos/combo-validation.test.ts`

Expected: module未作成で失敗。

- [ ] **Step 3: validationを実装する**

入力配列を直接sortせずcopyを昇順化し、成功時だけnormalized objectを返す。error copyは「2〜4個の異なるキーを選んでください」「同じキーの組み合わせが同じレイヤー条件にあります」など、画面へそのまま出せる日本語にする。

- [ ] **Step 4: validation testをGREENにする**

Run: `npm test -- src/combos/combo-validation.test.ts`

Expected: exit 0。

- [ ] **Step 5: Studio変更をcommitする**

```bash
git add src/combos/combo-validation.ts src/combos/combo-validation.test.ts
git commit -m "feat: validate runtime combo drafts"
```

## Task 3: Studio保存をsuccess+readback確認へ変更する

**Files:**
- Create: `src/combos/ComboSettings.test.tsx`
- Modify: `src/combos/ComboSettings.tsx`
- Modify: `src/copy/errorMessages.ts`

- [ ] **Step 1: 保存失敗を再現するcomponent RED testを書く**

custom subsystem、toast、Behavior picker、keymap取得をmockし、F/Jのdraftを作る。次を個別testにする。

- 空response、`success=false`、`response.error`、timeoutではediting formが残る。
- success=trueでもGetAllに同じcomboがない、key集合、binding parameters、timeout、layer mask、slow releaseのどれかが違えばformが残る。
- 完全一致した時だけlistを更新し、formを閉じ、成功toastを出す。
- payload lengthと段階をconsoleへ記録するが、binding内容全体は出さない。
- 受信枠が疑われるtimeoutではFirmware更新案内を出す。
- deleteも `deleteCombo?.success === true` とreadback上の不在を確認する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- src/combos/ComboSettings.test.tsx`

Expected: 現実装が空responseを成功扱いしformを閉じるため失敗。

- [ ] **Step 3: exact equality helperと保存フローを実装する**

`validateComboDraft(editing, combos)` のnormalized値だけ送る。比較helperはキーを集合として昇順比較し、次の全fieldを一致条件にする。

```ts
function comboEquals(a: ComboConfig, b: ComboConfig): boolean {
  return a.comboId === b.comboId
    && sorted(a.keyPositions).every((value, index) => value === sorted(b.keyPositions)[index])
    && a.keyPositions.length === b.keyPositions.length
    && a.timeoutMs === b.timeoutMs
    && a.binding?.behaviorId === b.binding?.behaviorId
    && a.binding?.param1 === b.binding?.param1
    && a.binding?.param2 === b.binding?.param2
    && a.layerMask === b.layerMask
    && a.slowRelease === b.slowRelease;
}
```

`setCombo?.success !== true` はthrowし、GetAllの完全一致後だけ `setCombos`、`setEditing(null)`、success toastを行う。失敗catchではdraftを触らない。

- [ ] **Step 4: delete readbackとerror copyを実装する**

delete success後にGetAllを呼び、対象IDが消えた時だけlistを更新する。`combo.firmwareRequired` と `combo.readbackMismatch` を `ERROR_MESSAGES` へ追加する。

- [ ] **Step 5: component testをGREENにする**

Run: `npm test -- src/combos/ComboSettings.test.tsx src/combos/combo-validation.test.ts src/proto/combos.test.ts`

Expected: exit 0。

- [ ] **Step 6: Studio変更をcommitする**

```bash
git add src/combos/ComboSettings.tsx src/combos/ComboSettings.test.tsx src/copy/errorMessages.ts
git commit -m "fix: confirm runtime combo saves by readback"
```

## Task 4: Firmware storageをtransactionalにする

**Files:**
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/include/zmk/combos/runtime_combos.h`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/src/runtime_combos.c`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combo_storage/CMakeLists.txt`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combo_storage/src/main.c`

- [ ] **Step 1: validationとrollbackのRED host testを書く**

同じキーを含む、2未満、4超、timeout 0/1001、不正behavior ID、同一キー集合かつ重なるlayerを拒否する。save adapterを失敗させ、set/delete後も旧RAM slotがGetAllから返ることを固定する。成功時はkey positionsが昇順で即時GetAllへ現れることを期待する。

- [ ] **Step 2: REDを確認する**

```bash
cmake -S /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combo_storage -B /tmp/minimal-keys-runtime-combo-storage -DRUNTIME_COMBO_STORAGE_HOST_TEST=ON
cmake --build /tmp/minimal-keys-runtime-combo-storage
ctest --test-dir /tmp/minimal-keys-runtime-combo-storage --output-on-failure
```

Expected: adapter/API未作成またはrollback assertionで失敗。

- [ ] **Step 3: storage APIとsnapshot contractを実装する**

```c
int zmk_runtime_combos_snapshot(struct runtime_combo_config *out,
                                uint8_t max_count, uint8_t *actual_count);
int zmk_runtime_combos_set(const struct runtime_combo_config *combo);
int zmk_runtime_combos_delete(uint32_t combo_id);
```

setはlocal copyを検証・正規化し、対象slotの `rtc/cN` を先にsaveし、成功後だけmutex内でslotを交換する。deleteはzeroed inactive copyを先にsaveし、成功後だけRAMを消す。snapshotはmutex内でcopyしてから返す。boot loadは全slotを検証し、不正slotをinactiveにする。

- [ ] **Step 4: storage host testをGREENにする**

Step 2の3コマンドを再実行。Expected: すべてexit 0。

- [ ] **Step 5: storage変更をcommitする**

```bash
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos add include/zmk/combos/runtime_combos.h src/runtime_combos.c tests/runtime_combo_storage
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos commit -m "fix: publish runtime combos after persistence"
```

## Task 5: Runtime Combo event engineをTDDで追加する

**Files:**
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/include/zmk/combos/runtime_combo_engine.h`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/src/runtime_combo_engine.c`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/CMakeLists.txt`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combos/native_posix_64.conf`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combos/native_posix_64.keymap`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combos/events.patterns`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combos/keycode_events.snapshot`

- [ ] **Step 1: F+J成立とtimeoutのRED event fixtureを書く**

native fixtureへF/J→Ctrl+Upのruntime comboを起動時注入する。次のevent列を別caseとして入れる。

- F press、50ms以内のJ press、F release、J release: F/J usageを出さずCtrl+Up press/releaseを各1回。
- J→F逆順: 同じ結果。
- F press、50ms経過、F release: F press/releaseを元の順番で再送。
- F timeout後にJ: FとJの通常eventを順番どおり出す。

- [ ] **Step 2: REDを確認する**

```bash
PATH=/tmp/minimal-keys-zmk-venv/bin:$PATH ZMK_SRC_DIR=/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk/app ZMK_EXTRA_MODULES=/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk/app/run-test.sh /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combos
```

Expected: engine未作成なのでF/J通常eventが漏れ、snapshot差分で失敗。

- [ ] **Step 3: candidate/capture state machineを実装する**

centralで `zmk_position_state_changed` を購読する。最初のpress時に現在のstorage snapshotと `zmk_keymap_highest_layer_active()` から候補を作り、そのpositionを含む候補の最大timeoutまでdelayable workを予約する。追加pressごとに候補を絞り、長い候補が残る場合は短いcomboを即発火しない。候補0またはtimeout時はcaptured pressをtimestamp順に再raiseする。

- [ ] **Step 4: Behavior press/releaseを実装する**

local behavior IDをdevice nameへ解決して `zmk_behavior_binding` を構築し、combo成立時にpressする。通常releaseは最初の構成key release、slow releaseは全構成key releaseでreleaseする。異常、storage削除、切断相当のreset経路でもactive behaviorを必ずreleaseする。reraised eventをlistener自身が再captureしないguardを入れる。

- [ ] **Step 5: layer/release/重なりのRED fixtureを追加する**

layer mask 0、特定bit、通常release、slow release、共通prefixを持つ2-key/3-key comboを追加する。2-keyは3-key候補がtimeoutまたは不成立になるまで待つことをsnapshotで固定する。

- [ ] **Step 6: event fixtureをGREENにする**

Step 2のcommandを再実行。Expected: exit 0。

- [ ] **Step 7: engine変更をcommitする**

```bash
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos add CMakeLists.txt include/zmk/combos/runtime_combo_engine.h src/runtime_combo_engine.c tests/runtime_combos
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos commit -m "feat: execute persisted runtime combos"
```

## Task 6: RPC handlerをtransactional resultへ揃える

**Files:**
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/src/studio/custom_handler.c`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combo_rpc/CMakeLists.txt`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combo_rpc/prj.conf`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combo_rpc/testcase.yaml`
- Create: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combo_rpc/src/main.c`

- [ ] **Step 1: success/error responseのRED testを書く**

set/deleteのstorage return 0だけでresponse `success=true`、validation/save failureは `success=false` とErrorResponse、GetAllはmutex snapshotをencodeすることをfixture化する。payload 68バイトまでdecodeできる最大ComboConfigも通す。

- [ ] **Step 2: REDを確認する**

Run:

```bash
PATH=/tmp/minimal-keys-zmk-venv/bin:$PATH /tmp/minimal-keys-zmk-venv/bin/west twister -T /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos/tests/runtime_combo_rpc -p native_posix_64 --inline-logs
```

Expected: test adapterまたは正確なsuccess/error mappingがないため失敗。

- [ ] **Step 3: handlerを実装してGREENにする**

storage return codeを握りつぶさず、失敗時にsuccessを立てない。GetAllは公開snapshot APIだけを使う。Step 2を再実行してexit 0を確認する。

- [ ] **Step 4: RPC変更をcommitする**

```bash
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos add src/studio/custom_handler.c tests/runtime_combo_rpc
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/zmk-module-runtime-combos commit -m "fix: report runtime combo persistence failures"
```

## Task 7: 右Firmwareの受信枠とengine所有権を配線する

**Files:**
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config/boards/shields/minimal-keys/minimal-keys_R.conf`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config/minimal-keys.keymap`
- Modify: `/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config/west.yml`

- [ ] **Step 1: config contractのRED確認を追加する**

右生成configでcustom payloadが68、RX bufferが96、左生成configでRuntime Combos/Studioが無効であることを確認するshell assertionを実装時の検証メモへ記録する。keymapに `compatible = "zmk,combos"` が残らないことも `rg` でassertする。

- [ ] **Step 2: 右confを更新する**

```text
CONFIG_ZMK_STUDIO_RPC_CUSTOM_SUBSYSTEM_REQUEST_PAYLOAD_MAX_BYTES=68
CONFIG_ZMK_STUDIO_RPC_RX_BUF_SIZE=96
```

既存のStudio設定の近くへ追加する。左confへは追加しない。

- [ ] **Step 3: 空の静的combo nodeを削除する**

`minimal-keys.keymap` の `/ { combos { compatible = "zmk,combos"; }; }` だけを削除し、hold-tapとkeymap nodeは維持する。Runtime Combos moduleだけがposition eventをcaptureする構成にする。

- [ ] **Step 4: manifest revisionを更新する**

`west.yml` の `zmk-module-runtime-combos` revisionをTask 6までの最新commit SHAへ更新する。

- [ ] **Step 5: config変更をcommitする**

```bash
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config add config/boards/shields/minimal-keys/minimal-keys_R.conf config/minimal-keys.keymap config/west.yml
git -C /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config commit -m "fix: size Studio transport for runtime combos"
```

## Task 8: 全検証、サイズ記録、実機ゲートを行う

**Files:**
- Verify only; unexpected failures require a regression test before fixes.

- [ ] **Step 1: Studio testとbuildを実行する**

```bash
npm test -- src/proto/combos.test.ts src/combos/combo-validation.test.ts src/combos/ComboSettings.test.tsx
npm test
npm run lint
npm run build
npm run tauri build
```

Expected: すべてexit 0。

- [ ] **Step 2: Firmware module testを再実行する**

Task 4のhost test、Task 5のevent fixture、Task 6のTwisterを再実行する。Expected: すべてexit 0。

- [ ] **Step 3: 右Firmwareをpristine buildする**

```bash
cd /Users/iwanedaijun/repos/minimal-keys-zmk-workspace
/tmp/minimal-keys-zmk-venv/bin/west build -s zmk/app -d build/runtime-combos-right -b seeeduino_xiao_ble -p -S studio-rpc-usb-uart -- -DSHIELD="minimal-keys_R rgbled_adapter raw_hid_adapter" -DZMK_CONFIG=/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config
```

Expected: exit 0。`build/runtime-combos-right/zephyr/.config` でpayload=68、RX=96を確認し、`zephyr.map` とbuild summaryからRAM/flash使用量を変更前buildと比較して記録する。

- [ ] **Step 4: 左Firmwareをpristine buildする**

```bash
cd /Users/iwanedaijun/repos/minimal-keys-zmk-workspace
/tmp/minimal-keys-zmk-venv/bin/west build -s zmk/app -d build/runtime-combos-left -b seeeduino_xiao_ble -p -- -DSHIELD="minimal-keys_L rgbled_adapter" -DZMK_CONFIG=/Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config/config
```

Expected: exit 0。左生成configにRuntime Combos engineとStudio RX増量が入っていない。

- [ ] **Step 5: dev smoke testを行う**

Run: `npm run dev`

Expected: コンボ画面でF/JとMission Controlを編集でき、接続なしでも例外にならない。確認後Ctrl-Cで終了する。

- [ ] **Step 6: 実機確認を手動ゲートとして記録する**

Firmware flashの明示承認後だけ、F+J保存、即時readback、右reset後の復元、Mission Control 1回発火、F/J漏れなし、timeout超過時の通常F/Jを確認する。未実施なら「自動検証済み・実機未確認」と明記し、完了扱いにしない。
