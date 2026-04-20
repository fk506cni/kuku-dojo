#!/bin/bash

# kuku-dojo パッケージ作成スクリプト
#
# 2 モードを提供する:
#   release (既定) : dist/kuku-dojo.html + README.md + LICENSE を配布用 zip にまとめる
#                    (GitHub Releases 等へのアップロード想定)
#   source         : index.html + ドキュメント + scripts + 設定ファイル等を
#                    開発バックアップ用 zip にまとめる
#
# 使用方法:
#   ./create_package.sh                         # release モード + Google Drive アップロード
#   ./create_package.sh --no-upload             # release モード (アップロードなし)
#   ./create_package.sh --source                # source モード + Google Drive アップロード
#   ./create_package.sh --source --no-upload    # source モード (アップロードなし)
#   ./create_package.sh -n                      # --no-upload の短縮
#
# 注意:
#   - release モードは dist/kuku-dojo.html の存在を前提とする。
#     無ければ `npm run build` を試行し、失敗したらエラー終了する。
#   - SPEC.md §7.1 (完全オフライン配布) の方針に従い、release パッケージには
#     Node / ビルドツール類は含めない。利用者には単一 HTML を渡すだけで済む。

set -e

# ── コマンドライン引数処理 ────────────────────────────────────
MODE="release"
AUTO_UPLOAD=true
for arg in "$@"; do
    case $arg in
        --release)
            MODE="release"
            ;;
        --source|-s)
            MODE="source"
            ;;
        --no-upload|-n)
            AUTO_UPLOAD=false
            ;;
        -h|--help)
            sed -n '3,23p' "$0"
            exit 0
            ;;
        *)
            echo "[警告] 未知の引数: $arg"
            ;;
    esac
done

# ── 基本設定 ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
# C11-09: 秒粒度 TIMESTAMP のみだと同一秒での多重実行時に RUN_DIR が上書きされる。
# PID を付与して衝突回避 (date +%N はプラットフォーム非互換のため採用しない)。
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")_p$$"

# バージョン取得: package.json を single source of truth として node -p で抽出 (C11-21)。
# node が無い / package.json が無い / 抽出失敗時は index.html の先頭コメントにフォールバック。
VERSION="unknown"
if [ -f "${PROJECT_ROOT}/package.json" ] && command -v node >/dev/null 2>&1; then
    VERSION=$(node -p "require('${PROJECT_ROOT}/package.json').version" 2>/dev/null || echo "unknown")
elif [ -f "${PROJECT_ROOT}/index.html" ]; then
    VERSION=$(grep -m1 '^\s*Version:' "${PROJECT_ROOT}/index.html" | sed -E 's/.*Version:\s*([^ ]+).*/\1/' || echo "unknown")
fi

ZIP_FILENAME="kuku-dojo_${MODE}_v${VERSION}_${TIMESTAMP}.zip"
OUTPUT_DIR="/tmp/${PROJECT_NAME}"
# バージョン付きサブフォルダにまとめる: 1 回のビルドで出る成果物 (zip + 生ビルド HTML +
# PACKAGE_INFO.md) を同一ディレクトリに格納しておくと、rclone copy で丸ごと
# Google Drive の同名フォルダに同期でき、履歴管理もしやすい。
RUN_DIR="${OUTPUT_DIR}/v${VERSION}_${TIMESTAMP}"
ZIP_PATH="${RUN_DIR}/${ZIP_FILENAME}"
BUILT_HTML_DEST="${RUN_DIR}/kuku-dojo.html"
ARCHIVE_DIR="${PROJECT_ROOT}/__archives"

echo "=============================================="
echo " kuku-dojo パッケージ作成"
echo "=============================================="
echo " モード      : ${MODE}"
echo " バージョン  : ${VERSION}"
echo " 基準        : ${PROJECT_ROOT}"
echo " 出力先      : ${RUN_DIR}/"
echo "             : ├─ ${ZIP_FILENAME}"
if [ "$MODE" = "release" ]; then
    echo "             : └─ kuku-dojo.html (ビルド済み単体 HTML)"
fi
echo " アップロード: $([ "$AUTO_UPLOAD" = true ] && echo "有効" || echo "無効")"
echo "=============================================="

cd "${PROJECT_ROOT}"

# ── 出力先ディレクトリ準備 ───────────────────────────────────
mkdir -p "${OUTPUT_DIR}"
mkdir -p "${RUN_DIR}"
mkdir -p "${ARCHIVE_DIR}"

# プロジェクトルート直下の既存 zip を __archives に退避
if ls kuku-dojo_*.zip 1> /dev/null 2>&1; then
    echo "[準備] 既存の kuku-dojo_*.zip を __archives/ に退避..."
    mv kuku-dojo_*.zip "${ARCHIVE_DIR}/"
fi

