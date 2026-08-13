# 動的コンボの保存・実行修復 設計

**日付:** 2026-08-10

**状態:** ユーザー承認済み

**対象:** `minimal-keys-studio`、minimal-keys Firmware設定、`zmk-module-runtime-combos`

## 目的

コンボ画面でFとJへ `Mission Control（Ctrl+↑）` を割り当てた時に「コンボの保存に失敗しました」となる問題を直す。保存できたように見せるだけでなく、保存したコンボが実際に発火し、再起動後も残るところまでを機能の完了条件にする。

## 確認した原因

現行Firmwareは次の既定値でbuildされている。

- `CONFIG_ZMK_STUDIO_RPC_RX_BUF_SIZE=30`
- `CONFIG_ZMK_STUDIO_RPC_CUSTOM_SUBSYSTEM_REQUEST_PAYLOAD_MAX_BYTES=25`

F＋J、timeout 50ms、Key Press、Ctrl+↑の新規コンボは、custom payloadだけで約22バイトになる。subsystem、request、request IDのprotobuf headerを加えたStudio requestは約33バイト以上になり、30バイトの受信枠を超える。BLE受信処理は1回のGATT writeをring bufferへ収めてからnotifyする構造なので、この超過は応答待ちtimeoutを起こし得る。

また、`zmk-module-runtime-combos` の現行実装は設定の保存・取得・削除だけを持ち、position eventからコンボを検出してBehaviorを実行する処理がない。そのため通信枠だけ直しても、保存後のF＋JではMission Controlが動かない。

## 採用方針

1. 右FirmwareのStudio RPC受信枠を、合法な最大コンボ要求を扱える値へ広げる。
2. Runtime Combos module自身を、保存データの正本かつ実行engineにする。
3. 空の静的 `zmk,combos` nodeを外し、同じposition eventを2つのcombo engineが奪い合わない構成にする。
4. Studioは明示的な成功応答と保存後readbackを確認してから成功表示する。

ZMK coreの `combo.c` を直接大改造する案は、上流との差分と回帰範囲が広いため採用しない。保存だけ直して実行を後回しにする案も、利用者に偽の成功を示すため採用しない。

## 通信サイズ

Nanopbが生成する `cormoran_combos_Request_size` は68バイトである。Firmware設定は次を満たす値にする。

- custom subsystem request payload: 68バイト以上
- Studio RPC RX buffer: 最大payload、custom wrapper、root request IDを含めて収まる96バイト

右側centralの設定へ次を明示し、左側へは不要なStudio RPC領域を追加しない。

```text
CONFIG_ZMK_STUDIO_RPC_CUSTOM_SUBSYSTEM_REQUEST_PAYLOAD_MAX_BYTES=68
CONFIG_ZMK_STUDIO_RPC_RX_BUF_SIZE=96
```

現在のF＋Jだけに合わせた33〜40バイトではなく、UIが許す4キー、uint32 parameters、layer mask、slow releaseを含む最大要求を基準にする。増加するRAMは小さいが、build後のmapと使用量を記録する。

## Runtime Combo Engine

### 入力

Runtime moduleはcentral側の `zmk_position_state_changed` を購読する。activeな保存済みコンボの先頭候補になり得るキーだけを一時captureし、候補が消えた時またはtimeout時は元のposition eventを順序を保って再送する。

キー位置は順序に依存しない集合として比較する。保存時に昇順へ正規化し、同じキーの重複、2個未満、4個超を拒否する。

### 候補とtimeout

- 最初のキーを含み、現在layerで有効なコンボを候補にする。
- 次のキーごとに候補を絞る。
- 全キーがtimeout内に揃えば構成キーの通常動作を抑止し、コンボBehaviorをpressする。
- 候補がなくなった場合はcapture済みの通常キーを解放する。
- timeoutは各コンボの `timeout_ms` を使う。

同じキー集合かつ重なるlayer条件のコンボは結果が曖昧になるため、保存時に拒否する。異なる長さで重なる候補は短い方を即発火せず、長い候補が成立し得る間は既存ZMK comboと同じくtimeoutまで待つ。

### Layerとrelease

`layer_mask=0` は全layerで有効とする。0以外は、`zmk_keymap_highest_layer_active()` が返す現在のlayer indexのbitで判定する。

Behaviorは保存されたlocal behavior IDからdevice nameを解決し、`param1` と `param2` を含む `zmk_behavior_binding` として呼び出す。

