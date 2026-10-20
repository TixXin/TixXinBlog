#!/usr/bin/env bash
# @file local-trial.sh
# @description 本地构建试装：用当前工作区代码构建镜像与部署包，交给同一个 install.sh / tixxin 安装与升级，
#   只把下载源换成本机目录，不需要发布 Release。只操作项目 tixxin-dev 与本脚本打的 *-dev.* 镜像标签。
#   用法见 help 子命令；目录可用 TIXXIN_TRIAL_DIR 覆盖。
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd -P)
readonly ROOT=$root
readonly REPOSITORY='TixXin/TixXinBlog'
readonly IMAGE_PREFIX='ghcr.io/tixxin/tixxinblog'
readonly PROJECT='tixxin-dev'
readonly HTTP_PORT=9080
readonly HTTPS_PORT=9443
readonly SUBNET='172.31.246.0/24'
readonly TRIAL_DIR=${TIXXIN_TRIAL_DIR:-$HOME/tixxin-blog-dev}
readonly WORK=$ROOT/.artifacts/local-trial
readonly DOWNLOAD=$WORK/download

ASSUME_YES=0
FROM_RELEASE=''

info() { printf '%s\n' "$*"; }
step() { printf '\n[trial] %s\n' "$*"; }
fail() {
  printf '[trial] 失败：%s\n' "$*" >&2
  exit 1
}

usage() {
  cat << EOF
本地构建试装：用当前代码体验一键安装、升级与备份，不需要发布 Release。

用法：corepack pnpm trial[:update|:status|:down] [选项]
      bash scripts/release/local-trial.sh <子命令> [选项]

子命令：
  install [--yes] [--from-release <版本>]
        构建当前代码并交互运行 install.sh；--yes 使用默认回答。
        --from-release 改为下载该版本官方 install.sh（校验 SHA256SUMS）并用官方镜像安装，
        之后可用 update 体验「从正式版升级到当前代码」。
  update [--yes]
        重新构建当前代码，用试装站点的 tixxin update 升级到新的开发版本（先备份、迁移、验收）。
  status
        显示试装站点状态与当前开发版本。
  down [--yes]
        一键删除试装站点与全部数据：容器、数据卷、网络、目录、本机下载目录与本脚本打的开发镜像标签。

约定：目录 ${TRIAL_DIR}，项目 ${PROJECT}，https://localhost:${HTTPS_PORT}（HTTP ${HTTP_PORT}），
      内部子网 ${SUBNET}；与官方试用（~/tixxin-blog、8443）互不干扰。
      开发版本形如 <版本>-dev.<提交号>.<UTC 时间>，有未提交改动时带 .dirty。
EOF
}

confirm() {
  [ "$ASSUME_YES" = 1 ] && return 0
  local answer
  printf '%s [y/N]: ' "$1"
  IFS= read -r answer || answer=''
  case $answer in y | Y | yes | YES) return 0 ;; *) return 1 ;; esac
}

parse_options() {
  while [ $# -gt 0 ]; do
    case $1 in
      --yes | -y) ASSUME_YES=1 ;;
      --from-release)
        [ $# -ge 2 ] && [ -n "$2" ] || fail '--from-release 需要版本号，例如 0.3.0'
        FROM_RELEASE=${2#v}
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *) fail "未知选项 $1" ;;
    esac
    shift
  done
}

require_tools() {
  local tool
  for tool in docker git curl; do
    command -v "$tool" > /dev/null 2>&1 || fail "缺少命令 $tool"
  done
  docker info > /dev/null 2>&1 || fail 'Docker 未运行，请先启动 Docker Desktop 或 Docker Engine'
}

env_value() {
  awk -v key="$1" 'index($0, key "=") == 1 { value = substr($0, length(key) + 2) } END { print value }' "$TRIAL_DIR/.env"
}

# 只认本脚本创建的试装站点：本机试用模式且项目名为 tixxin-dev。
require_trial_site() {
  [ -f "$TRIAL_DIR/.env" ] || fail "$TRIAL_DIR 没有试装站点；请先运行 corepack pnpm trial"
  [ "$(env_value TIXXIN_MODE)" = local ] && [ "$(env_value RELEASE_PROJECT)" = "$PROJECT" ] ||
    fail "$TRIAL_DIR 不是本脚本创建的试装站点（需要 TIXXIN_MODE=local 且 RELEASE_PROJECT=${PROJECT}），拒绝操作"
}