# ── PACKAGE_INFO.md 作成 ──────────────────────────────────────
create_release_info() {
    cat > PACKAGE_INFO.md << EOF
# kuku-dojo (くくどうじょう) — 配布パッケージ情報

| 項目 | 内容 |
|------|------|
| 作成日時 | $(date "+%Y-%m-%d %H:%M:%S") |
| パッケージ ID | kuku-dojo_release_v${VERSION}_${TIMESTAMP} |
| バージョン | ${VERSION} |
| 種類 | 配布用パッケージ (release) |

## 含まれるファイル

- \`kuku-dojo.html\` — 本体。完全オフライン動作する単一 HTML
- \`README.md\` — 利用者向け使い方
- \`LICENSE\` — MIT License
- \`PACKAGE_INFO.md\` — 本ファイル

> zip と同じ RUN_DIR (\`v${VERSION}_${TIMESTAMP}/\`) には、zip を展開せずに直接 DL できる
> \`kuku-dojo.html\` (ビルド済み単体 HTML) も併置されます。

## 使い方（エンドユーザー向け）

1. \`kuku-dojo.html\` を任意の場所に保存
2. ダブルクリックでブラウザが開く
3. インターネット接続は不要

Safari ご利用時の注意は README.md を参照してください。

## 注意事項

- 本パッケージに Node.js / ビルドツールは含まれません
- 外部通信は一切行いません (SPEC.md §7.1)
- 対応ブラウザは Chrome / Edge / Firefox / Safari の最新版 (SPEC.md §6.2)
EOF
}

create_source_info() {
    cat > PACKAGE_INFO.md << EOF
# kuku-dojo (くくどうじょう) — ソースバックアップ

| 項目 | 内容 |
|------|------|
| 作成日時 | $(date "+%Y-%m-%d %H:%M:%S") |
| パッケージ ID | kuku-dojo_source_v${VERSION}_${TIMESTAMP} |
| バージョン | ${VERSION} |
| 種類 | ソースバックアップ (source) |

## 含まれるファイル

- \`index.html\` — 開発版 (Play CDN + Babel Standalone)
- \`CLAUDE.md\` / \`SPEC.md\` / \`README.md\` / \`prompts.md\` — プロジェクト文書
- \`LICENSE\` — MIT License
- \`docs/\` — 要件定義書・敵対的レビュー記録等
- \`scripts/\` — 本スクリプトを含む補助スクリプト
- \`package.json\` / \`scripts/build-dist.mjs\` — 配布版ビルド定義 (存在する場合)
- \`PACKAGE_INFO.md\` — 本ファイル

## 除外されるもの

- \`__archives/\` / \`drafts/\` / \`jank/\` / \`refs/\` — 退避・一時
- \`main/\` / \`data/\` / \`docker/\` — 旧テンプレート残置 (本プロジェクト未使用)
- \`node_modules/\` / \`dist-tmp/\` — ビルド中間物
- \`.git/\` / IDE 設定 / OS メタ

## 復元方法

\`\`\`bash
unzip kuku-dojo_source_*.zip -d kuku-dojo-restored/
cd kuku-dojo-restored/
# 開発版をそのまま確認
xdg-open index.html   # または open / python3 -m http.server 8000
# 配布版をビルドする場合 (Step 10 以降)
npm install && npm run build
\`\`\`
EOF
}

# ── release モード ────────────────────────────────────────────
build_release_package() {
    # dist/kuku-dojo.html の存在確認。無ければ npm run build を試行
    if [ ! -f "dist/kuku-dojo.html" ]; then
        echo "[release] dist/kuku-dojo.html が見つかりません"
        if [ -f "package.json" ] && grep -q '"build"' package.json; then
            echo "[release] npm run build を試行..."
            if ! npm run build; then
                echo "[エラー] npm run build が失敗しました。Step 10 のビルドパイプラインが未整備の可能性があります。" >&2
                echo "         (SPEC.md §7.2 / prompts.md Step 10 を参照)" >&2
                exit 1
            fi
        else
            echo "[エラー] package.json または build スクリプトが無いため release パッケージを作れません。" >&2
            echo "        Step 10 の完了後に再実行してください。" >&2
            echo "        ソースバックアップが必要な場合は --source オプションを使ってください。" >&2
            exit 1
        fi
    fi

    # 配布版のサイズ目標チェック (SPEC.md §7.4: 非圧縮 3 MB 未満 / 1 MB 以上で警告)
    # 第12回 C12-20 / C12-23 + 第13回 C13-01 を受け v1.0.x で更新
    local size_bytes
    size_bytes=$(stat -c%s dist/kuku-dojo.html 2>/dev/null || stat -f%z dist/kuku-dojo.html 2>/dev/null || echo 0)
    local size_kb=$(( size_bytes / 1024 ))
    echo "[release] dist/kuku-dojo.html サイズ: ${size_kb} KB"
    if [ "$size_bytes" -gt 3145728 ]; then
        echo "[エラー] 非圧縮 3 MB を超えています (SPEC.md §7.4 HARD FAIL)"
        exit 1
    fi
    if [ "$size_bytes" -gt 1048576 ]; then
        echo "[警告] zip 同梱目安 1 MB を超えています (SPEC.md §7.4 — 配布可能だが要確認)"
    fi

    create_release_info

    echo "[release] zip を作成中..."
    zip -j "${ZIP_PATH}" \
        dist/kuku-dojo.html \
        README.md \
        LICENSE \
        PACKAGE_INFO.md

    # zip とは別に、ビルド済み単体 HTML をそのまま RUN_DIR に残す:
    # zip を展開せずに 1 ファイルだけ Google Drive から取得したい運用を想定。
    echo "[release] ビルド済み HTML を ${BUILT_HTML_DEST} にコピー..."
    cp dist/kuku-dojo.html "${BUILT_HTML_DEST}"

    # PACKAGE_INFO.md は zip 内だけでなく RUN_DIR にも残しておく (GDrive 上での目視確認用)
    mv PACKAGE_INFO.md "${RUN_DIR}/PACKAGE_INFO.md"
}

# ── source モード ─────────────────────────────────────────────
build_source_package() {
    create_source_info

    echo "[source] zip を作成中..."

    # 対象: プロジェクト核となるファイル・ディレクトリのみ
    # 旧テンプレート残置 (main/data/docker) や一時ディレクトリは含めない
    local include_targets=(
        index.html
        CLAUDE.md
        SPEC.md
        README.md
        LICENSE
        prompts.md
        PACKAGE_INFO.md
        docs/
        scripts/
    )

    # 任意で含めるもの (存在すれば)
    for optional in package.json package-lock.json .gitignore; do
        [ -e "$optional" ] && include_targets+=("$optional")
    done

    zip -r "${ZIP_PATH}" "${include_targets[@]}" \
        -x \
        "**/__pycache__/*" \
        "**/*.pyc" \
        "**/.DS_Store" \
        "**/Thumbs.db" \
        "**/.ipynb_checkpoints/*" \
        "**/*.tmp" \
        "**/*.bak" \
        "**/*.swp" \
        "**/*~" \
        "**/.git/*" \
        "**/.git" \
        "**/.idea/*" \
        "**/.vscode/*" \
        "docs/__archives/*" \
        "docs/__archives"

    # PACKAGE_INFO.md は zip 内だけでなく RUN_DIR にも残しておく
    mv PACKAGE_INFO.md "${RUN_DIR}/PACKAGE_INFO.md"
}

# ── モード別に実行 ────────────────────────────────────────────
case "$MODE" in
    release) build_release_package ;;
    source)  build_source_package  ;;
    *)
        echo "[エラー] 不明なモード: $MODE" >&2
        exit 1
        ;;
esac

# ── 結果表示 ─────────────────────────────────────────────────
echo ""
echo "=============================================="
echo " パッケージ作成完了"
echo "=============================================="
echo " ラン ディレクトリ: ${RUN_DIR}"
echo ""
echo " 格納ファイル:"
ls -lh "${RUN_DIR}" | tail -n +2 | awk '{printf "   %-40s %s\n", $9, $5}'
echo ""
echo "=== zip の内訳 ==="
unzip -l "${ZIP_PATH}" | head -30
total_line=$(unzip -l "${ZIP_PATH}" | tail -1)
echo "..."
echo "(${total_line})"

# ── Google Drive アップロード ────────────────────────────────
upload_to_gdrive_if_available() {
    local uploader="${SCRIPT_DIR}/upload_to_gdrive.sh"
    if [ ! -x "$uploader" ]; then
        echo "[情報] ${uploader} が見つからない/実行不可のため、アップロードはスキップします。"
        return 0
    fi
    echo ""
    echo "Google Drive にアップロード中 (RUN_DIR 丸ごと)..."
    # RUN_DIR をまとめて渡す: uploader 側で rclone copy するとディレクトリ内の
    # zip / 生ビルド HTML / PACKAGE_INFO.md を同一リモートフォルダに同期する。
    "$uploader" "${RUN_DIR}" || {
        echo "[警告] アップロードに失敗しましたが、ローカルは ${RUN_DIR} に保存されています。"
        return 0
    }
}

print_next_steps() {
    echo ""
    echo "次のステップ:"
    if [ "$MODE" = "release" ]; then
        echo "1. ${RUN_DIR}/ を GitHub Releases 等にアップロード"
        echo "   (${BUILT_HTML_DEST} は zip 展開不要の単体 HTML として添付も可能)"
        echo "2. 利用者は kuku-dojo.html をダブルクリックするだけ"
        echo "3. Safari 利用者向けには README.md の python3 -m http.server 案内を併記"
    else
        echo "1. ${RUN_DIR}/ を安全な場所に保管 (ソースバックアップ)"
        echo "2. 復元は unzip 後 xdg-open index.html で即起動"
        echo "3. 配布版をビルドする場合は npm install && npm run build (Step 10 完了後)"
    fi
}

if [ "$AUTO_UPLOAD" = true ]; then
    upload_to_gdrive_if_available
    print_next_steps
elif [ -t 0 ]; then
    echo ""
    read -p "Google Drive にアップロードしますか？ (y/N): " UPLOAD_CHOICE
    if [[ "$UPLOAD_CHOICE" =~ ^[Yy]$ ]]; then
        upload_to_gdrive_if_available
    fi
    print_next_steps
else
    print_next_steps
fi
