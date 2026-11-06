#!/usr/bin/env bash
# @file check-local.sh
# @description 推送前在本机按改动自动挑选并运行与 CI 对应的检查：能本地完成的先在本地完成，减少推送后才发现 CI 失败。
#   改动范围 = 相对 origin/main 的已提交改动 + 工作区未提交改动 + 未跟踪文件。
#   用法：corepack pnpm check:local [--e2e | --e2e-full] [--all]
#     --e2e       额外运行改动涉及的浏览器 spec（会先构建前后端）；改动影响全站外壳或构建产物时加跑冒烟 spec，
#                 其余没有改动 spec 时只提示，完整浏览器回归交给 CI
#     --e2e-full  在本机运行全部浏览器 spec（约 20 分钟，一般不需要；CI 与 Release 门禁都会跑全量）
#     --all       不按改动挑选，运行全部本地检查（含全部后端 HTTP 集成测试，需要本机 PostgreSQL）
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd -P)
cd "$root"
run_e2e=0
run_all=0
for arg in "$@"; do
  case $arg in
    --e2e) run_e2e=1 ;;
    --e2e-full) run_e2e=full ;;
    --all) run_all=1 ;;
    -h | --help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      printf '未知参数 %s；用法见 --help\n' "$arg" >&2
      exit 2
      ;;
  esac
done

# 多会话共用工作区：整轮检查持有本机 build 锁（与 build、test:e2e 同一把），避免与其他会话的构建互相覆盖产物、抢端口。
# 已在锁内（例如经 push:main 或嵌套调用）时 with-lock 直接执行，不会自锁。
if [ -z "${CHECK_LOCAL_LOCKED:-}" ]; then
  CHECK_LOCAL_LOCKED=1 exec node "$root/scripts/dev/with-lock.mjs" build -- bash "$root/scripts/check-local.sh" "$@"
fi

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
# 后端与共享包改动不触发前端 lint，UTC 截日检查很快，每次都跑
step 'UTC 截日检查' node scripts/check-utc-day.mjs
[ "$base" = HEAD ] || step '提交信息 AI 署名' bash scripts/check-ai-attribution.sh "$base..HEAD"

# 发版的版本提交只改 CHANGELOG.md 与各 package.json 的 version 行，不影响构建与测试，跳过其余检查（--all/--e2e 时照常运行）。
if [ "$run_all" = 0 ] && [ "$run_e2e" = 0 ] && node scripts/dev/release-prepare.mjs --version-only "$base"; then
  printf '\n只改了版本号与更新日志，跳过其余检查。\n'
  if [ "${#failed[@]}" -gt 0 ]; then
    printf '\n未通过：%s\n先修复再推送。\n' "${failed[*]}" >&2
    exit 1
  fi
  exit 0
fi

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
# HTTP 集成测试在开发库所在的 PostgreSQL 上各自建临时库，不碰日常数据；按改动的模块挑选，--all 时全量。
all_flag=''
[ "$run_all" = 1 ] && all_flag=--all
# shellcheck disable=SC2086
integration=$(printf '%s\n' "$files" | node scripts/ci/integration-tests.mjs $all_flag)
# here-string 而非管道：grep -q 提前退出会让 printf 收到 SIGPIPE，pipefail 下悄悄跳过集成测试
if grep -q '^[^#]' <<< "$integration"; then
  printf '%s\n' "$integration" | sed -n 's/^# /提示：/p'
  built_before=${#failed[@]}
  step '后端构建（集成测试使用）' corepack pnpm --filter server-main build
  if [ "${#failed[@]}" = "$built_before" ]; then
    # 与 CI 和 test:integration 一样在后端目录运行：测试从当前目录的 .env.local 读取 DATABASE_URL。
    for test in $(printf '%s\n' "$integration" | grep '^[^#]'); do
      step "后端集成：${test}" corepack pnpm --filter server-main exec node "tests/${test}"
    done
  fi
fi
if changed '^scripts/ci/'; then
  step '检查脚本单测' node --test scripts/ci/*.test.mjs
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
if changed '^(scripts/dev/|scripts/db/|scripts/static/|scripts/content-repo/)'; then
  step '开发启动器与静态发布脚本单测' corepack pnpm test:dev
fi

# 完整浏览器回归由 CI（8 片并行）与 Release 门禁负责；本地默认只跑改动涉及的 spec，避免重复等待。
if [ "$run_e2e" = full ]; then
  step '浏览器回归（全量）' corepack pnpm test:e2e
elif [ "$run_e2e" = 1 ]; then
  # 改动过的 spec，加上改动影响全站外壳或构建产物时的冒烟 spec（规则见 scripts/ci/e2e-specs.mjs）
  selection=$(printf '%s\n' "$files" | node scripts/ci/e2e-specs.mjs)
  printf '%s\n' "$selection" | sed -n 's/^# /提示：/p'
  specs=$(printf '%s\n' "$selection" | grep -v '^#' | tr '\n' ' ' || true)
  specs=${specs% }
  if [ -n "$specs" ]; then
    # shellcheck disable=SC2086
    step "浏览器回归：${specs}" corepack pnpm test:e2e $specs
  elif changed '^(src/|patches/|pnpm-lock\.yaml$)'; then
    printf '\n提示：没有改动 spec。按改动手动跑相关用例：corepack pnpm test:e2e:run <spec>（需先构建两端）；完整回归交给 CI，确需本地全量时用 --e2e-full。\n'
  fi
elif changed '^(src/|patches/|pnpm-lock\.yaml$)'; then
  printf '\n提示：改动涉及应用代码，CI 会跑完整浏览器回归；推送前按改动跑相关 spec：corepack pnpm test:e2e:run <spec>，或加 --e2e 跑改动过的 spec。\n'
fi

if [ "${#failed[@]}" -gt 0 ]; then
  printf '\n未通过：%s\n先修复再推送。\n' "${failed[*]}" >&2
  exit 1
fi
printf '\n本地检查全部通过。\n'