dev_version() {
  local base commit suffix=''
  base=$(sed -n 's/^  "version": "\(.*\)",$/\1/p' "$ROOT/package.json" | head -n 1)
  commit=$(git -C "$ROOT" rev-parse --short=8 HEAD)
  [ -z "$(git -C "$ROOT" status --porcelain)" ] || suffix='.dirty'
  printf '%s-dev.%s.%s%s' "$base" "$commit" "$(date -u +%Y%m%dT%H%M%S)" "$suffix"
}

# 串行构建四个镜像并按官方镜像名打本机标签；依赖镜像本机缺失时才拉取。
build_images() {
  local version=$1 image
  step "构建镜像 ${IMAGE_PREFIX}-*:${version}（首次约 10–15 分钟，之后使用缓存）"
  docker build -t "$IMAGE_PREFIX-web:$version" "$ROOT"
  docker build -f "$ROOT/src/backend/server-main/Dockerfile" -t "$IMAGE_PREFIX-api:$version" "$ROOT"
  docker build -f "$ROOT/src/backend/server-main/Dockerfile" --target migration -t "$IMAGE_PREFIX-migration:$version" "$ROOT"
  docker build -f "$ROOT/src/backend/server-main/Dockerfile" --target worker -t "$IMAGE_PREFIX-worker:$version" "$ROOT"
  grep -E '^(POSTGRES_IMAGE|CADDY_IMAGE)=' "$ROOT/deploy/production.env.example" | cut -d= -f2- | while read -r image; do
    docker image inspect "$image" > /dev/null 2>&1 || docker pull --quiet "$image" > /dev/null
  done
}

package() {
  local version=$1
  step "生成部署包 ${DOWNLOAD}/v${version}"
  bash "$ROOT/scripts/release/package-deploy.sh" --version "$version" --repository "$REPOSITORY" \
    --image-prefix "$IMAGE_PREFIX" --output "$DOWNLOAD/v$version" > /dev/null
}

cmd_install() {
  # macOS 自带 bash 3.2：不用 mapfile，数组展开均带空值保护。
  local version
  local args=(--local --dir "$TRIAL_DIR" --project "$PROJECT" --http-port "$HTTP_PORT" --https-port "$HTTPS_PORT" --subnet "$SUBNET")
  [ ! -e "$TRIAL_DIR/.env" ] || fail "$TRIAL_DIR 已有试装站点；升级用 corepack pnpm trial:update，重装前先 corepack pnpm trial:down"
  [ "$ASSUME_YES" = 0 ] || args+=(--yes)
  if [ -n "$FROM_RELEASE" ]; then
    local release_dir=$WORK/release-v$FROM_RELEASE base="https://github.com/$REPOSITORY/releases/download/v$FROM_RELEASE"
    step "下载官方 v${FROM_RELEASE} 的 install.sh 并校验"
    rm -rf "$release_dir"
    mkdir -p "$release_dir"
    curl -fsSL --proto '=https' "$base/install.sh" -o "$release_dir/install.sh" || fail "无法下载 v${FROM_RELEASE} 的 install.sh"
    curl -fsSL --proto '=https' "$base/SHA256SUMS" -o "$release_dir/SHA256SUMS" || fail "无法下载 v${FROM_RELEASE} 的 SHA256SUMS"
    local expected actual
    expected=$(awk '$2 == "install.sh" { print $1 }' "$release_dir/SHA256SUMS")
    if command -v sha256sum > /dev/null 2>&1; then actual=$(sha256sum "$release_dir/install.sh" | awk '{ print $1 }'); else actual=$(shasum -a 256 "$release_dir/install.sh" | awk '{ print $1 }'); fi
    [ -n "$expected" ] && [ "$expected" = "$actual" ] || fail 'install.sh 与 SHA256SUMS 不一致'
    step "安装官方 v${FROM_RELEASE} 到 ${TRIAL_DIR}"
    bash "$release_dir/install.sh" "${args[@]}" --version "$FROM_RELEASE" || install_failed
    info ''
    info "已安装官方 v${FROM_RELEASE}。改完代码后运行 corepack pnpm trial:update 升级到当前代码。"
    trial_hints
    return 0
  fi
  version=$(dev_version)
  build_images "$version"
  package "$version"
  step "安装开发版本 ${version} 到 ${TRIAL_DIR}"
  bash "$DOWNLOAD/v$version/install.sh" "${args[@]}" --version "$version" --download-base "file://$DOWNLOAD" --no-pull || install_failed
  trial_hints
}

