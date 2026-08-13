# minimal-keys Studio 接続トラブル 引き継ぎ資料

作成日時: 2026-07-03 10:26 JST
対象リポジトリ: `/Users/iwanedaijun/repos/minimal-keys-studio`
関連ファームウェアリポジトリ: `/Users/iwanedaijun/repos/minimal-keys-release`
作業ブランチ: `codex/fix-serial-open`

## 依頼したいこと

minimal-keys Studio の接続不良を、アプリ・ブラウザ・macOS・ファームウェアのどの層の問題か切り分けてほしい。

現在の最有力仮説は以下。

- USB CDC ACM ポートは開けるが、そこに ZMK Studio RPC が流れていない、または現在書き込まれている右側ファームが USB Studio RPC に応答していない。
- ファームウェア設定上は BLE Studio が有効なので、編集用の本命経路は BLE の可能性が高い。
- リアルタイムモニター用途は Studio RPC ではなく Raw HID (`usagePage 0xff60`, `usage 0x61`) を使う方がハードの実態に合う可能性が高い。

## ユーザーが直近で見ているエラー

USB 接続を押した後、画面に以下が出る。

```text
キーボードから応答がありません。USBシリアルは開けましたが Studio RPC の応答がないため、BLEでの接続も試してください。USBで編集したい場合は右側に studio-rpc-usb-uart 対応ファームを書き込んでください。
```

この文言はアプリ側で追加した診断メッセージ。意味は「Web Serial の `port.open()` は成功したが、初期 RPC `core.getDeviceInfo` がタイムアウトした」。

## 現在のアプリ状態

ローカルURL:

```text
http://127.0.0.1:5173/minimal-keys-studio/?chrome=1782631048
```

接続モーダルは以下の表示に変更済み。

- 先頭: `BLEで接続` / `minimal-keys推奨。ワイヤレスで編集する`
- 2番目: `USBで接続` / `USB Studio対応ファーム用。反応しない時はBLE`

in-app browser で DOM 確認済み。

## これまでの重要な修正

### Web Serial wrapper

追加ファイル:

- `src/transport/serial.ts`
- `src/transport/serial.test.ts`

目的:

- upstream の `@zmkfirmware/zmk-studio-ts-client/transport/serial` を直接使わず、ローカル実装に差し替え。
- `Failed to execute 'open' on 'SerialPort': The port is already open.` を扱う。
- in-flight close を `WeakMap<SerialPort, Promise<void>>` で待つ。
- baud rate を 12500 から 9600 に変更。
  - 根拠: `src-tauri/src/transport/serial.rs` が `tokio_serial::new(id, 9600)` を使用している。
- `port.open()` 後に `port.setSignals({ dataTerminalReady: true, requestToSend: true })` を呼ぶ。
- abort 後すぐ `port.close()` に行くと `create_rpc_connection` の pipe が stream lock を持っている可能性があるため、50ms 待ってから close する。

### 初期 RPC の診断

追加ファイル:

- `src/rpc/deviceInfo.ts`
- `src/rpc/deviceInfo.test.ts`
- `src/rpc/transportLifecycle.ts`
- `src/rpc/transportLifecycle.test.ts`

変更:

- `App.tsx` の初期化で `core.getDeviceInfo` を `requestDeviceInfo()` 経由に変更。
- USB/BLE 別に timeout 文言を分岐。
- USB timeout: 「USBシリアルは開けたが Studio RPC 応答なし。BLEも試す。USB編集には studio-rpc-usb-uart 対応ファームが必要」
- BLE timeout: 「BLE接続を解除して再試行」
- 初期化失敗時は `abortController.abort()` と `disposeTransport()` を呼ぶ。

### ConnectModal

変更ファイル:

- `src/ConnectModal.tsx`
- `src/ConnectModal.test.tsx`

変更:

