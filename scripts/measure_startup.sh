#!/bin/bash

# kuku-dojo 起動時間自動計測スクリプト
#
# 用途:
#   prompts.md Step 0 チェックリスト「起動時間のベースラインを記録した」の確認用。
#   headless Chrome で index.html を指定回数開き、`[kuku-dojo] startup: total=N ms js=M ms`
#   のログを parse して統計値を出力する。SPEC.md §6.1.1 の計測指標に準拠。
#
# 2 指標:
#   js    : <script type="text/babel"> 先頭 → App mount の区間 (Babel 変換 + React 初回レンダ)
#           → headless でも安定して実時間を反映する。自動退行検知の主指標。
#   total : navigationStart → App mount (HTML パース + CDN ダウンロード + js を含む)
#           → SPEC.md §6.1 の「起動 5 秒以内」目標に対応する。
#           → ただし headless Chrome はプロセス起動オーバーヘッドで total を 15〜25 秒
#             水増しするため、実ブラウザでダブルクリック起動した実測値と乖離する。
#             headless の total は参考値にとどめ、真のベースラインは実ブラウザで記録する。
#
# 使用方法:
#   ./scripts/measure_startup.sh                # 既定 3 回計測 (cold 1 + warm 2)
#   ./scripts/measure_startup.sh --runs 5       # 回数指定
#   ./scripts/measure_startup.sh --dist         # dist/kuku-dojo.html を計測 (Step 10 以降)
#
# 出力例:
#   ── 統計 ──
#     total  : [17000, 16500, 16600] ms  (min=16500 avg=16700)  ← headless 環境値 (参考)
#     js     : [6, 5, 5] ms              (min=5 avg=5)          ← 自動退行検知の主指標
#   結果: PASS (js avg=5 ms <= 1000 ms)
#
# 依存:
#   - google-chrome または chromium
#   - grep

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 引数処理
RUNS=3
TARGET_FILE="${PROJECT_ROOT}/index.html"
TARGET_MODE="dev"
for arg in "$@"; do
    case $arg in
        --runs)
            shift
            RUNS="${1:-3}"
            shift
            ;;
        --runs=*)
            RUNS="${arg#*=}"
            ;;
        --dist)
            TARGET_FILE="${PROJECT_ROOT}/dist/kuku-dojo.html"
            TARGET_MODE="dist"
            ;;
        -h|--help)
            sed -n '3,27p' "$0"
            exit 0
            ;;
    esac
done

if [ ! -f "$TARGET_FILE" ]; then
    echo "[エラー] 対象ファイルが存在しません: $TARGET_FILE" >&2
    if [ "$TARGET_MODE" = "dist" ]; then
        echo "        Step 10 の npm run build でビルドしてから再実行してください。" >&2
    fi
    exit 1
fi

# Chrome バイナリ検出
CHROME_BIN=""
for bin in google-chrome chromium chromium-browser; do
    if command -v "$bin" >/dev/null 2>&1; then
        CHROME_BIN="$bin"
        break
    fi
done
if [ -z "$CHROME_BIN" ]; then
    echo "[エラー] google-chrome / chromium が見つかりません" >&2
    exit 1
fi

# 自動判定の目標値: js 区間のみ (headless でも安定)
# total 区間は headless 環境のオーバーヘッドを含むため自動判定には使わない
if [ "$TARGET_MODE" = "dev" ]; then
    JS_TARGET_MS=1000       # 開発版: Babel 変換込みで 1 秒以内
    TOTAL_REFERENCE_MS=5000 # 実ブラウザでの参考目標 (SPEC.md §6.1)
else
    JS_TARGET_MS=200        # 配布版: 実行時変換なしなので 200ms 以内
    TOTAL_REFERENCE_MS=2000 # 実ブラウザでの参考目標 (SPEC.md §6.1)
fi

FILE_URL="file://${TARGET_FILE}"

