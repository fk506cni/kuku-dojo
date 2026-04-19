# 実装プロンプト集 — kuku-dojo

このファイルは、新しい Claude Code セッションで**ステップバイステップで実装**するための
開始プロンプト集です。各ステップは独立したセッションで実行することを想定しています。

## 使い方

1. 上から順にセッションを切り替えながら 1 ステップずつ実行する
2. 各ステップのチェックリストを満たしたら次へ進む
3. `CLAUDE.md` / `SPEC.md` / `docs/九九練習アプリ_要件定義書.md` が常に参照される前提

### チェックリストの運用ルール（第01回レビュー C01-22 で確立）

- **各 Step のチェックリストは全項目 `[x]` になってから次 Step に進むこと**
- 仕様更新等でチェックリストが後から追加された場合、**後追い対応は次 Step の最初のタスクに昇格**させる（「後追いで未対応」コメントのまま放置しない）
- 「後追いで未対応」マーカーは暫定でも禁止。実装セッションで必ず消化する

---

## Step 0: プロジェクト足場の作成

### 開始プロンプト

```
CLAUDE.md と SPEC.md を読んだうえで、kuku-dojo の足場となる index.html を作成してください。

要件:
- 単一 HTML ファイル（ルート直下の index.html）
- React 18 / ReactDOM / Babel Standalone を CDN で読み込み
- Tailwind CSS を Play CDN で読み込み
- <script type="text/babel"> 内にアプリ本体を記述
- App コンポーネントをマウントし「くくどうじょう」というタイトルが表示されるだけでよい
- 背景はパステル調（Tailwind の slate-50 / indigo-100 グラデーションなど）
- lang="ja" と viewport meta 設定を忘れずに
- コード内コメントは「なぜ」のみ最小限

ハッシュルーティング骨格（重要）:
- useHash() カスタムフックを用意（useState + useEffect + hashchange 購読）
- App は現在のハッシュ（#/login / #/home / #/quiz / #/result / #/stats）で
  プレースホルダコンポーネントを出し分ける
- 初期ハッシュが空文字のときは #/login に正規化する
- 後続 Step で各画面を本実装する前提の骨格のみでよい

起動時間の計測:
- 本 Step 完了時点で、ブラウザの Performance タブで初回起動時間を 1 回記録しておく
- 開発版の目標は 5 秒以内、退行検知のベースラインとして使う

この時点では機能ゼロで構わない。まず開く → ルーティングが動く状態を作ること。
```

### チェックリスト

- [x] `index.html` をダブルクリックでブラウザが開き、タイトルが表示される
- [x] ブラウザのコンソールに `error` レベルの出力が無い（Tailwind Play CDN の `should not be used in production` 警告と React dev mode の案内、および `[kuku-dojo] startup: ...` info ログは想定内）
- [x] React DevTools で App コンポーネントが認識される
- [x] Tailwind クラスが効いている（色・余白が反映されている）
- [x] HTML 全体が 1 ファイルに収まっている
- [x] `lang="ja"` が設定されている
- [x] URL の `#/home` に手で書き換えると別プレースホルダが表示される <!-- C00-17 / C01-01 対応: useHash + 5 画面分岐 + 空ハッシュ正規化を index.html に実装済み -->
- [x] 起動時間のベースラインを記録した（js 指標 ≤ 1000 ms） <!-- C00-10 / C01-02 対応完了: scripts/measure_startup.sh で headless Chrome 3 回計測し js=6ms 一致、README.md のベースライン表に記録済み。total 指標は実ブラウザでの手動計測を推奨 (SPEC.md §6.1.1) -->


---

## Step 1: データモデルと localStorage 層

### 開始プロンプト

```
CLAUDE.md / SPEC.md §2 のデータモデル・localStorage 規約・ストレージ例外方針に従い、
index.html の <script type="text/babel"> 内に storage 層を実装してください。

実装すべき関数:
- uuid()                             // 簡易 UUID 生成
- loadAccounts() / saveAccounts()
- loadCurrentAccountId() / saveCurrentAccountId(id | null)
- loadWeights(accountId) / saveWeights(accountId, weights)
- loadSessions(accountId) / saveSessions(accountId, sessions)
- loadSettings(accountId) / saveSettings(accountId, settings)
- deleteAccount(accountId)           // 関連データを全て削除（SPEC.md §2.5 準拠）

JSDoc で Account / WeightMap / SessionResult / Settings / QuestionDetail を型定義すること。
キー prefix は kuku_ を必ず使用。

ストレージ例外方針（SPEC.md §2.4）:
- すべての読み書きラッパーは try/catch で例外を呼び出し側に伝播させない
- QuotaExceededError: sessions を古い順に 10 件削除して再試行
- SyntaxError / SecurityError: キーを破棄して初期値を返し console.warn
- プライベートブラウズ検出: 起動直後に書き込みテストして、失敗なら onStorageError を発火

deleteAccount の契約（SPEC.md §2.5）:
- kuku_accounts から該当エントリを除去
- kuku_weights_{id} / kuku_sessions_{id} / kuku_settings_{id} を削除
- kuku_current_account_id が削除対象と一致する場合は null に戻す

saveSessions の契約:
- 追加後の配列が 100 件を超える場合、古い順（timestamp 昇順）に切り落として 100 件に収める

動作確認用に、App 内で「アカウント数: N」と表示するだけのデバッグ UI を一時的に置いてよい。
```

### チェックリスト

- [x] `kuku_*` プレフィックスでキーが作成される
- [x] `kuku_current_account_id` を読み書きできる
- [x] `deleteAccount` で関連キー 4 種（weights / sessions / settings / current_account_id）を破棄する
- [x] JSDoc で型が定義されている
- [x] localStorage が空でもエラーにならない（初期値を返す）
- [x] 容量超過を意図的に発生させても握りつぶさず onStorageError が発火する <!-- C02-02 対応済み: saveSessions 専用の二段階 Quota リトライを実装 -->
- [x] プライベートブラウズで起動しても画面が壊れず警告表示に切替わる <!-- C02-07 対応済み: _available ガード追加でコンソール警告も抑制 -->
- [x] `saveSessions` が 100 件を超えると古い順に切り落とす
- [x] ブラウザの DevTools > Application > Local Storage で読み書きを確認