- `onTransportCreated` が Promise を返せるようにした。
- transport 作成後、App 側の初期 RPC が完了するまで `接続中...` 表示を維持。
- `alert()` ではなく、モーダル内の inline error 表示に変更。
- BLE を USB より先に表示。

### UI/PWA/モニター寄りの前段変更

今回の接続問題と同じブランチに、以下の未コミット変更もある。

- `index.html`
- `src/GenericModal.tsx`
- `src/index.css`
- `src/keyboard/Keyboard.tsx`
- `src/keyboard/LayerPicker.tsx`
- `src/keyboard/LayerPicker.test.tsx`
- `tailwind.config.js`
- `public/manifest.webmanifest`
- `public/icons/`
- `docs/superpowers/specs/2026-07-02-studio-connect-ui-design.md`
- `src/App.disconnected.test.tsx`

このあたりは「エディター/モニター統合」「iPad向けUI」「PWAホーム画面追加」文脈の変更。接続調査で不用意に戻さないこと。

## 検証済みコマンド

前回の修正後に実行済み。

```bash
npm test
npm run lint
npm run build
```

結果:

- `npm test`: 31 files / 205 tests passed
- `npm run lint`: passed
- `npm run build`: passed
- build は既存の chunk size warning を出すが成功
- `ErrorBoundary.test.tsx` のスタック出力は意図的なテスト由来で、exit code は 0

## macOS/USB の証拠

2026-07-02 時点で USB 接続中に確認したデバイス情報:

```text
Device name: minimal-keys@01110000
USB Product Name: minimal_keys
kUSBProductString: minimal-keys
USB Vendor Name: ZMK Project
idVendor: 7504 decimal = 0x1d50
idProduct: 24926 decimal = 0x615e
USB Serial Number: F2A88EBCCBC3757A
bDeviceClass: 239
bDeviceSubClass: 2
bDeviceProtocol: 1
```

macOS 上で見えていた CDC ACM:

```text
/dev/cu.usbmodem11101
/dev/tty.usbmodem11101
```

2026-07-03 10:26 JST の資料作成時点では `/dev/cu.usbmodem11101` と `/dev/tty.usbmodem11101` は存在しない。
つまりこの時点では USB としては未接続、またはポート名が変わっている。

```bash
lsof /dev/cu.usbmodem11101 /dev/tty.usbmodem11101
```

結果:

```text
lsof: status error on /dev/cu.usbmodem11101: No such file or directory
lsof: status error on /dev/tty.usbmodem11101: No such file or directory
```

以前、接続失敗後に Chrome が `/dev/cu.usbmodem11101` を保持していたことが一度ある。
その後、serial cleanup に delay を追加し、現在の最新確認ではポート保持は再現していない。

## direct serial test の結果

ブラウザを介さず、macOS から Python で CDC ACM へ直接 Studio RPC frame を送った。

送った request:

- `core.getDeviceInfo`
- requestId 0 frame: `ab1a020801ad`
- requestId 1 frame: `ab08011a020801ad`

試した条件:

- `/dev/cu.usbmodem11101`
- baud: 9600
- baud: 115200
- baud: 12500
  - macOS custom baud via `IOSSIOSPEED = 0x80045402`
- DTR/RTS set
- read wait 2-5秒

結果:

```text
<no response>
```

このため、アプリの protobuf/framing 以前に「この CDC ポートで Studio RPC が返っていない」可能性が高い。

## BLE の証拠

2026-07-03 10:25 JST 時点で macOS は `minimal-keys` を paired / not connected として認識。

```bash
blueutil --paired --format json | jq '.[] | select((.name // "") | test("minimal|keys"; "i"))'
```

結果:

```json
{
  "address": "e0-57-56-8c-4c-47",
  "recentAccessDate": "2026-07-03T10:25:45+09:00",
  "favourite": false,
  "name": "minimal-keys",
  "connected": false,
  "paired": true
}
```

`system_profiler SPBluetoothDataType` でも `Not Connected: minimal-keys` と表示。

