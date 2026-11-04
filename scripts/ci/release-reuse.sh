#!/usr/bin/env bash
# @file release-reuse.sh
# @description Release 门禁复用判断：标签提交在 main 上已有全部任务成功（无跳过）的 CI / Backend CI 时，
#   对应门禁可以复用而不重跑。输出 GitHub Actions 的 ci=true|false、backend=true|false，并打印原因。
#   - CI：只认同一提交的最新一次 main 推送运行；main 上的 CI 会按改动跳过任务，有任何任务跳过即不复用。
#   - Backend CI：同一提交没有运行时，可复用 main 上最近一次成功运行，前提是该运行的提交是标签提交的祖先，
#     且两者之间的改动不涉及 Backend CI 的触发路径（与 backend-ci.yml 的 paths 保持一致）。
#   任何查询失败、运行未完成或条件不满足都按“不复用”处理，回到完整门禁。
#   用法：GH_TOKEN=... release-reuse.sh <owner/repo> <提交 SHA>（需在包含完整历史的检出目录中运行）
set -euo pipefail

repo=${1:?缺少仓库}
sha=${2:?缺少提交 SHA}

# 与 .github/workflows/backend-ci.yml 的 paths 一致：命中即说明后端门禁的输入发生了变化。
backend_path() {
  case $1 in
    src/backend/server-main/README.md) return 1 ;;
    src/backend/* | .github/workflows/backend-ci.yml | pnpm-lock.yaml | pnpm-workspace.yaml | compose.production.yaml | deploy/* | scripts/release/* | docs/api.md) return 0 ;;
    *) return 1 ;;
  esac
}

# 运行已完成、结论成功，且其中每个任务都成功（没有跳过、取消或失败）。
# 先取完整输出再比较：不把输出接给 grep -q，避免提前退出在 pipefail 下造成误判。
run_fully_passed() {
  local id=$1 summary all_success
  summary=$(gh api "repos/${repo}/actions/runs/${id}" --jq '"\(.status) \(.conclusion)"') || return 1
  [ "${summary}" = 'completed success' ] || return 1
  all_success=$(gh api "repos/${repo}/actions/runs/${id}/jobs?per_page=100" \
    --jq '(.jobs | length) > 0 and all(.jobs[]; .conclusion == "success")') || return 1
  [ "${all_success}" = true ]
}

# 同一提交在 main 上最新一次推送运行的 id；没有时输出空。
latest_run_for_sha() {
  gh api "repos/$repo/actions/workflows/$1/runs?head_sha=$sha&branch=main&event=push&per_page=1" \
    --jq '.workflow_runs[0].id // empty'
}

ci=false
id=$(latest_run_for_sha ci.yml || true)
if [ -z "$id" ]; then
  echo "CI：提交 ${sha} 在 main 上没有推送运行，完整运行门禁" >&2
elif run_fully_passed "$id"; then
  ci=true
  echo "CI：复用 main 上的运行 ${id}（全部任务成功）" >&2
else
  echo "CI：main 上的运行 ${id} 未完成、未成功或有任务被跳过，完整运行门禁" >&2
fi

backend=false
id=$(latest_run_for_sha backend-ci.yml || true)
if [ -n "$id" ]; then
  if run_fully_passed "$id"; then
    backend=true
    echo "Backend CI：复用同一提交在 main 上的运行 ${id}" >&2
  else
    echo "Backend CI：同一提交在 main 上的运行 ${id} 未完成或未全部成功，完整运行门禁" >&2
  fi
else
  # 同一提交没有运行：说明这次推送没有触及后端路径。在最近的成功运行里取第一个是标签提交祖先的，核对两者之间的改动。
  candidate=''
  while IFS=' ' read -r run_id run_sha; do
    [ -n "${run_sha}" ] || continue
    if git merge-base --is-ancestor "${run_sha}" "${sha}" 2> /dev/null; then
      candidate="${run_id} ${run_sha}"
      break
    fi
  done < <(gh api "repos/${repo}/actions/workflows/backend-ci.yml/runs?branch=main&event=push&status=success&per_page=30" \
    --jq '.workflow_runs[] | "\(.id) \(.head_sha)"' || true)
  base_id=${candidate%% *}
  base_sha=${candidate#* }
  if [ -z "${candidate}" ]; then
    echo 'Backend CI：最近 30 次成功运行中没有标签提交的祖先，完整运行门禁' >&2
  else
    changed=$(git diff --name-only "$base_sha" "$sha")
    touched=''
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      if backend_path "$file"; then
        touched=$file
        break
      fi
    done <<< "$changed"
    if [ -n "$touched" ]; then
      echo "Backend CI：${base_sha} 之后改动了 ${touched}，完整运行门禁" >&2
    elif run_fully_passed "$base_id"; then
      backend=true
      echo "Backend CI：复用 main 上的运行 ${base_id}（提交 ${base_sha} 之后没有后端相关改动）" >&2
    else
      echo "Backend CI：运行 ${base_id} 有任务未成功，完整运行门禁" >&2
    fi
  fi
fi

printf 'ci=%s\nbackend=%s\n' "${ci}" "${backend}"
