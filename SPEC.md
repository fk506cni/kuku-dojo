# 技術仕様書 (SPEC.md) — kuku-dojo

| 項目 | 内容 |
|------|------|
| ドキュメントバージョン | 1.0 |
| 作成日 | 2026-04-15 |
| ステータス | 設計中 |
| 関連 | [docs/九九練習アプリ_要件定義書.md](docs/九九練習アプリ_要件定義書.md) |

---

## 0. 背景・目的

### 0.1 背景

小学生の九九学習は反復練習が要だが、紙のドリルでは「すでにできる問題」と「苦手な問題」を均等に繰り返すため非効率になりがち。家庭学習の現場で個別最適化された反復ができるツールが求められている。

### 0.2 目的

- 苦手問題を自動的に重点出題する**適応型学習**を提供する
- 子供が**1 人で楽しく続けられる**UI・エフェクトを実装する
- インストール不要で即起動できる**単一 HTML ファイル**として配布する

### 0.3 スコープ

- 対象: 1×1 〜 9×9 の 81 問
- ユーザー: 同一 PC 上で複数アカウント切り替え可能
- 通信: 一切なし。完全オフライン

---

## 1. アーキテクチャ

### 1.1 全体構成

本プロジェクトは**開発モード**と**配布モード**の 2 つの成果物を持つ（ハイブリッド 2 モード運用）。

| モード | ファイル | React / Tailwind / Babel の扱い | ネット接続 |
|------|------|------|------|
| 開発 | `index.html` | Play CDN + Babel Standalone で実行時変換 | 初回のみ必要 |
| 配布 | `dist/kuku-dojo.html` | React production min をインライン、Tailwind CLI 生成 CSS をインライン、JSX は Babel CLI で事前コンパイル | **一切不要** |

配布モードが本プロジェクトの最終成果物であり、完全オフライン動作を保証する。開発モードは実装中の利便性のためだけに存在し、利用者に配布するのは常に `dist/kuku-dojo.html`。

```
┌──────────────────────────────────────────────┐
│         dist/kuku-dojo.html (配布版)          │
│  ┌────────────────────────────────────────┐  │
│  │  <style> Tailwind 生成 CSS (~10KB)     │  │
│  │          (tailwindcss CLI で抽出)      │  │
│  │  <script> React/ReactDOM production    │  │
│  │  <script> app.js (Babel 事前コンパイル) │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │    ┌──────────────────────────────┐    │  │
│  │    │ lib: ストレージ / 出題エンジン │    │  │
│  │    │      / エフェクト             │    │  │
│  │    └──────────────────────────────┘    │  │
│  │    ┌──────────────────────────────┐    │  │
│  │    │ components: 5 画面 + 共通    │    │  │
│  │    └──────────────────────────────┘    │  │
│  │    ┌──────────────────────────────┐    │  │
│  │    │ App: ルーティング + Context   │    │  │
│  │    └──────────────────────────────┘    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  localStorage   │
              └─────────────────┘
```

> 開発モードでは `<script type="text/babel">` 内にアプリ本体を書き、ブラウザ側の Babel Standalone が変換する。配布モードでは同じソースを Babel CLI で事前変換してから埋め込むため、**配布版は実行時 JSX コンパイルを行わない**（起動が高速）。

### 1.2 レイヤ分離

| レイヤ | 責務 | 例 |
|------|------|------|
| Storage | localStorage の読み書きラッパ | `loadAccounts`, `saveSession` |
| Engine | 出題アルゴリズム・重み更新 | `pickQuestion`, `updateWeight` |
| Effects | 紙吹雪・サウンド・アニメ | `playConfetti`, `playSound` |
| UI | React コンポーネント | `LoginScreen`, `QuizScreen` |
| App | 画面遷移・グローバル状態 | `App`, `AppContext` |

---

## 2. データモデル

### 2.1 localStorage キー

| キー | 値の型 | 説明 |
|------|------|------|
| `kuku_accounts` | `Account[]` | 全アカウント一覧 |
| `kuku_current_account_id` | `string \| null` | 最後に選択したアカウント ID。リロード時の自動復帰に使用 |
| `kuku_weights_{accountId}` | `WeightMap` | アカウント別問題重み |
| `kuku_sessions_{accountId}` | `SessionResult[]` | アカウント別セッション履歴 |
| `kuku_settings_{accountId}` | `Settings` | アカウント別設定 |
| `kuku_welcomed` | `boolean` | **device-level**（アカウント非依存）。初回起動時のデータ消失注意 (WelcomeNotice) を一度だけ出すためのマーカー |

`kuku_current_account_id` はアカウント選択時に書き込み、ログアウト・アカウント削除時にクリアする。リロード直後は本キーを読み、存在すれば `#/home` へ自動遷移、なければ `#/login` を表示する。これにより 7〜9 歳の子供が F5 を押すたびにログイン画面に戻される UX を防ぐ。

**`kuku_welcomed` がアカウント非依存である理由**（第10回レビュー C10-13 で明文化）: WelcomeNotice の文言は「せいせきは この ブラウザに ほぞんされるよ。ブラウザの おそうじや ひみつモードで あそぶと せいせきが きえる」というブラウザ・端末レベルのデータ永続性に関する注意であり、アカウント固有の情報を含まない。教室・家族共用端末で前の子が既に案内を見ている場合、同じ注意を次の子に再度見せる必要はない（同一ブラウザに対する同一の注意）。端末 1 台 = 案内 1 回で運用する。教室運用ではログアウト時にアカウント削除を行わず、アプリ初回配布時に教師が一度「わかったよ」を押すオペレーションを推奨する。

### 2.2 型定義（JSDoc）