## firmware repo 側の証拠

関連ファイル:

- `/Users/iwanedaijun/repos/minimal-keys-release/build.yaml`
- `/Users/iwanedaijun/repos/minimal-keys-release/config/boards/shields/minimal-keys/minimal-keys_R.conf`
- `/Users/iwanedaijun/repos/minimal-keys-release/config/boards/shields/minimal-keys/minimal-keys_R.overlay`
- `/Users/iwanedaijun/repos/minimal-keys-release/config/boards/shields/minimal-keys/minimal-keys_L.overlay`

該当設定:

```text
build.yaml:
  shield: minimal-keys_R rgbled_adapter raw_hid_adapter
  snippet: studio-rpc-usb-uart

minimal-keys_R.conf:
  CONFIG_ZMK_STUDIO=y
  CONFIG_ZMK_STUDIO_LOCKING=n
  CONFIG_ZMK_STUDIO_TRANSPORT_BLE=y

minimal-keys_R.overlay:
  &xiao_serial { status = "disabled"; };

minimal-keys_L.overlay:
  &xiao_serial { status = "disabled"; };
```

重要:

- `CONFIG_ZMK_STUDIO_TRANSPORT_BLE=y` は明示されている。
- `studio-rpc-usb-uart` は `build.yaml` の snippet 依存。
- ただし、いま実機に入っているファームがこの `build.yaml` 産物なのかは未確認。
- `xiao_serial` が overlay で disabled なので、USB CDC がどの UART/endpoint に紐づいているか要確認。

## Raw HID の証拠

`ioreg` で `minimal-keys` に vendor HID interface が見えていた。

特徴:

```text
PrimaryUsagePage = 65376 decimal = 0xff60
PrimaryUsage = 97 decimal = 0x61
MaxInputReportSize = 32
MaxOutputReportSize = 32
```

`/Users/iwanedaijun/repos/zmk-web-configurator/lib/use-webhid.ts` に既存実装がある。

そこでは以下の marker を読む:

```ts
const RAW_HID_USAGE_PAGE = 0xff60;
const RAW_HID_USAGE = 0x61;
const KEY_PACKET_MARKER = 0xf1;
const LAYER_PACKET_MARKER = 0xff;
const POINTER_PACKET_MARKER = 0xf2;
const ENCODER_PACKET_MARKER = 0xf3;
```

リアルタイムモニター用途は、ZMK Studio RPC より Raw HID 経路を取り込む方が筋が良い可能性が高い。

## すぐ試してほしいこと

### 1. Webアプリで BLE 接続を押す

現行UIでは BLE が先頭に出る。

期待:

- Chrome の Bluetooth device picker に `minimal-keys` が出る
- 選択後、`core.getDeviceInfo` が返る
- App shell が表示される

失敗した場合:

- 画面上の文言を記録
- Chrome console の `[BLE]` ログを確認
- `src/transport/gatt.ts` のどこで止まるか見る

### 2. BLE GATT service の有無を確認

Studio service UUID:

```text
00000000-0196-6107-c967-c5cfb1c2482a
```

RPC characteristic UUID:

```text
00000001-0196-6107-c967-c5cfb1c2482a
```

Tauri 側の実装:

- `src-tauri/src/transport/gatt.rs`

ここでは `discover_services_with_uuid(SVC_UUID)` と `discover_characteristics_with_uuid(RPC_CHRC_UUID)` を使っている。
Tauri dev で BLE の list/connect を試すと、Web Bluetooth の前に macOS native BLE 層で切り分けできる可能性がある。

### 3. 実機ファームが本当に `studio-rpc-usb-uart` で焼かれているか確認

USBで編集したいなら、右側 central に `studio-rpc-usb-uart` snippet 入りのファームを焼く必要がある。

確認ポイント:

- GitHub Actions artifact の生成元 branch / commit
- `build.yaml` が上記の内容だったか
- 実際に右側へ flash した UF2 が `minimal-keys_R rgbled_adapter raw_hid_adapter` で、snippet 付きだったか
- 左側ではなく右側へUSBケーブルを接続しているか

