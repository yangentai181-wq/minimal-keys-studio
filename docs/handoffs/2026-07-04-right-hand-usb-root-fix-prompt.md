# 右手USB接続問題の抜本修正依頼プロンプト

作成日時: 2026-07-04 18:48 JST
対象リポジトリ: `/Users/iwanedaijun/repos/minimal-keys-studio`
関連ファームウェアリポジトリ: `/Users/iwanedaijun/repos/minimal-keys-release`

## 依頼文

あなたは Web Serial / WebHID / BLE / ZMK firmware / React の接続設計に強いエンジニアAIです。

以下の資料とコードを読み、minimal-keys Studio の接続問題を小手先ではなく抜本的に修正してください。

最初に必ず読む資料:

- `/Users/iwanedaijun/repos/minimal-keys-studio/docs/handoffs/2026-07-03-minimal-keys-studio-connection-troubleshooting.md`
- `/Users/iwanedaijun/repos/minimal-keys-studio/docs/handoffs/2026-07-03-troubleshooter-ai-prompt.md`

今回の最重要前提:

- **大原則として、右手側 central を USB 有線で接続する。**
- BLE は補助経路・検証経路であり、主導線ではない。
- 「USBで接続」ボタンの表面修正やタイムアウト文言の調整で終わらせない。
- 右手USB接続を入口に、リアルタイムモニターとエディターを成立させる接続アーキテクチャへ整理する。

## 現在の問題分析

現状は、アプリが「USBポートを開けたこと」と「ZMK Studio RPC が使えること」をほぼ同一視している。

しかし既存調査では、USB CDC ACM ポートを開くこと自体はできても、`core.getDeviceInfo` に応答が返っていない。Python で CDC へ直接 ZMK Studio RPC frame を送っても応答がなかった。つまり現在の症状は、単なる Chrome Web Serial の `port.open()` 問題ではなく、USB上に期待している Studio RPC 契約が実機ファームと一致していない可能性が高い。

また、このアプリには2つの用途がある。

1. エディター: キーマップ、トラックボール、コンボ、Bluetooth設定などを書き換える。これは ZMK Studio RPC が必要。
2. リアルタイムモニター: iPadやMac上で現在のレイヤー、押下キー、トラックボール、エンコーダー等を常時表示する。これは Studio RPC より Raw HID の方が自然。

参考実装 `/Users/iwanedaijun/repos/zmk-web-configurator/lib/use-webhid.ts` には、Raw HID (`usagePage 0xff60`, `usage 0x61`) で以下のフレームを読む実装がある。

- `0xf1`: key
- `0xff`: layer
- `0xf2`: pointer
- `0xf3`: encoder

したがって抜本修正の方向は、USB接続を単一の「Studio RPC接続」と見なすのではなく、右手USBデバイスに対して以下を明示的に分離すること。

- USB Raw HID: リアルタイムモニター用の一次経路
- USB Serial Studio RPC: エディター用の経路。ただし実機ファームが `studio-rpc-usb-uart` に応答することをプローブで確認する
- BLE Studio RPC: 補助・検証・将来用

## 2026-07-04 現在の端末状態

この依頼文作成時点で、このMacからは minimal-keys の USB CDC / USBデバイスは見えていない。

実行結果:

- `ls -l /dev/cu.* /dev/tty.* | rg 'usbmodem|usbserial|Bluetooth'`
  - Bluetooth-Incoming-Port のみ
- `system_profiler SPUSBDataType | rg -i -C 8 'minimal|ZMK|615e|1d50|xiao|Seeed'`
  - 該当なし
- `ioreg -p IOUSB -l -w 0 | rg -i -C 10 'minimal-keys|minimal_keys|ZMK Project|615e|1d50'`
  - 該当なし
- `blueutil --paired --format json | jq '.[] | select((.name // "") | test("minimal|keys"; "i"))'`
  - `MX Keys Mini` のみ。minimal-keys は現在 paired として見えていない

つまり、実機を右手USBで接続した状態で再度調査する必要がある。ただし前回調査では minimal-keys の USB CDC と vendor HID は見えていた。

## 既知のファームウェア情報

`/Users/iwanedaijun/repos/minimal-keys-release/build.yaml`:

```yaml
include:
  - board: seeeduino_xiao_ble
    shield: minimal-keys_R rgbled_adapter raw_hid_adapter
    snippet: studio-rpc-usb-uart
```

`minimal-keys_R.conf`:

```text
CONFIG_ZMK_STUDIO=y
CONFIG_ZMK_STUDIO_LOCKING=n
CONFIG_ZMK_STUDIO_TRANSPORT_BLE=y
```

`minimal-keys_R.overlay`:

```text
&xiao_serial { status = "disabled"; };
```

重要な疑問:

- 実機に入っている右手UF2が本当にこの `build.yaml` 産物か
- `studio-rpc-usb-uart` snippet と `&xiao_serial { status = "disabled"; };` が同時に成立しているか
- USB CDC ACM が Studio RPC endpoint なのか、別用途/無応答の endpoint なのか
- raw_hid_adapter は実機に入っており、WebHIDで安定して読めるか

## 抜本修正でやること

### 1. 接続状態を state machine 化する

`ConnectModal` と `App.tsx` の中に散らばっている接続処理を、明示的な接続コーディネータへ切り出す。