```js
/**
 * @typedef {Object} Account
 * @property {string} id          - UUID
 * @property {string} name        - ニックネーム（最大10文字）
 * @property {number} avatarIndex - アバター番号 (0..N)
 * @property {number} createdAt   - 作成日時 (UNIX ms)
 * // Step 5 以降で SessionResult save 時に account.lastPlayedAt も更新する拡張を検討 (C04-19)。
 * // 現行 Step 3 では LoginScreen が Storage.loadSessions() の最大 timestamp を都度走査して導出。
 * // lastPlayedAt をスキーマに昇格するかは Step 5 着手時に決定する。
 */

/**
 * @typedef {Object<string, number>} WeightMap
 * キー: "{dan}-{multiplier}"（例: "7-8"）, 値: weight (>= 0.5)
 */

/**
 * @typedef {Object} SessionResult
 * @property {string} sessionId
 * @property {number} timestamp
 * @property {number[]} selectedDans
 * @property {number} totalQuestions
 * @property {number} correctCount
 * @property {number} elapsedTime    - 秒
 * @property {QuestionDetail[]} details
 */

/**
 * @typedef {Object} QuestionDetail
 * @property {number} dan
 * @property {number} multiplier
 * @property {number} correctAnswer
 * @property {number} userAnswer
 * @property {boolean} isCorrect
 * @property {number} responseTime   - ms
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} soundEnabled
 * @property {boolean} effectsEnabled
 * @property {number}  volume               - 0.0 - 1.0
 * @property {number}  wrongWeightBoost     - 不正解加算 (+2.0) の倍率 (§3.2 参照)。
 *                                             0.5 (ひかえめ) / 1.0 (ふつう、既定) / 2.0 (しっかり)
 */
```

> **SessionResult / QuestionDetail の mutation 禁止契約**（第06回レビュー C06-13）: 呼び出し側（ResultScreen / StatsScreen）はこれらのオブジェクトおよび配列を **in-place で書き換えてはならない**（`sort` / `reverse` / `splice` / プロパティ再代入 いずれも禁止）。読み取り専用で扱い、加工が必要なら `.slice()` / `[...arr]` / `{ ...obj }` で浅コピーしてから操作する。`Storage.loadSessions` が返す配列は localStorage から `JSON.parse` された新規オブジェクトだが、同一セッション中に複数画面で共有するケースに備えて契約として明示する。`elapsedTime` は秒単位で **最小 1**（C06-09）とし、0 秒セッションが保存されないよう QuizScreen 側で `Math.max(1, ...)` クランプする。

### 2.3 デフォルト値

| 項目 | 値 |
|------|------|
| 重み初期値 | 1.0 |
| 重み下限 | 0.5 |
| 重み上限 | 10.0 |
| 不正解時加算 | +2.0 |
| 正解時減算 | -0.3 |
| 既定問題数 | 27 |
| 問題数範囲 | 10 - 81 |
| 既定段選択 | 全段（1-9） |
| サウンド初期 | ON |
| エフェクト初期 | ON |
| 音量初期 | 0.4 |
| wrongWeightBoost 初期 | 1.0 (ふつう) |
| wrongWeightBoost 選択肢 | 0.5 (ひかえめ) / 1.0 (ふつう) / 2.0 (しっかり) |
| セッション履歴上限 | 100 件／アカウント |

### 2.4 ストレージ例外方針

すべての localStorage 読み書きは storage 層のラッパー関数を経由し、生 API を直接叩かない。ラッパーは以下の契約を満たすこと。

| 例外 | 原因 | ラッパーの挙動 |
|------|------|------|
| `QuotaExceededError` | 5MB 上限超過 | 当該アカウントの古いセッション履歴を 10 件削除して再試行。再試行も失敗したらユーザーに「ほぞん できなかったよ」と子供向け通知を出す |
| プライベートブラウズで書き込み不可 | Safari プライベートモード等 | 起動直後の読み込み試行時に検出し、ログイン画面下部に「このブラウザでは せいせきが ほぞん できません」と表示 |
| `SyntaxError`（JSON.parse 失敗） | データ破損 | 該当キーを破棄して初期値を返す。破棄の事実を `console.warn` に記録 |
| `SecurityError` | オリジン制限・拡張機能干渉 | 同上（初期値フォールバック） |

ラッパーの戻り値は常に「値もしくは安全な初期値」とし、**呼び出し側に例外を伝播しない**。ただし書き込み時の失敗は UI 層に通知する経路を持たせる（Context の `onStorageError` ハンドラ経由）。

### 2.5 `deleteAccount` の契約

アカウント削除時は、対象 `accountId` に関連する**すべての `kuku_*` キーを破棄する**:

- `kuku_accounts` から該当エントリを除去
- `kuku_weights_{accountId}` を削除
- `kuku_sessions_{accountId}` を削除
- `kuku_settings_{accountId}` を削除
- `kuku_current_account_id` が削除対象と一致する場合は `null` に戻す

将来キーが追加された場合も、`kuku_*_{accountId}` パターンに一致するすべてを掃除する実装にしておく（列挙漏れ防止）。

---

## 3. コアロジック仕様

### 3.1 出題エンジン (`pickQuestion`)

```text
入力: selectedDans: number[], weights: WeightMap, recent: string[]
出力: { dan, multiplier }

手順:
  0. 空配列フォールバック:
     selectedDans.length === 0 のときは [1,2,3,4,5,6,7,8,9] として扱う。
     （UI 側でも同等の補正を行うが、エンジンも自己防御する）
  1. 候補プール = selectedDans の各段 × 1..9 の組み合わせ
  2. recent（直前2問のキー）に含まれる組み合わせを除外
     ただし候補が空になる場合は除外しない
  3. 各候補 i に重み w_i = weights["{dan}-{m}"] (なければ 1.0) を割当
  4. 累積重み配列を作り、Math.random() * total で抽選
  5. 該当する候補を返す
```