echo "=============================================="
echo " kuku-dojo 起動時間計測"
echo "=============================================="
echo " 対象        : ${FILE_URL}"
echo " モード      : ${TARGET_MODE}"
echo " 実行回数    : ${RUNS}"
echo " Chrome      : $(${CHROME_BIN} --version)"
echo " 目標 (自動) : js <= ${JS_TARGET_MS} ms (headless で安定)"
echo " 目標 (参考) : total <= ${TOTAL_REFERENCE_MS} ms (実ブラウザで計測)"
echo "=============================================="

TOTALS=()
JS_VALUES=()

run_one() {
    local idx=$1
    local tmp_profile tmp_err
    tmp_profile=$(mktemp -d)
    tmp_err=$(mktemp)
    "$CHROME_BIN" \
        --headless \
        --disable-gpu \
        --no-sandbox \
        --disable-dev-shm-usage \
        --no-first-run \
        --disable-background-networking \
        --disable-sync \
        --disable-default-apps \
        --disable-extensions \
        --disable-component-update \
        --disable-domain-reliability \
        --metrics-recording-only \
        --no-default-browser-check \
        --user-data-dir="$tmp_profile" \
        --enable-logging=stderr \
        --dump-dom \
        "$FILE_URL" >/dev/null 2>"$tmp_err" || true
    local output
    output=$(grep -oE '\[kuku-dojo\] startup: total=[0-9]+ms js=[0-9]+ms' "$tmp_err" | tail -1 || true)
    rm -rf "$tmp_profile" "$tmp_err"

    if [ -z "$output" ]; then
        echo "  run #${idx}: ❌ 起動時間ログが検出できませんでした"
        return 1
    fi
    local total js
    total=$(echo "$output" | grep -oE 'total=[0-9]+' | grep -oE '[0-9]+')
    js=$(echo "$output"    | grep -oE 'js=[0-9]+'    | grep -oE '[0-9]+')
    echo "  run #${idx}: total=${total}ms  js=${js}ms"
    TOTALS+=("$total")
    JS_VALUES+=("$js")
}

for i in $(seq 1 "$RUNS"); do
    run_one "$i"
done

if [ "${#TOTALS[@]}" -eq 0 ]; then
    echo "[エラー] 全ての実行で計測に失敗しました。index.html が正しく起動するか手動で確認してください。" >&2
    exit 1
fi

# 統計計算
JS_AVG=0
TOTAL_AVG=0
compute_stats() {
    local label=$1
    shift
    local values=("$@")
    local min=${values[0]}
    local max=${values[0]}
    local sum=0
    for v in "${values[@]}"; do
        [ "$v" -lt "$min" ] && min=$v
        [ "$v" -gt "$max" ] && max=$v
        sum=$((sum + v))
    done
    local avg=$((sum / ${#values[@]}))
    printf "  %-6s : %s ms  (min=%d max=%d avg=%d)\n" "$label" "[$(IFS=, ; echo "${values[*]}")]" "$min" "$max" "$avg"
    if [ "$label" = "total" ]; then TOTAL_AVG=$avg; fi
    if [ "$label" = "js" ];    then JS_AVG=$avg; fi
}

echo ""
echo "── 統計 ────────────────────────────────────────"
compute_stats "total" "${TOTALS[@]}"
compute_stats "js"    "${JS_VALUES[@]}"

# 判定: js を主指標とする (headless でも安定)
echo ""
if [ "${JS_AVG}" -le "${JS_TARGET_MS}" ]; then
    echo "結果: ✅ PASS (js avg=${JS_AVG}ms <= ${JS_TARGET_MS}ms)"
    PASS=0
else
    echo "結果: ❌ FAIL (js avg=${JS_AVG}ms > ${JS_TARGET_MS}ms)"
    PASS=1
fi

echo ""
echo "注意:"
echo "  - js は Babel 変換 + React 初回レンダのみを捕捉する狭い指標で、headless でも安定する。"
echo "  - total は HTML/CDN ダウンロードを含むが、headless Chrome の起動オーバーヘッドで"
echo "    15〜25 秒水増しされる。実ブラウザ (Chrome/Edge/Firefox) でダブルクリック起動し、"
echo "    DevTools コンソールの \`[kuku-dojo] startup: total=...\` を正しいベースラインとして"
echo "    README.md に記録すること。SPEC.md §6.1.1 を参照。"

exit $PASS
