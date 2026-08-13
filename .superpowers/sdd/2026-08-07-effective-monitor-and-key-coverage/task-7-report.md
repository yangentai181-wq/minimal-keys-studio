# Task 7 最終検証レポート

対象コミット: `4a2bc6c` を起点に、検証中に見つけた Storybook fixture の
context 不足を最小修正した状態。

## Studio gates

| コマンド | 終了コード | 新規実行の結果 |
| --- | ---: | --- |
| `npm test` | 0 | 117 files / 742 tests passed |
| `npm run build` | 0 | TypeScript、Vite、`verify:local-fonts` 成功 |
| `npm run lint` | 0 | warnings 0 |
| `npm run tauri build` | 0 | macOS `.app` と DMG を生成 |

最終レビュー修正後に `npm test`（117 / 742）、`npm run build`、
`npm run lint`、`npm run tauri build` をそれぞれ exit 0 で再実行した。
今回はproduction Studioコードを変更したため、Tauri bundleも新規に再生成した。

`npx storybook build --output-dir <temporary directory>` も修正前・修正後とも
exit 0。no-MDX と third-party `eval` の既知 advisory は出たが失敗ではない。

## Firmware config 検証記録（Task 5 からの転記）

Task 5で用いたfocused config testは次のとおり。

```bash
cd /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/config
python3 -m unittest tests/test_standard_key_coverage.py
```

全config suiteのコマンドは次のとおり。

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

右手側firmwareの既存ビルドコマンドは次のとおり。

```bash
cd /Users/iwanedaijun/repos/minimal-keys-zmk-workspace
PATH="/tmp/minimal-keys-zmk-venv/bin:$PATH" \
  /tmp/minimal-keys-zmk-venv/bin/west build \
  -d /Users/iwanedaijun/repos/minimal-keys-zmk-workspace/build/right-persistent-base-red
```

Task 5の最終記録では、focused testは10件成功・終了コード0、全config suiteは
16件成功・終了コード0、右手firmware buildは336工程・終了コード0で
`zmk.uf2`を生成した。生成物は599,040 bytesだった。

最終レビュー修正後にも、firmwareソースを変更せず上記のfocused test（10件）、
全config suite（16件）、右手firmware build（今回のincremental buildは8工程）を
再実行し、すべて終了コード0を確認した。右手buildは599,040 bytesの`zmk.uf2`を
再生成した。

## 独立レビューと修正

設計書、Task 1〜6 の TDD 記録、Studio 最終差分、表示経路を照合した。

- RED: `KeyboardWorkspace` の IntegratedMonitor Story は
  `MonitorKeymapProvider is required` で Storybook 実行時に失敗した。
- GREEN: `src/keyboard/KeyboardWorkspace.stories.tsx` の全 Story decorator を、
  本番の接続境界と同じ `MonitorKeymapProvider` で包んだ。再ビルド後は
  リアルタイム Story が描画される。
- Studio 側に RPC/proto の変更はなく、実効解決は `Transparent` のみを
  下位へ解決する既存の実装・テスト経路を維持している。

## ヘッドレス画面証跡

Storybook static output を一時 localhost サーバーで提供し、GUI を開かない
Chrome `--headless=new` で作成した。各 PNG は出力サイズが安定した後に
寸法を検査し、その撮影用 Chrome プロセスだけへ TERM を送った。

| 画面 | 証跡 | 寸法 | SHA-256 |
| --- | --- | --- | --- |
| エディター | `docs/audits/evidence/2026-08-08/editor-800x600.png` | 800×600 | `7a05c69ce2360bb84a262b97ee21e5377e6e522bf41496233d1609301abc95e6` |
| リアルタイム | `docs/audits/evidence/2026-08-08/realtime-800x600.png` | 800×600 | `87484bef97340908991bf7b47c0b68aa8b4aba79d07cf21b1c5642d8903b5e64` |
| エディター | `docs/audits/evidence/2026-08-08/editor-1200x800.png` | 1200×800 | `e33259113a8b06949a561bbc195df40729729bf6c3e232c98b227e4efd52a8fc` |
| リアルタイム | `docs/audits/evidence/2026-08-08/realtime-1200x800.png` | 1200×800 | `02c9dffb6201266a24d1c7aeb939924f63a6a0c84a0d811813554435d21e5b9a` |