> 「選択段が空なら全段」は UI とエンジンの**二重保証**とする。ホーム画面のバリデーションが将来改変されてもエンジン側でランタイムエラーにならないようにするため。

### 3.2 重み更新 (`updateWeight`)

```text
入力: weights, dan, multiplier, isCorrect, wrongWeightBoost
出力: weights (新オブジェクト、元を破壊しない)

  key = `${dan}-${multiplier}`
  current = weights[key] ?? 1.0
  next = isCorrect ? current - 0.3 : current + 2.0 * wrongWeightBoost
  weights[key] = clamp(next, 0.5, 10.0)   // 下限 0.5 / 上限 10.0
```

**`wrongWeightBoost` (Settings §2.3)**: 不正解加算の倍率。0.5 (ひかえめ) / 1.0 (ふつう、既定) / 2.0 (しっかり) から選択。SettingsModal の「にがて もんだい でやすさ」プリセットで変更可能。既定 1.0 は従来挙動と互換。

- **ひかえめ (0.5)**: 不正解 +1.0/回。重み 10.0 到達まで 9 連続不正解が必要で、ゆっくり苦手問題が増える。出題頻度の偏りを嫌う子供・保護者向け
- **ふつう (1.0)**: 不正解 +2.0/回。仕様初版の値。SPEC §3.2 収束挙動の既定
- **しっかり (2.0)**: 不正解 +4.0/回。3 連続不正解で重み上限 10.0 (1.0 → 5.0 → 9.0 → 10.0) に到達し、苦手問題の再出題がかなり強まる

正解側の減算 -0.3 は 3 プリセット共通で固定。非対称 (苦手側は可変 / 得意側は固定) なのは、苦手判定の積極的な集中練習と、得意判定の慎重な格下げのバランスを保つため (§3.3 L1/L2 が OR で早期救済する思想と整合)。

> **収束挙動の注意**: 全問正解を繰り返すと全 81 問の重みが下限 0.5 に張り付き、均等出題に収束する。これは「苦手問題重視」という適応機構の帰結として許容する。得意問題の忘却防止は将来の別機構（時間減衰など）で対応する余地を残す（§8 将来拡張）。

> **上限値の根拠**（第03回レビュー C03-07）: 上限 10.0 は「`proficiencyLevel` L1 苦手判定の閾値 2.0 を 5 倍に上回る値で、苦手分類としての意味を超えない」「Stats 画面で重みを表示する際の桁数を抑える（最大 4 桁）」「不正解 5 連続でも上限到達せず、重みの動的応答性を保つ（1.0 → 3 → 5 → 7 → 9 → 10）」のバランスから設定。SPEC §2.3 デフォルト値表と整合。

### 3.3 習熟度マップ算出

各 (dan, m) について「直近 N セッションでの正答率」と「現在の重み」から、5 段階で色分けする。

| レベル | ラベル | 色（参考） | 判定条件 |
|------|------|------|------|
| 0 | 未挑戦 | グレー #E5E7EB | 直近 N セッションで出題 0 回、または総挑戦回数 0 |
| 1 | 苦手 | レッド #FCA5A5 | 重み ≥ 2.0 または 直近正答率 < 40% |
| 2 | 要練習 | オレンジ #FDBA74 | 重み ≥ 1.2 または 直近正答率 < 70% |
| 3 | 普通 | イエロー #FDE68A | L1 / L2 / L4 のいずれにも該当しないすべて（包括ルール） |
| 4 | 得意 | グリーン #86EFAC | 重み ≤ 0.6 かつ 直近正答率 ≥ 90% |

- N（参照セッション数）の初期値は 5
- 上の条件は**上位（未挑戦）から順に評価**し、最初にマッチしたレベルを採用する（苦手条件が最優先）
- L3 は「上位 L1 / L2 にも下位 L4 にも該当しない中間状態すべて」を吸収する**包括ルール**として定義する。例えば `重み 0.5 ∧ 正答率 0.85`（重みは下限張り付きだが正答率がまだ 90% 未満）や `重み 0.7 ∧ 正答率 0.95`（中間域の重みで高正答率）は L3 とする。これは閾値表の表面的な「重み > 0.6 かつ 正答率 < 90%」式では拾えない領域を**意図的に L3 に集約**する設計判断である（第03回レビュー C03-02）
- L1 / L2 が `または` で苦手側を**早期救済**するのに対し、L4 は `かつ` で得意側を**慎重に格上げ**する。この非対称性は「子供を苦手判定で取りこぼさず、得意判定では確証を求める」という適応学習の原則による
- 「直近正答率」は直近 N セッション内の該当問題の挑戦分のみを母数とする。母数 0 のときは「未挑戦」扱い
- 閾値は初版固定。将来ユーザーテストで調整する場合は SPEC.md を改訂する

---

## 4. 画面仕様

### 4.1 画面一覧と URL（ハッシュルーティング）

本プロジェクトは**5 画面構成**とする（要件定義書 §3.2 の 4 画面記述とは異なり、結果サマリーを独立画面として扱う。SPEC.md を正とする）。

| 画面 | route | 主要状態 |
|------|------|------|
| ログイン | `#/login` | accounts |
| ホーム | `#/home` | currentAccount, selectedDans, totalQuestions |
| 試験 | `#/quiz` | currentQuestion, progress, combo |
| 結果サマリー | `#/result` | session |
| 成績 | `#/stats` | sessions, weights |