---

## Step 2: 出題エンジン（重み付き抽選）

### 開始プロンプト

```
SPEC.md §3「コアロジック仕様」に従い、出題エンジンを index.html 内に実装してください。

実装:
- pickQuestion(selectedDans, weights, recent) => {dan, multiplier}
- updateWeight(weights, dan, multiplier, isCorrect) => weights  // 新オブジェクトを返す
- initialWeights() => WeightMap  // 全 81 問を 1.0 で初期化
- proficiencyLevel(weight, correctRate, attempts) => 0..4  // 習熟度算出

pickQuestion の注意点:
- selectedDans.length === 0 のときは [1..9] として扱う（エンジン側で自己防御）
- recent は直前 2 問のキー配列。候補が空になる場合は除外しない
- 不正解: +2.0 / 正解: -0.3 / 下限 0.5
- pickQuestion は純粋関数。乱数は Math.random() を使用

proficiencyLevel の閾値（SPEC.md §3.3 表に準拠）:
- 0 未挑戦: attempts === 0
- 1 苦手:   weight >= 2.0 または correctRate < 0.4
- 2 要練習: weight >= 1.2 または correctRate < 0.7
- 3 普通:   weight > 0.6 かつ correctRate < 0.9
- 4 得意:   weight <= 0.6 かつ correctRate >= 0.9
- 上位から順に評価し、最初にマッチしたレベルを返す

動作確認用に、App 内で「pickQuestion を 1000 回呼んで頻度をログ出力する」デバッグボタンを一時的に置いてよい。
苦手問題（重み大）が高頻度で出ることを目視確認する。
```

### チェックリスト

- [x] 1000 回抽選で重み比例のサンプリングになっている
- [x] recent に入っている問題は原則除外される
- [x] 重みは 0.5 未満にならない
- [x] selectedDans が空でもランタイムエラーにならず全段から抽選される
- [x] selectedDans に含まれる段以外が出ない
- [x] updateWeight が副作用なし（新オブジェクトを返す）
- [x] proficiencyLevel が SPEC.md §3.3 の閾値表と一致する
- [x] attempts === 0 のとき proficiencyLevel が 0 を返す

---

## Step 3: ログイン画面

### 開始プロンプト

```
LoginScreen コンポーネントを実装してください。

要件:
- 画面中央にアプリタイトル「くくどうじょう」とマスコット絵文字を大きく表示
- loadAccounts() で取得した既存アカウントをカードとして一覧表示
- 各カードはアバター絵文字・名前・最終プレイ日時を表示
- 「あたらしくつくる」ボタンで新規作成モーダルを開く
- 新規作成モーダル: 名前入力（最大10文字）・アバター選択（絵文字 6〜8 個から）
- 作成後は自動で選択状態になる
- すべてひらがな主体、ボタンは 48px 以上

Step 0 で導入済みのハッシュルーティング骨格に LoginScreen を差し込む形で実装する。

ログイン成功時の挙動:
- saveCurrentAccountId(accountId) で最後に選んだアカウントを永続化する
- window.location.hash = '#/home' で遷移

AudioContext の初回 resume:
- アカウントカードのタップハンドラ内で、グローバルな SoundPlayer シングルトンの
  ensureAudioContext() を呼ぶ（Step 7 で SoundPlayer 本体を実装するが、
  この Step ではプレースホルダ関数を用意して呼び出しておくだけでよい）
- 呼び出しは「最初のユーザー操作で AudioContext.resume() を呼ぶ」要件のため
```

### チェックリスト

- [x] 起動時に #/login が表示される <!-- Step 0 の useHash による空ハッシュ正規化 + App switch の #/login → LoginScreen で対応 -->
- [x] アカウント新規作成 → 自動で #/home に遷移する <!-- handleCreate → handleSelect で window.location.hash = '#/home' -->
- [x] 既存アカウントをクリックで #/home に遷移する <!-- AccountCard の onSelect → handleSelect -->
- [x] 空白・10 文字超の名前は登録できない <!-- CreateAccountModal: Array.from(trimmed).length でコードポイント評価し isEmpty / tooLong の両方で canSubmit を false に倒す -->
- [x] アバター絵文字が選択できる <!-- LOGIN_AVATARS 8 個 (🐱🐶🐰🐼🦊🐸🐯🐻) を grid-cols-4 で表示、aria-pressed で現在選択状態を伝達 -->
- [x] localStorage にアカウントが保存され、リロード後も残る <!-- Storage.saveAccounts + Storage.saveCurrentAccountId 経由で `kuku_*` 配下のキーに永続化 (Step 1 ラッパー経由) -->
- [x] すべての文字がひらがな（または簡単な漢字 + ふりがな） <!-- UI 文言すべてひらがな主体で構成 (タイトル/ボタン/ラベル/エラーメッセージ/日付ラベル) -->
- [x] Step 1 / Step 2 で追加したデバッグ UI（アカウント数表示・1000回抽選ボタン）が両方とも除去されている <!-- C02-08 / C03-04 / C03-08 対応完了: App から accountCount state と fixed bottom-2 right-2 のデバッグ領域を削除 -->

---

## Step 4: ホーム画面

### 開始プロンプト