目視確認では、リアルタイム画面に未解決の `Trans` は表示されず、現在
レイヤー・最新キー・停止中の状態カードと主要キー名は読める。実際の
Transparent 解決は `KeyboardMonitorSurface.test.tsx` が、継承元の `A` を
表示し `Trans` がないことを確認しており、上記の全テスト成功に含まれる。

エディターが扱う raw `Transparent` は `SystemTab` の日本語ラベル `透過` として
維持されている。`SystemTab.test.tsx` の「透過」を表示・適用する確認も同じ全体
テスト成功に含まれる。今回の汎用エディター visual fixture は `B` の設定例を
描くため、`透過` そのものを写した fixture ではない。

## 生成 bundle

| 項目 | 値 |
| --- | --- |
| app | `src-tauri/target/release/bundle/macos/minimal-keys カスタマイズ.app` |
| version / build | `0.1.0` / `0.1.0` |
| app executable SHA-256 | `34b52534b89ffae2f00765dfbb3f9794c385a164d698743ffdaf560754f005fb` |
| DMG | `src-tauri/target/release/bundle/dmg/minimal-keys カスタマイズ_0.1.0_aarch64.dmg` |
| DMG SHA-256 | `bd9a66a6c6ade99ffdbb14241667df1d672501aee0b44c99c0b12e95c3260267` |

## 最終レビュー修正後のアプリ置換

再レビュー承認後、実行中プロセスがないことを確認してから、修正後bundleを
`/Applications/minimal-keys カスタマイズ.app` へ配置した。置換前のアプリは
削除せず、次のTrash内へ復元可能な状態で移動した。

| 確認 | 結果 |
| --- | --- |
| backup | `/Users/iwanedaijun/.Trash/minimal-keys-customize-backup-20260808-170705/minimal-keys カスタマイズ.app` |
| backup存在確認 | 成功 |
| `mv` + `ditto` | exit 0 |
| installed executable SHA-256 | `34b52534b89ffae2f00765dfbb3f9794c385a164d698743ffdaf560754f005fb` |
| build executable SHA-256 | `34b52534b89ffae2f00765dfbb3f9794c385a164d698743ffdaf560754f005fb` |
| installed version / build | `0.1.0` / `0.1.0` |
| 実行中プロセス | なし |

## 懸念

- 800×600 の realtime fixture では、長い fallback 表示（例: `Mission / L2`、
  `Space / Scr`）が二行制限で省略表示になる。主要なキー・状態は読めるが、
  「全キー名を省略なしで表示」を厳密な受入条件にする場合は、別途 typography の
  調整が必要。
- firmware/RPC/proto は変更していない。Task 5の記録に加え、今回もfocused/full config
  suiteと右手firmware buildを終了コード0で再実行した。

## Step 4: 以前のインストール済みアプリ置換記録

以下は以前のTask 7で実施した置換の履歴であり、上記の最終レビュー修正waveで
生成したbundleを指すものではない。

ユーザー承認済みの置換として、GUI を開かずに実施した。開始前の read-only
確認では `/Applications/minimal-keys カスタマイズ.app` と build bundle の両方が
存在し、`minimal-keys-customize` の実行プロセスは見つからなかった。

実行内容:

```text
mkdir "/Users/iwanedaijun/.Trash/minimal-keys-customize-backup-20260808-163356"
mv "/Applications/minimal-keys カスタマイズ.app" \
  "/Users/iwanedaijun/.Trash/minimal-keys-customize-backup-20260808-163356/minimal-keys カスタマイズ.app"
ditto "src-tauri/target/release/bundle/macos/minimal-keys カスタマイズ.app" \
  "/Applications/minimal-keys カスタマイズ.app"
```

| 確認 | 結果 |
| --- | --- |
| backup | `/Users/iwanedaijun/.Trash/minimal-keys-customize-backup-20260808-163356/minimal-keys カスタマイズ.app` |
| `ditto` | exit 0 |
| installed executable SHA-256 | `2c041dab23cf7c98cd100d1d3ebf7d6f658d18de79c43c108a0d175d57388b38` |
| build executable SHA-256 | `2c041dab23cf7c98cd100d1d3ebf7d6f658d18de79c43c108a0d175d57388b38` |
| installed version / build | `0.1.0` / `0.1.0` |
| build version / build | `0.1.0` / `0.1.0` |

旧アプリは削除せず、上記 Trash backup 内に recoverable な状態で残した。