# install.sh 只提示 tixxin 子命令；试装站点另有 trial 系列命令，尤其要让人知道如何一键删除。
trial_hints() {
  info ''
  info '试装管理：corepack pnpm trial:update（升级到当前代码）| trial:status | trial:down（删除试装站点与全部数据）'
}

install_failed() {
  local code=$?
  info '' >&2
  info '[trial] 安装未完成；确认不需要保留现场后，可用 corepack pnpm trial:down 删除试装站点与全部数据后重装。' >&2
  exit "$code"
}

cmd_update() {
  local version args
  require_trial_site
  version=$(dev_version)
  build_images "$version"
  package "$version"
  # 试装站点可能来自官方 Release；改为本机下载源后，tixxin update 才能取到本地部署包。
  step "升级试装站点到 ${version}"
  set_env TIXXIN_DOWNLOAD_BASE "file://$DOWNLOAD"
  args=(update "$version" --no-pull)
  [ "$ASSUME_YES" = 0 ] || args+=(--yes)
  TIXXIN_DIR=$TRIAL_DIR "$TRIAL_DIR/deploy/tixxin" "${args[@]}"
}

# 原子改写试装站点 .env 的单个键，保持 600 权限。
set_env() {
  local key=$1 value=$2 temp
  temp=$(umask 077 && mktemp "$TRIAL_DIR/.env.XXXXXX")
  awk -v key="$key" -v value="$value" '
    index($0, key "=") == 1 { if (!done) print key "=" value; done = 1; next }
    { print }
    END { if (!done) print key "=" value }
  ' "$TRIAL_DIR/.env" > "$temp"
  chmod 600 "$temp"
  mv "$temp" "$TRIAL_DIR/.env"
}

cmd_status() {
  require_trial_site
  TIXXIN_DIR=$TRIAL_DIR "$TRIAL_DIR/deploy/tixxin" status
  local version
  version=$(env_value RELEASE_VERSION)
  case $version in
    *-dev.*)
      local commit=${version#*-dev.}
      info "开发版本：${version}（提交 ${commit%%.*}）"
      ;;
    *) info "官方版本：${version}" ;;
  esac
}

cmd_down() {
  local id tag
  if [ -e "$TRIAL_DIR" ]; then
    require_trial_site
    confirm "将删除试装站点 ${TRIAL_DIR}（项目 ${PROJECT}）的容器、数据卷与目录，确认？" || fail '已取消'
    step '停止并删除试装站点'
    (cd "$TRIAL_DIR" && docker compose --profile worker --profile maintenance down -v --remove-orphans)
    rm -rf "$TRIAL_DIR"
  fi
  # 只按项目标签清理残留，不触碰其他项目。
  docker ps -aq --filter "label=com.docker.compose.project=$PROJECT" | while read -r id; do docker rm -f "$id" > /dev/null; done
  docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" | while read -r id; do docker volume rm "$id" > /dev/null; done
  docker network ls -q --filter "label=com.docker.compose.project=$PROJECT" | while read -r id; do docker network rm "$id" > /dev/null; done
  docker image ls --format '{{.Repository}}:{{.Tag}}' | { grep -E "^${IMAGE_PREFIX}-(web|api|migration|worker):.+-dev\..+" || true; } |
    while read -r tag; do docker rmi "$tag" > /dev/null || true; done
  rm -rf "$WORK"
  step '试装已清理'
}

main() {
  local command=${1:-help}
  [ $# -eq 0 ] || shift
  parse_options "$@"
  case $command in
    install)
      require_tools
      cmd_install
      ;;
    update)
      require_tools
      cmd_update
      ;;
    status) cmd_status ;;
    down)
      require_tools
      cmd_down
      ;;
    help | -h | --help) usage ;;
    *) fail "未知子命令 ${command}；运行 bash scripts/release/local-trial.sh help 查看用法" ;;
  esac
}

main "$@"