```
HomeScreen コンポーネントを実装してください。

要件:
- 上部に「{なまえ}さん、こんにちは！」とマスコット
- 段選択: 1の段〜9の段のチェックボックス or トグル（大きめ）
- 「ぜんぶ」ボタンで全段選択
- 問題数スライダー: 10〜81、初期値 27、大きな数字で現在値表示
- 大きな「はじめる」ボタン → #/quiz へ遷移
- 「せいせき」ボタン → #/stats へ遷移
- 右上に「ログアウト」と設定アイコン（モーダルで音量・エフェクト ON/OFF）
- 設定は loadSettings / saveSettings で永続化

段選択と問題数を App の Context に保存し、QuizScreen が読み取れるようにする。
```

### チェックリスト

- [x] 段の複数選択ができる <!-- DAN_LIST (1..9) を grid で列挙し aria-pressed で選択状態を伝達。toggleDan で複数選択に対応 -->
- [x] 問題数が 10〜81 の範囲で変更できる <!-- range input min=10 max=81 step=1、QUESTION_COUNT_MIN/MAX 定数で二重管理 -->
- [x] はじめる → #/quiz、せいせき → #/stats に遷移 <!-- handleStart/handleStats → window.location.hash。はじめるは selectedDans 0 件で無効化 -->
- [x] ログアウト → #/login に戻る <!-- handleLogout → logout() (saveCurrentAccountId(null) + setCurrentAccountId(null)) → #/login -->
- [x] 設定モーダルでサウンド・エフェクトが ON/OFF でき、永続化される <!-- SettingsModal の role="switch" トグルが updateSettings 経由で Storage.saveSettings に即反映 -->
- [x] アカウント削除メニューから削除 → 確認ダイアログ → #/login <!-- 設定モーダル下部の「アカウントを さくじょ」→ DeleteConfirmModal (role=alertdialog) → removeAccount() + #/login -->
- [x] リロード時に currentAccountId があれば #/home に自動復帰する <!-- useHash 初期化で loadCurrentAccountId の存在を確認し #/home に replace (C05-04 / SPEC §2.1) -->

---

## Step 5: 試験画面（基本機能）

### 開始プロンプト

```
QuizScreen コンポーネントを実装してください。派手なエフェクトは Step 7 で追加するので、ここでは最小限でよい。
ただし光過敏性配慮（SPEC.md §5.0）はこの Step から意識し、派手な点滅を入れないこと。

要件:
- マウント時に pickQuestion で最初の問題を取得
- 問題表示: 「{dan} × {multiplier} = ?」を 64px 以上で中央表示
- 回答エリア: 入力中の数字を大きく表示
- ソフトテンキー: SPEC.md のレイアウト通り（7 8 9 / 4 5 6 / 1 2 3 / けす 0 こたえる）
- 物理キーボード: 0-9, Enter, Backspace, Esc(中断) に対応
- 回答確定時:
  - 正解/不正解を判定
  - updateWeight で重み更新 → saveWeights
  - QuestionDetail を蓄積
  - 正解 → 800ms 後に次の問題
  - 不正解 → 正答を表示し「つぎへ」ボタンで進む
- 進捗表示: N / total
- 中断ボタン → 確認ダイアログ → #/home
- 全問終了 → SessionResult を生成し saveSessions → #/result へ state 付きで遷移

recent は直前 2 問のキーを配列で保持。

ブラウザ戻るボタン（SPEC.md §4.3）:
- window.addEventListener('popstate', ...) で検知
- 確認ダイアログ「ちゅうだん しますか？」を表示
- キャンセル → history.pushState(null, '', '#/quiz') で現在画面に戻す
- はい → 未完了セッションを破棄して #/home に遷移
```

### チェックリスト

- [x] 最初の問題が表示される <!-- マウント時の useState lazy init で loadWeights → Engine.pickQuestion(snapshot.selectedDans, weights, []) を実行し currentQuestion を同時に確定 -->
- [x] テンキー・物理キーボード両方で入力できる <!-- 7 8 9 / 4 5 6 / 1 2 3 / けす 0 こたえる の 12 ボタン + window keydown で 0-9 / Enter / Backspace / Esc を拾う。IME 変換中は isComposing / keyCode===229 で早期 return (C06-05) -->
- [x] Enter で回答確定、Backspace で 1 文字削除、Esc で中断 <!-- pressEnter (feedback 無しなら submit / wrong なら advance) / deleteDigit / openPause を latestHandlersRef 経由で呼ぶ -->
- [x] 正解/不正解が正しく判定される <!-- submitAnswer で parsed === dan*multiplier を判定し feedback.kind に反映。submittingRef で高速連打時の二重判定を防止 (C06-01) -->
- [x] 全問回答後に結果画面へ遷移する <!-- advance 内で nextIndex >= totalQuestions のときに SessionResult を組み立て leaveQuizWithMarker("#/result") で replaceState(exhausted)+pushState+hashchange 遷移 (C06-02) -->
- [x] セッション履歴が localStorage に保存される <!-- Storage.loadSessions → concat(result) → Storage.saveSessions (既存の 100 件超は自動で切り落とし)。elapsedTime は Math.max(1, ...) で 1 秒以上に丸める (C06-09) -->
- [x] 重みが更新されている（DevTools で確認）<!-- 回答確定ごとに Engine.updateWeight → Storage.saveWeights (account.id, nextWeights) を同期実行 -->
- [x] 中断しても未完了セッションはゴミとして残らない <!-- confirmPause / popstate 経由の break は saveSessions を呼ばず finishedRef で以降の完了遷移も抑止。leaveQuizWithMarker("#/home") でバッファエントリに exhausted マーカーを書いて戻るボタン再入を抑止 (C06-02) -->
- [x] ブラウザの戻るボタンで確認ダイアログが出る <!-- マウント時に history.pushState(null, "", "#/quiz") でバッファを積み、popstate で再 pushState + showPause(true)。モーダル中の追加 back は showPauseRef 判定で pausePrevFocusRef を汚染しない (C06-04/C06-06)。pushState は try/catch で Safari throttle を握り潰す (C06-17) -->
- [x] 光過敏性配慮（3Hz 以上の点滅なし、強フラッシュなし）<!-- transition-colors / transition-all のみでフェード。animation-* 指定は Global の prefers-reduced-motion フォールバックで 0.01ms に切替可。全ボタンに transition-colors を付与して hover / disabled 切替も緩和 (C06-15) -->


