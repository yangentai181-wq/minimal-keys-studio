# 右手USB接続アーキテクチャ再設計（根本修正）

作成日: 2026-07-04
ブランチ: `fix/right-usb-connection-architecture`
前提資料: `2026-07-03-minimal-keys-studio-connection-troubleshooting.md`

## 根本原因（実機で確定）

ZMK Studio RPC は**選択中の出力エンドポイントの transport でしか待ち受けない**
（`hyhy-masa/zmk@957c4b0c app/src/studio/rpc.c refresh_selected_transport()`）。

- 出力先がBLEのとき: USB CDC は `port.open()` できるが RPC frame は一切読まれない
  → これが「USBは開けるが getDeviceInfo timeout」の正体。
- 実機差分実験:
  - BLE接続中(7/2-3): CDC直プローブ 0 byte（全baud・DTR/RTS無効果）
  - BLE解除後(7/4): 同一frame `ab08011a020801ad` に即応答
    `ab0a1e08011a1a0a180a0c6d696e696d616c2d6b6579731208f2a88ebccbc3757aad`
    (= getDeviceInfo: name "minimal-keys", serial f2a88ebccbc3757a)。9600/115200同一。
- ファーム自体は正常: snippet `studio-rpc-usb-uart` 有効（CDC応答で証明）、
  `raw_hid_adapter` 有効（hidutil に usagePage 0xff60/usage 0x61）、
  `&xiao_serial disabled` は snippet の CDC ノード（zephyr_udc0配下）と無関係。

プローブスクリプト: `scripts/studio_rpc_probe.py`（pyserial不要・termios直叩き）。

## 新アーキテクチャ

USB接続を単一の「Studio RPC接続」とみなさず、契約を分離:

| 経路                             | 用途                             | 成立条件                                           |
| -------------------------------- | -------------------------------- | -------------------------------------------------- |
| USB Raw HID (WebHID 0xff60/0x61) | リアルタイムモニター（一次経路） | inputreport購読。**出力先に関係なく動く**          |
| USB Serial Studio RPC            | エディター                       | `core.getDeviceInfo` 応答（port.open成功では不可） |
| BLE Studio RPC                   | エディター補助/検証              | 同上（GATT）                                       |

### 追加ファイル

- `src/connection/coordinator.ts` — 接続state machine
  （idle / right_usb_not_detected / right_usb_detected / opening_webhid /
  rawhid_monitor_ready / opening_webserial / serial_open_but_rpc_unavailable /
  studio_rpc_ready / ble_optional_ready / firmware_contract_mismatch /
  busy_or_already_open）と契約ベースの文言 `describeConnection()`
- `src/connection/rawHidFrames.ts` — 0xf1/0xff/0xf2/0xf3 の pure parser
- `src/connection/rawHid.ts` — WebHID検出/購読
- `src/connection/usbDiagnostics.ts` — VID/PID/Product診断ログ
- `src/connection/rightUsbFlow.ts` — 検出→WebHID→Serial+RPCプローブの一連フロー
- `src/connection/useRightUsbConnection.ts` — Reactフック（coordinator+monitor所有）
- `src/monitor/monitorStore.ts` / `MonitorPanel.tsx` / `layerNames.ts` —
  RPCなしで起動するモニターUI（レイヤーはRaw HID追従・手動切替なし、
  Auto Mouse はmask使用中のみバッジ表示）

### UI

- 主ボタン: 「右手USBで接続」（WebHIDモニター + Serial RPCプローブを一括実行）
- BLE / USBシリアルのみ は `詳細な接続方法` に降格
- RPC timeout時は degraded（モニター可・エディター不可）でモニター画面を表示し、
  「出力先がBLEの可能性・&out OUT_USB で切替」を案内

## ファーム側（minimal-keys-release, commit 75325a2）

- keymap L6 に `&out OUT_USB / OUT_BLE / OUT_TOG` 追加（USB復帰の脱出口）
- build.yaml に artifact-name 明示
- 検証手順: `minimal-keys-release/docs/usb-studio-rpc-verification.md`

## 実機での次の検証（フラッシュ後）

1. 新UF2（`minimal-keys_R-usb-studio-raw-hid`）を右手に焼く
2. `python3 scripts/studio_rpc_probe.py /dev/cu.usbmodemXXXX` → 応答確認
3. iPad等とBLE接続した状態で同プローブ → 無応答になること（仕様どおり）を確認
4. L6 の `&out OUT_USB` を押して再プローブ → 応答復帰を確認
5. ブラウザで「右手USBで接続」→ モニター表示 + エディター起動を確認