> ハッシュルーティングは `file://` でも動かすための選択。React Router は使わず自前で管理する。`useHash()` カスタムフックで `window.location.hash` と `hashchange` イベントを購読し、`App` コンポーネントが現在の route に応じて 5 画面を出し分ける。骨格は Step 0 の足場で導入し、Step 3 以降で各画面を埋めていく。

遷移時は `window.location.hash = '#/home'` 直接代入（= `history.pushState` 相当）を用いる。`history.replaceState` が必要な場面は「ログイン直後の自動遷移」「結果サマリーからホームに戻る」等、**戻るボタンで前画面に戻るべきでない遷移**のみに限定する。

### 4.2 共通コンポーネント

- `MascotCharacter` — 状態 (idle/happy/sad/celebrate) を props で受け取り表示
- `ConfettiCanvas` — マウント時にパーティクル発生、フェードアウト後 unmount
- `BigButton` — 48px 以上の大型ボタン
- `Furigana` — 漢字+ふりがな表示用（必要に応じて）

### 4.3 試験画面の状態遷移

```
[出題] → [入力中] → [回答確定]
                       ├─ 正解 → [正解エフェクト] → 次の問題 (自動 800ms)
                       └─ 不正解 → [不正解表示] → ユーザーが「つぎへ」
                                                 → 次の問題
全問終了 → [結果サマリー]
中断 → [ホーム]
ブラウザ戻る → [中断確認ダイアログ]
```

**ブラウザ戻るボタンの扱い**: 試験中に `popstate` を検知したら、`preventDefault` 的な挙動はブラウザ上できないため、代わりに「中断してもよいですか？」確認ダイアログを表示する。`キャンセル` なら `history.pushState('#/quiz')` で現在の画面に戻し、`はい` なら未完了セッションを破棄して `#/home` に遷移する。未完了セッションは **localStorage に保存しない**（中途半端な成績が残らない）。

**`#/quiz` → `#/result` / `#/home` 遷移の実装契約**（第06回レビュー C06-02）:

- QuizScreen は完了・中断時に `window.location.replace(...)` を使わず、`history.replaceState({ kukuExhausted: true }, "", "#/quiz")` でバッファエントリにマーカーを書き込んだ上で `history.pushState(null, "", nextHash)` + `window.dispatchEvent(new Event("hashchange"))` で次画面へ遷移する。`replace` は state を null 上書きしてマーカーを失わせるため使用しない。
- QuizScreen マウント時は `window.history.state` を確認し、`kukuExhausted === true` なら新規セッションを開始せずに `window.location.replace("#/home")` で退避する（`#/result` から back で戻ってきた場合の再マウント対策）。
- なお HomeScreen `handleStart` の `hash="#/quiz"` 経由で生成される中間エントリには本マーカーが付かないため、`#/result` → back → back → back の連打で到達する最奥の `#/quiz` エントリは新規セッションとして起動する。これは hash routing + pushState バッファ構造の既知制約であり、Step 6 ResultScreen の「ホームへ / もういちど」導線で十分カバーできる範囲とする。

**iOS Safari / iPadOS Safari のエッジスワイプ既知制約**（第06回レビュー C06-03）:

iOS Safari・iPadOS Safari のエッジスワイプによる back 操作は、`history.pushState` によるバッファリングを素通りして先に `hashchange` を発火させる場合がある（WebKit 既知の挙動）。このときは中断確認ダイアログが表示されずにそのまま前画面に戻るが、未完了セッションは localStorage に保存されない契約のため**成績データの喪失以上の被害は発生しない**。物理戻るボタンと仮想戻るボタンでは本制約は発生しない。iOS 利用者向けドキュメントで「エッジスワイプで離脱すると確認ダイアログが出ない」旨を補足すること。

---

## 5. 子供向けエフェクト仕様

### 5.0 光過敏性（てんかん）配慮

本アプリは 7〜9 歳の不特定多数の子供が利用するため、光過敏性発作（PSE）のリスクを最小化する設計を**必須要件**として課す。WCAG 2.3.1（Three Flashes or Below Threshold）に準拠する。

- **点滅周波数**: 画面全体または画面の 25% を超える面積で **3Hz を超える点滅を行わない**
- **輝度差**: 強いフラッシュ（白⇄黒の急峻な切替）を避ける。色相変化やフェードで代替する
- **ストロボ様アニメ禁止**: 連続する高輝度閃光・放射状ズームの連続発生は実装しない
- **アニメ最長**: 個別エフェクトは 1.5 秒以内に終息する（長時間の刺激を避ける）
- **色の彩度**: 原色の高彩度ベタ塗りではなく、パステル調（レイヤー #200 〜 #400 程度）を基本とする
- **設定 OFF の尊重**: `Settings.effectsEnabled === false` のときはすべての視覚演出を無効化し、テキスト表現（「○」「×」「せいかい！」）のみに退行する

**カスタム keyframes を書くときの具体ルール**（第01回レビュー C01-16 で確立）:

- `animation-duration` を 0.33 秒未満にしない（1 周期 0.33 秒 = 3Hz 相当）
- `animation-iteration-count: infinite` を使うのは呼吸・波紋など **1Hz 以下**の穏やかな動きだけ
- 点滅・明滅は `opacity` の補間で表現し、`background-color` の白⇄黒交互切替は禁止
- `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }` を `<style>` 冒頭に必置
- Tailwind デフォルトの `animate-bounce`（1s 周期）/ `animate-ping`（1s 周期）/ `animate-pulse`（2s 周期）/ `animate-spin`（1s 周期）は全て条件内で使用可

上記は Step 5（QuizScreen 基本機能）の時点から意識し、Step 7（エフェクト統合）のチェックリストでも再確認する。

**`effectsEnabled === false` の反映範囲**（第06回レビュー C06-07）:

