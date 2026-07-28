#!/bin/bash

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

MODE="full"
case "${1:-}" in
  ""|--full) MODE="full" ;;
  --compact) MODE="compact" ;;
  *) echo "使い方: ./tools/start_chat.sh [--full|--compact]" >&2; exit 1 ;;
esac

AGENTS_FILE="AGENTS.md"
MEMORY_FILES="
docs/project-memory/01_SYSTEM_DESIGN.md
docs/project-memory/02_DEVELOPMENT_RULES.md
docs/project-memory/03_PROJECT_MAP.md
docs/project-memory/04_CURRENT_STATUS.md
docs/ROADMAP.md
"
VERIFICATION_DIR="docs/verification"
OUTPUT_FILE="$(mktemp -t sales-management-start-chat-package.XXXXXX)" || exit 1

missing=0
if [ ! -f "$AGENTS_FILE" ]; then
  echo "必要な資料がありません: $AGENTS_FILE" >&2
  missing=$((missing + 1))
fi
for file in $MEMORY_FILES; do
  if [ ! -f "$file" ]; then
    echo "必要な資料がありません: $file" >&2
    missing=$((missing + 1))
  fi
done
if [ ! -d "$VERIFICATION_DIR" ]; then
  echo "必要なフォルダがありません: $VERIFICATION_DIR" >&2
  missing=$((missing + 1))
fi
if [ "$missing" -ne 0 ]; then exit 1; fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch="$(git branch --show-current 2>/dev/null || true)"
  latest_commit="$(git log -1 --oneline 2>/dev/null || true)"
  git_status="$(git status --short --branch --untracked-files=all 2>&1)"
else
  branch="Git未初期化"
  latest_commit="Git未初期化"
  git_status="Gitリポジトリが初期化されていません。"
fi

{
  echo "=================================================="
  echo "営業管理システム 新エージェントシステムv2 開始パッケージ"
  echo "=================================================="
  echo
  echo "正式な情報源は、既存設計書、AGENTS.md、Project Memory、Roadmap、必要な検証手順、実コード、Git状態です。"
  echo
  echo "【必須事項】"
  echo "- 現在地整理前に実装しない"
  echo "- 1ステップにつき1つの目的だけを扱う"
  echo "- 未確定事項を推測で正式仕様にしない"
  echo "- 既存IDと業務ロジックを保護する"
  echo "- 外部状態を変える操作では許可ルールを守る"
  echo "- 必要な実機確認完了前にGitHubへ安定地点として保存しない"
  echo
  echo "【最初に報告すること】"
  echo "1. 現在のPhaseとStep"
  echo "2. 最新安定地点とGit状態"
  echo "3. 未確認事項と保留事項"
  echo "4. 今回の1目的"
  echo "5. 変更対象と変更しない範囲"
  echo "6. 今回読む検証手順"
  echo "7. 必要なテスト、実機確認、許可"
  echo
  echo "=================================================="
  echo "Git状態"
  echo "=================================================="
  echo "プロジェクトルート: $PROJECT_ROOT"
  echo "ブランチ: ${branch:-未取得}"
  echo "最新コミット: ${latest_commit:-未取得}"
  echo "$git_status"

  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo
    echo "----- 変更ファイル -----"
    git status --short --untracked-files=all
    echo
    echo "----- 差分概要 -----"
    git diff --stat
    git diff --cached --stat
    if [ "$MODE" = "full" ]; then
      echo
      echo "----- 未ステージ差分詳細（検証手順全文を除く） -----"
      git diff -- . ':(exclude)docs/verification/**'
      echo
      echo "----- ステージ済み差分詳細（検証手順全文を除く） -----"
      git diff --cached -- . ':(exclude)docs/verification/**'
    fi
  fi

  echo
  echo "=================================================="
  echo "AGENTS.md"
  echo "=================================================="
  cat "$AGENTS_FILE"

  echo
  echo "=================================================="
  echo "利用可能な検証手順ファイル一覧"
  echo "=================================================="
  find "$VERIFICATION_DIR" -maxdepth 1 -type f -name '*.md' -print | LC_ALL=C sort

  for file in $MEMORY_FILES; do
    echo
    echo "=================================================="
    echo "$file"
    echo "=================================================="
    cat "$file"
  done
} | tee "$OUTPUT_FILE"

if [ "${NO_CLIPBOARD:-0}" != "1" ] && command -v pbcopy >/dev/null 2>&1; then
  pbcopy < "$OUTPUT_FILE"
  echo "開始パッケージをクリップボードへコピーしました。"
else
  echo "開始パッケージを次へ保存しました: $OUTPUT_FILE"
fi