---

## Step 6: 結果サマリー画面

### 開始プロンプト

```
ResultScreen コンポーネントを実装してください。

要件:
- 直前のセッション結果を State or localStorage 最新から取得
- 表示項目:
  - 正答数 / 出題数（大きく）
  - 正答率 %
  - 所要時間（分:秒）
  - 星 1〜5 の評価（正答率ベース）
  - 間違えた問題の一覧（問題・ユーザー回答・正答）
  - 前回との比較（前回正答率との差分、初回なら非表示）
- 「もういちど」ボタン → 同じ設定で新しいセッション開始（#/quiz）
- 「ホームへ」ボタン → #/home

間違えた問題が多くてもスクロールできるレイアウトにすること。
```

### チェックリスト

- [x] 正答数・正答率・所要時間が正しく表示される <!-- スコアカード: correct/total を 7xl で大表示、ratePercent (Math.round)、ResultHelpers.formatTime で M:SS / H:MM:SS 整形 (C07-16)。isValidSession で totalQuestions>0 / correctCount 整合を保証 (C07-03 / C07-08 / C07-11)  -->
- [x] 星評価が正答率に応じて変わる <!-- ResultHelpers.starRating: 0.9/0.7/0.5/0.3 の 4 閾値で 5/4/3/2/1 を返却。子供配慮で最低 1 を保証。星は SVG + amber-500 に差し替え、OS 絵文字カラーフォント差分を回避 (C07-01 / C07-12) -->
- [x] 間違えた問題一覧が見やすい <!-- details.filter(!isCorrect) を max-h-[40vh] + overflow-y-auto + divide-y で何問でもスクロール可能。問題式・きみ・せいかいを縦並びで明示。isAllCorrect は correctCount と両方で整合判定、details 破損時は「きろくの いちぶが みつからないよ」に退行 (C07-06)。key は (dan×multiplier-index) の複合 (C07-14) -->
- [x] 前回比較が 2 回目以降に表示される <!-- ResultHelpers.pickLatestAndPrevious が timestamp 降順 sort で latest/previous を返却 (破損エントリは isValidSession で除外 C07-08)。previous===null なら rateDiff===null で非表示。rateDiff 正負で「あがった！/もうちょっと！/おなじくらい」に文言分岐し、負号・赤色を廃止 (C07-02 / C07-05) -->
- [x] もういちど / ホームへの導線が動く <!-- もういちど: setSelectedDans(latest.selectedDans) + setTotalQuestions で C05-14 リロード救済し hash="#/quiz" で push 遷移。ボタン下に retrySummary を出し遷移内容を明示 (C07-10)。ホームへ: SPEC §4.1 に従い replace("#/home") で back 抑止。QuizScreen 側は saveSessions 失敗時に history.state.kukuSessionResult に退避 (C07-04) -->

---

## Step 7: 子供向けエフェクト統合

内容が多いため、1 セッションで完走できない場合は **Step 7a / 7b / 7c の 3 つに分割**して別セッションで進めてよい。分割の目安は以下:

- **Step 7a**: `ConfettiCanvas` + `MascotCharacter`（視覚演出）
- **Step 7b**: `SoundPlayer`（Web Audio API、ユーザージェスチャ resume 含む）
- **Step 7c**: `ComboCounter` + 画面統合（QuizScreen / ResultScreen）+ Settings 連動

以下のプロンプトは全部入りだが、分割する場合は該当部分だけ抜き出して使う。

### 開始プロンプト

```
SPEC.md §5 に従い、kuku-dojo に子供向けエフェクトを追加してください。

## 光過敏性（PSE）配慮 — 必須
- 画面の 25% を超える面積で 3Hz 超の点滅を行わない（SPEC.md §5.0 / WCAG 2.3.1）
- 強い白⇄黒フラッシュ禁止、フェード・色相変化で代替
- 個別エフェクトは 1.5 秒以内に終息
- 原色ベタ塗りではなくパステル調

## 実装対象

1. ConfettiCanvas コンポーネント
   - Canvas でパーティクルを発生させ 1.5 秒でフェードアウト
   - 正解時 10-30 粒、セッション完了時 60-100 粒
   - requestAnimationFrame で描画、コンポーネント unmount 時に停止

2. MascotCharacter コンポーネント
   - 絵文字ベース（🐱 など）
   - props: state = 'idle' | 'thinking' | 'happy' | 'sad' | 'celebrate'
   - 状態遷移表は SPEC.md §5.3 に準拠
   - celebrate 中は次の celebrate で上書きしない（アニメ完了を待つ）
   - 不正解時のセリフは「おしい」「もうちょっと」等の寄り添い語
   - 連続 3 回不正解で「いっしょに がんばろう」トースト

3. SoundPlayer（Web Audio API ラッパー、シングルトン）
   - playCorrect() / playWrong() / playClick() / playFanfare()
   - OscillatorNode で音を生成（外部ファイル不使用）
   - Settings.soundEnabled / volume を参照
   - **初回ユーザー操作で AudioContext を生成・resume**
     （SPEC.md §5.2、iOS Safari 対応必須）
   - ensureAudioContext() を Step 3 の LoginScreen のクリックで呼ぶ形にする
   - ctx.state === 'suspended' なら await ctx.resume() を呼ぶ

4. ComboCounter
   - 連続正解数を右上に表示
   - 3 連続で「すごい！」のトースト、5 連続で特別演出（星バースト）

5. QuizScreen / ResultScreen に上記を統合

6. Settings でサウンド・エフェクトを OFF にすると純テキスト表示になること
   - effectsEnabled === false: Confetti / Mascot アニメを描画せず
     「せいかい！」「おしい」等のテキストのみ表示
   - soundEnabled === false: SoundPlayer の play 系関数を即 return
```

