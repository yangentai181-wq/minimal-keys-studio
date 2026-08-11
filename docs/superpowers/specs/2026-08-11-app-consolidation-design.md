# minimal-keys アプリ整理設計

## 目的

Mac上で混在している minimal-keys のアプリを1つの正本へまとめ、再生成可能な開発成果物を削除して、既存の未統合作業を失わずに約5.2GBの容量を回収する。

## 正本

- 正本アプリは `/Applications/minimal-keys カスタマイズ.app` とする。
- Bundle IDは `com.hyhy-masa.minimal-keys-customize`、現在のアプリ版は `0.1.0`。
- 正本コードはローカルブランチ `codex/implement-v060-editor-fixes` を基準とする。
- Chromeアプリ版 `/Users/iwanedaijun/Applications/Chrome Apps.localized/Minimal Keys Studio.app` は旧版として扱う。

## 実行対象

### 1. 旧Chromeアプリを退避

旧Chromeアプリ版を、名前の衝突を避けた専用名でユーザーのゴミ箱へ移動する。直接削除せず、必要なら元の場所へ戻せる状態にする。

### 2. 再生成可能な開発成果物を削除

存在するものだけを、実行直前に正規化した絶対パスと照合してから削除する。

- `/Users/iwanedaijun/repos/minimal-keys-studio/dist`
- `/Users/iwanedaijun/repos/minimal-keys-studio/src-tauri/target`
- `/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/dist`
- `/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/src-tauri/target`
- `/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/dist`
- `/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/src-tauri/target`（存在する場合のみ）

これらは `npm run build` または `npm run tauri build` で再生成できる。容量回収が目的なので、ビルド成果物はゴミ箱へ移動せず完全に削除する。

## 保護対象

次の項目は変更・削除しない。

- `/Applications/minimal-keys カスタマイズ.app`
- メイン作業場所の未保存変更 `.gitignore` と `work/`
- `node_modules` と依存関係ファイル
- `codex/editor-hold-actions` と `codex/ipad-unified-studio-impl` のworktree・ブランチ
- その他すべてのGitブランチとコミット
- Firmware、UF2、キーマップJSON・keymapファイル
- Desktop、Downloadsにある minimal-keys 関連資料
- StorybookのモーションCSS未読込問題（別タスク）

## 安全手順

1. 実行前に正本アプリ、旧Chromeアプリ、対象ディレクトリの実在とサイズを再取得する。
2. メインと2つのworktreeの `git status --short` を記録する。
3. 旧Chromeアプリをゴミ箱へ移動する。
4. 対象パスが許可リストと完全一致する場合だけ、再生成可能な成果物を削除する。
5. 削除後に対象パスが存在しないことを確認する。
6. 正本アプリのBundle ID、バージョン、コード署名を読み取り確認する。
7. Git状態とworktree一覧が実行前から変化していないことを確認する。
8. 回収容量を実測して報告する。

## 失敗時の扱い

- 旧Chromeアプリの移動に失敗した場合、開発成果物の削除へ進まない。
- 許可リスト外のパス、シンボリックリンク、不明な実体を検出した場合、その対象は削除せず停止する。
- Gitの追跡ファイルや未保存変更が対象配下に見つかった場合、その対象は削除しない。
- Chromeアプリはゴミ箱から復元できる。ビルド成果物は各ブランチで再ビルドして復元する。

## 完了条件

- Applications上で使用するminimal-keysアプリがTauri版1つに整理されている。
- 旧Chromeアプリがゴミ箱にあり復元可能である。
- 指定した再生成可能成果物が削除され、約5.2GBの容量が回収されている。
- メインと2つのworktreeの未保存変更、ブランチ、コミットが維持されている。
- Firmware・キーマップ・個人資料に変更がない。