Step 5 時点の QuizScreen には個別エフェクトが未実装のため、`transition-colors` / `transition-all` は常時発動でよい（フェード 150ms はパステル域で PSE リスクなし）。Step 7 で `ConfettiCanvas` / `MascotCharacter` / `SoundPlayer` / コンボ演出等を追加する際は、各エフェクトコンポーネントが `useContext(AppContext).settings.effectsEnabled` を参照して早期 return する設計とし、QuizScreen 自身は transition クラスを維持する（Settings OFF は「派手な演出を止める」であって「色フェードまで消す」ではない）。`SoundPlayer` は別途 `settings.soundEnabled` を参照する。

### 5.1 視覚

| トリガ | エフェクト | 実装方針 |
|------|------|------|
| 正解 | 紙吹雪（10〜30 粒）, ○マーク拡大, 数字バウンド | Canvas + Tailwind animate |
| 不正解 | マスコットしょんぼり（目を閉じる表情、励まし語「おしいっ」）, 画面わずかにシェイク（5〜8px, 1 往復）, 正答ハイライト | CSS keyframes |
| 連続 3 回不正解 | 励ましトースト「いっしょに がんばろう！」（否定語を避ける） | Tailwind transition |
| コンボ +1 | 数字カウンタ拡大, ☆ 追加 | Tailwind transition |
| 5 連続 | 大きな星バースト + マスコットジャンプ（ジャンプ高さ控えめ、1 往復のみ） | Canvas |
| セッション完了 | 大紙吹雪 + 結果カードがフェードイン + 星のレーティング | Canvas + Tailwind |

不正解時の表現は「子供の自己肯定感を下げない」トーンを優先する。否定語（「まちがい」「だめ」）の直接表示は避け、「おしい」「もうちょっと」「いっしょに」等の寄り添う言葉を使う。

### 5.2 サウンド（Web Audio API）

| 種類 | 実装 |
|------|------|
| 正解 | 三和音（C-E-G）短く |
| 不正解 | やや低い 1 音、減衰早め |
| ボタン押下 | 軽いクリック音 |
| 完了ファンファーレ | 4-5 音シーケンス |

外部音源ファイルは使わず、`OscillatorNode` で生成（ファイルサイズと依存を避けるため）。

**AudioContext のライフサイクル**:

iOS Safari / macOS Safari / 近年の Chrome は、ブラウザ起動直後の `AudioContext` を **suspended 状態**で生成する（自動再生ポリシー）。ユーザーの最初の操作で `resume()` を呼ばない限り無音になる。これを避けるため:

- `AudioContext` は**アプリ起動時ではなく、最初のユーザー操作（`pointerdown` / `keydown` / `touchstart`）で遅延生成**する
- 既に生成済みで `ctx.state === 'suspended'` なら `ctx.resume()` を呼ぶ
- SoundPlayer はシングルトンで、`resume()` 済みフラグをメモリ上に保持（リロードで再初期化）
- ログイン画面のアカウントカードタップが「最初のジェスチャ」になるケースが多いため、Step 3 のログイン画面実装時点で resume フックを仕込む

これを守らないと iPad Safari で「音だけ鳴らない」現象が発生し、子供が設定ミスか実装バグか切り分け不能になる。

### 5.3 マスコット

- 仮称「くくちゃん」
- 表現: 絵文字（🐱🐶🐰など）から開始 → 余裕があれば SVG で差し替え
- 状態: `idle` / `happy` / `sad` / `celebrate` / `thinking`

**マスコットとアカウントアバターの関係** (C04-18):

Step 3 LoginScreen では 8 種類のアバター絵文字（🐱🐶🐰🐼🦊🐸🐯🐻）を `LOGIN_AVATARS` として定義している。これらは**各アカウントの個人アバター**であり、画面全体の進行役である「くくちゃん」とは別概念として扱う。

- **くくちゃん (Mascot)**: 全画面共通の進行役。Step 7 `MascotCharacter` コンポーネントとして状態遷移付きで実装
- **アバター (LOGIN_AVATARS)**: アカウント個別の識別子。ログイン・ホーム・結果画面で本人識別のために表示

Step 7 でマスコット絵文字を決定する際は、LOGIN_AVATARS と**被らない 1 種類**（例: 🦉 / 🐹 等）を選ぶか、あるいは「くくちゃんはアバターと同じ絵文字に追従して表情だけ変える」方針のどちらかを採用する。初版は前者（独立絵文字）を推奨。

**状態遷移表**（`MascotCharacter` コンポーネントの props として `state` を渡す）:

| イベント | 遷移先 | 持続時間 | 備考 |
|------|------|------|------|
| 画面マウント（ホーム・成績） | `idle` | 常時 | 呼吸アニメーションのみ |
| 問題表示直後（試験画面） | `thinking` | 入力開始まで | 目を細める表情 |
| 入力中 | `thinking` | 回答確定まで | 同上 |
| 正解 | `happy` | 800ms | `idle` に戻る |
| 不正解 | `sad` | ユーザーが「つぎへ」を押すまで | 目を閉じた表情 + 励まし語 |
| 3 連続正解 | `celebrate` | 1200ms | 小ジャンプ 1 回 |
| 5 連続正解 | `celebrate` | 1500ms | 大ジャンプ 1 回 + 星バースト |
| セッション完了（正答率 ≥ 80%） | `celebrate` | 1500ms | 大紙吹雪と同期 |
| セッション完了（正答率 < 80%） | `happy` | 1500ms | 「がんばったね」トースト |
| ログイン画面表示 | `idle` | 常時 | — |

