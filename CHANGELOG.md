# Changelog

本プロジェクトは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) 規約に沿って変更履歴を記載し、バージョンは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

正の Release 本文は [GitHub Releases](https://github.com/fk506cni/kuku-dojo/releases) にあります。本ファイルはリポジトリ内での簡易履歴です。

## [Unreleased]

（次回 v1.y.0 / v1.0.y に含める変更があればここに記載）

## [1.0.1] - 2026-04-21

**動作変化なし / 品質基盤の整備のみ**。配布版 `kuku-dojo.html` の動作・UI・成績データは v1.0.0 から完全互換。v1.0.0 をお使いの方は更新不要。

### Added

- **ユニットテスト基盤** (`node:test` / Node 22+ / 追加依存なし)
  - `tests/helpers/load-core.mjs` — `index.html` の `// ── storage ──` / `// ── engine ──` / `// ── helpers ──` セクションを VM 抽出してロードするヘルパ
  - `tests/engine-pickQuestion.test.mjs` / `tests/engine-updateWeight.test.mjs` / `tests/engine-proficiencyLevel.test.mjs` / `tests/storage-loadSettings.test.mjs` で **28 件**のユニットテストを整備
  - `npm test` で実行
- **CI 自動実行** (`.github/workflows/test.yml`)
  - PR / main push で Node 22 環境で `npm ci && npm test && npm run build` を自動実行
  - `actions/setup-node` の npm cache、`timeout-minutes: 10`、`concurrency` で古い run を cancel
- **内部構造の整理**
  - `index.html` に `// ── helpers ──` セクションを新設し、`ResultHelpers` / `StatsHelpers` をピュア関数として抽出（UI 出力は不変）
  - `package.json` に `"engines": { "node": ">=22.0.0" }` を追加

### Changed

- `README.md` に Node バージョン要件（22+）と動作確認 OS（Linux / macOS）を明記
- `CLAUDE.md` に tests レイヤ / Helpers 層 / マーカー同期責任 / Tailwind tests 禁則を追記
- `SPEC.md §2.2` JSDoc の `slowThresholdSec` 注記を整理（仕様先行記載、実装は F1 セッションで追加予定）
- `.gitignore` に `docs/report*.md` / `docs/publication_manual.md` / `publication_plan.md` / `scripts/upload_to_gdrive.sh` / 旧 step 資料を追加

### Fixed

- VM sandbox に Promise / RegExp / TypeError / RangeError / Symbol / WeakMap / Intl 等の intrinsics 16 種を注入し、将来の拡張時に silent な ReferenceError を防止

### 配布版

- ファイルサイズ: **338.4 KB**（346,554 bytes / v1.0.0 と同水準、SPEC §7.4 の 1 MB zip 予算に対して余裕あり）
- `dist/kuku-dojo.html` は [Releases v1.0.1](https://github.com/fk506cni/kuku-dojo/releases/tag/v1.0.1) から入手可能

## [1.0.0] - 2026-04-19

**初回公開リリース**。

### Added

- 単一 HTML ファイル `dist/kuku-dojo.html` による完全オフライン配布
- 適応型出題エンジン（重み付き抽選 + 習熟度マップ L0〜L4）
- マルチアカウント対応（ニックネームのみ）
- 子供向けエフェクト（紙吹雪 / マスコット「くくちゃん」/ 効果音）
- 成績ダッシュボード（履歴 / 段別正答率 / 習熟度マップ / 苦手ワースト 5）
- SettingsModal（サウンド / エフェクト / 音量 / wrongWeightBoost 3 段）
- `scripts/build-dist.mjs` による配布版ビルドパイプライン
- WelcomeNotice（device-level 初回案内）
- 光過敏性（WCAG 2.3.1）配慮

### 配布版

- ファイルサイズ: **337.5 KB**
- [Releases v1.0.0](https://github.com/fk506cni/kuku-dojo/releases/tag/v1.0.0)

[Unreleased]: https://github.com/fk506cni/kuku-dojo/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/fk506cni/kuku-dojo/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/fk506cni/kuku-dojo/releases/tag/v1.0.0
