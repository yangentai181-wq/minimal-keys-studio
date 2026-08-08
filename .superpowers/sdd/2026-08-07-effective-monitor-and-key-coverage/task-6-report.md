# Task 6 完了報告 — 出荷時ラベルの同期

## 1. そもそも何を直したのか

キーボード本体の設定と画面上の予備表示をそろえた。
人間でいえば、本体の鍵に付いた名札と予備の案内板を同じ内容へ直す作業になる。

## 2. 作ったもの一覧

### 1. 出荷時キー表示の更新

- ファイル: `src/monitor/minimalKeysMonitorLabels.ts`
- モニター単体時の9レイヤー・各43位置の表示を、firmware commit `2293a3b` と一致させた。
- L2のInsert/Delete、L3の`[`/`]`、L5の画面撮影・明るさ・音量・Caps Lockを表示する。
- L4の`&to 0`は、透過やL0ではなく「通常へ戻る」と表示する。
- Caps LockはL5/33とし、F7〜F12はL5/22〜27に残した。

### 2. レイヤー名と保護数の更新

- ファイル: `src/monitor/layerNames.ts`
- L1を「数字」、L8を「精密モード」として表示する。
- ファイル: `src/keyboard/minimal-keys-layers.ts`
- 全9レイヤーという数を定数化し、精密モード用L8の保護判定に使う。

### 3. 取り違えを防ぐ自動確認

- ファイル: `src/monitor/MinimalKeysMonitorLayout.test.tsx`
- 追加操作、L4の通常復帰、L5/33のCaps Lock、F7〜F12の位置を確認する。
- 9レイヤーすべてが43位置であることも確認する。
- これにより、将来の変更でF7〜F12をCaps Lockが上書きする事故を防ぐ。

### 4. 全体テスト用の既存モック修正

- ファイル: `src/encoder/EncoderSettings.test.tsx` と `src/App.monitor-isolation.test.tsx`
- 概要表示が読む空の動作一覧を、既存モックにも渡すようにした。
- 本番の未接続時と同じ空の対応表を返すだけで、画面の動作は変えない。

### 5. 設計書の配置訂正

- ファイル: `docs/superpowers/specs/2026-08-07-effective-monitor-and-key-coverage-design.md`
- ファイル: `docs/superpowers/plans/2026-08-07-effective-monitor-and-key-coverage.md`
- 誤っていたL5/22のCaps Lock指定をL5/33へ訂正した。
- F7〜F12をL5/22〜27で維持する理由も残した。

## 3. 確認記録

| 確認 | 結果 |
| --- | --- |
| RED: `npm test -- --run src/monitor/MinimalKeysMonitorLayout.test.tsx` | 旧L1名と8レイヤー表で失敗を確認 |
| GREEN: 同コマンド | 2ファイル・11テスト成功 |
| 関連テスト | 3ファイル・13テスト成功 |
| 結合テスト | 2ファイル・6テスト成功 |
| `npm run lint` | 成功 |
| `npm run build` | 成功 |
| `git diff --check` | 成功 |

## 4. 補足

- `npm test` の全体実行は終了コード1だった。Task 6の対象と、今回修正した結合テストは成功している。
- 既存の意図的な例外表示が大量に出る全体実行の最終失敗は、このTaskでは追跡しない。親担当の全体検証で扱う。