状態は React の `useState` で管理し、`setTimeout` で自然に `idle` に戻す。**`celebrate` 中に次の `celebrate` が来た場合は上書きせず、現在のアニメ完了を待つ**（視覚的混乱を避ける）。

### 5.4 設定で OFF にできること

`Settings.soundEnabled` / `Settings.effectsEnabled` で全体オフ可能。OFF 時はテキスト表現 (「○」「×」「せいかい！」) のみ。

---

## 6. 非機能要件

### 6.1 性能・UX

| 項目 | 要求 |
|------|------|
| 問題遷移 | 200ms 以内 |
| 起動時間（配布版 `dist/kuku-dojo.html`） | 初回 2 秒以内。実行時 JSX コンパイルなし |
| 起動時間（開発版 `index.html`） | 初回 5 秒以内（Babel Standalone による JSX 変換込み）、2 回目以降 3 秒以内 |
| 対応デバイス | デスクトップ / タブレット |
| アクセシビリティ | 文字 16px+, 問題 32px+, ボタン 48px+, 色だけに依存しない |
| 言語 | 日本語・ひらがな主体 |

> 配布版は Babel の実行時変換を含まないため、非機能要件として「2 秒以内」は現実的に達成可能。一方、開発版は Babel Standalone のコンパイル時間が加わるため別基準とする。Step 0 時点で起動時間を計測する習慣を付け、Step 7 以降の退行を早期検知すること。

#### 6.1.1 起動時間の計測指標と手順

起動時間の定義が曖昧なまま「目標 5 秒以内」だけを掲げると退行検知が不可能になるため、以下を計測の**唯一の公式指標**として固定する。

**2 指標を同時に記録する**:

| 指標 | 計測範囲 | 用途 |
|------|---------|------|
| `js` | `<script type="text/babel">` 先頭 (`kuku-app-script-start`) → `App` マウント (`kuku-app-mounted`) | Babel Standalone 変換 + React 初回レンダ。**headless Chrome でも安定して実時間を反映**するため、自動退行検知の主指標として使う |
| `total` | `navigationStart` → `App` マウント (`performance.now()`) | HTML パース + CDN ダウンロード + `js` を含む全体。**SPEC.md §6.1 の「起動 5 秒以内」目標に対応**する。ただし実ブラウザで計測する必要がある（下記注意参照） |

`index.html` は両指標を同時に `console.info("[kuku-dojo] startup:", "total=XXXms", "js=XXXms")` で出力する。

**⚠️ headless Chrome での total 計測の制約**:

headless Chrome (`--headless --dump-dom`) でローカル計測した場合、**`total` 値は Chrome プロセスのバックグラウンドサービス初期化に起因する 15〜25 秒の固定オーバーヘッドが上乗せされ**、実ユーザーがダブルクリックで開いたときの体感起動時間とは大きく乖離する。一方で `js` 値は Chrome プロセスの状態に影響されず、Babel + React の純粋な処理時間を捕捉する。

- **自動テスト（CI / ローカルスクリプト）**: `js` 値のみを使う。閾値は開発版 1000ms 以内、配布版 200ms 以内
- **本物のベースライン記録**: 実ブラウザ（Chrome / Edge / Firefox のデスクトップ版）を**通常起動**し、DevTools コンソールに出る `total` 値を記録する。閾値は開発版 5000ms 以内、配布版 2000ms 以内

**自動出力**:

- `index.html` は起動直後に `console.info("[kuku-dojo] startup: total=XXXms js=XXXms")` を出力する
- 開発者はブラウザの DevTools コンソールを開くだけで当該セッションの両指標を目視できる
- `scripts/measure_startup.sh` で headless Chrome による `js` 値の自動計測が可能（退行検知用）

**DevTools での詳細計測手順**（ベースライン記録時）:

1. Chrome または Edge でシークレットウィンドウを開く（拡張機能やキャッシュの影響を避けるため）
2. DevTools を開き、**Performance** タブに移動
3. `index.html` を `file://` で開く、または `python3 -m http.server 8000` 経由で開く
4. DevTools 上部の **Reload (⟳)** ボタンを押して録画を開始
5. 画面に「くくどうじょう」が表示されたら録画停止
6. **Timings** レーンに `kuku-app-script-start` と `kuku-app-mounted` のマークが表示されていることを確認
7. 両マークの間隔（= `kuku-startup` の duration）を記録

**ベースライン記録先**:

- Step 0 〜 Step 10 のベースライン値は `README.md` の「開発者向け」セクション内のベースライン表に転記する
- `js` 値は `scripts/measure_startup.sh` で自動計測可能（Step 0 時点で確定済み: **js=6ms**）
- `total` 値は実ブラウザでの手動計測を推奨（headless では不正確）
- Step 7（エフェクト統合）以降で Step 0 比 +50% を超える `js` の退行が発生したら、該当 Step のセッション内で原因調査すること

**目標値（再掲）**:

| 指標 | 開発版 | 配布版 |
|------|--------|--------|
| `js` (自動退行検知) | ≤ 1000 ms | ≤ 200 ms |
| `total` (実ブラウザ体感) | 初回 ≤ 5000 ms / 2 回目以降 ≤ 3000 ms | ≤ 2000 ms |

> **注**: Chrome DevTools の Performance タブが示す `FCP`（First Contentful Paint）は本アプリの場合、CDN フォールバック表示が先に描画されるため `kuku-startup-js` より早い値になる。`FCP` は「最初のインク時間」として参考値にとどめ、退行検知の主指標としては使わない。

### 6.2 対応ブラウザ × 実行プロトコル マトリクス

