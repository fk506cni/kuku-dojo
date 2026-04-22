# Changelog

本プロジェクトは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) 規約に沿って変更履歴を記載し、バージョンは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

正の Release 本文は [GitHub Releases](https://github.com/fk506cni/kuku-dojo/releases) にあります。本ファイルはリポジトリ内での簡易履歴です。

## [Unreleased]

（次回 v1.y.0 / v1.0.y に含める変更があればここに記載）

## [1.1.0] - 2026-04-22

**新機能リリース**: Stats 画面に「がんばった きろく」タブを追加し、回答時間の可視化と「じかんもくひょう」プリセットで子どもが自分で目標スピードを選べるようになりました。**適応出題アルゴリズム本体は変更なし** (proficiencyLevel / updateWeight 不変)。v1.0.x の成績データは互換維持で持ち上がります。

### Added

- **「がんばった きろく」タブ** (StatsScreen 第3タブ)
  - 問題ごとの最近 5 回の回答時間を横棒グラフで可視化、平均秒数を「だいたい ○びょう」で表示
  - **到達可視化**: 「じかんもくひょう」未満で 3 サンプル以上揃ったセルに薄ミント背景 + ★ + `border-emerald-400` (色覚多様性配慮 / 第16回 C16-08)
  - **褒めバッジ**: 最近の平均より 0.3 秒以上はやくなったら「さいきんの へいきんより X びょう はやくなった！」(N=2 では発火しない / 第16回 C16-07)
  - 詳細カードに「さいきん N かいの へいきん（ぜんぶで M かい とりくんだよ）」補助行 (lifetime と recent の semantic 区別 / 第16回 C16-11)
- **じかんもくひょう設定** (SettingsModal「くわしい せってい」内)
  - 4 プリセット: のんびり 15s / ふつう 10s (既定) / きびきび 7s / **たつじん 5s**
  - **「たつじん 5s」はお子さん自身が選ぶ前提のチャレンジ枠**。到達時は可視化のみ・未達でもペナルティなし（保護者による押し付け防止）
- **Engine.isSlowAverage(avgResponseMs, thresholdSec)** 新設 (Stats 可視化専用、出題確率には影響しない)
- **cold start 除外**: セッション先頭 3 問は集計外 / per-cell 最新 5 サンプル平均

### Changed

- **SettingsModal を情報階層化**: 基本 3 項目（サウンド / エフェクト / 音量）を常時表示、「くわしい せってい」折りたたみで `wrongWeightBoost` と `slowThresholdSec` を配置 (第13回 C13-04 / 第16回 C16-04 系の階層整理)
- **StatsScreen タブに a11y ナビゲーション**: ArrowKey + Home/End + roving tabindex / `role="tablist"` / Esc は詳細カード閉じ → 画面遷移の優先順位 (第13回 C13-12)
- **time タブヘッダを 2 行化**: 「-」セルの意味と cold start 3 問除外を子供向け表現で明示 / 「みずいろ」→「みどりの ★」表記に修正（色語彙齟齬解消 / 第16回 C16-12 / C16-13）
- **SPEC §8.8.1 (5)**: セッション単位サマリ表示は v1.1.0 MVP 範囲外と明記し、v1.1.x / v1.2.0 で再検討する旨を追記 (第16回 C16-03)

### Internal

- node:test スイート 28 → **49 件**（`engine-isSlowAverage.test.mjs` 6 ケース新設 / `stats-aggregate.test.mjs` 9 ケース新設 / `storage-loadSettings.test.mjs` +6 ケース）
- `Storage.loadSettings` に `slowThresholdSec` 欠損補完 + プリセット外正規化（C11-06 と同パターン / 負数 / Infinity / 非数値 raw JSON も 10 に正規化 / 第16回 C16-05 / C16-20）
- `tests/helpers/load-core.mjs` に `SLOW_THRESHOLD_PRESETS` / `COLD_START_COUNT` / `STATS_RESPONSE_TIME_SAMPLES` を export 追加 (第16回 C16-09)
- 第16回敵対的レビュー対応 C16-01〜C16-09 / C16-11 / C16-12 / C16-13 / C16-20 の 12 件 (詳細は `docs/__archives/report16.md`)

### Fixed

- `index.html` 横棒グラフ「Nかいまえ」ラベル off-by-one を修正（`(i+1) + "かいまえ"` → `i + "かいまえ"` / 第16回 C16-01）
- praise 文言「このまえより」が単数形だったが内部計算は最大 4 サンプル平均だったため、「さいきんの へいきんより」に文言統一（過少約束の解消 / 第16回 C16-02）

### 配布版

- ファイルサイズ: **360.1 KB** (368,758 bytes / SPEC §7.4 の 1 MB zip 予算に対して余裕あり)
- `dist/kuku-dojo.html` は [Releases v1.1.0](https://github.com/fk506cni/kuku-dojo/releases/tag/v1.1.0) から入手可能

### 既知の制限

- **実機検証範囲**: v1.0.x で未消化の 9 項目（macOS Safari / iPadOS Safari / Firefox / Android タブレット / 色覚シミュレータ / SR 実読み上げ等）は v1.1.x パッチで順次消化予定（第11回 C11-23 と整合）

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

[Unreleased]: https://github.com/fk506cni/kuku-dojo/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/fk506cni/kuku-dojo/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/fk506cni/kuku-dojo/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/fk506cni/kuku-dojo/releases/tag/v1.0.0