### 4. USB CDC が Studio RPC ではなく debug/log/別用途になっていないか確認

direct serial test で response 0 bytes のため、CDC endpoint の用途自体を疑う。

確認ポイント:

- ZMK snippet `studio-rpc-usb-uart` が対象 board/shield で有効になっているか
- `&xiao_serial { status = "disabled"; };` と snippet の関係
- Zephyr devicetree の chosen UART
- CDC ACM の interface 0/1 がどの driver に紐づくか
- raw_hid_adapter と studio RPC USB UART が同時に成立しているか

## やらなくてよさそうなこと

以下は既に試して効果なし。

- Web Serial baud 12500 への戻し
- Web Serial baud 9600
- Web Serial baud 115200
- DTR/RTS set
- requestId 0 / requestId 1 の getDeviceInfo frame 直接送信
- Chrome の port already open だけを原因とする仮説

## 現在の git 状態

2026-07-03 10:26 JST 時点:

```text
## codex/fix-serial-open
 M index.html
 M src/App.tsx
 M src/ConnectModal.test.tsx
 M src/ConnectModal.tsx
 M src/GenericModal.tsx
 M src/index.css
 M src/keyboard/Keyboard.tsx
 M src/keyboard/LayerPicker.test.tsx
 M src/keyboard/LayerPicker.tsx
 M tailwind.config.js
?? docs/superpowers/specs/2026-07-02-studio-connect-ui-design.md
?? public/icons/
?? public/manifest.webmanifest
?? src/App.disconnected.test.tsx
?? src/rpc/deviceInfo.test.ts
?? src/rpc/deviceInfo.ts
?? src/rpc/transportLifecycle.test.ts
?? src/rpc/transportLifecycle.ts
?? src/transport/serial.test.ts
?? src/transport/serial.ts
```

注意:

- ユーザーのUI/PWA/モニター系変更が同じブランチに混ざっている。
- 接続調査だけしたい場合も、未関連差分を revert しないこと。

## 参照コード

アプリ側:

- `src/App.tsx`
- `src/ConnectModal.tsx`
- `src/transport/serial.ts`
- `src/transport/gatt.ts`
- `src/rpc/deviceInfo.ts`
- `src/rpc/transportLifecycle.ts`

Tauri 側:

- `src-tauri/src/transport/serial.rs`
- `src-tauri/src/transport/gatt.rs`

Raw HID 既存実装:

- `/Users/iwanedaijun/repos/zmk-web-configurator/lib/use-webhid.ts`
- `/Users/iwanedaijun/repos/zmk-web-configurator/components/MonitorView.tsx`

Firmware:

- `/Users/iwanedaijun/repos/minimal-keys-release/build.yaml`
- `/Users/iwanedaijun/repos/minimal-keys-release/config/boards/shields/minimal-keys/minimal-keys_R.conf`
- `/Users/iwanedaijun/repos/minimal-keys-release/config/boards/shields/minimal-keys/minimal-keys_R.overlay`

## 推奨する結論候補

1. BLE Studio が通るなら:
   - エディター機能は BLE を正式推奨にする。
   - USB は「対応ファーム用」の補助経路にする。
   - リアルタイムモニターは Raw HID を別経路として統合する。

2. BLE Studio も通らないなら:
   - 実機ファームが Studio service を持っていない、またはファーム/ペアリング状態が古い。
   - 右側 central のファームを build artifact から焼き直す。
   - Bluetooth ペアリング削除、再ペアリングも候補。

3. USB Studio を必須にするなら:
   - `studio-rpc-usb-uart` が実際に有効な UF2 を作る。
   - `xiao_serial` disabled と CDC ACM endpoint の関係を devicetree/build log で確認する。
   - direct serial test に response が返るまでWebアプリの修正へ戻らない。
