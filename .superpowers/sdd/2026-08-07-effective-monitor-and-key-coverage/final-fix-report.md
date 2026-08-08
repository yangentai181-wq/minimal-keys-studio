# Final Review Fix Wave Report

## Scope

最終レビューで指摘された4点だけを修正した。新規依存、RPC、proto、firmware
ソースの変更はない。既存の`work/`は変更していない。

## TDD evidence

REDでは次のfocused commandを実行し、要求どおり7件が失敗した。

```bash
npm test -- --run src/monitor/minimalKeysMonitorLabels.test.ts src/monitor/MinimalKeysMonitorLayout.test.tsx src/monitor/MonitorPanel.test.tsx src/keyboard/KeyboardMonitorSurface.test.tsx src/StudioConnectionOverview.test.tsx
```

失敗理由は、factory-mask resolverの未実装、L8+L3の固定表表示、両接続画面の
静的レイヤー名、MonitorPanelの500ms停止判定だった。その後、接続画面の静的
最新キーfallbackも同じresolverへ統一するための2件をREDで追加した。

GREENでは同じfocused commandを再実行し、7 files / 39 testsが終了コード0だった。

## Implemented fixes

- `resolveFactoryMonitorKeyLabel(position, activeLayerMask)`を追加した。L8からL0へ
  優先度順に走査し、空文字（factoryのTransparent）だけを下位へ通す。
  L0+L3+L8ではL3のbindingを返す。
- `MinimalKeysMonitorLayout`、MonitorPanelの押下中キー、接続画面のstatic latest-key
  fallbackへ同じmask resolverを渡した。
- `KeyboardMonitorSurface`と`StudioConnectionOverview`は、live keymapがあれば
  `resolveMonitorLayer(keymap, mask)`の配列優先順位と、そのresolved indexのlive nameを
  使用する。live nameがない時だけlayer IDの固定名へfallbackする。
- 500msのpointer summary hookを`src/monitor/usePointerSummary.ts`へ集約し、3画面で
  再利用した。MonitorPanelは既存のwheel/buttons表示を維持しつつ、期限後は`停止中`へ
  変わる。

## Verification

| Command | Result |
| --- | --- |
| focused monitor tests | 7 files / 39 tests, exit 0 |
| `npm test` | 117 files / 742 tests, exit 0 |
| `npm run build` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run tauri build` | exit 0; `.app` and DMG generated |
| `python3 -m unittest tests/test_standard_key_coverage.py` | 10 tests, exit 0 |
| `python3 -m unittest discover -s tests -p 'test_*.py'` | 16 tests, exit 0 |
| Task 5 right-half `west build` command | 8 incremental steps, exit 0; `zmk.uf2` 599,040 bytes |

The focused and full firmware commands and the exact right-half build command are
copied into `task-7-report.md` with the Task 5 exit-0 evidence.

## Tauri artifacts

| Artifact | SHA-256 |
| --- | --- |
| `src-tauri/target/release/bundle/macos/minimal-keys カスタマイズ.app/Contents/MacOS/minimal-keys-customize` | `34b52534b89ffae2f00765dfbb3f9794c385a164d698743ffdaf560754f005fb` |
| `src-tauri/target/release/bundle/dmg/minimal-keys カスタマイズ_0.1.0_aarch64.dmg` | `bd9a66a6c6ade99ffdbb14241667df1d672501aee0b44c99c0b12e95c3260267` |

`/Applications/minimal-keys カスタマイズ.app` was not replaced in this wave.

## Concerns

- Tauri skipped notarization because no notarization credentials were supplied.
- The existing Vite chunk-size and firmware deprecation warnings remained warnings;
  all required commands exited 0.