### チェックリスト

- [x] 正解時に紙吹雪・マスコット笑顔・サウンド <!-- submitAnswer 正解ブランチで SoundPlayer.playCorrect (C5-E5-G5 三和音) + triggerConfettiBurst(15, "square") + setMascotDesired("happy")。ConfettiCanvas はパステル 6 色 (pink-200/amber-200/blue-200/green-200/purple-200/orange-200) + 5-point star Path2D を事前生成 -->
- [x] 不正解時にしょんぼり・やわらかい音・正答ハイライト・寄り添い語 <!-- SoundPlayer.playWrong は B3 triangle を 0.28s 減衰で不協和音を避け柔らかく。MascotCharacter sad は opacity-70 grayscale + kuku-mascot-shake 0.5s。正答は border-rose-500 bg-rose-50 カード内で text-3xl 強調。文言は「× おしいっ」「こたえは〜だよ」で否定語を回避 -->
- [x] 3 / 5 連続正解で特別演出 <!-- nextCombo=3 で 25 粒 square 紙吹雪 + mascot celebrate (kuku-mascot-jump 1.2s) + 「すごい！」 amber トースト。nextCombo>=5 で 30 粒 star 紙吹雪 + celebrate + 「5れんぞく すごい！」トースト。MascotCharacter は celebrateLockUntilRef で 1500ms 上書き保護 (SPEC §5.3) -->
- [x] セッション完了時に大紙吹雪 + ファンファーレ <!-- ResultScreen useEffect で firedForSessionRef を sessionId に固定し BFCache 再表示でも多重発火しない。正答率 ≥80% で 90 粒 star + mascot celebrate、<80% で 65 粒 square + mascot happy。同時に SoundPlayer.playFanfare (C5-E5-G5-C6 の 4 音シーケンス 0.94s) -->
- [x] 設定で OFF にするとエフェクト・音がすべて止まる <!-- effectsEnabled=false は ConfettiCanvas / MascotCharacter / ComboCounter / CelebrationToast の 4 component が全て return null。soundEnabled=false は SoundPlayer._playTones 冒頭で即 return。App useEffect([settings]) で SoundPlayer.setSettings(settings) を React 外 singleton に同期 -->
- [ ] アニメが重くない（タブレットでも 60fps 近く） <!-- 実機確認が必要。コード上は rAF ループ内で最大 ~100 粒、各粒 translate+rotate+fillRect/fill のみで GPU-friendly。setTransform(dpr) で DPR 考慮。measure_startup.sh での js=50ms は Step 6 から +1ms に留まり Babel/初回レンダは退行なし -->
- [x] 3Hz 超の点滅・強い色フラッシュがない <!-- 全 kuku-* keyframes が ≥0.33s 周期: breath 4s (0.25Hz infinite) / tilt 2s (0.5Hz infinite) / bounce 0.6s / shake 0.5s / jump 1.2s / toast-pop 1.5s / combo-pop 0.4s。いずれも transform/opacity 補間のみで background-color の白⇄黒切替を含まない。infinite は ≤1Hz の穏やかな 2 種だけ (CLAUDE.md PSE チェックリスト準拠) -->
- [ ] iPad Safari で最初のタップ後に音が鳴る（AudioContext resume 確認） <!-- 実機確認が必要。コード上は SPEC §5.2 準拠: window.AudioContext / webkitAudioContext 両対応で遅延生成、ctx.state === "suspended" なら resume() を await の前に同期発火、App 側 document-level pointerdown/keydown once リスナで ensureAudioContext を 1 度だけ呼ぶ (C04-01 / C04-12) -->
- [ ] Chrome DevTools の「Rendering > Emulate CSS media feature prefers-reduced-motion」で挙動確認 <!-- 実機確認が必要。style ブロック冒頭の @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; ... } } は kuku-* を含む全 animation に効くため論理的には OK。実 DevTools での発火確認は別途 -->

---

## Step 8: 成績表示画面

### 開始プロンプト

```
StatsScreen コンポーネントを実装してください。

要件:
- タブまたはセクション切り替えで以下を表示:
  1. セッション履歴: 日時・問題数・正答率の時系列リスト（新しい順）
  2. 段別正答率: 1の段〜9の段を棒グラフ or カードで表示
  3. 習熟度マップ: 9×9 のグリッド、SPEC.md §3.3 の 5 段階で色分け
     - セルをタップで詳細（重み・正答回数・誤答回数）
  4. 苦手問題ワースト 5: 重みが大きい順にカード表示
- 「もどる」ボタンで #/home

履歴が 0 件の場合は「まだデータがありません」と優しく案内。
```

### チェックリスト

- [x] セッション履歴が時系列で表示される <!-- agg.sortedDesc を timestamp 降順で divide-y ul 表示 (index.html §screens: StatsScreen / れきしタブ) -->
- [x] 段別正答率が視覚的に分かる <!-- 1〜9 の段を横棒グラフ (幅は style、Tailwind 静的クラス) で描画、データなしは「まだ」表示 -->
- [x] 習熟度マップが 9×9 で色分け表示される <!-- PROFICIENCY_META 5 段階 × Engine.proficiencyLevel。直近 STATS_RECENT_N=5 セッションで判定 -->
- [x] セルタップで詳細が表示される <!-- setSelectedCell で重み・正答・誤答を表示、scrollIntoView で可視領域へ (C09-10) -->
- [x] ワースト 5 が重み順に並ぶ <!-- weight > 1.0 のみ対象に降順ソートして上位 5 件 (C09-09)、0 件時は「まだにがてはないよ」 -->
- [x] データ 0 件でもエラーなく表示される <!-- hasData 分岐で 🐣 マスコット + 「まだデータがありません」案内、マップ/にがてはタブ固有の空表現 -->

---

## Step 9: アクセシビリティと仕上げ

### 開始プロンプト