最低限、以下の状態を区別する。

- `idle`
- `right_usb_not_detected`
- `right_usb_detected`
- `opening_webhid`
- `rawhid_monitor_ready`
- `opening_webserial`
- `serial_open_but_rpc_unavailable`
- `studio_rpc_ready`
- `ble_optional_ready`
- `firmware_contract_mismatch`
- `busy_or_already_open`

ユーザー向け文言では「何を開けたか」ではなく「どの契約が成立したか」を表示する。

例:

- 右手USBデバイスがOSから見えない
- 右手USBのRaw HIDは読めるのでモニターは利用可能
- USB Serialは開けたがStudio RPCが返らないので、エディターには対応ファームの焼き直しが必要
- Web Serialが他プロセスに掴まれている

### 2. 右手USBを主導線にする

UIの主ボタンは「右手USBで接続」にする。

接続時はまず右手USBデバイスの存在を検出する。

- WebHID: `navigator.hid.getDevices()` / `requestDevice({ filters: [{ usagePage: 0xff60, usage: 0x61 }] })`
- WebSerial: `navigator.serial.getPorts()` / `requestPort()`
- macOS診断では USB VID/PID/Product/Serial をログに出す

BLEは主ボタンにしない。必要なら詳細/補助欄に置く。

### 3. リアルタイムモニターは Raw HID を一次経路にする

`/Users/iwanedaijun/repos/zmk-web-configurator/lib/use-webhid.ts` の既存パターンを minimal-keys-studio に移植する。

要件:

- Raw HID usagePage `0xff60`, usage `0x61` を使う
- `0xf1`, `0xff`, `0xf2`, `0xf3` をパースする
- レイヤー表示は Raw HID の layer frame に追従し、手動切り替えはモニターモードでは無効化する
- オートマウスレイヤーは常時表示ではなく、Raw HID の active layer mask / pointer frame から「使用中だけ」自然に見せる
- Raw HID が成立すれば、Studio RPC がなくてもモニターモードは起動できる

### 4. エディターは Studio RPC の契約確認後だけ開く

エディター機能は `core.getDeviceInfo` が成功してから有効化する。

USB Serialで以下を明示的にプローブする。

- `port.open()` 成功
- `create_rpc_connection()` 成功
- `core.getDeviceInfo` 応答あり
- device name / serialNumber 取得

`port.open()` 成功だけで接続成功扱いにしない。

失敗時は「エディター不可、モニター可」の degraded 状態を許可する。

### 5. ファームウェア側の契約を確定する

`minimal-keys-release` 側も確認し、必要なら修正する。

確認項目:

- 右手 central のUF2 artifact名を明確化する
- `raw_hid_adapter` が右手に必ず入ること
- USB Studio RPC を本当に使うなら `studio-rpc-usb-uart` が有効で、CDC ACM endpoint が RPC に応答すること
- `&xiao_serial { status = "disabled"; };` と snippet の衝突がないこと
- build log / generated devicetree / final `.config` で `CONFIG_ZMK_STUDIO_TRANSPORT_*` と CDC/UART の状態を証拠として確認する

もし USB Studio RPC が構造的に不安定または不要なら、エディターは BLE Studio RPC、モニターは USB Raw HID と割り切る。ただしUI上では「右手USBでモニター」「編集にはBLE/対応ファームが必要」と明確に分ける。

### 6. 診断ログとテストを追加する

追加してほしいテスト:

- Raw HID frame parser unit test
- WebHID接続成功時、Studio RPCなしでもモニターが起動するテスト
- USB Serialが開くが `core.getDeviceInfo` timeout の場合、`serial_open_but_rpc_unavailable` になるテスト
- BLE/USB別のエラー文言テスト
- 右手USBを主ボタンとして表示し、BLEが補助扱いになる UI test
- WebSerial `already open` のcleanup regression test

実行する検証:

```bash
npm test
npm run lint
npm run build
```

実機がある場合は、右手USB接続状態で以下も確認する。

```bash
ls -l /dev/cu.* /dev/tty.* | rg 'usbmodem|usbserial'
system_profiler SPUSBDataType | rg -i -C 8 'minimal|ZMK|615e|1d50|xiao|Seeed'
ioreg -p IOUSB -l -w 0 | rg -i -C 10 'minimal-keys|minimal_keys|ZMK Project|615e|1d50'
hidutil list | rg -i 'minimal|1d50|615e|ff60'
lsof /dev/cu.usbmodem* /dev/tty.usbmodem*
```

## 成果物

最後に以下を報告してください。

- 根本原因または最有力原因
- 右手USB上で Raw HID / Studio RPC のどちらが成立しているか
- モニターモードが Studio RPC なしで起動できるか
- エディターモードに必要なファームウェア条件
- 変更したファイル一覧
- 追加したテスト一覧
- 実行した検証コマンドと結果

## 禁止事項

- 「USBケーブルを抜き差ししてください」で終わらせない
- BLEを主導線に変更して問題を隠さない
- `port.open()` 成功を接続成功と扱わない
- Raw HID と Studio RPC を同じ接続成功条件に混ぜない
- 未コミットのUI/PWA/モニター系変更を勝手に revert しない
- 推測だけで baud rate や delay をいじり続けない

