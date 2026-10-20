#!/usr/bin/env bash
# @file check-ai-attribution.sh
# @description 检查一段提交范围内的提交信息是否带 AI 署名 trailer（Co-authored-by: Cursor/Claude/Copilot 等），
#   带了就列出并返回非零。规则与 .husky/commit-msg 剥离的内容一致，用于拦截绕过本机钩子的提交（如网页端提交）。
#   用法：bash scripts/check-ai-attribution.sh <提交范围>，例如 origin/main..HEAD；不传时检查 HEAD 单个提交。
set -euo pipefail

readonly PATTERN='^[[:space:]]*(Co-authored-by:[[:space:]]*(Claude|Happy|Cursor|cursoragent|Cursor Agent|Copilot|GitHub Copilot|Codex|OpenAI|ChatGPT|Gemini|Grok|Windsurf|Devin|Aider)([[:space:]]|<|$)|Co-authored-by:.*(noreply@anthropic\.com|yesreply@happy\.engineering|@cursor\.(com|sh)|copilot@github\.com|@openai\.com)|Claude-Session:|(.{0,8}[[:space:]])?Generated with \[?(Claude Code|Cursor)\]?|via \[?Happy\]?([[:space:]]*\(|$)|🤖)'

range=${1:-HEAD^!}
found=0
while read -r commit; do
  [ -n "$commit" ] || continue
  lines=$(git log -1 --format=%B "$commit" | LC_ALL=C grep -iE "$PATTERN" || true)
  [ -n "$lines" ] || continue
  found=1
  printf '提交 %s（%s）带 AI 署名：\n%s\n\n' "$(git rev-parse --short "$commit")" "$(git log -1 --format=%s "$commit")" "$lines"
done < <(git rev-list "$range")

if [ "$found" = 1 ]; then
  printf '提交信息不得包含 AI 署名（见 AGENTS.md「版本控制与文档」）。请改写这些提交后重新推送。\n' >&2
  exit 1
fi
printf '未发现 AI 署名（范围 %s）\n' "$range"