| ブラウザ | `file://` （ダブルクリック） | `http://localhost` （`python3 -m http.server`） |
|------|------|------|
| Chrome（最新） | ◎ 完全サポート | ◎ 完全サポート |
| Edge（最新） | ◎ 完全サポート | ◎ 完全サポート |
| Firefox（最新） | ◎ 完全サポート | ◎ 完全サポート |
| Safari（macOS/iPadOS 最新） | △ localStorage が利用不可になる設定あり。**推奨しない** | ◎ 完全サポート |

**Safari 利用者向けの運用**: README.md の「使い方」セクションで、`python3 -m http.server 8000` で起動してから `http://localhost:8000/kuku-dojo.html` を開く手順を併記する。Safari の `file://` 起動は配布版のマニュアルテスト項目から除外し、代わりに `http://localhost` 起動の動作確認を必須とする。

`file://` でも以下のブラウザ API はすべて動作することを確認済み想定:

- localStorage（Safari を除く）
- Web Audio API（`OscillatorNode` 生成、`AudioContext.resume()`）
- Canvas 2D context（紙吹雪描画）
- `hashchange` / `popstate` イベント（ハッシュルーティング）

### 6.3 複数タブ同時起動の方針

第01回レビュー C01-14 で検討した結果、以下を初版の公式方針とする。

- **複数タブ同時起動は保証外**とする。同一ブラウザで `index.html` / `dist/kuku-dojo.html` を 2 タブ以上で開いた場合の挙動は未定義
- 片方のタブで試験中にもう片方のタブでアカウント削除・設定変更等が行われた場合、試験中タブの React state と localStorage の内容が乖離する可能性がある
- 将来 `window.addEventListener('storage', ...)` を用いたクロスタブ同期を実装するかは Step 10 以降で再評価
- 対象ユーザー（7〜9 歳）が複数タブを同時に運用するケースは稀と見なし、初版では割り切る

---

## 7. 制約・前提

### 7.1 配布形態

- **配布物は常に `dist/kuku-dojo.html` の単一 HTML ファイル**。ダブルクリックで起動し、起動後の外部通信は一切発生しない
- 配布版の生成にのみ Node 環境とビルドスクリプト（Tailwind CLI / Babel CLI）を使用する。**利用者には Node は不要**
- 重厚なビルドツール（Vite, webpack, esbuild 等）は使用しない。`scripts/build-dist.mjs`（~230 行、第11回レビュー時点）で JSX 事前コンパイル / Tailwind CLI 呼出 / インライン化 / smoke test / CSP 注入 / `console.info` 除去を行う（C11-17）
- 開発版 `index.html` は CDN 経由で動作するが、これは実装中の利便性のためだけに存在し、**エンドユーザーへの配布対象ではない**

### 7.2 ビルドパイプライン

配布版生成の流れ:

```
index.html (JSX 入り)
     │
     ├──(1) Tailwind CLI で使用クラス抽出 ──→ dist-tmp/tailwind.css
     │       npx tailwindcss -i base.css -o dist-tmp/tailwind.css \
     │         --content index.html --minify
     │
     ├──(2) Babel CLI で JSX → JS 事前コンパイル ──→ dist-tmp/app.js
     │       npx babel src/app.jsx --presets @babel/preset-react \
     │         -o dist-tmp/app.js
     │       （または index.html 内の <script type="text/babel"> を
     │         ビルドスクリプトが抜き出して Babel に渡す）
     │
     ├──(3) React/ReactDOM production min を同梱
     │       vendor/react.production.min.js
     │       vendor/react-dom.production.min.js
     │       （npm install 時に node_modules からコピー）
     │
     └──(4) ビルドスクリプトが (1)〜(3) を HTML テンプレートに
            インライン埋め込み ──→ dist/kuku-dojo.html
```

依存バージョンは `package.json` で固定する（例: `react@18.2.0`, `@babel/core@7.x`, `@babel/preset-react@7.x`, `tailwindcss@3.x`）。

#### 7.2.1 Tailwind CLI `--content` の制約と動的クラス禁止

Tailwind CLI の `--content index.html` は**正規表現ベースの文字列マッチ**でクラスを抽出する（`/[^<>"'\`\s]*[^<>"'\`\s:]/g` 相当）。テンプレートリテラルの変数展開・文字列連結で構築されるクラス名は検出できず、配布版 CSS で欠損してレイアウト崩れを起こす。

- **禁止構文**: `` `bg-${color}-500` ``、`"bg-" + color + "-500"`、部分文字列の `join(" ")`
- **推奨構文**: 三項演算子の各枝に完全な class 文字列を書く（詳細は `CLAUDE.md` の「Tailwind クラスの記述ルール」参照）

**ビルド前の smoke test**（Step 10 で自動化するまでの手動手順）:

```bash
# index.html 内のクラスが Tailwind CLI で正しく抽出されることを確認
npx tailwindcss -i /dev/stdin -o /tmp/kuku-probe.css \
  --content index.html --minify <<< '@tailwind base; @tailwind components; @tailwind utilities;'

# 必須クラスが含まれるかを grep で確認
grep -c 'bg-white/70\|backdrop-blur\|from-slate-50\|to-indigo-100\|bg-gradient-to-br' /tmp/kuku-probe.css
# → 5 以上が返れば OK
```

Step 10 のビルドスクリプト `scripts/build-dist.mjs` に同等の検証ロジックを組み込み、既知必須クラスが欠損していたらビルドを失敗させること（第01回レビュー C01-04）。

#### 7.2.1.1 ビルドパイプラインの同期責任（第11回レビュー C11-15）

以下の値は複数ファイルに分散するため、**変更時は全箇所を同時に更新してレビュー時に突合すること**。片方のみ更新で発生するドリフトを防ぐ。

