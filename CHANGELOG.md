# Changelog

本プロジェクトは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) 規約に沿って変更履歴を記載し、バージョンは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

正の Release 本文は [GitHub Releases](https://github.com/fk506cni/kuku-dojo/releases) にあります。本ファイルはリポジトリ内での簡易履歴です。

## [Unreleased]

（次回 v1.y.0 / v1.0.y に含める変更があればここに記載）

## [1.3.0] - 2026-04-25

**機能リリース**: 多言語対応 Phase C で **初期 6 言語フル展開** (zh-CN / zh-TW / ko / vi の 4 言語追加)。zh-HK/zh-MO/zh-SG の region variant + zh-Hans/zh-Hant の script tag フォールバックも実装し、Android 中華圏ブラウザの自動判定を改善。第19回敵対的レビュー対応 22 件を吸収。**適応出題アルゴリズム本体は変更なし** (proficiencyLevel / updateWeight 不変)、v1.0.x / v1.1.0 / v1.2.0 の成績データは互換維持で持ち上がります。

### Added

- **多言語対応 Phase C** (zh-CN / zh-TW / ko / vi の 4 言語追加、SPEC §8.9)
  - `MESSAGES.zh-CN` / `MESSAGES.zh-TW` / `MESSAGES.ko` / `MESSAGES.vi` 各 197 キー (base 193 + 言語名 4)
  - 副題は SPEC §8.9.2 採用: 「九九道场 — 快乐记乘法表」「九九道場 — 快樂記乘法表」「구구단 도장 — 곱셈구구를 즐겁게」「Đạo Trường Cửu Chương — Học bảng cửu chương vui vẻ」(タイトル本体は全言語 `kuku-dojo` 不変 / C12-18)
  - endonym 統一: 中文（简体）/ 中文（繁體）/ 한국어 / Tiếng Việt
  - **4 言語は機械翻訳ベース** で公開、ネイティブ訂正は GitHub Issues で募集
- **`detectLang()` の region / script 両対応 FALLBACKS** (SPEC §8.9.3 / 第19回 C19-06):
  - region variant: `zh-HK` / `zh-MO` → `zh-TW`、`zh-SG` → `zh-CN`
  - script tag: `zh-Hans` / `zh-Hans-CN` / `zh-Hans-SG` → `zh-CN`、`zh-Hant` / `zh-Hant-TW` / `zh-Hant-HK` / `zh-Hant-MO` → `zh-TW` (Android 中華圏 / ChromeOS が `zh-Hans-CN` 等を返す経路の対応)
- **`detectLang()` の navigator=null ガード** (第19回 C19-05): `typeof null === "object"` を素通る経路を防御、極端環境での起動失敗を回避
- **言語手動切替**: SettingsModal「くわしい せってい」内の言語セレクタが 3 ボタン → 7 ボタンに拡張 (auto / にほんご / English / 中文（简体）/ 中文（繁體）/ 한국어 / Tiếng Việt)
- **新規テスト**: `tests/util-detectLang.test.mjs` 22 ケース (SUPPORTED 完全一致 / base 部分一致 / region+script FALLBACKS / navigator 異常入力 / 配列重複 / 大文字 SUPPORTED など)
- **新規テスト**: `tests/util-t.test.mjs` に 6 言語スモークテスト (全 197 keys × 6 lang) + 言語別 assertion (home.greeting / answerSuffix / app.subtitle 構造 lock)
- **CI: `validate-i18n.mjs` の zh-CN ⇄ zh-TW 簡繁交差検査** (第19回 C19-15): 既知 problematic pair リスト (设/設, 开/開, 时/時, ...) で簡繁取り違えを機械検出。endonym keys (`settings.lang.name.*`) は除外して偽陽性を回避

### Changed

- **`SUPPORTED_LANGS` を 7 値に拡張**: `["auto", "ja", "en", "zh-CN", "zh-TW", "ko", "vi"]`。Phase D で `es` / `pt-BR` を MESSAGES 追加と同じ commit で 1 行ずつ拡張する運用継続
- **`Settings.lang` typedef** / `Storage.loadLangPreference` JSDoc / `kuku_lang_preference` 値域コメントを Phase C 7 値に同期
- **SPEC §8.9.3 / §8.9.6 / §8.9.7 / §8.9.9** を Phase C 実測値 (426 KB / 1 言語あたり 9 KB) と 7 値に同期更新 (第19回 C19-07)
- **`MESSAGES_RE` を lookahead 化** (SPEC §7.2.1.1 同期責任表): `scripts/validate-i18n.mjs` / `scripts/build-dist.mjs` 両方を属性順非依存に変更。HTML formatter / Prettier の属性 alphabetical sort 耐性を獲得 (第18回 C18-06 / 第19回 C19-10)
- **`applyEffectiveLang(...)` を `Util.applyEffectiveLang(...)` に統一**: index.html 4 箇所を namespace 経由呼出に変更、CLAUDE.md C03-09 規約遵守 (第18回 C18-09 / 第19回 C19-09)
- **`quiz.feedback.wrong.answerSuffix` の構造改修** (第18回 C18-11 / 第19回 C19-11): JSX の hardcoded `{" "}` を削除し、各言語 suffix が必要な leading space を内包する規約に変更 (en/zh-CN/zh-TW/vi は句点で終わり space なし、ja/ko は leading space で span との区切り維持)
- **en `app.subtitle` のネイティブ呼称付与** (第19回 C19-12): `"Multiplication Tables Practice"` → `"Kuku Dojo — Multiplication Tables Practice"`、他 5 言語の「ネイティブ呼称 + " — " + 説明」構造に整合
- **README ロードマップ + 配布版サイズ表記**: v1.3.0 公開日付追記、`約 330 KB` → `約 426 KB` に同期 (第19回 C19-04)
- **CLAUDE.md L157 `kuku_lang_preference` 値域記述** を Phase C 7 値に同期 (第19回 C19-08)

### Internal

- node:test スイート 78 → **104 件** (`util-detectLang.test.mjs` 新規 22 / `util-t.test.mjs` 21→25 / `storage-langPreference.test.mjs` / `storage-loadSettings.test.mjs` の supported 配列を 7 値に拡張)
- `tests/helpers/load-core.mjs`: `setNavigator(nav)` ヘルパー追加 (VM sandbox の navigator 動的差替え用) / `SUPPORTED_LANGS` を export し テスト側のリテラル二重管理を解消 (第19回 C19-22)
- 第19回敵対的レビュー対応: Critical 4 (C19-01〜04) + Major 7 (C19-05〜11) + Minor 11 (C19-12〜21) + Info 6 (C19-22〜28) の **22 件すべて吸収** (詳細は `docs/__archives/report19.md`)
- 配布版サイズ実測: Phase B 完了 394,293 B → **Phase C 完了 436,031 B** (`+41,738 B` ≒ +36 KB / 1 言語あたり 9 KB / 1 MB 警告しきい値の 41.6%、3 MB FAIL の 14%)

### Known limitations / Phase D 以降に繰越

- **C18-12 / C19-17 en 単複未対応**: `"1 questions"` / `"1 days ago"` 等は子供向け平易さ優先で許容、SPEC §8.9.6 に明文化
- **C18-13 / C19-18 en MM/DD 固定**: `login.lastPlayed.dateFormat` の en `"{month}/{day}"` は en-GB / en-AU の DD/MM と曖昧。Phase D で `Intl.DateTimeFormat` 化を検討
- **C18-16 / C19-19 pre-mount `<html lang="ja">` 固定**: 4 言語追加で影響範囲増だが構造的解消アイデア無し、known limitation 維持
- **C18-01 / C19-20 useEffect 1-frame flash**: アカウント切替時の旧言語 1 フレーム描画は Phase D 以降で `useLayoutEffect` / `useSyncExternalStore` 化を検討
- **Step 12.C-6 多言語フォント実機検証 / Step 12.C-7 各言語スクリーンショット**: 残タスク (実機タブレット作業必要)

## [1.2.0] - 2026-04-25

**機能リリース**: 多言語対応 (Phase A: I18n 基盤 + ja / Phase B: en + Login 言語復元) で日本語と英語の 2 言語に対応。アプリの利用可能な言語をブラウザの言語設定から自動判定し、SettingsModal の「くわしい せってい」から手動切替も可能。第18回敵対的レビュー対応 9 件 + ユーザー判断起点の Login 言語復元（案 A）を同梱。**適応出題アルゴリズム本体は変更なし** (proficiencyLevel / updateWeight 不変)、v1.0.x / v1.1.0 の成績データは互換維持で持ち上がります。

### Added

- **多言語対応 Phase A/B** (ja / en の 2 言語、SPEC §8.9)
  - `MESSAGES.ja` / `MESSAGES.en` 計 193 キー (子供向け tone "Nice!" "Awesome!" "Amazing!" "Genius!" "Perfect!" "Legendary!" 等の en 訳)
  - **言語自動検出** (`detectLang`): `navigator.languages` から実装済言語へフォールバック (Phase B 時点 ja / en の 2 値)
  - **言語手動切替**: SettingsModal「くわしい せってい」内に言語セレクタ（auto / にほんご / English の 3 ボタン、Phase C/D で 1 ボタンずつ拡張予定）
  - **`<html lang>` 同期**: `applyEffectiveLang()` で `I18n.current` と `document.documentElement.lang` を同時更新（SR 発音整合 / 第17回 C17-09 吸収）
- **device-level 言語 preference** (`kuku_lang_preference`): Login 画面（Account 未確定時）も最後に確定した言語で起動するよう、device 全体で直近の `Settings.lang` を保持。ja 環境ブラウザで en 設定 Account を使う家庭/学級でも「ログアウト → Login が ja に戻る」UX 退行を解消（v1.2.0 Phase B / 第18回ユーザー判断 案 A 採用）
- **`Util.formatList(items)`**: Intl.ListFormat ベースのリスト連結ヘルパー。retry summary の `dans.join("・")` ja 中黒ハードコードを置換し、ja "3、5、7" / en "3, 5, 7" に locale-aware 化（第18回 C18-02）
- **CI: `scripts/validate-i18n.mjs`**: ja を参照言語として全言語 MESSAGES の (1) key-set 一致 (2) placeholder 整合 (3) 型ガード を検査。`npm test` と `npm run build` の両方に組込み（第18回 C18-03 / C18-04 / C18-05 / C18-15）

### Changed

- **`SUPPORTED_LANGS` を実装済 3 値に縮約**: `["auto", "ja", "en"]` のみ。Phase C/D 未実装 6 言語（zh-CN / zh-TW / ko / vi / es / pt-BR）を SettingsModal 言語セレクタから一時的に除外し、「効かないボタン」UX 退行を回避。Phase C/D で言語追加と同じ commit で 1 行ずつ拡張する運用（第17回 C17-05 / 第18回 C18-14）
- **SPEC §2.2 Settings typedef** / §8.9.3 / §8.9.9 / §7.2.1.1 同期責任表を Phase B 縮約に追従更新

### Internal

- node:test スイート 49 → **78 件**（`util-t.test.mjs` 13→17 / `storage-loadSettings.test.mjs` +1 / `storage-langPreference.test.mjs` 8 ケース新設）
- 第18回敵対的レビュー対応 C18-01 / C18-02 / C18-03 / C18-04 / C18-05 / C18-08 / C18-10 / C18-14 / C18-15 / C18-19 の 10 件 + Login 言語復元（案 A）（詳細は `docs/__archives/report18.md`）

### Known limitations / Phase C 以降に繰越

- **C17-11 useEffect 1-frame flash 未対応**: アカウント切替時に旧言語で 1 フレーム描画される退行は Phase B では解消していない（`applyEffectiveLang` は同期だが useEffect 内で paint 後実行）。複アカ異言語切替の体感影響は 16 ms 程度。Phase C 以降で `useLayoutEffect` 化または `useSyncExternalStore` 化を検討（第18回 C18-01）
- **Pre-mount の `<html lang="ja">` 固定**: React mount より前の loading placeholder / noscript / `<title>` は ja 固定。en ユーザー初回起動時の SR 発音不整合は構造的に解消困難（第17回 C17-14 で割切明文化）
- **複数形は単一形で押通し**: en の "1 questions" / "1 times" / "1 days ago" は子供向け平易さ優先で許容（第18回 C18-12）
- **日付形式は MM/DD 固定**: `login.lastPlayed.dateFormat` en = "{month}/{day}" は US 表記。Intl.DateTimeFormat 化は Phase C 以降で検討（第18回 C18-13）
- **`answerSuffix` 末尾空白**: en で "The answer is 42 " と末尾スペース 1 文字残る（第18回 C18-11）
- **`MESSAGES_RE` 属性順固定**: `type` → `id` の順。属性入替で build throw、silent 退行はしない（第17回 C17-06 / 第18回 C18-06 lookahead 化未実施）
- **`Util.applyEffectiveLang` は bare 呼出**: CLAUDE.md namespace 規約と微差（第18回 C18-09）

### 配布版

- ファイルサイズ: **約 390 KB** (398,973 bytes / SPEC §7.4 の 1 MB zip 予算に対して 38.0% / 3 MB 非圧縮 FAIL の 12.7%)
- `dist/kuku-dojo.html` は [Releases v1.2.0](https://github.com/fk506cni/kuku-dojo/releases/tag/v1.2.0) から入手可能

### 既知の制限

- **実機検証範囲**: en QuizScreen は Chrome で確認済（B-8 解消）。macOS Safari / iPadOS Safari / Firefox / Android タブレット / 色覚シミュレータ / SR 実読み上げ / Phase C 言語追加前の en 全画面回帰検証は v1.2.x パッチで順次消化予定（v1.0.x / v1.1.x の未消化分と合わせて運用）

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

[Unreleased]: https://github.com/fk506cni/kuku-dojo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/fk506cni/kuku-dojo/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fk506cni/kuku-dojo/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/fk506cni/kuku-dojo/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/fk506cni/kuku-dojo/releases/tag/v1.0.0