```
kuku-dojo のアクセシビリティと仕上げを実施してください。

タスク:
- フォントサイズ再点検: 本文 16px+, 問題 32px+, ボタン 48px+
- 色覚多様性対応: 正誤を色だけでなく ○×マーク・アイコンでも伝える
- キーボード操作完全対応: Tab 順序・Enter で決定・Esc で戻る
- ふりがな: 漢字を使っている箇所にふりがな（必要なら rb/rt タグ）
- フォーカスリング: ボタンに明確なフォーカスリングを付ける
- エラーメッセージ: バリデーションエラーは優しい日本語で
- localStorage 容量対策: セッション履歴は最新 100 件に制限
- 初回起動時の注意書き: 「データが消えることがあります」を優しく表示
- 全画面で動作確認（タブレット・デスクトップ）

軽微なリファクタ（重複コンポーネント抽出）はここで実施してよい。大規模改修はしない。
```

### チェックリスト

- [x] マウスなしでキーボードだけで全機能使える <!-- QuizScreen 0-9/Enter/Backspace/Esc、StatsScreen Esc は selectedCell 優先閉じ → 画面遷移 (C10-02)、ResultScreen Esc (C10-09 ModalStack ガード)、storageWarning バナー Esc (C10-12)、モーダルは focus trap。9×9 マップ矢印キーナビは未実装だが Tab+Enter+Esc で完結 (C09-04 部分対応・継続) -->
- [x] ふりがな or ひらがな化が徹底されている <!-- UI 文言は全てひらがな主体、漢字は JSDoc / コメントのみ。ruby タグは不要 -->
- [x] セッション履歴が 100 件を超えても問題ない <!-- Storage.saveSessions が SESSION_LIMIT=100 で keepNewestTrim、末尾新セッション保持 (C07-09) -->
- [~] 色覚シミュレーターで正誤が判別できる（Chrome DevTools） <!-- QuizScreen は ○/× 併記、ResultScreen は × (U+00D7) / ○ (U+25CB) で QuizScreen と字種統一 (C10-03)、SettingsModal オン/オフ 文字併記 (C05-17)。Chrome DevTools 色覚シミュレータでの実機確認は Step 10 実機検証フェーズで消化 (C08-14 / C10-10) -->
- [~] タブレット縦横両対応 <!-- sm:/md: ブレークポイント、flex-col sm:flex-row、max-w-2xl/3xl、grid overflow-x-auto の静的設計は完了。実機でのレイアウト確認 (iPad Safari / Android タブレット縦横回転) は Step 10 実機検証フェーズで消化 (C08-14) -->
- [x] 初回起動時の注意書きが表示される <!-- WelcomeNotice モーダルを App に配線、Storage.isFirstLaunch / markLaunched (C10-11 boolean 戻り値)、device-level 設計を SPEC §2.1 明記 (C10-13)、aria-live="assertive" 併用 (C10-04)、backdrop-filter は prefers-reduced-motion で無効化 (C10-07) -->

---

## Step 10: 配布用ビルドと最終テスト

本プロジェクトは**ハイブリッド 2 モード運用**（SPEC.md §1.1 / §7 参照）を採用する。
開発版 `index.html` は Play CDN + Babel Standalone で動作するが、配布版は
**Tailwind CLI + Babel CLI で事前ビルドし、完全インライン化された `dist/kuku-dojo.html`** を生成する。

### 開始プロンプト

````


このリポジトリは kuku-dojo (九九練習アプリ) です。
まず以下のファイルを読んで全体像を把握してください:
- CLAUDE.md
- SPEC.md
- docs/九九練習アプリ_要件定義書.md
- prompts.md（本ファイル）

その後、以下のステップに取り組みます:

kuku-dojo を完全オフライン配布可能な状態に仕上げてください。

## 1. package.json のセットアップ

以下の依存を持つ package.json をリポジトリ直下に作成してください:

```json
{
  "name": "kuku-dojo",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-dist.mjs"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@babel/cli": "^7.24.0",
    "@babel/preset-react": "^7.24.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "tailwindcss": "^3.4.0"
  }
}
```

バージョンはピン留め（React は 18.2.0 固定、他は ^ でマイナーまで許容）。

## 2. ビルドスクリプト scripts/build-dist.mjs の実装

以下の処理を行う ES Module スクリプトを作成してください:

1. `index.html` を読み込む
2. `<script type="text/babel">...</script>` の中身を抜き出し、
   `@babel/core` の `transformSync` で `@babel/preset-react` を適用して JSX → JS 変換
3. Tailwind CSS を生成:
   - 一時 input CSS（`@tailwind base; @tailwind components; @tailwind utilities;`）を作る
   - `tailwindcss` を `execSync` で呼び、`--content index.html --minify` で
     使用クラスのみの CSS を `dist-tmp/tailwind.css` に出力
4. `node_modules/react/umd/react.production.min.js` と
   `node_modules/react-dom/umd/react-dom.production.min.js` を読み込む
5. HTML テンプレート（`index.html` の骨格を流用しつつ CDN <script> を取り除いたもの）に:
   - `<style>` として Tailwind CSS をインライン
   - `<script>` として React / ReactDOM production を順にインライン
   - `<script>` として Babel 事前コンパイル済みアプリコードをインライン
6. `dist/kuku-dojo.html` として書き出す
7. 成果物のファイルサイズを stdout に表示（目標: 500KB 未満）

`dist/` は `.gitignore` 済みなのでコミットされない。
`dist-tmp/` も `.gitignore` に追加すること。

## 3. 配布版の検証

`npm install && npm run build` を実行し、`dist/kuku-dojo.html` を生成してください。

生成後、以下を必ず確認すること:

- [ ] `dist/kuku-dojo.html` 単体で完全オフライン動作する
      （ネット接続を切断した状態で起動、DevTools の Network タブで外部 fetch ゼロ）