| 値 | 単一 source of truth | 参照箇所 |
|------|-----------------------|----------|
| バージョン | `package.json` の `"version"` | `scripts/build-dist.mjs` が `readFileSync(PACKAGE_JSON)` で読み込み、`scripts/create_package.sh` が `node -p "require(...).version"` で読み込み（C11-07 / C11-21 対応） |
| 必須 Tailwind クラス 5 個 | `scripts/build-dist.mjs` `REQUIRED_PATTERNS` | SPEC.md §7.2.1 のサンプルコマンド |
| CSP meta | `scripts/build-dist.mjs` `cspMeta` | SPEC.md §7.2.2 の完全テキスト |
| ファイルサイズ予算 500KB | `scripts/build-dist.mjs` `SIZE_BUDGET` | `scripts/create_package.sh` の 500KB 警告閾値 / SPEC.md §7.4 |
| HTML テンプレートマーカー | `index.html` `<!-- KUKU-HEADER-START -->` / `<!-- KUKU-CDN-START -->` | `scripts/build-dist.mjs` の置換 regex（C11-03 / C11-10 対応） |

#### 7.2.2 Content-Security-Policy の方針

第01回レビュー C01-18 を受け、CSP meta は以下の方針で扱う。

- **開発版 `index.html`**: Babel Standalone が内部で `new Function()` を使うため `'unsafe-eval'` が必須、Tailwind Play CDN は実行時に `<style>` をインジェクトするため `'unsafe-inline'` が必須となり、**厳格な CSP を設定しても実質的な守りにならないため CSP meta は付けない**
- **配布版 `dist/kuku-dojo.html`**: 外部 fetch ゼロ・Babel 実行時変換なしのため、Step 9 の仕上げ工程で以下の厳格な CSP を付加する
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none';">
  ```
- 両モードとも `<meta name="referrer" content="no-referrer">` は付ける（開発版にも既に適用済み）

### 7.3 動作保証範囲

- `file://` での起動を**第一級サポート**とする。ただし Safari `file://` は localStorage 分離に既知の問題があるため、Safari 利用者向けには `python3 -m http.server` 起動を README.md で併記する
- `http://localhost` 起動は全ブラウザで完全サポート
- Service Worker は利用しない（`file://` で動作しないため）

### 7.4 その他

- localStorage 容量上限 (5MB) を超えないようセッション履歴は最大 100 件で打ち切る（1 セッション ≒ 10KB × 100 件 ≒ 1MB/アカウント）
- 配布物のファイルサイズ目標: 500KB 未満（React 150KB + ReactDOM 130KB + Tailwind 10KB + app.js 50〜150KB 想定）

### 7.5 リリース基準とバージョニング（第11回レビュー C11-01）

セマンティックバージョニングに従う（`MAJOR.MINOR.PATCH`）。各リリースの刻印基準は以下。

| バージョン階層 | 刻印基準 | 承認単位 |
|----------------|---------|---------|
| `1.0.0` | (1) 自動検証（ビルド成功 / オフライン性 / 500KB 未満 / 起動 2 秒以内） (2) Windows Chrome/Edge の実機検証 (3) 敵対的レビュー Major/Critical ゼロ | Major リリース |
| `1.0.x` パッチ | 1.0.0 に加え、順次消化した実機検証（macOS Safari / iPadOS Safari / Firefox / Android / SR / 色覚シミュレータ）の完了報告 | 追加検証完了ごと |
| `1.y.0` マイナー | 1.0.0 基準 + 機能追加の自動テスト（将来の Vitest 整備後） | 機能追加時 |
| `2.0.0` メジャー | 1.0.0 基準 + 主要 UX / データ構造の非互換変更（例: Settings マイグレーション非互換） | 破壊的変更時 |

**刻印の同期箇所**（変更時はすべて同時更新）:

- `package.json` `"version"` — 単一 source of truth
- `scripts/build-dist.mjs` — `package.json` から自動抽出（C11-07 対応）
- `scripts/create_package.sh` — `package.json` から `node -p` で抽出（C11-07 / C11-21 対応）
- `index.html` / `dist/kuku-dojo.html` ヘッダコメント — build-dist.mjs が配布版に注入、開発版 index.html は手動更新
- `README.md` ベースライン表 / 既知制限事項 — 手動更新

**実機検証が未消化の段階で `1.0.0` を刻印することは許容する**が、README 既知制限事項に「検証済みブラウザ範囲」を明記すること。1.0.0-rc を経由する運用は本プロジェクトでは採用しない（個人配布のため簡素化）。

---

## 8. 既知の検討事項と将来拡張

- **CDN 依存問題**: §7.1〜§7.2 のハイブリッド 2 モード運用で解決済み。初版から Tailwind CLI / Babel CLI による事前ビルドで `dist/kuku-dojo.html` を生成する方針
- **データエクスポート**: 要件では将来拡張だが、ブラウザデータ消去時のリスクが大きいので早期実装も検討
- **マスコットデザイン**: 著作権フリーの絵文字採用が無難。SVG 化は最終工程
- **音量初期値**: 0.4（§2.3 デフォルト値参照、深夜利用想定）
- **Safari `file://` の localStorage**: §6.2 の通り `http://localhost` 経由起動を併記することで回避。配布前にマニュアルテストで確認
- **全網羅モード（将来拡張）**: 現行の重み付き抽選では 1 セッション 81 問でも全 81 問を網羅する保証がない。保護者の「全問を一回ずつ練習させたい」要望に応えるため、将来「網羅モード」（重みを無視し 81 問シャッフル）を追加検討
- **時間減衰（将来拡張）**: 全問正解で重みが 0.5 に張り付いた後の忘却対策として、最終挑戦からの経過時間に応じて重みを緩やかに引き上げる機構を将来検討（§3.2 収束挙動参照）
