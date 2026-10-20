#!/usr/bin/env bash
# @file check-local.sh
# @description 推送前在本机按改动自动挑选并运行与 CI 对应的检查：能本地完成的先在本地完成，减少推送后才发现 CI 失败。
#   改动范围 = 相对 origin/main 的已提交改动 + 工作区未提交改动 + 未跟踪文件。
#   用法：corepack pnpm check:local [--e2e] [--all]
#     --e2e  额外运行改动涉及的浏览器 spec（会先构建前后端，较慢）；改动了应用代码但没有改 spec 时运行全量
#     --all  不按改动挑选，运行全部本地检查
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd -P)
cd "$root"
run_e2e=0
run_all=0
for arg in "$@"; do
  case $arg in
    --e2e) run_e2e=1 ;;
    --all) run_all=1 ;;
    -h | --help)
      sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      printf '未知参数 %s；用法见 --help\n' "$arg" >&2
      exit 2
      ;;
  esac
done

base=origin/main
git rev-parse --verify --quiet "$base" > /dev/null || base=HEAD
files=$(
  {
    git diff --name-only "$base...HEAD"
    git diff --name-only HEAD
    git ls-files --others --exclude-standard
  } | sort -u
)
if [ "$run_all" = 0 ] && [ -z "$files" ]; then
  printf '相对 %s 没有改动，无需检查。\n' "$base"
  exit 0
fi

changed() { [ "$run_all" = 1 ] || printf '%s\n' "$files" | LC_ALL=C grep -qE "$1"; }
failed=()
step() {
  local label=$1
  shift
  printf '\n▶ %s\n' "$label"
  if "$@"; then printf '✓ %s\n' "$label"; else
    printf '✗ %s\n' "$label"
    failed+=("$label")
  fi
}

printf '检查范围（相对 %s）：%s 个文件\n' "$base" "$(printf '%s\n' "$files" | grep -c .)"

step '敏感信息扫描' corepack pnpm check:secrets
[ "$base" = HEAD ] || step '提交信息 AI 署名' bash scripts/check-ai-attribution.sh "$base..HEAD"

if changed '^(src/frontend/|src/shared/|patches/|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|package\.json$)'; then
  step '前端 lint' corepack pnpm lint
  step '前端类型检查' corepack pnpm --filter web-blog exec nuxt typecheck
  step '前端单元测试' corepack pnpm --filter web-blog test
fi
if changed '^(src/backend/|src/shared/|pnpm-lock\.yaml$|docs/api\.md$)'; then
  step '后端 lint' corepack pnpm --filter server-main lint
  step '后端类型检查' corepack pnpm --filter server-main typecheck
  step '后端单元测试' corepack pnpm --filter server-main test
fi
if changed '^(deploy/|scripts/release/|scripts/ci/|scripts/check-[^/]+\.sh$|\.husky/)'; then
  if command -v shellcheck > /dev/null 2>&1; then
    step 'Shell 检查' corepack pnpm lint:shell
  elif command -v docker > /dev/null 2>&1 && docker info > /dev/null 2>&1; then
    # 与 CI 固定的 v0.11.0 一致
    # shellcheck disable=SC2046
    step 'Shell 检查（shellcheck v0.11.0 镜像）' docker run --rm -v "$root:/mnt" -w /mnt koalaman/shellcheck:v0.11.0 \
      $(node -p "require('./package.json').scripts['lint:shell'].replace(/^shellcheck /, '')")
  else
    printf '\n! 跳过 Shell 检查：本机没有 shellcheck，也没有可用的 Docker；CI 会照常检查\n'
  fi
fi
if changed '^(scripts/dev/|scripts/db/)'; then
  step '开发启动器单测' corepack pnpm test:dev
fi

if [ "$run_e2e" = 1 ]; then
  specs=$(printf '%s\n' "$files" | sed -n 's#^src/frontend/web-blog/tests/e2e/\([^/]*\.spec\.ts\)$#\1#p' | tr '\n' ' ')
  if [ -n "$specs" ]; then
    # shellcheck disable=SC2086
    step "浏览器回归：${specs}" corepack pnpm test:e2e $specs
  elif changed '^(src/|patches/|pnpm-lock\.yaml$)'; then
    step '浏览器回归（全量）' corepack pnpm test:e2e
  fi
elif changed '^(src/|patches/|pnpm-lock\.yaml$)'; then
  printf '\n提示：改动涉及应用代码，CI 会跑浏览器回归；需要先在本地跑时加 --e2e，或用 corepack pnpm test:e2e:run <spec>。\n'
fi

if [ "${#failed[@]}" -gt 0 ]; then
  printf '\n未通过：%s\n先修复再推送。\n' "${failed[*]}" >&2
  exit 1
fi
printf '\n本地检查全部通过。\n'