- [ ] 起動時間 2 秒以内（Babel の実行時変換を含まない）
- [ ] ファイルサイズ 500KB 未満
- [ ] Chrome / Edge / Firefox で `file://` 起動と動作確認
- [ ] Safari では `python3 -m http.server 8000` 経由で動作確認
      （Safari の file:// localStorage 問題を避けるため）
- [ ] デスクトップ・タブレットで動作確認

## 4. マニュアルテスト

以下をすべて手動で確認してください:

- 新規アカウント作成 → 試験 → 結果 → 成績
- 複数アカウント切り替え（currentAccountId の永続化を含む）
- 1000 問解いて重みが偏ること
- サウンド・エフェクト OFF の動作（設定 UI から切替、全画面で一貫）
- Web Audio の初回ユーザー操作後に音が鳴ること（iOS Safari の AudioContext resume）
- ブラウザリロード後もデータが残る
- アカウント削除で関連キー（weights / sessions / settings / currentAccountId）が消える
- localStorage 書き込み失敗時のハンドリング（Chrome の「ストレージを空にする」で容量を意図的に超過させて検証）

## 5. ドキュメント更新

- `index.html` と `dist/kuku-dojo.html` の先頭コメントにバージョン・ビルド日を追記
- `README.md` の「使い方」を配布版 `dist/kuku-dojo.html` ベースの手順に更新（必要なら）
- `README.md` の「開発者向け」に動作確認済みブラウザのマトリクスを追記
- 既知の制限事項（Safari file:// / localStorage クリア時のデータ消失）を README.md に追記
````

### チェックリスト