- 通常release: 構成キーの最初の1つを離した時にBehaviorをrelease
- slow release: 構成キーをすべて離した時にBehaviorをrelease

Mission ControlではKey PressへCtrl修飾付きUp usageを渡し、press/releaseの両方を必ず発行する。切断や異常経路でも押しっぱなしの修飾キーを残さない。

### 即時反映と並行性

Studioからset/deleteされたコンボは再起動なしで候補表へ反映する。RPC writeとevent listenerが同じ配列を同時に読む可能性があるため、短時間のZephyr mutexで候補表の参照・公開を保護する。Behavior実行中やevent再送中にflash書込みを行わない。

保存処理はtransactionalにする。検証済みの新値を先にsettingsへ保存し、成功後にmutex内でRAM slotを公開する。settings保存が失敗した時はRAM上の旧slotを変更せず、応答の `success=false` とerrorを返す。deleteも削除済み値のsettings保存に成功してからRAMへ公開する。

## Studioの保存フロー

1. 2〜4個の異なるキー、Behavior、timeout、重複コンボを送信前に検証する。
2. `encodeSetCombo` のpayloadを送る。
3. `response.error` がなく、`setCombo.success === true` の時だけ次へ進む。
4. `GetAllCombos` でreadbackし、combo ID、キー集合、Behavior、parametersが一致することを確認する。
5. 一致した時だけ編集画面を閉じ、「コンボを保存しました」と表示する。

timeout、空応答、`success=false`、readback不一致はすべて失敗とする。編集内容は保持する。旧Firmwareの受信枠が疑われる場合は、単なる再試行だけでなく「キーボードのFirmware更新が必要です」と案内する。developer consoleには段階、payload length、error型を残すが、生の個人情報や秘密情報は記録しない。

## 設定互換性

既存の `rtc/cN` settings keyと `runtime_combo_config` の保存形式は維持する。形式を変える必要が生じた場合だけrevisionを追加し、旧データを明示的にmigrationする。理由なく既存コンボを消去しない。

Firmware起動時に次を検証し、不正slotは無効化してログへ理由を残す。

- key count
- key position範囲と重複
- behavior local IDが解決可能
- timeout範囲

## テスト

すべてのコード変更をRED→GREENのTDDで行う。

### Studio

- F＋J、Mission Control、50msの正確なpayload fixture
- 2キー／4キー、最大uint32 parameter、layer mask、slow releaseのcodec往復
- `setCombo.success` がない空応答を成功扱いしないこと
- error、timeout、readback不一致で編集内容が残ること
- 保存成功後だけ一覧更新と編集終了が起きること
- 同じキーの重複、キー数、同一キー集合コンボを送信前に拒否すること
- 旧Firmware向けの更新案内

### Firmware module

- F pressをcaptureし、Jが50ms以内なら通常F/Jを出さずMission Controlをpress/releaseすること
- timeout時はF/Jの通常eventを順序どおり再送すること
- 逆順J→Fでも同じコンボになること
- layer mask、通常release、slow release
- 重なる2キー／3キー候補とtimeout
- settings set/get/delete、再起動復元、保存失敗rollback
- RPC writeとposition eventが競合しても破損しないこと
- 不正behavior IDや破損settingsを安全に無効化すること

### Buildと実機

- 右Firmwareの生成configがpayload 68以上、RX 96になっていること
- 右Firmware build成功、RAM/flash差分記録、左Firmware build成功
- Studioの全test、build、lint、Tauri build成功
- 実機で保存、一覧への再表示、右側reset後の再表示
- 実機でF＋JがMission Controlを1回だけ発火し、F/J単独入力を漏らさないこと
- timeoutを超えたF→Jは通常のFとJとして入力されること

## 非目標

- コンボUI全体の再デザイン
- 5キー以上のコンボ
- combo chord以外のsequence／macro機能
- 静的devicetree comboとの混在
- Mission Control以外のOSショートカット定義変更
- Firmwareの自動flashまたは外部公開

## 完了条件

1. F＋J→Mission Controlをエラーなく保存できる。
2. 保存直後と再起動後のreadbackが一致する。
3. 実機でF＋JがMission Controlを発火し、構成キーの通常入力を漏らさない。
4. timeout、release、layer、永続化、保存失敗が安全に処理される。
5. Studio／Firmwareの自動検証と左右buildが終了コード0になる。
