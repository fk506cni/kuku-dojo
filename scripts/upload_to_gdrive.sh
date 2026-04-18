#!/bin/bash

# Google Drive アップロードスクリプト
#
# 使い方:
#   upload_to_gdrive.sh <path>           # 指定したファイルまたはディレクトリをアップロード
#   upload_to_gdrive.sh                  # 引数なし: /tmp/${PROJECT_NAME}/ 以下の最新 RUN_DIR を探す
#
# 環境変数 (任意):
#   GDRIVE_REMOTE  rclone remote 名 (既定: "gdrive")
#   GDRIVE_FOLDER  アップロード先フォルダパス (既定: "tmp/${PROJECT_NAME}")
#
# 動作:
#   - 引数にファイルを渡すと、そのファイル単体を ${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/ にコピー
#   - 引数にディレクトリを渡すと、ディレクトリを丸ごと
#     ${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/$(basename DIR)/ にコピー (create_package.sh の RUN_DIR 想定)
#   - 引数なしのときは /tmp/${PROJECT_NAME}/v*_*/ の最新サブフォルダを自動検出
#
# 依存: rclone (remote 設定済みのこと)
# 終了コード: 0=成功 / 1=対象なし・アップロード失敗 / 127=rclone 未インストール

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
# C11-14: 環境変数でユーザー個別設定を上書き可能にする
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive}"
GDRIVE_FOLDER="${GDRIVE_FOLDER:-tmp/${PROJECT_NAME}}"
OUTPUT_DIR="/tmp/${PROJECT_NAME}"

# C11-02: rclone 未インストール時の分かりやすいエラー
if ! command -v rclone >/dev/null 2>&1; then
    echo "Error: rclone がインストールされていません。" >&2
    echo "       https://rclone.org/install/ から導入し、" >&2
    echo "       'rclone config' で remote 名 '${GDRIVE_REMOTE}' を設定してください。" >&2
    exit 127
fi

TARGET="${1:-}"

# 引数なし: 最新の RUN_DIR (v*_*) を自動検出
if [ -z "$TARGET" ]; then
    TARGET=$(ls -td "${OUTPUT_DIR}"/v*_*/ 2>/dev/null | head -n 1)
    if [ -z "$TARGET" ]; then
        # 後方互換: 旧レイアウトで RUN_DIR 無しに zip だけが置かれていた場合
        TARGET=$(ls -t "${OUTPUT_DIR}"/kuku-dojo_*.zip 2>/dev/null | head -n 1)
    fi
fi

if [ -z "$TARGET" ] || [ ! -e "$TARGET" ]; then
    echo "Error: アップロード対象が見つかりません。" >&2
    echo "       引数に RUN_DIR/ファイルを指定するか、先に create_package.sh を実行してください。" >&2
    exit 1
fi

# ディレクトリなら basename をリモート先に付けて配下をまるごと同期、
# ファイルなら GDRIVE_FOLDER 直下にコピー。
if [ -d "$TARGET" ]; then
    DEST="${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/$(basename "$TARGET")"
    echo "アップロード対象: $(basename "$TARGET")/ (ディレクトリ)"
else
    DEST="${GDRIVE_REMOTE}:${GDRIVE_FOLDER}"
    echo "アップロード対象: $(basename "$TARGET")"
fi
echo "アップロード先  : ${DEST}"

# C11-02: set -e 下では `rclone copy` 失敗時にスクリプトが即 exit するため
# `$? -eq 0` 分岐が到達不能だった。if-then-else で明示し、失敗時メッセージを確実に出す。
if rclone copy "$TARGET" "$DEST" --progress; then
    echo "✓ アップロード完了: $(basename "$TARGET")"
else
    rc=$?
    echo "✗ アップロード失敗 (rclone exit=${rc})" >&2
    echo "  ヒント: 'rclone lsd ${GDRIVE_REMOTE}:' で remote 接続を確認してください。" >&2
    exit "${rc}"
fi