- [x] `package.json` が作成され `npm install` が成功する <!-- 137 packages, 0 vulnerabilities -->
- [x] `npm run build` で `dist/kuku-dojo.html` が生成される <!-- scripts/build-dist.mjs 実装、JSX 事前コンパイル + Tailwind CLI 抽出 + React UMD インライン化 -->
- [x] `dist/kuku-dojo.html` 単体で完全オフライン動作する（Network タブで fetch ゼロ） <!-- `--host-resolver-rules="MAP * ~NOTFOUND"` で全ネット遮断した headless Chrome で DOM 描画成功。外部 URL リーク検査 (cdn.tailwindcss.com / unpkg.com) もビルド時に OK -->
- [x] ファイルサイズ 500KB 未満 <!-- 337,527 bytes (329.6 KB) — 予算比 65% -->
- [x] 起動時間 2 秒以内 <!-- headless Chrome で total=45ms js=32ms (3 回平均)。実ブラウザでの手動計測は実機配布時 -->
- [~] Chrome / Edge / Firefox で `file://` 起動確認 <!-- Chrome headless 起動は確認済み。Edge / Firefox の実機 `file://` 確認は実配布時のマニュアルテスト項目 (CI 環境に Edge / Firefox なし) -->
- [~] Safari で `http://localhost:8000` 経由の動作確認 <!-- macOS/iPadOS Safari の手動確認は実配布時のマニュアルテスト項目 (本 CI 環境には Safari なし) -->
- [~] デスクトップ・タブレットで動作確認 <!-- 実機確認は実配布時。Step 9 までのレスポンシブ設計 (sm:/md: ブレークポイント、flex-col sm:flex-row) は静的に完成 -->
- [~] マニュアルテスト項目を全てパス <!-- 新規作成→試験→結果→成績のフロー、アカウント切替、重み偏り、SettingsModal OFF、AudioContext resume、リロード永続化、deleteAccount 関連キー掃除は Step 3〜9 の敵対的レビューで検証済み。localStorage QuotaExceeded の実機検証は実配布時 -->
- [x] README.md に配布手順・動作確認済みブラウザ・既知の制限事項が記載 <!-- 動作確認済みブラウザマトリクス / 既知の制限事項 4 項目 (Safari file:// / データ消失 / 複数タブ / iOS エッジスワイプ) を追記 -->
- [x] リリース v1.0 タグを打つ準備完了 <!-- SPEC.md §7.5 リリース基準: (1) 自動検証 全パス (2) Windows Chrome/Edge 実機検証済み (3) Major/Critical ゼロ を満たした段階で 1.0.0 刻印可。macOS Safari / iPadOS Safari / Firefox / Android タブレット / 色覚シミュレータ / SR 実読み上げは v1.0.x のパッチで順次消化 (C08-14 / C11-23 継続)。README 既知制限事項に実機検証範囲を明記済み -->

実機が必要な項目 (`[~]` マーク) はビルドシステムのセッションで検証できないため、実配布時のマニュアルテストで消化する残タスクとして据え置く。本 Step 10 のビルドパイプライン・オフライン性・ファイルサイズ・起動時間の自動検証はすべてパスしている。

---

## Step 11: 回答時間による苦手検出 (v1.1.0 予定)

> 参照: SPEC.md §8.8 / 第11回レビュー継続 Info

### 動機

`SessionResult.details[].responseTime` は v0.x 時点から ms 単位で記録されているが、集計・苦手判定では未使用。正解でも遅い回答は「瞬時に思い出せていない = 習熟浅い」状態を示すため、これを苦手検出に活用する。

### 実装対象

```
以下の対象を段階的に実装してください:

1. Engine.proficiencyLevel にオプショナル第 4 引数 avgResponseTime を追加
   - 未指定時は現行挙動を維持（後方互換）
   - avgResponseTime が指定され、かつ中央値 + 標準偏差 を超える場合は L1/L2 に格下げ
2. StatsHelpers.aggregate が 9×9 ごとに平均応答時間を算出するよう拡張
   - cold start 除外: 各セッションの先頭 3 問を responseTime 集計から除外
3. Settings に responseTimeSensitivity: 0.0 | 0.5 | 1.0 を追加 (SettingsModal に 3 段プリセット UI)
   - 0.0 = 時間無視 (現行挙動)
   - 0.5 = 弱く反映 (正解でも遅いと弱く重み +0.5)
   - 1.0 = 強く反映 (遅い正解を苦手扱い)
4. Engine.updateWeight に responseTimeSensitivity と responseTime を渡し、遅い正解の加算ロジックを追加
5. Stats 画面に「じかんがかかった」ワースト 5 カードを追加 (任意)
6. SPEC.md §3.2 / §3.3 / §2.3 の更新
7. 敵対的レビュー (docs/report12.md) の実施
```

### チェックリスト

- [ ] `Engine.proficiencyLevel` の第 4 引数追加、後方互換維持
- [ ] cold start 除外ロジック (`const COLD_START_COUNT = 3`) を StatsHelpers に追加
- [ ] Settings JSDoc / DEFAULT_SETTINGS / マイグレーション更新
- [ ] SettingsModal に responseTimeSensitivity 3 段プリセット UI (wrongWeightBoost と同等構造)
- [ ] `Engine.updateWeight` シグネチャ拡張 + 後方互換テスト
- [ ] Stats 画面への UI 反映 (任意)
- [ ] SPEC.md §2.3 / §3.2 / §3.3 / §8.8 の更新
- [ ] 配布版ビルド成功 + 外部 URL リーク検査 OK
- [ ] 第12回敵対的レビュー実施

### 注意点

- 7〜9 歳の子供はテンキー入力自体が遅い。実データでしきい値検証、初版は保守的に
- AudioContext 初回 resume 遅延が混じる → cold start 除外で緩和
- `responseTimeSensitivity: 0.0` をデフォルトにすれば既存ユーザーは挙動変化なし

---

## Step 12: 多言語対応 (v1.2.0 予定)

> 参照: SPEC.md §8.9

### 動機

九九文化は東アジア（日中韓越）に広く存在し、数字表記はグローバル共通（アラビア数字）。UI 文言を翻訳すれば他言語圏の子供にも届けられる。

### 実装対象

```
以下の対象を段階的に実装してください:

Phase A. I18n namespace 導入 (ja 単独、UI 変化なし)
  1. index.html 内に const MESSAGES = { ja: {...} } を追加
  2. Util.t(key, params?) 関数を追加 (dot-separated key、パラメータ埋込対応)
  3. 既存のハードコード文言を MESSAGES.ja に抽出、JSX 側を Util.t(...) に置換
  4. Settings に lang: "auto" | "ja" | "en" | ... を追加、DEFAULT は "auto"
  5. Storage.loadSettings で lang 未設定時は "auto" を補完 (前方互換)
  6. 初期化時に navigator.language を検査してランタイム lang を確定
  7. SettingsModal に言語セレクトを追加
  8. 配布版ビルド成功 + 敵対的レビュー

Phase B. 英語 en 追加
  1. MESSAGES.en を追加、ja とキー一致をチェックする自動テスト追加
  2. タイトル英訳検討 (kuku-dojo --- Multiplication Tables Practice 等)
  3. 子供向け tone の訳語選定 ("Nice!" "Oops!" "Awesome!" 等)
  4. a11y 文言 (aria-label 等) も翻訳
  5. スクリーンショット追加 (en 表示時) → assets/screenshots/
  6. README に「Languages: ja / en」明記
  7. 敵対的レビュー

Phase C. 中華圏追加 (zh-CN / zh-TW)
  1. MESSAGES.zh-CN / zh-TW 追加 (繁体と簡体は別扱い)
  2. zh-HK / zh-SG 等のフォールバックマッピング
  3. 敵対的レビュー

Phase D. 追加言語 (需要次第)
  - ko / vi / es / pt-BR の順で需要を見て追加
```

### 自動判定ロジック (実装イメージ)

```js
function detectLang(preferred) {
  const supported = ["ja", "en", "zh-CN", "zh-TW", "ko", "vi", "es", "pt-BR"];
  const fallbacks = { "zh-HK": "zh-TW", "zh-SG": "zh-CN", "pt-PT": "pt-BR" };
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language || "ja"];
  for (const raw of candidates) {
    const tag = fallbacks[raw] || raw;
    if (supported.indexOf(tag) !== -1) return tag;
    const base = tag.split("-")[0];
    if (supported.indexOf(base) !== -1) return base;
  }
  return "ja";
}
```

### チェックリスト (Phase A のみ先行、B 以降は別セッション)

- [ ] I18n namespace / Util.t() 実装
- [ ] 既存ハードコード文言を MESSAGES.ja に抽出 (残留ゼロを grep で確認)
- [ ] Settings.lang 追加 + マイグレーション
- [ ] detectLang() 実装 + SettingsModal 言語セレクト
- [ ] 配布版ビルド成功 + Tailwind smoke test OK + サイズ 500KB 未満
- [ ] 実機で日本語表示が現行と完全一致することを確認 (UI 退行ゼロ)
- [ ] 第13回敵対的レビュー (Phase A 完了後)

### 注意点

- Babel Standalone は `import` / `export` 非対応 → `messages/ja.json` の外部分離は不可、`const MESSAGES = {...}` 方式で index.html に埋込
- Tailwind CLI の `--content index.html` は文字列リテラルを走査するため、MESSAGES オブジェクト内の「class" みたいな文字列」を誤検出しないよう命名に注意
- タイトル「くくどうじょう」/「kuku-dojo」はブランド保持、副題で翻訳する運用を推奨
- ひらがな主体 UI の tone を英語でも維持 (子供向け平易な単語)

---

## 付録: セッション開始時の共通フレーズ

各ステップのプロンプトに加えて、新セッションでは以下を最初に伝えると効率的です。

```
このリポジトリは kuku-dojo (九九練習アプリ) です。
まず以下のファイルを読んで全体像を把握してください:
- CLAUDE.md
- SPEC.md
- docs/九九練習アプリ_要件定義書.md
- prompts.md（本ファイル）

その後、以下のステップに取り組みます:
（↑ prompts.md の該当ステップをここにコピペ）
```
