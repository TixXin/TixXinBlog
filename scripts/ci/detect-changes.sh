#!/usr/bin/env bash
# @file detect-changes.sh
# @description 按改动文件判断需要运行的检查，供 CI 跳过无关任务、本地 check:local 挑选检查共用。
#   输出 app=true|false 与 images=true|false 两行（可直接追加到 $GITHUB_OUTPUT）。
#   判断从保守出发：只有全部改动都属于明确无关的类别才输出 false，任何未列入的路径都按需要全量处理。
#   用法：bash scripts/ci/detect-changes.sh <提交范围>|--full|--files <文件列表文件>
set -euo pipefail

# 不影响应用代码、浏览器回归、类型检查与构建的路径（部署与开发脚本、钩子、其他工作流、说明文件）
readonly NON_APP='^(deploy/|scripts/release/|scripts/dev/|scripts/db/|scripts/ci/|scripts/docs/|scripts/check-[^/]+\.sh$|\.husky/|\.github/(dependabot\.yml|CODEOWNERS|PULL_REQUEST_TEMPLATE\.md|ISSUE_TEMPLATE/|workflows/(commit-policy|security|codeql|lighthouse|release|backend-ci)\.yml$)|\.gitattributes$|\.gitignore$|\.dockerignore$|Dockerfile$|compose[^/]*\.ya?ml$|docs/|[^/]+\.md$|LICENSE)'
# 同时不影响镜像构建、容器冒烟与安装冒烟的路径（NON_APP 去掉部署脚本、Dockerfile 与编排）
readonly NON_IMAGE='^(scripts/dev/|scripts/db/|scripts/ci/|scripts/docs/|scripts/check-[^/]+\.sh$|\.husky/|\.github/(dependabot\.yml|CODEOWNERS|PULL_REQUEST_TEMPLATE\.md|ISSUE_TEMPLATE/|workflows/(commit-policy|security|codeql|lighthouse|release|backend-ci)\.yml$)|\.gitattributes$|\.gitignore$|docs/|[^/]+\.md$|LICENSE)'

full() {
  printf 'app=true\nimages=true\n'
  exit 0
}

case ${1:-} in
  '' | --full) full ;;
  --files) files=$(cat "$2") ;;
  *) files=$(git diff --name-only "$1") || full ;;
esac

# 没有可比较的改动时同样全量，避免误判为可跳过
[ -n "$files" ] || full

flag() {
  if printf '%s\n' "$files" | LC_ALL=C grep -qvE "$1"; then echo true; else echo false; fi
}
printf 'app=%s\nimages=%s\n' "$(flag "$NON_APP")" "$(flag "$NON_IMAGE")"
